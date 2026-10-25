#![no_std]
//! SeyfLock — el capital del usuario se bloquea dentro de una bóveda DeFindex
//! por un plazo fijo y SEYF le adelanta hoy el rendimiento futuro.
//!
//! Modelo (docs/hackmeridian-plan.md §SeyfLock):
//! - `lock`: el contrato deposita el capital en la bóveda a su nombre (las shares
//!   siguen rindiendo) y paga el adelanto desde su pool:
//!   `adelanto = capital × APY × plazo × advance_bps`.
//! - Al vencer (`settle`, lo puede llamar cualquiera): el usuario recibe su
//!   capital; TODO el rendimiento va al pool. Si el rendimiento fue menor que el
//!   adelanto, el pool (tesorería SEYF) absorbe la diferencia.
//! - Salida anticipada (`unlock` antes de `unlock_at`): el rendimiento generado
//!   hasta hoy regresa al pool y el usuario paga lo que falte del adelanto
//!   (`adelanto − rendimiento`, mínimo 0). Recibe su capital completo.
//!
//! El pool es el saldo libre del activo en este contrato: los capitales
//! bloqueados viven como shares de la bóveda, nunca como saldo del activo, así
//! que `withdraw_pool` no puede tocarlos. `unlock`/`settle` funcionan aunque el
//! contrato esté en pausa: la pausa solo frena bloqueos nuevos.

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token,
    vec, Address, BytesN, Env, IntoVal, Symbol, TryFromVal, Val, Vec,
};

const BPS: i128 = 10_000;
const YEAR_SECS: i128 = 31_536_000;
/// Tope de seguridad: el adelanto nunca excede el 90% del capital (igual que SeyfAdvance.sol).
const MAX_LTV_BPS: i128 = 9_000;
const MAX_APY_BPS: u32 = 5_000;
const MAX_TERM_SECS: u64 = 5 * 31_536_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidParams = 1,
    InvalidAmount = 2,
    InvalidTerm = 3,
    Paused = 4,
    LockExists = 5,
    NoLock = 6,
    NotMatured = 7,
    CapExceeded = 8,
    InsufficientPool = 9,
    Slippage = 10,
    Overflow = 11,
    VaultMismatch = 12,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Params {
    /// APY estimado de la bóveda, en bps (800 = 8%).
    pub apy_bps: u32,
    /// Fracción del rendimiento proyectado que se adelanta, en bps (9000 = 90%).
    pub advance_bps: u32,
    pub min_term_secs: u64,
    pub max_term_secs: u64,
    /// Tope de capital por bloqueo y total (unidades del activo). Beta sin auditoría.
    pub cap_per_lock: i128,
    pub cap_total: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Lock {
    pub shares: i128,
    pub principal: i128,
    pub advance: i128,
    pub start: u64,
    pub unlock_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub lock: Lock,
    /// Valor actual de las shares en el activo subyacente.
    pub value: i128,
    /// Rendimiento generado hasta hoy (`value − principal`, mínimo 0).
    pub accrued_yield: i128,
    /// Lo que el usuario pagaría por salir hoy (0 si ya venció).
    pub owed_now: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Vault,
    Asset,
    Params,
    Paused,
    TotalPrincipal,
    Lock(Address),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Locked {
    #[topic]
    pub user: Address,
    pub principal: i128,
    pub shares: i128,
    pub advance: i128,
    pub unlock_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Released {
    #[topic]
    pub user: Address,
    pub early: bool,
    pub to_user: i128,
    pub to_pool: i128,
    pub repaid: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolFunded {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

/// Lo mínimo de la bóveda DeFindex que usa SeyfLock
/// (defindex-io/stellar-contracts, vault/src/interface.rs). `deposit` se llama
/// con `invoke_contract` porque su tercer valor de retorno trae tipos propios
/// de DeFindex que aquí no necesitamos decodificar.
#[allow(dead_code)]
#[contractclient(name = "VaultClient")]
pub trait VaultInterface {
    fn withdraw(e: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128>;
    fn get_asset_amounts_per_shares(e: Env, vault_shares: i128) -> Vec<i128>;
}

#[contract]
pub struct SeyfLock;

#[contractimpl]
impl SeyfLock {
    pub fn __constructor(env: Env, admin: Address, vault: Address, asset: Address, params: Params) {
        if validate_params(&params).is_err() {
            soroban_sdk::panic_with_error!(&env, Error::InvalidParams);
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Vault, &vault);
        s.set(&DataKey::Asset, &asset);
        s.set(&DataKey::Params, &params);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::TotalPrincipal, &0i128);
    }

    // ---------------------------------------------------------------- usuario

    /// Bloquea `amount` del activo por `term_secs` y entrega el adelanto.
    /// `min_shares` protege contra un precio de share peor al esperado.
    pub fn lock(env: Env, user: Address, amount: i128, term_secs: u64, min_shares: i128) -> Result<Lock, Error> {
        user.require_auth();
        bump_instance(&env);
        if read_paused(&env) {
            return Err(Error::Paused);
        }
        let params = read_params(&env);
        if amount <= 0 || min_shares < 0 {
            return Err(Error::InvalidAmount);
        }
        if term_secs < params.min_term_secs || term_secs > params.max_term_secs {
            return Err(Error::InvalidTerm);
        }
        if amount > params.cap_per_lock {
            return Err(Error::CapExceeded);
        }
        let key = DataKey::Lock(user.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::LockExists);
        }
        let total = read_total(&env);
        let new_total = total.checked_add(amount).ok_or(Error::Overflow)?;
        if new_total > params.cap_total {
            return Err(Error::CapExceeded);
        }

        let advance = quote_advance(&params, amount, term_secs)?;
        if advance <= 0 {
            return Err(Error::InvalidAmount);
        }
        let asset = read_asset(&env);
        let vault = read_vault(&env);
        let this = env.current_contract_address();
        let asset_client = token::TokenClient::new(&env, &asset);
        if asset_client.balance(&this) < advance {
            return Err(Error::InsufficientPool);
        }

        // 1. El capital entra al contrato (autorizado por el usuario dentro de `lock`).
        asset_client.transfer(&user, &this, &amount);

        // 2. El contrato deposita en la bóveda a su nombre. La bóveda mueve el
        //    activo desde este contrato, así que pre-autorizamos esa transferencia.
        let shares_client = token::TokenClient::new(&env, &vault);
        let shares_before = shares_client.balance(&this);
        env.authorize_as_current_contract(vec![
            &env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: asset.clone(),
                    fn_name: Symbol::new(&env, "transfer"),
                    args: (this.clone(), vault.clone(), amount).into_val(&env),
                },
                sub_invocations: vec![&env],
            }),
        ]);
        let deposited = vault_deposit(&env, &vault, amount, &this)?;
        if deposited != amount {
            return Err(Error::VaultMismatch);
        }
        let shares = shares_client
            .balance(&this)
            .checked_sub(shares_before)
            .ok_or(Error::Overflow)?;
        if shares <= 0 || shares < min_shares {
            return Err(Error::Slippage);
        }

        // 3. Adelanto desde el pool.
        asset_client.transfer(&this, &user, &advance);

        let now = env.ledger().timestamp();
        let lock = Lock {
            shares,
            principal: amount,
            advance,
            start: now,
            unlock_at: now + term_secs,
        };
        env.storage().persistent().set(&key, &lock);
        bump_lock(&env, &key);
        env.storage().instance().set(&DataKey::TotalPrincipal, &new_total);

        Locked {
            user,
            principal: amount,
            shares,
            advance,
            unlock_at: lock.unlock_at,
        }
        .publish(&env);
        Ok(lock)
    }

    /// Libera el capital. Antes del vencimiento cobra `adelanto − rendimiento`
    /// (mínimo 0) al usuario. Funciona aunque el contrato esté en pausa.
    /// `min_out` protege el monto que devuelve la bóveda.
    pub fn unlock(env: Env, user: Address, min_out: i128) -> Result<i128, Error> {
        user.require_auth();
        close(&env, user, min_out, true)
    }

    /// Cierra un bloqueo vencido. Lo puede llamar cualquiera (cron/keeper):
    /// el capital va al usuario, el rendimiento al pool.
    pub fn settle(env: Env, user: Address, min_out: i128) -> Result<i128, Error> {
        close(&env, user, min_out, false)
    }

    /// Extiende la vida (TTL) del bloqueo. Cualquiera puede llamarlo.
    pub fn bump(env: Env, user: Address) -> Result<(), Error> {
        bump_instance(&env);
        let key = DataKey::Lock(user);
        if !env.storage().persistent().has(&key) {
            return Err(Error::NoLock);
        }
        bump_lock(&env, &key);
        Ok(())
    }

    // --------------------------------------------------------------- lectura

    pub fn quote(env: Env, amount: i128, term_secs: u64) -> Result<i128, Error> {
        let params = read_params(&env);
        if term_secs < params.min_term_secs || term_secs > params.max_term_secs {
            return Err(Error::InvalidTerm);
        }
        quote_advance(&params, amount, term_secs)
    }

    pub fn position(env: Env, user: Address) -> Option<Position> {
        let lock: Lock = env.storage().persistent().get(&DataKey::Lock(user))?;
        let value = share_value(&env, &read_vault(&env), lock.shares);
        let accrued_yield = (value - lock.principal).max(0);
        let owed_now = if env.ledger().timestamp() >= lock.unlock_at {
            0
        } else {
            (lock.advance - accrued_yield).max(0)
        };
        Some(Position {
            lock,
            value,
            accrued_yield,
            owed_now,
        })
    }

    pub fn pool_balance(env: Env) -> i128 {
        token::TokenClient::new(&env, &read_asset(&env)).balance(&env.current_contract_address())
    }

    pub fn total_principal(env: Env) -> i128 {
        read_total(&env)
    }

    pub fn params(env: Env) -> Params {
        read_params(&env)
    }

    pub fn config(env: Env) -> (Address, Address, Address, bool) {
        (read_admin(&env), read_vault(&env), read_asset(&env), read_paused(&env))
    }

    // ------------------------------------------------------- tesorería / admin

    /// Fondea el pool de adelantos (cualquiera puede aportar).
    pub fn fund_pool(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        bump_instance(&env);
        token::TokenClient::new(&env, &read_asset(&env)).transfer(&from, &env.current_contract_address(), &amount);
        PoolFunded { from, amount }.publish(&env);
        Ok(())
    }

    /// Retira del pool. Solo toca saldo libre: los capitales bloqueados son shares.
    pub fn withdraw_pool(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        read_admin(&env).require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let asset_client = token::TokenClient::new(&env, &read_asset(&env));
        let this = env.current_contract_address();
        if asset_client.balance(&this) < amount {
            return Err(Error::InsufficientPool);
        }
        asset_client.transfer(&this, &to, &amount);
        Ok(())
    }

    /// Cambia los parámetros para bloqueos NUEVOS; los existentes conservan sus términos.
    pub fn set_params(env: Env, params: Params) -> Result<(), Error> {
        read_admin(&env).require_auth();
        validate_params(&params)?;
        env.storage().instance().set(&DataKey::Params, &params);
        bump_instance(&env);
        Ok(())
    }

    pub fn set_paused(env: Env, paused: bool) {
        read_admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        bump_instance(&env);
    }

    /// Cambio de admin: firman el actual y el nuevo (evita transferir a una llave perdida).
    pub fn set_admin(env: Env, new_admin: Address) {
        read_admin(&env).require_auth();
        new_admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
    }

    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        read_admin(&env).require_auth();
        env.deployer()
            .update_current_contract(soroban_sdk::ContractExecutable::Wasm(wasm_hash));
    }
}

// ---------------------------------------------------------------- internos

fn close(env: &Env, user: Address, min_out: i128, by_user: bool) -> Result<i128, Error> {
    bump_instance(env);
    let key = DataKey::Lock(user.clone());
    let lock: Lock = env.storage().persistent().get(&key).ok_or(Error::NoLock)?;
    let now = env.ledger().timestamp();
    let early = now < lock.unlock_at;
    if early && !by_user {
        return Err(Error::NotMatured);
    }

    let asset = read_asset(env);
    let vault = read_vault(env);
    let this = env.current_contract_address();
    let asset_client = token::TokenClient::new(env, &asset);

    // Salida anticipada: el rendimiento generado regresa al pool y el usuario
    // cubre lo que falte del adelanto.
    let mut repaid = 0i128;
    if early {
        let value = share_value(env, &vault, lock.shares);
        let accrued = (value - lock.principal).max(0);
        repaid = (lock.advance - accrued).max(0);
        if repaid > 0 {
            asset_client.transfer(&user, &this, &repaid);
        }
    }

    // Efectos antes de mover fondos de la bóveda.
    env.storage().persistent().remove(&key);
    let total = read_total(env) - lock.principal;
    env.storage().instance().set(&DataKey::TotalPrincipal, &total.max(0));

    let out = VaultClient::new(env, &vault).withdraw(&lock.shares, &vec![env, min_out], &this);
    let withdrawn = out.get(0).unwrap_or(0);
    if withdrawn < min_out {
        return Err(Error::Slippage);
    }
    // El usuario recupera su capital (o todo lo que quede si la bóveda perdió valor);
    // el excedente —el rendimiento— se queda en el pool.
    let to_user = withdrawn.min(lock.principal);
    let to_pool = withdrawn - to_user;
    if to_user > 0 {
        asset_client.transfer(&this, &user, &to_user);
    }

    Released {
        user,
        early,
        to_user,
        to_pool,
        repaid,
    }
    .publish(env);
    Ok(to_user)
}

fn vault_deposit(env: &Env, vault: &Address, amount: i128, from: &Address) -> Result<i128, Error> {
    let args: Vec<Val> = vec![
        env,
        vec![env, amount].into_val(env),
        vec![env, amount].into_val(env),
        from.into_val(env),
        true.into_val(env),
    ];
    // Retorno de DeFindex: (Vec<i128> montos, i128 shares, Option<...> asignaciones).
    let ret: Val = env.invoke_contract(vault, &Symbol::new(env, "deposit"), args);
    let tuple = Vec::<Val>::try_from_val(env, &ret).map_err(|_| Error::VaultMismatch)?;
    let amounts_val = tuple.get(0).ok_or(Error::VaultMismatch)?;
    let amounts = Vec::<i128>::try_from_val(env, &amounts_val).map_err(|_| Error::VaultMismatch)?;
    amounts.get(0).ok_or(Error::VaultMismatch)
}

fn share_value(env: &Env, vault: &Address, shares: i128) -> i128 {
    VaultClient::new(env, vault)
        .get_asset_amounts_per_shares(&shares)
        .get(0)
        .unwrap_or(0)
}

fn quote_advance(params: &Params, amount: i128, term_secs: u64) -> Result<i128, Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    // capital × APY × (plazo / año) × advance_bps
    let advance = amount
        .checked_mul(params.apy_bps as i128)
        .and_then(|v| v.checked_mul(term_secs as i128))
        .and_then(|v| v.checked_mul(params.advance_bps as i128))
        .ok_or(Error::Overflow)?
        / (BPS * BPS * YEAR_SECS);
    let ltv_cap = amount.checked_mul(MAX_LTV_BPS).ok_or(Error::Overflow)? / BPS;
    Ok(advance.min(ltv_cap))
}

fn validate_params(p: &Params) -> Result<(), Error> {
    let ok = p.apy_bps > 0
        && p.apy_bps <= MAX_APY_BPS
        && p.advance_bps > 0
        && p.advance_bps as i128 <= BPS
        && p.min_term_secs > 0
        && p.min_term_secs <= p.max_term_secs
        && p.max_term_secs <= MAX_TERM_SECS
        && p.cap_per_lock > 0
        && p.cap_total >= p.cap_per_lock;
    if ok {
        Ok(())
    } else {
        Err(Error::InvalidParams)
    }
}

fn bump_instance(env: &Env) {
    let max = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max / 2, max);
}

fn bump_lock(env: &Env, key: &DataKey) {
    let max = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(key, max / 2, max);
}

fn read_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}
fn read_vault(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Vault).unwrap()
}
fn read_asset(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Asset).unwrap()
}
fn read_params(env: &Env) -> Params {
    env.storage().instance().get(&DataKey::Params).unwrap()
}
fn read_paused(env: &Env) -> bool {
    env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
}
fn read_total(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalPrincipal).unwrap_or(0)
}

#[cfg(test)]
mod test;
