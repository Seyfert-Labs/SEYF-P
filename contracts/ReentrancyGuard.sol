// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Guard simple contra reentrancy (sin dependencias externas).
///         Un solo slot de estado; revierte si una función `nonReentrant`
///         se vuelve a entrar antes de terminar.
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_status == _NOT_ENTERED, "reentrant");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}
