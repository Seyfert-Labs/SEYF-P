//! Bóveda Ship-It (reto exprés de BAF, **solo testnet**).
//!
//! Guarda XLM (vía el SAC nativo) y paga [`PRIZE`] a quien presente el código
//! correcto. El contrato solo conoce `sha256(código)`, nunca el texto.
//!
//! - Sin función de retiro para el admin: los fondos solo salen con el código.
//! - Cada reclamo paga [`PRIZE`] mientras haya saldo; no se cierra tras el
//!   primero, así que se puede recargar con `fund`.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient,
    Address, BytesN, Env, String,
};

/// 5555 XLM en stroops (7 decimales).
pub const PRIZE: i128 = 55_550_000_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// El código presentado no coincide.
    WrongCode = 1,
    /// La bóveda tiene menos de 5555 XLM.
    InsufficientBalance = 2,
    /// `fund` con monto menor o igual a 0.
    InvalidAmount = 3,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Token,
    CodeHash,
}

/// Se emite en cada reclamo exitoso.
#[contractevent(topics = ["claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claimed {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// Se emite en cada depósito.
#[contractevent(topics = ["funded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Funded {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contract]
pub struct ShipItVault;

#[contractimpl]
impl ShipItVault {
    /// `code_hash` = sha256 del código (para el reto: sha256("Ship It")).
    pub fn __constructor(env: Env, admin: Address, token: Address, code_hash: BytesN<32>) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::CodeHash, &code_hash);
    }

    /// Deposita `amount` stroops desde `from`. Cualquiera puede recargar.
    /// Devuelve el saldo nuevo de la bóveda.
    pub fn fund(env: Env, from: Address, amount: i128) -> Result<i128, Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let token = token_client(&env);
        let me = env.current_contract_address();
        token.transfer(&from, &me, &amount);
        Funded { from, amount }.publish(&env);
        extend(&env);
        Ok(token.balance(&me))
    }

    /// Paga [`PRIZE`] a `to` si `sha256(code)` coincide con el hash guardado.
    pub fn claim(env: Env, to: Address, code: String) -> Result<i128, Error> {
        to.require_auth();
        let expected: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::CodeHash)
            .unwrap();
        let got: BytesN<32> = env.crypto().sha256(&code.to_bytes()).into();
        if got != expected {
            return Err(Error::WrongCode);
        }
        let token = token_client(&env);
        let me = env.current_contract_address();
        if token.balance(&me) < PRIZE {
            return Err(Error::InsufficientBalance);
        }
        token.transfer(&me, &to, &PRIZE);
        Claimed { to, amount: PRIZE }.publish(&env);
        extend(&env);
        Ok(PRIZE)
    }

    /// Saldo actual de la bóveda en stroops.
    pub fn balance(env: Env) -> i128 {
        token_client(&env).balance(&env.current_contract_address())
    }

    /// Premio por reclamo en stroops.
    pub fn prize(_env: Env) -> i128 {
        PRIZE
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn code_hash(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::CodeHash).unwrap()
    }
}

fn token_client(env: &Env) -> TokenClient<'_> {
    let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
    TokenClient::new(env, &token)
}

/// Mantiene viva la instancia (~30 días) en cada escritura.
fn extend(env: &Env) {
    const DAY: u32 = 17_280;
    env.storage().instance().extend_ttl(DAY * 7, DAY * 30);
}

#[cfg(test)]
mod test;
