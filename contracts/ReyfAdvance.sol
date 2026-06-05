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
    function lockedAmount(address user, uint256 vaultId) external view returns (uint256);
    function lock(address user, uint256 vaultId, uint256 amount) external;
    function unlock(address user, uint256 vaultId, uint256 amount) external;
}

/// @title ReyfAdvance
/// @notice Adelanto de liquidez a 0% de costo para el usuario.
///         El usuario recibe MXNB hoy sin vender su principal: se bloquea
///         un colateral 1:1 en su bóveda. El colateral sigue generando
///         rendimiento off-chain; si el usuario no repaga manualmente, el
///         rendimiento acumulado cubre la deuda de forma natural.
///         Reyf obtiene el diferencial entre el APR de los instrumentos
///         subyacentes y el 0% que adelanta al usuario.
/// @dev    Tope = saldo de la bóveda / 2 (50% del principal).
///         Debe registrarse como `advanceManager` en ReyfVaults.
contract ReyfAdvance is ReentrancyGuard {
    IReyfVaults public immutable vaults;
    IERC20 public immutable token;

    address public owner;
    address public pendingOwner;

    bool public paused;

    /// @dev user => vaultId => saldo adeudado del adelanto (== colateral bloqueado).
    mapping(address => mapping(uint256 => uint256)) public debt;

    event AdvanceTaken(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 newDebt);
    event Repaid(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 newDebt);
    event TreasuryFunded(address indexed from, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferStarted(address indexed current, address indexed pending);
    event OwnershipTransferred(address indexed previous, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address vaults_, address token_) {
        require(vaults_ != address(0) && token_ != address(0), "zero addr");
        vaults = IReyfVaults(vaults_);
        token = IERC20(token_);
        owner = msg.sender;
    }

    // -------- admin --------

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    // -------- usuario --------

    /// @notice Adelanto máximo disponible: ≈ 1 año de rendimiento sobre el saldo LIBRE
    ///         (balance menos lo ya bloqueado como colateral), menos deuda actual.
    function maxAdvance(address user, uint256 vaultId) public view returns (uint256) {
        IReyfVaults.Vault memory v = vaults.getVault(user, vaultId);
        if (!v.exists) return 0;
        uint256 locked = vaults.lockedAmount(user, vaultId);
        uint256 free = v.balance > locked ? v.balance - locked : 0;
        uint256 cap = (free * v.apyBps) / 10000;
        uint256 owed = debt[user][vaultId];
        return cap > owed ? cap - owed : 0;
    }

    /// @notice Toma un adelanto: bloquea colateral 1:1 en la bóveda y recibe MXNB.
    /// @dev    Effects (lock + debt) antes de la interacción (transfer). nonReentrant.
    function requestAdvance(uint256 vaultId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "amount=0");
        require(amount <= maxAdvance(msg.sender, vaultId), "exceeds max advance");
        require(token.balanceOf(address(this)) >= amount, "treasury insufficient");

        vaults.lock(msg.sender, vaultId, amount);
        debt[msg.sender][vaultId] += amount;

        emit AdvanceTaken(msg.sender, vaultId, amount, debt[msg.sender][vaultId]);
        require(token.transfer(msg.sender, amount), "transfer failed");
    }

    /// @notice Repaga (total o parcial) el adelanto y libera el colateral. Requiere `approve`.
    function repay(uint256 vaultId, uint256 amount) external nonReentrant whenNotPaused {
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
