// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReyfVaults} from "../ReyfVaults.sol";
import {ReentrantToken, IReentered} from "./ReentrantToken.sol";

/// @notice Contrato que intenta drenar la bóveda reentrando `withdraw` cuando
///         recibe tokens (vía el hook del token malicioso). Si el guard funciona,
///         la reentrada revierte y todo el `attack()` aborta.
contract ReentrancyAttacker is IReentered {
    ReyfVaults public vault;
    ReentrantToken public token;
    uint256 public vid;
    bool internal attacking;

    constructor(ReyfVaults v, ReentrantToken t) {
        vault = v;
        token = t;
    }

    /// Abre una bóveda y deposita (los tokens deben haberse minteado a este contrato antes).
    function setup(uint256 amount) external {
        vid = vault.openVault("atk", amount, 1000);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(vid, amount);
    }

    /// Dispara un retiro; al recibir los tokens, el hook reentra `withdraw`.
    function attack(uint256 amount) external {
        attacking = true;
        token.arm(address(this));
        vault.withdraw(vid, amount);
    }

    /// Hook llamado por el token al recibir fondos → intento de reentrada.
    function reenter() external {
        if (attacking) {
            attacking = false;
            vault.withdraw(vid, 1); // debe chocar con el guard y revertir
        }
    }
}
