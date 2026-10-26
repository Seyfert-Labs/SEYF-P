extern crate std;

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, Event, IntoVal, Symbol, Vec,
};

use crate::events::{TreasuryFunded, TreasuryWithdrawn};
use crate::{Error, Params, SeyfAdvance, SeyfAdvanceClient};

// ------------------------------------------------------------- vault simulado
//
// Reproduce lo que usa el contrato del vault de DeFindex: acciones SEP-41,
// valor por acción = activos del vault * acciones / supply, y `withdraw` que
// quema acciones de `from`, respeta `min_amounts_out` y le paga en el activo.

#[contracttype]
enum MockKey {
    Asset,
    Supply,
    Balance(Address),
}

#[contract]
pub struct MockVault;

#[contractimpl]
impl MockVault {
    pub fn __constructor(e: Env, asset: Address) {
        e.storage().instance().set(&MockKey::Asset, &asset);
    }

    pub fn deposit(e: Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        let total = Self::total_assets(&e);
        let supply = Self::total_supply(e.clone());
        let shares = if supply == 0 { amount } else { amount * supply / total };
        Self::token(&e).transfer(&from, &e.current_contract_address(), &amount);
        Self::set_balance(&e, &from, Self::balance(e.clone(), from.clone()) + shares);
        e.storage().instance().set(&MockKey::Supply, &(supply + shares));
        shares
    }

    pub fn get_asset_amounts_per_shares(e: Env, vault_shares: i128) -> Vec<i128> {
        let supply = Self::total_supply(e.clone());
        let value = if supply == 0 { 0 } else { Self::total_assets(&e) * vault_shares / supply };
        vec![&e, value]
    }

    pub fn withdraw(
        e: Env,
        withdraw_shares: i128,
        min_amounts_out: Vec<i128>,
        from: Address,
    ) -> Vec<i128> {
        from.require_auth();
        let supply = Self::total_supply(e.clone());
        let amount = Self::total_assets(&e) * withdraw_shares / supply;
        assert!(amount >= min_amounts_out.get(0).unwrap(), "InsufficientOutputAmount");
        let balance = Self::balance(e.clone(), from.clone());
        assert!(balance >= withdraw_shares, "insufficient shares");
        Self::set_balance(&e, &from, balance - withdraw_shares);
        e.storage().instance().set(&MockKey::Supply, &(supply - withdraw_shares));
        Self::token(&e).transfer(&e.current_contract_address(), &from, &amount);
        vec![&e, amount]
    }

    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_balance = Self::balance(e.clone(), from.clone());
        assert!(from_balance >= amount, "insufficient shares");
        Self::set_balance(&e, &from, from_balance - amount);
        Self::set_balance(&e, &to, Self::balance(e.clone(), to.clone()) + amount);
    }

    pub fn balance(e: Env, id: Address) -> i128 {
        e.storage().persistent().get(&MockKey::Balance(id)).unwrap_or(0)
    }

    pub fn total_supply(e: Env) -> i128 {
        e.storage().instance().get(&MockKey::Supply).unwrap_or(0)
    }

    /// Simula una pérdida en la estrategia: saca activos del vault.
    pub fn drain(e: Env, to: Address, amount: i128) {
        Self::token(&e).transfer(&e.current_contract_address(), &to, &amount);
    }
}

impl MockVault {
    fn token(e: &Env) -> TokenClient<'_> {
        let asset: Address = e.storage().instance().get(&MockKey::Asset).unwrap();
        TokenClient::new(e, &asset)
    }

    fn total_assets(e: &Env) -> i128 {
        Self::token(e).balance(&e.current_contract_address())
    }

    fn set_balance(e: &Env, id: &Address, amount: i128) {
        e.storage().persistent().set(&MockKey::Balance(id.clone()), &amount);
    }
}

// ------------------------------------------------------------------- entorno

const USDC: i128 = 10_000_000; // 7 decimales
const TREASURY: i128 = 50 * USDC;

struct Setup<'a> {
    e: Env,
    admin: Address,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
    vault: MockVaultClient<'a>,
    advance: SeyfAdvanceClient<'a>,
    users: std::vec::Vec<Address>,
    /// USDC aportado a la tesorería menos lo retirado por el admin.
    net_funded: i128,
}

fn default_params() -> Params {
    Params {
        apy_bps: 800,
        max_advance_bps: 500,
        min_term_days: 30,
        max_term_days: 365,
        per_user_cap: 10 * USDC,
        global_cap: 100 * USDC,
        allowlist_on: true,
    }
}

impl<'a> Setup<'a> {
    fn new() -> Self {
        let e = Env::default();
        e.mock_all_auths();
        e.ledger().set_timestamp(1_000_000);

        let admin = Address::generate(&e);
        let sac = e.register_stellar_asset_contract_v2(Address::generate(&e));
        let usdc = TokenClient::new(&e, &sac.address());
        let usdc_admin = StellarAssetClient::new(&e, &sac.address());

        let vault_id = e.register(MockVault, (sac.address(),));
        let vault = MockVaultClient::new(&e, &vault_id);

        let advance_id = e.register(
            SeyfAdvance,
            (admin.clone(), vault_id.clone(), sac.address(), default_params()),
        );
        let advance = SeyfAdvanceClient::new(&e, &advance_id);

        let mut s = Setup {
            e,
            admin,
            usdc,
            usdc_admin,
            vault,
            advance,
            users: std::vec::Vec::new(),
            net_funded: 0,
        };
        // Tesorería con 50 USDC aportados por un tercero.
        s.fund(TREASURY);
        s
    }

    /// Un tercero aporta `amount` USDC a la tesorería.
    fn fund(&mut self, amount: i128) -> Address {
        let funder = Address::generate(&self.e);
        self.usdc_admin.mint(&funder, &amount);
        self.advance.fund_treasury(&funder, &amount);
        self.net_funded += amount;
        funder
    }

    /// El admin retira `amount` USDC de la tesorería.
    fn withdraw(&mut self, amount: i128) -> Address {
        let to = Address::generate(&self.e);
        self.advance.withdraw_treasury(&to, &amount);
        self.net_funded -= amount;
        to
    }

    /// Usuario aprobado con `deposit` USDC depositados en el vault.
    fn user(&mut self, deposit: i128) -> (Address, i128) {
        let user = Address::generate(&self.e);
        self.usdc_admin.mint(&user, &deposit);
        let shares = self.vault.deposit(&user, &deposit);
        self.advance.set_allowed(&user, &true);
        self.users.push(user.clone());
        (user, shares)
    }

    /// Simula rendimiento del vault.
    fn accrue(&self, amount: i128) {
        self.usdc_admin.mint(&self.vault.address, &amount);
    }

    fn value_of(&self, shares: i128) -> i128 {
        self.vault.get_asset_amounts_per_shares(&shares).get(0).unwrap()
    }

    /// Invariantes de la tesorería y las posiciones.
    fn check_invariants(&self) {
        let mut advances = 0i128;
        let mut shares = 0i128;
        for user in &self.users {
            if let Some(p) = self.advance.position(user) {
                advances += p.advance;
                shares += p.shares;
            }
        }
        assert_eq!(self.advance.outstanding(), advances, "Outstanding != suma de adelantos");
        assert_eq!(
            self.vault.balance(&self.advance.address),
            shares,
            "acciones del contrato != suma de acciones de las posiciones"
        );
        // La tesorería es exactamente el USDC del contrato.
        assert_eq!(self.advance.treasury(), self.usdc.balance(&self.advance.address));
        // La tesorería nunca pierde: lo libre más lo adelantado cubre lo aportado.
        assert!(self.advance.treasury() + advances >= self.net_funded, "la tesorería perdió USDC");
    }
}

/// A = floor(V * apy_bps * d / (10_000 * 365)).
fn expected_advance(value: i128, apy_bps: u32, days: u32) -> i128 {
    value * apy_bps as i128 * days as i128 / (10_000 * 365)
}

// --------------------------------------------------------------------- tests

#[test]
fn open_advance_pays_from_treasury_and_locks_shares() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);

    let expected = expected_advance(100 * USDC, 800, 90);
    assert_eq!(expected, 19_726_027);
    assert_eq!(s.advance.quote(&shares, &90), (100 * USDC, expected));

    let paid = s.advance.open_advance(&user, &shares, &90, &expected);
    assert_eq!(paid, expected);
    assert_eq!(s.usdc.balance(&user), expected);
    assert_eq!(s.advance.treasury(), TREASURY - expected);
    assert_eq!(s.vault.balance(&user), 0);
    assert_eq!(s.vault.balance(&s.advance.address), shares);

    let p = s.advance.position(&user).unwrap();
    assert_eq!(p.shares, shares);
    assert_eq!(p.value_at_open, 100 * USDC);
    assert_eq!(p.advance, expected);
    assert_eq!(p.expected_unlock_at, p.opened_at + 90 * 86_400);
    assert_eq!(s.advance.unlock_status(&user), (100 * USDC, 100 * USDC + expected));
    s.check_invariants();
}

#[test]
fn open_advance_authorizes_user_and_share_transfer() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);

    s.advance.open_advance(&user, &shares, &90, &1);

    // El usuario firma la llamada raíz y, dentro del mismo árbol, la
    // transferencia de sus acciones al contrato. El pago del adelanto sale del
    // saldo del propio contrato, así que no pide ninguna otra firma.
    assert_eq!(
        s.e.auths(),
        std::vec![(
            user.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.advance.address.clone(),
                    Symbol::new(&s.e, "open_advance"),
                    (user.clone(), shares, 90u32, 1i128).into_val(&s.e),
                )),
                sub_invocations: std::vec![AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        s.vault.address.clone(),
                        Symbol::new(&s.e, "transfer"),
                        (user.clone(), s.advance.address.clone(), shares).into_val(&s.e),
                    )),
                    sub_invocations: std::vec![],
                }],
            }
        )]
    );
}

#[test]
fn open_advance_rejections() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);

    assert_eq!(s.advance.try_open_advance(&user, &shares, &29, &0), Err(Ok(Error::TermOutOfRange)));
    assert_eq!(s.advance.try_open_advance(&user, &shares, &366, &0), Err(Ok(Error::TermOutOfRange)));
    assert_eq!(s.advance.try_open_advance(&user, &0, &90, &0), Err(Ok(Error::ZeroShares)));

    // Tope de LTV: 8% anual a 365 días = 8% > 5%.
    assert_eq!(s.advance.try_open_advance(&user, &shares, &365, &0), Err(Ok(Error::ExceedsLtv)));

    let expected = expected_advance(100 * USDC, 800, 90);
    assert_eq!(
        s.advance.try_open_advance(&user, &shares, &90, &(expected + 1)),
        Err(Ok(Error::AdvanceBelowMin))
    );

    s.advance.pause();
    assert_eq!(s.advance.try_open_advance(&user, &shares, &90, &0), Err(Ok(Error::Paused)));
    s.advance.unpause();

    s.advance.set_allowed(&user, &false);
    assert_eq!(s.advance.try_open_advance(&user, &shares, &90, &0), Err(Ok(Error::NotAllowed)));
    s.advance.set_allowed(&user, &true);

    s.advance.open_advance(&user, &(shares / 2), &90, &0);
    assert_eq!(
        s.advance.try_open_advance(&user, &(shares / 2), &90, &0),
        Err(Ok(Error::PositionExists))
    );
    s.check_invariants();
}

#[test]
fn open_advance_caps() {
    let mut s = Setup::new();

    // Tope por usuario: 1000 USDC a 90 días adelantan ~19.7 USDC > 10.
    let (whale, whale_shares) = s.user(1_000 * USDC);
    assert_eq!(
        s.advance.try_open_advance(&whale, &whale_shares, &90, &0),
        Err(Ok(Error::ExceedsUserCap))
    );

    let mut p = default_params();
    p.global_cap = 3 * USDC;
    p.per_user_cap = 3 * USDC;
    s.advance.set_params(&p);
    let (a, a_shares) = s.user(100 * USDC);
    let (b, b_shares) = s.user(100 * USDC);
    s.advance.open_advance(&a, &a_shares, &90, &0);
    assert_eq!(
        s.advance.try_open_advance(&b, &b_shares, &90, &0),
        Err(Ok(Error::ExceedsGlobalCap))
    );
    s.check_invariants();
}

#[test]
fn open_advance_requires_treasury_balance() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    let expected = expected_advance(100 * USDC, 800, 90);

    // Falta 1 unidad en la tesorería.
    s.withdraw(TREASURY - expected + 1);
    assert_eq!(s.advance.treasury(), expected - 1);
    assert_eq!(
        s.advance.try_open_advance(&user, &shares, &90, &0),
        Err(Ok(Error::InsufficientTreasury))
    );

    // Con el saldo justo ya alcanza y la tesorería queda en cero.
    s.fund(1);
    s.advance.open_advance(&user, &shares, &90, &expected);
    assert_eq!(s.advance.treasury(), 0);
    s.check_invariants();
}

#[test]
fn repay_returns_all_shares_and_refills_treasury() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    s.advance.open_advance(&user, &shares, &90, &0);

    s.advance.repay(&user);
    assert_eq!(s.vault.balance(&user), shares);
    assert_eq!(s.usdc.balance(&user), 0);
    assert_eq!(s.advance.treasury(), TREASURY);
    assert_eq!(s.advance.outstanding(), 0);
    assert_eq!(s.advance.position(&user), None);
    s.check_invariants();

    // No se puede cerrar dos veces.
    assert_eq!(s.advance.try_repay(&user), Err(Ok(Error::NoPosition)));
    assert_eq!(s.advance.try_settle(&user), Err(Ok(Error::NoPosition)));
}

#[test]
fn pause_only_blocks_new_advances() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    let (other, other_shares) = s.user(100 * USDC);
    s.advance.open_advance(&user, &shares, &90, &0);
    s.advance.pause();

    // Nada nuevo se abre.
    assert_eq!(
        s.advance.try_open_advance(&other, &other_shares, &90, &0),
        Err(Ok(Error::Paused))
    );
    // Pero el usuario sale repagando y la tesorería sigue operando.
    s.advance.repay(&user);
    assert_eq!(s.vault.balance(&user), shares);
    assert_eq!(s.advance.treasury(), TREASURY);
    s.fund(USDC);
    s.withdraw(USDC);
    assert_eq!(s.advance.treasury(), TREASURY);
    s.check_invariants();
}

#[test]
fn settle_waits_until_yield_covers_the_advance() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    let advance = s.advance.open_advance(&user, &shares, &90, &0);

    // El tiempo solo no libera nada: hace falta rendimiento.
    s.e.ledger().set_timestamp(1_000_000 + 400 * 86_400);
    assert_eq!(s.advance.try_settle(&user), Err(Ok(Error::YieldNotCovered)));

    // Falta 1 unidad para cubrir el adelanto.
    s.accrue(advance - 1);
    assert_eq!(s.advance.try_settle(&user), Err(Ok(Error::YieldNotCovered)));

    // Ya lo cubre: cualquiera liquida, también en pausa, sin firmas.
    s.accrue(1);
    s.advance.pause();
    let treasury_before = s.advance.treasury();
    s.advance.settle(&user);
    assert_eq!(s.e.auths(), std::vec![]);

    // La tesorería recupera al menos el adelanto.
    assert!(s.advance.treasury() - treasury_before >= advance);
    // El usuario recupera su principal completo (salvo el redondeo de una acción).
    let returned = s.vault.balance(&user);
    assert!(returned < shares);
    assert!(s.value_of(returned) >= 100 * USDC - 1);
    assert_eq!(s.advance.outstanding(), 0);
    assert_eq!(s.advance.position(&user), None);
    s.check_invariants();

    assert_eq!(s.advance.try_settle(&user), Err(Ok(Error::NoPosition)));
}

#[test]
fn settle_returns_extra_yield_to_user() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    let advance = s.advance.open_advance(&user, &shares, &90, &0);

    // El vault rinde 10 USDC, más que el adelanto (~1.97 USDC).
    s.accrue(10 * USDC);
    s.advance.settle(&user);

    let returned_value = s.value_of(s.vault.balance(&user));
    // Principal + rendimiento - adelanto, salvo redondeo.
    assert!(returned_value >= 110 * USDC - advance - 2);
    assert!(returned_value <= 110 * USDC - advance);
    s.check_invariants();
}

#[test]
fn vault_loss_keeps_shares_locked_until_repay() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    s.advance.open_advance(&user, &shares, &90, &0);

    // Pérdida en la estrategia: no se puede liquidar contra el principal.
    let sink = Address::generate(&s.e);
    s.vault.drain(&sink, &(5 * USDC));
    assert_eq!(s.advance.try_settle(&user), Err(Ok(Error::YieldNotCovered)));

    // El usuario puede salir repagando y recupera todas sus acciones.
    s.advance.repay(&user);
    assert_eq!(s.vault.balance(&user), shares);
    s.check_invariants();
}

#[test]
fn admin_only_functions() {
    let s = Setup::new();
    let e = &s.e;

    e.set_auths(&[]);
    assert!(s.advance.try_pause().is_err());
    assert!(s.advance.try_unpause().is_err());
    assert!(s.advance.try_set_params(&default_params()).is_err());
    assert!(s.advance.try_withdraw_treasury(&Address::generate(e), &1).is_err());
    assert!(s.advance.try_set_allowed(&Address::generate(e), &true).is_err());
    assert!(s.advance.try_propose_admin(&Address::generate(e)).is_err());
    assert_eq!(s.advance.treasury(), TREASURY);
}

#[test]
fn fund_treasury_from_anyone() {
    let mut s = Setup::new();
    let funder = s.fund(3 * USDC);
    // `events()` refleja solo la última invocación: se lee antes de otra llamada.
    assert_eq!(
        s.e.events().all().filter_by_contract(&s.advance.address),
        std::vec![TreasuryFunded { from: funder.clone(), amount: 3 * USDC }
            .to_xdr(&s.e, &s.advance.address)]
    );
    assert_eq!(s.advance.treasury(), TREASURY + 3 * USDC);

    // Lo firma quien aporta, junto con la transferencia de su USDC.
    s.usdc_admin.mint(&funder, &USDC);
    s.advance.fund_treasury(&funder, &USDC);
    assert_eq!(
        s.e.auths(),
        std::vec![(
            funder.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.advance.address.clone(),
                    Symbol::new(&s.e, "fund_treasury"),
                    (funder.clone(), USDC).into_val(&s.e),
                )),
                sub_invocations: std::vec![AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        s.usdc.address.clone(),
                        Symbol::new(&s.e, "transfer"),
                        (funder.clone(), s.advance.address.clone(), USDC).into_val(&s.e),
                    )),
                    sub_invocations: std::vec![],
                }],
            }
        )]
    );
    s.net_funded += USDC;

    assert_eq!(s.advance.try_fund_treasury(&funder, &0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(s.advance.try_fund_treasury(&funder, &-1), Err(Ok(Error::InvalidAmount)));
    s.check_invariants();
}

#[test]
fn withdraw_treasury_cannot_take_committed_funds() {
    let mut s = Setup::new();
    let (user, shares) = s.user(100 * USDC);
    let advance = s.advance.open_advance(&user, &shares, &90, &0);
    let free = TREASURY - advance;
    assert_eq!(s.advance.treasury(), free);

    // Lo adelantado ya no está en la tesorería: solo se retira lo libre.
    let to = Address::generate(&s.e);
    assert_eq!(
        s.advance.try_withdraw_treasury(&to, &(free + 1)),
        Err(Ok(Error::InsufficientTreasury))
    );
    assert_eq!(s.advance.try_withdraw_treasury(&to, &0), Err(Ok(Error::InvalidAmount)));

    let to = s.withdraw(free);
    assert_eq!(
        s.e.events().all().filter_by_contract(&s.advance.address),
        std::vec![TreasuryWithdrawn { to: to.clone(), amount: free }
            .to_xdr(&s.e, &s.advance.address)]
    );
    assert_eq!(s.usdc.balance(&to), free);
    assert_eq!(s.advance.treasury(), 0);
    assert_eq!(
        s.advance.try_withdraw_treasury(&to, &1),
        Err(Ok(Error::InsufficientTreasury))
    );
    s.check_invariants();
}

#[test]
fn locked_shares_never_leave_through_withdraw_treasury() {
    let mut s = Setup::new();
    let (a, a_shares) = s.user(100 * USDC);
    let (b, b_shares) = s.user(100 * USDC);
    let advance_a = s.advance.open_advance(&a, &a_shares, &90, &0);
    let advance_b = s.advance.open_advance(&b, &b_shares, &90, &0);

    // El admin vacía la tesorería: las acciones bloqueadas se quedan.
    s.withdraw(TREASURY - advance_a - advance_b);
    assert_eq!(s.advance.treasury(), 0);
    assert_eq!(s.vault.balance(&s.advance.address), a_shares + b_shares);
    s.check_invariants();

    // Las dos salidas siguen funcionando con la tesorería vacía.
    s.advance.repay(&a);
    assert_eq!(s.vault.balance(&a), a_shares);
    assert_eq!(s.advance.treasury(), advance_a);

    // El rendimiento cubre de sobra el adelanto de `b`.
    s.accrue(5 * USDC);
    s.advance.settle(&b);
    assert!(s.vault.balance(&b) > 0);
    assert!(s.advance.treasury() >= advance_a + advance_b);
    assert_eq!(s.vault.balance(&s.advance.address), 0);
    s.check_invariants();
}

#[test]
#[should_panic]
fn constructor_rejects_vault_equal_to_asset() {
    let e = Env::default();
    let sac = e.register_stellar_asset_contract_v2(Address::generate(&e));
    e.register(
        SeyfAdvance,
        (Address::generate(&e), sac.address(), sac.address(), default_params()),
    );
}

#[test]
fn set_params_validates() {
    let s = Setup::new();
    let mut p = default_params();
    p.min_term_days = 400;
    assert_eq!(s.advance.try_set_params(&p), Err(Ok(Error::InvalidParams)));
    let mut p = default_params();
    p.max_advance_bps = 0;
    assert_eq!(s.advance.try_set_params(&p), Err(Ok(Error::InvalidParams)));
    let mut p = default_params();
    p.global_cap = p.per_user_cap - 1;
    assert_eq!(s.advance.try_set_params(&p), Err(Ok(Error::InvalidParams)));
}

#[test]
fn two_step_admin_change() {
    let s = Setup::new();
    let new_admin = Address::generate(&s.e);

    assert_eq!(s.advance.try_accept_admin(), Err(Ok(Error::NoPendingAdmin)));
    s.advance.propose_admin(&new_admin);
    assert_eq!(s.advance.admin(), s.admin);
    s.advance.accept_admin();

    // accept_admin la firma el admin propuesto. `auths()` refleja solo la
    // última invocación, así que se lee antes de cualquier otra llamada.
    let auths = s.e.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, new_admin);
    assert_eq!(s.advance.admin(), new_admin);
}
