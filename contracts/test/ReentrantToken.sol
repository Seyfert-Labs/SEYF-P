// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReentered {
    function reenter() external;
}

/// @notice Token ERC-20 MALICIOSO para probar la protección de reentrancy:
///         cuando envía tokens a `hook` y está "armado", llama de vuelta a
///         `hook.reenter()` (estilo ERC-777). Si el contrato objetivo no está
///         protegido, esto permitiría reentrar; con el guard, revierte.
contract ReentrantToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public hook;
    bool public armed;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function arm(address hook_) external {
        hook = hook_;
        armed = true;
    }

    function disarm() external {
        armed = false;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        _maybeReenter(to);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _transfer(from, to, amount);
        _maybeReenter(to);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }

    function _maybeReenter(address to) internal {
        if (armed && to == hook) {
            IReentered(to).reenter(); // si revierte (guard), propaga y aborta todo
        }
    }
}
