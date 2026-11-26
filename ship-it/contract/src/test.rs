#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token::{StellarAssetClient, TokenClient},
    Bytes, Env, Event, String,
};

const CODE: &str = "Ship It";

struct Setup<'a> {
    env: Env,
    vault: ShipItVaultClient<'a>,
    xlm: TokenClient<'a>,
    xlm_admin: StellarAssetClient<'a>,
    funder: Address,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let xlm = TokenClient::new(&env, &sac.address());
    let xlm_admin = StellarAssetClient::new(&env, &sac.address());
    let admin = Address::generate(&env);
    let hash: BytesN<32> = env
        .crypto()
        .sha256(&Bytes::from_slice(&env, CODE.as_bytes()))
        .into();
    let id = env.register(ShipItVault, (admin, sac.address(), hash));
    let vault = ShipItVaultClient::new(&env, &id);
    let funder = Address::generate(&env);
    xlm_admin.mint(&funder, &(PRIZE * 3));
    Setup {
        env,
        vault,
        xlm,
        xlm_admin,
        funder,
    }
}

fn s(env: &Env, v: &str) -> String {
    String::from_str(env, v)
}

#[test]
fn correct_code_pays_prize_and_emits_event() {
    let t = setup();
    assert_eq!(t.vault.fund(&t.funder, &PRIZE), PRIZE);
    let judge = Address::generate(&t.env);

    assert_eq!(t.vault.claim(&judge, &s(&t.env, CODE)), PRIZE);

    // Quien reclama es quien firma.
    let auths = t.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, judge);

    // El evento `claimed` se emitió.
    let ev = Claimed {
        to: judge.clone(),
        amount: PRIZE,
    };
    let all = t.env.events().all();
    let xdr = ev.to_xdr(&t.env, &t.vault.address);
    assert!(all.events().iter().any(|e| *e == xdr));

    assert_eq!(t.xlm.balance(&judge), PRIZE);
    assert_eq!(t.vault.balance(), 0);
}

#[test]
fn wrong_code_is_rejected() {
    let t = setup();
    t.vault.fund(&t.funder, &PRIZE);
    let who = Address::generate(&t.env);
    for bad in ["ship it", "Ship it", "ShipIt", " Ship It", "Ship It ", ""] {
        assert_eq!(
            t.vault.try_claim(&who, &s(&t.env, bad)),
            Err(Ok(Error::WrongCode))
        );
    }
    assert_eq!(t.xlm.balance(&who), 0);
    assert_eq!(t.vault.balance(), PRIZE);
}

#[test]
fn no_balance_is_rejected() {
    let t = setup();
    let who = Address::generate(&t.env);
    assert_eq!(
        t.vault.try_claim(&who, &s(&t.env, CODE)),
        Err(Ok(Error::InsufficientBalance))
    );
    // Un saldo parcial (menor al premio) tampoco alcanza.
    t.vault.fund(&t.funder, &(PRIZE - 1));
    assert_eq!(
        t.vault.try_claim(&who, &s(&t.env, CODE)),
        Err(Ok(Error::InsufficientBalance))
    );
    assert_eq!(t.vault.balance(), PRIZE - 1);
}

#[test]
fn refill_after_someone_claims_first() {
    let t = setup();
    t.vault.fund(&t.funder, &PRIZE);
    let other_team = Address::generate(&t.env);
    let judge = Address::generate(&t.env);
    t.vault.claim(&other_team, &s(&t.env, CODE));
    assert_eq!(
        t.vault.try_claim(&judge, &s(&t.env, CODE)),
        Err(Ok(Error::InsufficientBalance))
    );
    // Recarga desde una cuenta de respaldo.
    let backup = Address::generate(&t.env);
    t.xlm_admin.mint(&backup, &PRIZE);
    assert_eq!(t.vault.fund(&backup, &PRIZE), PRIZE);
    t.vault.claim(&judge, &s(&t.env, CODE));
    assert_eq!(t.xlm.balance(&judge), PRIZE);
    assert_eq!(t.xlm.balance(&other_team), PRIZE);
    assert_eq!(t.vault.balance(), 0);
}

#[test]
fn double_claim_pays_each_time_while_balance_lasts() {
    let t = setup();
    t.vault.fund(&t.funder, &(PRIZE * 2));
    let judge = Address::generate(&t.env);
    t.vault.claim(&judge, &s(&t.env, CODE));
    t.vault.claim(&judge, &s(&t.env, CODE));
    assert_eq!(t.xlm.balance(&judge), PRIZE * 2);
    assert_eq!(
        t.vault.try_claim(&judge, &s(&t.env, CODE)),
        Err(Ok(Error::InsufficientBalance))
    );
}

#[test]
fn fund_rejects_non_positive_and_requires_auth() {
    let t = setup();
    assert_eq!(t.vault.try_fund(&t.funder, &0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(t.vault.try_fund(&t.funder, &-1), Err(Ok(Error::InvalidAmount)));
    t.vault.fund(&t.funder, &PRIZE);
    assert_eq!(t.env.auths()[0].0, t.funder);
}

#[test]
#[should_panic]
fn claim_without_auth_fails() {
    let t = setup();
    t.vault.fund(&t.funder, &PRIZE);
    t.env.set_auths(&[]);
    let who = Address::generate(&t.env);
    t.vault.claim(&who, &s(&t.env, CODE));
}

#[test]
fn views() {
    let t = setup();
    assert_eq!(t.vault.prize(), PRIZE);
    assert_eq!(t.vault.token(), t.xlm.address);
    let expected: BytesN<32> = t
        .env
        .crypto()
        .sha256(&Bytes::from_slice(&t.env, CODE.as_bytes()))
        .into();
    assert_eq!(t.vault.code_hash(), expected);
}
