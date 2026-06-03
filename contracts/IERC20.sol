// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interfaz mínima de ERC-20 (MXNB tiene 6 decimales).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
