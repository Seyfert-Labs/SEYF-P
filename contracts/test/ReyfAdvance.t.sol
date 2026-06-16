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

    function test_MaxYearsRespectsLTV() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150); // 11.5%
        // piso(9000 / 1150) = 7 años (7*11.5% = 80.5% ≤ 90%)
        assertEq(advance.maxYears(alice, id), 7);
    }

    function test_QuoteAdvanceByYears() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        assertEq(advance.quoteAdvance(alice, id, 1), 115 * UNIT);       // 1000*11.5%
        assertEq(advance.quoteAdvance(alice, id, 7), 805 * UNIT);       // 7 años
    }

    function test_RequestAdvanceLocksFullPrincipalAndPays() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);

        vm.prank(alice);
        advance.requestAdvance(id, 1); // 1 año de rendimiento

        assertEq(advance.debt(alice, id), 115 * UNIT);
        assertEq(vault.lockedAmount(alice, id), 1_000 * UNIT); // colateral = principal completo
        assertEq(vault.availableToWithdraw(alice, id), 0);
        assertEq(token.balanceOf(alice), 115 * UNIT);
        assertEq(advance.treasuryBalance(), 385 * UNIT);
        // ya no queda saldo libre → no se puede otro adelanto
        assertEq(advance.maxYears(alice, id), 0);
    }

    function test_RequestExceedingLTVReverts() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        vm.expectRevert(bytes("exceeds 90% LTV"));
        advance.requestAdvance(id, 8); // 8*11.5% = 92% > 90%
    }

    function test_RequestExceedingTreasuryReverts() public {
        advance.withdrawTreasury(500 * UNIT); // vacía la tesorería
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        vm.expectRevert(bytes("treasury insufficient"));
        advance.requestAdvance(id, 1);
    }

    function test_RepayReleasesAllCollateral() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        advance.requestAdvance(id, 1);

        vm.startPrank(alice);
        token.approve(address(advance), 115 * UNIT);
        advance.repay(id, 115 * UNIT);
        vm.stopPrank();

        assertEq(advance.debt(alice, id), 0);
        assertEq(vault.lockedAmount(alice, id), 0); // liberación total
        assertEq(advance.treasuryBalance(), 500 * UNIT); // tesorería repuesta
        assertEq(vault.availableToWithdraw(alice, id), 1_000 * UNIT);
    }

    function test_PartialRepayReleasesProportional() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1000); // 10% → números limpios
        vm.prank(alice);
        advance.requestAdvance(id, 1); // amount = 100, colateral = 1000

        vm.startPrank(alice);
        token.approve(address(advance), 40 * UNIT);
        advance.repay(id, 40 * UNIT);
        vm.stopPrank();

        assertEq(advance.debt(alice, id), 60 * UNIT);
        // libera proporcional: 1000 * 40/100 = 400
        assertEq(vault.lockedAmount(alice, id), 600 * UNIT);
        assertEq(vault.availableToWithdraw(alice, id), 400 * UNIT);
    }

    function test_RepayMoreThanDebtReverts() public {
        uint256 id = _aliceVaultWith(1_000 * UNIT, 1150);
        vm.prank(alice);
        advance.requestAdvance(id, 1);

        vm.prank(alice);
        vm.expectRevert(bytes("bad amount"));
        advance.repay(id, 116 * UNIT);
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
        advance.requestAdvance(id, 1);

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
        atk.setup(1_000 * UNIT);

        vm.expectRevert(bytes("reentrant"));
        atk.attack(1); // 1 año

        // tesorería intacta (todo revirtió)
        assertEq(evilAdv.treasuryBalance(), 500 * UNIT);
    }
}
