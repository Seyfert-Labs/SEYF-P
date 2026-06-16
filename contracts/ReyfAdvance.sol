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
/// @notice Adelanto de liquidez a 0% de costo para el usuario, por AÑOS de rendimiento.
///         El usuario compromete su principal libre como colateral (se bloquea
///         completo en la bóveda) y recibe por adelantado N años del rendimiento
///         que ese principal genera: `monto = principal × APY × años`.
///         El colateral sigue generando rendimiento off-chain; al repagar se
///         libera proporcionalmente (saldar todo libera todo).
///         Reyf obtiene el diferencial entre el APR de los instrumentos
///         subyacentes y el 0% que adelanta al usuario.
/// @dev    Tope de seguridad: el adelanto nunca excede el 90% del colateral
///         bloqueado (LTV ≤ 90%), lo que limita los años a `piso(0.90 / APY)`.
///         Debe registrarse como `advanceManager` en ReyfVaults.
contract ReyfAdvance is ReentrancyGuard {
    IReyfVaults public immutable vaults;
    IERC20 public immutable token;

    address public owner;
    address public pendingOwner;

    bool public paused;

    /// @notice LTV máximo del adelanto sobre el colateral bloqueado (90%).
    uint256 public constant MAX_LTV_BPS = 9000;

    /// @dev user => vaultId => saldo adeudado del adelanto (MXNB).
    mapping(address => mapping(uint256 => uint256)) public debt;

    event AdvanceTaken(address indexed user, uint256 indexed vaultId, uint256 years_, uint256 amount, uint256 collateral, uint256 newDebt);
    event Repaid(address indexed user, uint256 indexed vaultId, uint256 amount, uint256 released, uint256 newDebt);
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

    // -------- lecturas / cotización --------

    /// @notice Saldo libre de la bóveda (principal no comprometido como colateral).
    function freeBalance(address user, uint256 vaultId) public view returns (uint256) {
        IReyfVaults.Vault memory v = vaults.getVault(user, vaultId);
        if (!v.exists) return 0;
        uint256 locked = vaults.lockedAmount(user, vaultId);
        return v.balance > locked ? v.balance - locked : 0;
    }

    /// @notice Máximo de años de rendimiento adelantables (LTV ≤ 90%).
    ///         = piso(0.90 / APY) = piso(9000 / apyBps).
    function maxYears(address user, uint256 vaultId) public view returns (uint256) {
        IReyfVaults.Vault memory v = vaults.getVault(user, vaultId);
        if (!v.exists || v.apyBps == 0) return 0;
        if (freeBalance(user, vaultId) == 0) return 0;
        return MAX_LTV_BPS / v.apyBps;
    }

    /// @notice Cotiza el monto a recibir por adelantar `years_` años sobre el saldo libre.
    function quoteAdvance(address user, uint256 vaultId, uint256 years_) public view returns (uint256) {
        IReyfVaults.Vault memory v = vaults.getVault(user, vaultId);
        if (!v.exists) return 0;
        uint256 free = freeBalance(user, vaultId);
        return (free * v.apyBps * years_) / 10000;
    }

    // -------- usuario --------

    /// @notice Toma un adelanto de `years_` años de rendimiento.
    ///         Bloquea el saldo libre completo como colateral y entrega
    ///         `saldoLibre × APY × años`. El adelanto no excede el 90% del
    ///         colateral (años × apyBps ≤ 9000).
    /// @dev    Effects (lock + debt) antes de la interacción (transfer). nonReentrant.
    function requestAdvance(uint256 vaultId, uint256 years_) external nonReentrant whenNotPaused {
        require(years_ > 0, "years=0");
        IReyfVaults.Vault memory v = vaults.getVault(msg.sender, vaultId);
        require(v.exists, "no vault");
        require(v.apyBps > 0, "apy=0");
        require(years_ * v.apyBps <= MAX_LTV_BPS, "exceeds 90% LTV");

        uint256 free = freeBalance(msg.sender, vaultId);
        require(free > 0, "no free balance");

        uint256 amount = (free * v.apyBps * years_) / 10000;
        require(amount > 0, "amount=0");
        require(token.balanceOf(address(this)) >= amount, "treasury insufficient");

        // Colateral = principal libre completo (genera el rendimiento adelantado).
        vaults.lock(msg.sender, vaultId, free);
        debt[msg.sender][vaultId] += amount;

        emit AdvanceTaken(msg.sender, vaultId, years_, amount, free, debt[msg.sender][vaultId]);
        require(token.transfer(msg.sender, amount), "transfer failed");
    }

    /// @notice Repaga (total o parcial) el adelanto y libera el colateral proporcional.
    ///         Saldar la deuda completa libera todo el colateral restante. Requiere `approve`.
    function repay(uint256 vaultId, uint256 amount) external nonReentrant whenNotPaused {
        uint256 owed = debt[msg.sender][vaultId];
        require(amount > 0 && amount <= owed, "bad amount");

        uint256 lockedNow = vaults.lockedAmount(msg.sender, vaultId);
        // Liberación proporcional; al saldar todo se libera el colateral restante completo.
        uint256 release = amount == owed ? lockedNow : (lockedNow * amount) / owed;

        debt[msg.sender][vaultId] = owed - amount;
        if (release > 0) vaults.unlock(msg.sender, vaultId, release);

        emit Repaid(msg.sender, vaultId, amount, release, debt[msg.sender][vaultId]);
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
