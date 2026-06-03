// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";

/// @notice Interfaz hacia ReyfVaults (solo lo que el adelanto necesita).
interface IReyfVaults {
    struct Vault {
        string name;
        uint256 goal;
        uint256 balance;
        uint16 apyBps;
        uint64 createdAt;
        bool exists;
    }
    function getVault(address user, uint256 vaultId) external view returns (Vault memory);
    function lock(address user, uint256 vaultId, uint256 amount) external;
    function unlock(address user, uint256 vaultId, uint256 amount) external;
}

/// @title ReyfAdvance
/// @notice Adelanto de liquidez sobre el rendimiento futuro del ahorro.
///         El usuario recibe MXNB hoy (de una tesorería que Reyf fondea) sin
///         vender su principal: se bloquea un colateral 1:1 en su bóveda y el
///         adelanto es a 0% de interés. Al repagar, se libera el colateral.
/// @dev    Tope = saldo de la bóveda × apyBps / 10000 (≈ 1 año de rendimiento
///         proyectado), menos lo ya adeudado. Debe registrarse como
///         `advanceManager` en ReyfVaults para poder bloquear colateral.
contract ReyfAdvance is ReentrancyGuard {
    IReyfVaults public immutable vaults;
    IERC20 public immutable token;
    address public owner;

    /// @dev user => vaultId => saldo adeudado del adelanto (== colateral bloqueado).
    mapping(address => mapping(uint256 => uint256)) public debt;

    event AdvanceTaken(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 newDebt);
    event Repaid(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 newDebt);
    event TreasuryFunded(address indexed from, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address vaults_, address token_) {
        require(vaults_ != address(0) && token_ != address(0), "zero addr");
        vaults = IReyfVaults(vaults_);
        token = IERC20(token_);
        owner = msg.sender;
    }

    // -------- usuario --------

    /// @notice Adelanto máximo disponible para una bóveda (≈ 1 año de rendimiento, menos deuda).
    function maxAdvance(address user, uint256 vaultId) public view returns (uint256) {
        IReyfVaults.Vault memory v = vaults.getVault(user, vaultId);
        if (!v.exists) return 0;
        uint256 cap = (v.balance * v.apyBps) / 10000; // 1 año de rendimiento proyectado
        uint256 owed = debt[user][vaultId];
        return cap > owed ? cap - owed : 0;
    }

    /// @notice Toma un adelanto: bloquea colateral 1:1 en la bóveda y recibe MXNB.
    /// @dev    Effects (lock + debt) antes de la interacción (transfer). nonReentrant.
    function requestAdvance(uint256 vaultId, uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(amount <= maxAdvance(msg.sender, vaultId), "exceeds max advance");
        require(token.balanceOf(address(this)) >= amount, "treasury insufficient");

        // Bloquea el colateral en la bóveda del usuario (revierte si no hay saldo libre).
        vaults.lock(msg.sender, vaultId, amount);
        debt[msg.sender][vaultId] += amount;

        emit AdvanceTaken(msg.sender, vaultId, amount, debt[msg.sender][vaultId]);
        require(token.transfer(msg.sender, amount), "transfer failed");
    }

    /// @notice Repaga (total o parcial) el adelanto y libera el colateral. Requiere `approve`.
    /// @dev    Checks-Effects-Interactions: reduce deuda y libera colateral antes
    ///         del `transferFrom`; si el pull falla, todo revierte. nonReentrant.
    function repay(uint256 vaultId, uint256 amount) external nonReentrant {
        uint256 owed = debt[msg.sender][vaultId];
        require(amount > 0 && amount <= owed, "bad amount");

        debt[msg.sender][vaultId] = owed - amount;
        vaults.unlock(msg.sender, vaultId, amount);
        emit Repaid(msg.sender, vaultId, amount, debt[msg.sender][vaultId]);

        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
    }

    // -------- tesorería (owner) --------

    /// @notice Fondea la tesorería del adelanto con MXNB. Requiere `approve` previo.
    function fundTreasury(uint256 amount) external onlyOwner nonReentrant {
        emit TreasuryFunded(msg.sender, amount);
        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
    }

    /// @notice Retira MXNB sobrante de la tesorería (no afecta colaterales, que viven en la bóveda).
    function withdrawTreasury(uint256 amount) external onlyOwner nonReentrant {
        emit TreasuryWithdrawn(msg.sender, amount);
        require(token.transfer(msg.sender, amount), "transfer failed");
    }

    function treasuryBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
