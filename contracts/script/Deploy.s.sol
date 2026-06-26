// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SeyfVaults} from "../SeyfVaults.sol";
import {SeyfAdvance} from "../SeyfAdvance.sol";

contract Deploy is Script {
    // MXNB en Arbitrum Sepolia
    address constant MXNB_SEPOLIA = 0x82B9e52b26A2954E113F94Ff26647754d5a4247D;
    // MXNB en Arbitrum One
    address constant MXNB_MAINNET = 0xF197FFC28c23E0309B5559e7a166f2c6164C80aA;

    function run() external {
        address mxnb = block.chainid == 42161 ? MXNB_MAINNET : MXNB_SEPOLIA;

        vm.startBroadcast();

        SeyfVaults vaults = new SeyfVaults(mxnb);
        console.log("SeyfVaults:  ", address(vaults));

        SeyfAdvance advance = new SeyfAdvance(address(vaults), mxnb);
        console.log("SeyfAdvance: ", address(advance));

        vaults.setAdvanceManager(address(advance));
        console.log("advanceManager set");

        vm.stopBroadcast();

        console.log("\n# .env.local");
        console.log("NEXT_PUBLIC_SEYF_VAULTS_ADDRESS=", address(vaults));
        console.log("NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS=", address(advance));
    }
}
