#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal,
};

/// Bóveda de prueba con la misma forma de autorización que DeFindex:
/// `deposit` exige `from.require_auth()` y mueve el activo con `transfer(from → vault)`.
/// El precio de la share sube si se le acuña activo directo (rendimiento) y baja con `skim` (pérdida).
mod mock_vault {
    use soroban_sdk::{contract, contractimpl, contracttype, token, vec, Address, Env, Vec};

    #[contracttype]
    enum Key {
        Asset,
        Supply,
        Bal(Address),
    }

    #[contract]
    pub struct MockVault;

    fn total_assets(e: &Env) -> i128 {
        let asset: Address = e.storage().instance().get(&Key::Asset).unwrap();
        token::TokenClient::new(e, &asset).balance(&e.current_contract_address())
    }
    fn supply(e: &Env) -> i128 {
        e.storage().instance().get(&Key::Supply).unwrap_or(0)
    }

    #[contractimpl]
    impl MockVault {
        pub fn __constructor(e: Env, asset: Address) {
            e.storage().instance().set(&Key::Asset, &asset);
        }

        pub fn deposit(
            e: Env,
            amounts_desired: Vec<i128>,
            _amounts_min: Vec<i128>,
            from: Address,
            _invest: bool,
        ) -> (Vec<i128>, i128, Option<Vec<i128>>) {
            from.require_auth();
            let amount = amounts_desired.get(0).unwrap();
            let (sup, assets) = (supply(&e), total_assets(&e));
            let shares = if sup == 0 { amount } else { amount * sup / assets };
            let asset: Address = e.storage().instance().get(&Key::Asset).unwrap();
            token::TokenClient::new(&e, &asset).transfer(&from, &e.current_contract_address(), &amount);
            let bal: i128 = e.storage().instance().get(&Key::Bal(from.clone())).unwrap_or(0);
            e.storage().instance().set(&Key::Bal(from), &(bal + shares));
            e.storage().instance().set(&Key::Supply, &(sup + shares));
            (vec![&e, amount], shares, None)
        }

        pub fn withdraw(e: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128> {
            from.require_auth();
            let out = Self::get_asset_amounts_per_shares(e.clone(), df_amount).get(0).unwrap();
            assert!(out >= min_amounts_out.get(0).unwrap_or(0), "slippage");
            let bal: i128 = e.storage().instance().get(&Key::Bal(from.clone())).unwrap_or(0);
            assert!(bal >= df_amount, "shares");
            e.storage().instance().set(&Key::Bal(from.clone()), &(bal - df_amount));
            e.storage().instance().set(&Key::Supply, &(supply(&e) - df_amount));
            let asset: Address = e.storage().instance().get(&Key::Asset).unwrap();
            token::TokenClient::new(&e, &asset).transfer(&e.current_contract_address(), &from, &out);
            vec![&e, out]
        }

        pub fn get_asset_amounts_per_shares(e: Env, vault_shares: i128) -> Vec<i128> {
            let sup = supply(&e);
            let v = if sup == 0 { 0 } else { vault_shares * total_assets(&e) / sup };
            vec![&e, v]
        }

        pub fn balance(e: Env, id: Address) -> i128 {
            e.storage().instance().get(&Key::Bal(id)).unwrap_or(0)
        }

        /// Simula una pérdida de la bóveda.
        pub fn skim(e: Env, to: Address, amount: i128) {
            let asset: Address = e.storage().instance().get(&Key::Asset).unwrap();
            token::TokenClient::new(&e, &asset).transfer(&e.current_contract_address(), &to, &amount);
        }
    }
}
use mock_vault::{MockVault, MockVaultClient};

const U: i128 = 10_000_000; // 1 unidad con 7 decimales
const YEAR: u64 = 31_536_000;

struct Setup<'a> {
    env: Env,
    admin: Address,
    user: Address,
    asset: Address,
    vault: Address,
    lock: SeyfLockClient<'a>,
    token: TokenClient<'a>,
    sac: StellarAssetClient<'a>,
    vault_client: MockVaultClient<'a>,
}

fn params() -> Params {
    Params {
        apy_bps: 800,
        advance_bps: 9_000,
        min_term_secs: 30 * 24 * 3600,
        max_term_secs: 2 * YEAR,
        cap_per_lock: 50_000 * U,
        cap_total: 100_000 * U,
    }
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let sac_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let asset = sac_contract.address();
    let vault = env.register(MockVault, (asset.clone(),));
    let lock_id = env.register(SeyfLock, (admin.clone(), vault.clone(), asset.clone(), params()));
    let sac = StellarAssetClient::new(&env, &asset);
    sac.mint(&user, &(20_000 * U));
    sac.mint(&admin, &(10_000 * U));
    let lock = SeyfLockClient::new(&env, &lock_id);
    lock.fund_pool(&admin, &(5_000 * U));
    Setup {
        token: TokenClient::new(&env, &asset),
        vault_client: MockVaultClient::new(&env, &vault),
        env,
        admin,
        user,
        asset,
        vault,
        lock,
        sac,
    }
}

/// Simula rendimiento: acuña activo directo a la bóveda.
fn add_yield(s: &Setup, amount: i128) {
    s.sac.mint(&s.vault, &amount);
}

#[test]
fn quote_is_capital_times_apy_times_term_times_advance() {
    let s = setup();
    // 10,000 × 8% × 1 año × 90% = 720
    assert_eq!(s.lock.quote(&(10_000 * U), &YEAR), 720 * U);
    // medio año → 360
    assert_eq!(s.lock.quote(&(10_000 * U), &(YEAR / 2)), 360 * U);
}

#[test]
fn lock_deposits_into_vault_and_pays_advance() {
    let s = setup();
    let lock = s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    assert_eq!(lock.principal, 10_000 * U);
    assert_eq!(lock.advance, 720 * U);
    assert_eq!(lock.unlock_at, 1_000_000 + YEAR);
    // usuario: 20,000 − 10,000 + 720
    assert_eq!(s.token.balance(&s.user), 10_720 * U);
    // el capital vive en la bóveda como shares a nombre del contrato
    assert_eq!(s.vault_client.balance(&s.lock.address), lock.shares);
    assert_eq!(s.token.balance(&s.vault), 10_000 * U);
    // pool: 5,000 − 720
    assert_eq!(s.lock.pool_balance(), 4_280 * U);
    assert_eq!(s.lock.total_principal(), 10_000 * U);
}

/// Sin mock_all_auths: solo el usuario firma `lock` + su transfer. La transferencia
/// que la bóveda hace desde el contrato debe salir de `authorize_as_current_contract`.
#[test]
fn lock_works_with_only_user_signature() {
    let s = setup();
    let env = &s.env;
    env.set_auths(&[]);
    let amount = 1_000 * U;
    env.mock_auths(&[MockAuth {
        address: &s.user,
        invoke: &MockAuthInvoke {
            contract: &s.lock.address,
            fn_name: "lock",
            args: (&s.user, amount, YEAR, 0i128).into_val(env),
            sub_invokes: &[MockAuthInvoke {
                contract: &s.asset,
                fn_name: "transfer",
                args: (&s.user, &s.lock.address, amount).into_val(env),
                sub_invokes: &[],
            }],
        },
    }]);
    let lock = s.lock.lock(&s.user, &amount, &YEAR, &0);
    assert_eq!(lock.advance, 72 * U);
}

#[test]
fn settle_at_maturity_returns_capital_and_keeps_yield_in_pool() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    add_yield(&s, 1_000 * U); // la bóveda rindió 10%
    s.env.ledger().set_timestamp(1_000_000 + YEAR);
    let anyone = Address::generate(&s.env);
    let _ = anyone; // settle no exige firma de nadie
    let out = s.lock.settle(&s.user, &0);
    assert_eq!(out, 10_000 * U);
    assert_eq!(s.token.balance(&s.user), 20_720 * U);
    // pool: 4,280 + 1,000 de rendimiento
    assert_eq!(s.lock.pool_balance(), 5_280 * U);
    assert!(s.lock.position(&s.user).is_none());
    assert_eq!(s.lock.total_principal(), 0);
}

#[test]
fn treasury_absorbs_shortfall_when_yield_is_below_advance() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    add_yield(&s, 200 * U); // solo 2% vs 720 adelantados
    s.env.ledger().set_timestamp(1_000_000 + YEAR + 1);
    s.lock.settle(&s.user, &0);
    // el usuario recibe su capital completo; no debe nada
    assert_eq!(s.token.balance(&s.user), 20_720 * U);
    // pool: 4,280 + 200 → absorbió 520
    assert_eq!(s.lock.pool_balance(), 4_480 * U);
}

#[test]
fn early_exit_returns_accrued_yield_and_charges_the_rest() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    add_yield(&s, 400 * U);
    s.env.ledger().set_timestamp(1_000_000 + YEAR / 2);
    let pos = s.lock.position(&s.user).unwrap();
    assert_eq!(pos.accrued_yield, 400 * U);
    assert_eq!(pos.owed_now, 320 * U); // 720 − 400
    let out = s.lock.unlock(&s.user, &0);
    assert_eq!(out, 10_000 * U);
    // 10,720 − 320 + 10,000
    assert_eq!(s.token.balance(&s.user), 20_400 * U);
    // pool: 4,280 + 320 pagados + 400 de rendimiento
    assert_eq!(s.lock.pool_balance(), 5_000 * U);
}

#[test]
fn early_exit_without_yield_repays_full_advance() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    s.env.ledger().set_timestamp(1_000_000 + 10);
    assert_eq!(s.lock.position(&s.user).unwrap().owed_now, 720 * U);
    s.lock.unlock(&s.user, &0);
    assert_eq!(s.token.balance(&s.user), 20_000 * U);
    assert_eq!(s.lock.pool_balance(), 5_000 * U);
}

#[test]
fn vault_loss_is_borne_by_user_capital() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    let sink = Address::generate(&s.env);
    s.vault_client.skim(&sink, &(500 * U));
    s.env.ledger().set_timestamp(1_000_000 + YEAR);
    let out = s.lock.settle(&s.user, &0);
    assert_eq!(out, 9_500 * U);
    assert_eq!(s.lock.pool_balance(), 4_280 * U);
}

#[test]
fn settle_before_maturity_fails() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    assert_eq!(s.lock.try_settle(&s.user, &0), Err(Ok(Error::NotMatured)));
}

#[test]
fn one_lock_per_user() {
    let s = setup();
    s.lock.lock(&s.user, &(1_000 * U), &YEAR, &0);
    assert_eq!(s.lock.try_lock(&s.user, &(1_000 * U), &YEAR, &0), Err(Ok(Error::LockExists)));
}

#[test]
fn rejects_bad_term_caps_and_empty_pool() {
    let s = setup();
    assert_eq!(s.lock.try_lock(&s.user, &(1_000 * U), &10, &0), Err(Ok(Error::InvalidTerm)));
    assert_eq!(s.lock.try_lock(&s.user, &(1_000 * U), &(3 * YEAR), &0), Err(Ok(Error::InvalidTerm)));
    s.sac.mint(&s.user, &(60_000 * U));
    assert_eq!(s.lock.try_lock(&s.user, &(60_000 * U), &YEAR, &0), Err(Ok(Error::CapExceeded)));
    s.lock.withdraw_pool(&s.admin, &(5_000 * U));
    assert_eq!(s.lock.try_lock(&s.user, &(1_000 * U), &YEAR, &0), Err(Ok(Error::InsufficientPool)));
}

#[test]
fn slippage_guard_on_shares() {
    let s = setup();
    assert_eq!(
        s.lock.try_lock(&s.user, &(1_000 * U), &YEAR, &(1_001 * U)),
        Err(Ok(Error::Slippage))
    );
}

#[test]
fn pause_blocks_new_locks_but_never_exits() {
    let s = setup();
    s.lock.lock(&s.user, &(1_000 * U), &YEAR, &0);
    s.lock.set_paused(&true);
    let other = Address::generate(&s.env);
    s.sac.mint(&other, &(1_000 * U));
    assert_eq!(s.lock.try_lock(&other, &(1_000 * U), &YEAR, &0), Err(Ok(Error::Paused)));
    s.lock.unlock(&s.user, &0);
    assert!(s.lock.position(&s.user).is_none());
}

#[test]
fn withdraw_pool_cannot_touch_locked_capital() {
    let s = setup();
    s.lock.lock(&s.user, &(10_000 * U), &YEAR, &0);
    // pool libre = 4,280; el capital está en shares
    assert_eq!(
        s.lock.try_withdraw_pool(&s.admin, &(4_281 * U)),
        Err(Ok(Error::InsufficientPool))
    );
    s.lock.withdraw_pool(&s.admin, &(4_280 * U));
    s.env.ledger().set_timestamp(1_000_000 + YEAR);
    assert_eq!(s.lock.settle(&s.user, &0), 10_000 * U);
}

#[test]
fn unlock_requires_the_user_signature() {
    let s = setup();
    s.lock.lock(&s.user, &(1_000 * U), &YEAR, &0);
    s.env.set_auths(&[]);
    assert!(s.lock.try_unlock(&s.user, &0).is_err());
}

#[test]
fn invalid_params_rejected() {
    let s = setup();
    let mut p = params();
    p.apy_bps = 0;
    assert_eq!(s.lock.try_set_params(&p), Err(Ok(Error::InvalidParams)));
    let mut p = params();
    p.advance_bps = 10_001;
    assert_eq!(s.lock.try_set_params(&p), Err(Ok(Error::InvalidParams)));
}
