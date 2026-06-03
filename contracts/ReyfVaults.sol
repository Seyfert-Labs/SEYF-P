// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";

/// @title ReyfVaults
/// @notice Bóvedas de ahorro de Reyf. Cada usuario abre bóvedas con nombre,
///         meta y estrategia (apyBps); deposita y retira MXNB libremente.
///         El contrato custodia el principal; el rendimiento proyectado se
///         calcula en el cliente a partir de `apyBps`.
/// @dev    Pensado para cuentas inteligentes (ERC-4337): `msg.sender` es la
///         smart wallet del usuario. Sin custodia central: cada quien solo
///         mueve sus propias bóvedas.
///
///         Soporte de "lien": un contrato autorizado (`advanceManager`, p. ej.
///         ReyfAdvance) puede bloquear parte del saldo como colateral. Lo
///         bloqueado no se puede retirar hasta que se libere. Las firmas
///         externas existentes (openVault/deposit/withdraw/closeVault/getVaults)
///         no cambian, así el frontend ya integrado sigue funcionando.
contract ReyfVaults is ReentrancyGuard {
    /// @notice Token custodiado (MXNB).
    IERC20 public immutable token;

    /// @notice Dueño del contrato (puede designar el advanceManager).
    address public owner;

    /// @notice Contrato autorizado a bloquear/liberar colateral (ReyfAdvance).
    address public advanceManager;

    struct Vault {
        string name;       // nombre de la meta ("Mi retiro", "Casa"…)
        uint256 goal;      // meta en unidades del token (6 decimales)
        uint256 balance;   // principal depositado actualmente
        uint16 apyBps;     // estrategia: rendimiento anual en basis points (1150 = 11.5%)
        uint64 createdAt;  // timestamp de apertura
        bool exists;       // false cuando se cierra la bóveda
    }

    /// @dev dueño => lista de bóvedas (el índice en el arreglo es el vaultId).
    mapping(address => Vault[]) private _vaults;

    /// @dev dueño => vaultId => monto bloqueado como colateral (no retirable).
    mapping(address => mapping(uint256 => uint256)) public lockedAmount;

    event VaultOpened(address indexed owner, uint256 indexed vaultId, string name, uint256 goal, uint16 apyBps);
    event Deposited(address indexed owner, uint256 indexed vaultId, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed owner, uint256 indexed vaultId, uint256 amount, uint256 newBalance);
    event VaultClosed(address indexed owner, uint256 indexed vaultId, uint256 returned);
    event Locked(address indexed owner, uint256 indexed vaultId, uint256 amount);
    event Unlocked(address indexed owner, uint256 indexed vaultId, uint256 amount);
    event AdvanceManagerSet(address indexed manager);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAdvanceManager() {
        require(msg.sender == advanceManager, "not advance manager");
        _;
    }

    constructor(address token_) {
        require(token_ != address(0), "token=0");
        token = IERC20(token_);
        owner = msg.sender;
    }

    /// @notice Designa el contrato de adelantos autorizado a bloquear colateral.
    function setAdvanceManager(address manager) external onlyOwner {
        advanceManager = manager;
        emit AdvanceManagerSet(manager);
    }

    // -------- operaciones del usuario --------

    /// @notice Abre una nueva bóveda para el llamante. Devuelve su id (índice).
    function openVault(string calldata name, uint256 goal, uint16 apyBps) external returns (uint256 vaultId) {
        vaultId = _vaults[msg.sender].length;
        _vaults[msg.sender].push(
            Vault({ name: name, goal: goal, balance: 0, apyBps: apyBps, createdAt: uint64(block.timestamp), exists: true })
        );
        emit VaultOpened(msg.sender, vaultId, name, goal, apyBps);
    }

    /// @notice Abona MXNB a una bóveda. Requiere `approve` previo al contrato.
    /// @dev    Checks-Effects-Interactions: se acredita el saldo y luego se
    ///         hace el `transferFrom`; si el pull falla, todo revierte.
    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        Vault storage v = _get(msg.sender, vaultId);
        require(amount > 0, "amount=0");
        v.balance += amount;
        emit Deposited(msg.sender, vaultId, amount, v.balance);
        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
    }

    /// @notice Retira MXNB libre (no bloqueado como colateral) hacia el dueño.
    function withdraw(uint256 vaultId, uint256 amount) external nonReentrant {
        Vault storage v = _get(msg.sender, vaultId);
        require(amount > 0, "amount=0");
        require(amount <= _free(msg.sender, vaultId, v.balance), "exceeds free balance");
        v.balance -= amount;
        emit Withdrawn(msg.sender, vaultId, amount, v.balance);
        require(token.transfer(msg.sender, amount), "transfer failed");
    }

    /// @notice Cierra una bóveda y devuelve el saldo. No se puede si hay colateral bloqueado.
    function closeVault(uint256 vaultId) external nonReentrant {
        Vault storage v = _get(msg.sender, vaultId);
        require(lockedAmount[msg.sender][vaultId] == 0, "vault has lien");
        uint256 bal = v.balance;
        v.balance = 0;
        v.exists = false;
        if (bal > 0) require(token.transfer(msg.sender, bal), "transfer failed");
        emit VaultClosed(msg.sender, vaultId, bal);
    }

    // -------- lien (solo advanceManager) --------

    /// @notice Bloquea `amount` del saldo libre como colateral de un adelanto.
    function lock(address user, uint256 vaultId, uint256 amount) external onlyAdvanceManager {
        Vault storage v = _get(user, vaultId);
        require(amount <= _free(user, vaultId, v.balance), "exceeds free balance");
        lockedAmount[user][vaultId] += amount;
        emit Locked(user, vaultId, amount);
    }

    /// @notice Libera `amount` de colateral (al repagar el adelanto).
    function unlock(address user, uint256 vaultId, uint256 amount) external onlyAdvanceManager {
        require(amount <= lockedAmount[user][vaultId], "exceeds locked");
        lockedAmount[user][vaultId] -= amount;
        emit Unlocked(user, vaultId, amount);
    }

    // -------- lecturas --------

    function vaultCount(address user) external view returns (uint256) {
        return _vaults[user].length;
    }

    function getVault(address user, uint256 vaultId) external view returns (Vault memory) {
        return _vaults[user][vaultId];
    }

    /// @notice Devuelve todas las bóvedas del dueño (incluye cerradas: filtra por `exists`).
    function getVaults(address user) external view returns (Vault[] memory) {
        return _vaults[user];
    }

    /// @notice Saldo retirable (principal menos colateral bloqueado).
    function availableToWithdraw(address user, uint256 vaultId) external view returns (uint256) {
        return _free(user, vaultId, _vaults[user][vaultId].balance);
    }

    function _free(address user, uint256 vaultId, uint256 balance) private view returns (uint256) {
        uint256 locked = lockedAmount[user][vaultId];
        return balance > locked ? balance - locked : 0;
    }

    function _get(address user, uint256 vaultId) private view returns (Vault storage) {
        require(vaultId < _vaults[user].length, "no vault");
        Vault storage v = _vaults[user][vaultId];
        require(v.exists, "closed");
        return v;
    }
}
