// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SeyfVaults} from "../SeyfVaults.sol";
import {SeyfAdvance} from "../SeyfAdvance.sol";
import {ReentrantToken, IReentered} from "./ReentrantToken.sol";

/// @notice Intenta reentrar `requestAdvance` al recibir los MXNB del adelanto.
contract AdvanceAttacker is IReentered {
    SeyfVaults public vault;
    SeyfAdvance public advance;
    ReentrantToken public token;
    uint256 public vid;
    bool internal attacking;

    constructor(SeyfVaults v, SeyfAdvance a, ReentrantToken t) {
        vault = v;
        advance = a;
        token = t;
    }

    function setup(uint256 deposit_) external {
        vid = vault.openVault("atk", deposit_, 1150);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(vid, deposit_);
    }

    function attack(uint256 amount) external {
        attacking = true;
        token.arm(address(this));
        advance.requestAdvance(vid, amount);
    }

    function reenter() external {
        if (attacking) {
            attacking = false;
            advance.requestAdvance(vid, 1); // debe chocar con el guard
        }
    }
}
