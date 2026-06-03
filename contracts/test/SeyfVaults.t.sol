// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SeyfVaults} from "../SeyfVaults.sol";
import {MockERC20} from "./MockERC20.sol";
import {ReentrantToken} from "./ReentrantToken.sol";
import {ReentrancyAttacker} from "./ReentrancyAttacker.sol";

contract SeyfVaultsTest is Test {
    SeyfVaults vault;
    MockERC20 token;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address manager = address(0x6A9A6E);

    uint256 constant UNIT = 1e6; // 6 decimales

    function setUp() public {
        token = new MockERC20();
        vault = new SeyfVaults(address(token)); // este test es el owner
        token.mint(alice, 1_000 * UNIT);
        token.mint(bob, 1_000 * UNIT);
    }

    function _open(address user, uint256 goal, uint16 apy) internal returns (uint256 id) {
        vm.prank(user);
        id = vault.openVault("meta", goal, apy);
    }

    function _deposit(address user, uint256 id, uint256 amount) internal {
        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(id, amount);
        vm.stopPrank();
    }

    function test_OpenAndDeposit() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);

        SeyfVaults.Vault memory v = vault.getVault(alice, id);
        assertEq(v.balance, 40 * UNIT);
        assertEq(v.apyBps, 1150);
        assertEq(token.balanceOf(address(vault)), 40 * UNIT);
        assertEq(token.balanceOf(alice), 960 * UNIT);
    }

    function test_WithdrawFree() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);

        vm.prank(alice);
        vault.withdraw(id, 15 * UNIT);

        assertEq(vault.getVault(alice, id).balance, 25 * UNIT);
        assertEq(token.balanceOf(alice), 975 * UNIT);
    }

    function test_WithdrawMoreThanBalanceReverts() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);

        vm.prank(alice);
        vm.expectRevert(bytes("exceeds free balance"));
        vault.withdraw(id, 41 * UNIT);
    }

    function test_VaultsAreIsolatedPerUser() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);
        // bob no tiene esa bóveda
        vm.prank(bob);
        vm.expectRevert();
        vault.withdraw(id, 1 * UNIT);
    }

    // -------- lien / advanceManager --------

    function test_OnlyAdvanceManagerCanLock() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);

        vm.prank(bob);
        vm.expectRevert(bytes("not advance manager"));
        vault.lock(alice, id, 10 * UNIT);
    }

    function test_OnlyOwnerSetsManager() public {
        vm.prank(bob);
        vm.expectRevert(bytes("not owner"));
        vault.setAdvanceManager(manager);
    }

    function test_LockedCannotBeWithdrawn() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);

        vault.setAdvanceManager(manager);
        vm.prank(manager);
        vault.lock(alice, id, 30 * UNIT);

        assertEq(vault.availableToWithdraw(alice, id), 10 * UNIT);

        // No puede retirar lo bloqueado
        vm.prank(alice);
        vm.expectRevert(bytes("exceeds free balance"));
        vault.withdraw(id, 11 * UNIT);

        // Pero sí lo libre
        vm.prank(alice);
        vault.withdraw(id, 10 * UNIT);
        assertEq(vault.getVault(alice, id).balance, 30 * UNIT);

        // Tras liberar, se puede retirar
        vm.prank(manager);
        vault.unlock(alice, id, 30 * UNIT);
        vm.prank(alice);
        vault.withdraw(id, 30 * UNIT);
        assertEq(vault.getVault(alice, id).balance, 0);
    }

    function test_LockExceedingFreeReverts() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);
        vault.setAdvanceManager(manager);
        vm.prank(manager);
        vm.expectRevert(bytes("exceeds free balance"));
        vault.lock(alice, id, 41 * UNIT);
    }

    function test_CloseWithLienReverts() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);
        vault.setAdvanceManager(manager);
        vm.prank(manager);
        vault.lock(alice, id, 10 * UNIT);

        vm.prank(alice);
        vm.expectRevert(bytes("vault has lien"));
        vault.closeVault(id);
    }

    function test_CloseReturnsBalance() public {
        uint256 id = _open(alice, 100 * UNIT, 1150);
        _deposit(alice, id, 40 * UNIT);
        vm.prank(alice);
        vault.closeVault(id);
        assertEq(token.balanceOf(alice), 1_000 * UNIT);
        assertFalse(vault.getVault(alice, id).exists);
    }

    // -------- reentrancy --------

    function test_ReentrancyOnWithdrawIsBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        SeyfVaults evilVault = new SeyfVaults(address(evil));
        ReentrancyAttacker attacker = new ReentrancyAttacker(evilVault, evil);

        evil.mint(address(attacker), 100 * UNIT);
        attacker.setup(100 * UNIT);

        // El intento de reentrada debe chocar con el guard y revertir todo el ataque.
        vm.expectRevert(bytes("reentrant"));
        attacker.attack(100 * UNIT);

        // La bóveda no fue drenada: sigue con el principal intacto.
        assertEq(evil.balanceOf(address(evilVault)), 100 * UNIT);
    }
}
