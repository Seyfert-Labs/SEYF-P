// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ReyfAdvance} from "../ReyfAdvance.sol";

interface IVaultsAdmin {
    function setAdvanceManager(address manager) external;
    function advanceManager() external view returns (address);
    function owner() external view returns (address);
}

/// @notice Redespliega SOLO ReyfAdvance (modelo de años + LTV 90%) conservando
///         el ReyfVaults existente, y lo registra como nuevo advanceManager.
/// @dev    Requiere variables de entorno:
///           VAULTS_ADDRESS  = ReyfVaults ya desplegado
///         El broadcaster debe ser el `owner` de ReyfVaults (para setAdvanceManager).
contract RedeployAdvance is Script {
    address constant MXNB_SEPOLIA = 0x82B9e52b26A2954E113F94Ff26647754d5a4247D;
    address constant MXNB_MAINNET = 0xF197FFC28c23E0309B5559e7a166f2c6164C80aA;

    function run() external {
        address vaultsAddr = vm.envAddress("VAULTS_ADDRESS");
        address mxnb = block.chainid == 42161 ? MXNB_MAINNET : MXNB_SEPOLIA;

        vm.startBroadcast();

        ReyfAdvance advance = new ReyfAdvance(vaultsAddr, mxnb);
        console.log("Nuevo ReyfAdvance:", address(advance));

        IVaultsAdmin(vaultsAddr).setAdvanceManager(address(advance));
        console.log("advanceManager actualizado en ReyfVaults:", vaultsAddr);

        vm.stopBroadcast();

        console.log("\n# Actualiza esta env (Vercel + .env.local) y re-deploya el front:");
        console.log("NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS=", address(advance));
    }
}
