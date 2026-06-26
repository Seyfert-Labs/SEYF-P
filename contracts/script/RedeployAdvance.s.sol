// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SeyfAdvance} from "../SeyfAdvance.sol";

interface IERC20Mint {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVaultsAdmin {
    function setAdvanceManager(address manager) external;
    function advanceManager() external view returns (address);
    function owner() external view returns (address);
}

/// @notice Redespliega SOLO SeyfAdvance (modelo de años + LTV 90%) conservando
///         el SeyfVaults existente, y lo registra como nuevo advanceManager.
/// @dev    Variables de entorno:
///           VAULTS_ADDRESS         SeyfVaults desplegado
///           FUND_TREASURY_MXNB     (opcional) MXNB humanos a fondear en tesorería (default 50000)
///         El broadcaster debe ser el `owner` de SeyfVaults (setAdvanceManager) y
///         tener MXNB + ETH en Sepolia para fondear la tesorería del nuevo contrato.
contract RedeployAdvance is Script {
    address constant MXNB_SEPOLIA = 0x82B9e52b26A2954E113F94Ff26647754d5a4247D;
    address constant MXNB_MAINNET = 0xF197FFC28c23E0309B5559e7a166f2c6164C80aA;
    uint256 constant UNIT = 1e6;

    function run() external {
        address vaultsAddr = vm.envAddress("VAULTS_ADDRESS");
        address mxnb = block.chainid == 42161 ? MXNB_MAINNET : MXNB_SEPOLIA;
        uint256 fundHuman = vm.envOr("FUND_TREASURY_MXNB", uint256(50_000));
        uint256 fundUnits = fundHuman * UNIT;

        vm.startBroadcast();

        SeyfAdvance advance = new SeyfAdvance(vaultsAddr, mxnb);
        console.log("Nuevo SeyfAdvance (modelo anos):", address(advance));

        IVaultsAdmin(vaultsAddr).setAdvanceManager(address(advance));
        console.log("advanceManager actualizado en SeyfVaults:", vaultsAddr);

        IERC20Mint token = IERC20Mint(mxnb);
        uint256 bal = token.balanceOf(msg.sender);
        uint256 toFund = fundUnits > bal ? bal : fundUnits;
        if (toFund > 0) {
            require(token.approve(address(advance), toFund), "approve failed");
            advance.fundTreasury(toFund);
            console.log("Tesoreria fondeada (unidades 6 dec):", toFund);
        } else {
            console.log("AVISO: sin MXNB en el deployer; fondea tesoreria manualmente");
        }

        vm.stopBroadcast();

        console.log("\n# Actualiza .env y Vercel, luego reinicia el front:");
        console.log("NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS=", address(advance));
    }
}
