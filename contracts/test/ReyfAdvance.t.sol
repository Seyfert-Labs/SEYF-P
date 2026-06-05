// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReyfVaults} from "../ReyfVaults.sol";
import {ReyfAdvance} from "../ReyfAdvance.sol";
import {MockERC20} from "./MockERC20.sol";
import {ReentrantToken} from "./ReentrantToken.sol";
import {AdvanceAttacker} from "./AdvanceAttacker.sol";

contract ReyfAdvanceTest is Test {
    ReyfVaults vault;
    ReyfAdvance advance;
    MockERC20 token;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant UNIT = 1e6;

    function setUp() public {
        token = new MockERC20();
        vault = new ReyfVaults(address(token));
        advance = new ReyfAdvance(address(vault), address(token));
        vault.setAdvanceManager(address(advance));

        // tesorería del adelanto (este test = owner del advance)
        token.mint(address(this), 1_000 * UNIT);
        token.approve(address(advance), type(uint256).max);
        advance.fundTreasury(500 * UNIT);

        token.mint(alice, 1_000 * UNIT);
    }

    function _aliceVaultWith(uint256 deposit_, uint16 apy) internal returns (uint256 id) {
        vm.startPrank(alice);
        id = vault.openVault("retiro", deposit_, apy);
        token.approve(address(vault), deposit_);
        vault.deposit(id, deposit_);
        vm.stopPrank();
    }

    function test_MaxAdvanceIsOneYearYield() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150); // 11.5%
        // 1000 * 1150 / 10000 = 115 UNIT
        assertEq(advance.maxAdvance(alice, id), 115 * UNIT);
    }

    function test_RequestAdvanceLocksCollateralAndPays() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);

        vm.prank(alice);
        advance.requestAdvance(id, 100 * UNIT);

        assertEq(advance.debt(alice, id), 100 * UNIT);
        assertEq(vault.lockedAmount(alice, id), 100 * UNIT);
        assertEq(vault.availableToWithdraw(alice, id), 900 * UNIT);
        assertEq(token.balanceOf(alice), 100 * UNIT);
        assertEq(advance.treasuryBalance(), 400 * UNIT);
        // tope restante: saldo libre=900, cap=900*11.5%=103.5, owed=100 → 3.5 UNIT
        assertEq(advance.maxAdvance(alice, id), (900 * UNIT * 1150) / 10000 - 100 * UNIT);
    }

    function test_RequestExceedingMaxReverts() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        vm.expectRevert(bytes("exceeds max advance"));
        advance.requestAdvance(id, 116 * UNIT); // tope es 115 (1 año de rendimiento)
    }

    function test_RequestExceedingTreasuryReverts() public {
        // vacía la tesorería primero
        advance.withdrawTreasury(500 * UNIT);
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        vm.expectRevert(bytes("treasury insufficient"));
        advance.requestAdvance(id, 100 * UNIT);
    }

    function test_RepayReleasesCollateral() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        advance.requestAdvance(id, 100 * UNIT);

        vm.startPrank(alice);
        token.approve(address(advance), 100 * UNIT);
        advance.repay(id, 100 * UNIT);
        vm.stopPrank();

        assertEq(advance.debt(alice, id), 0);
        assertEq(vault.lockedAmount(alice, id), 0);
        assertEq(advance.treasuryBalance(), 500 * UNIT); // tesorería repuesta
        assertEq(vault.availableToWithdraw(alice, id), 1_000 * UNIT);
    }

    function test_PartialRepay() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        advance.requestAdvance(id, 100 * UNIT);

        vm.startPrank(alice);
        token.approve(address(advance), 40 * UNIT);
        advance.repay(id, 40 * UNIT);
        vm.stopPrank();

        assertEq(advance.debt(alice, id), 60 * UNIT);
        assertEq(vault.lockedAmount(alice, id), 60 * UNIT);
    }

    function test_RepayMoreThanDebtReverts() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        advance.requestAdvance(id, 100 * UNIT);

        vm.prank(alice);
        vm.expectRevert(bytes("bad amount"));
        advance.repay(id, 101 * UNIT);
    }

    function test_OnlyOwnerTreasury() public {
        vm.prank(bob);
        vm.expectRevert(bytes("not owner"));
        advance.withdrawTreasury(1 * UNIT);

        vm.prank(bob);
        vm.expectRevert(bytes("not owner"));
        advance.fundTreasury(1 * UNIT);
    }

    function test_CannotCloseVaultWithOutstandingAdvance() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        advance.requestAdvance(id, 50 * UNIT);

        vm.prank(alice);
        vm.expectRevert(bytes("vault has lien"));
        vault.closeVault(id);
    }

    // -------- reentrancy --------

    function test_ReentrancyOnAdvanceIsBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        ReyfVaults evilVault = new ReyfVaults(address(evil));
        ReyfAdvance evilAdv = new ReyfAdvance(address(evilVault), address(evil));
        evilVault.setAdvanceManager(address(evilAdv));

        evil.mint(address(this), 1_000 * UNIT);
        evil.approve(address(evilAdv), type(uint256).max);
        evilAdv.fundTreasury(500 * UNIT);

        AdvanceAttacker atk = new AdvanceAttacker(evilVault, evilAdv, evil);
        evil.mint(address(atk), 1_000 * UNIT);
        atk.setup(1_000 * UNIT); // maxAdvance = 115

        vm.expectRevert(bytes("reentrant"));
        atk.attack(100 * UNIT);

        // tesorería intacta (todo revirtió)
        assertEq(evilAdv.treasuryBalance(), 500 * UNIT);
    }
}
