# Contratos de Reyf

Dos contratos simples para el ahorro on-chain en MXNB (ERC-20, 6 decimales),
pensados para usarse desde la smart wallet del usuario (ERC-4337, gas
patrocinado vía Privy).

## 1. `ReyfVaults.sol` — bóvedas de ahorro
Custodia MXNB en bóvedas con nombre, meta y estrategia (`apyBps`) por usuario.
Cada quien solo mueve sus propias bóvedas; sin admin sobre los fondos.

- `openVault(name, goal, apyBps)` → abre una bóveda, devuelve su id
- `deposit(vaultId, amount)` → abona (requiere `approve` previo de MXNB)
- `withdraw(vaultId, amount)` → retira **saldo libre** (no el bloqueado como colateral)
- `closeVault(vaultId)` → cierra y devuelve el saldo (no permitido con colateral activo)
- `getVaults(owner)` → lista (el front filtra `exists`)
- `availableToWithdraw(owner, vaultId)` → principal − colateral bloqueado

**Lien:** un contrato autorizado (`advanceManager`) puede `lock`/`unlock` parte
del saldo como colateral. Lo bloqueado no se puede retirar. El `owner` del
contrato designa ese manager con `setAdvanceManager`.

`apyBps` = rendimiento anual en basis points (1150 = 11.5%). Es informativo: el
contrato custodia el **principal** y el front proyecta el rendimiento.

## 2. `ReyfAdvance.sol` — adelanto de liquidez
Adelanta MXNB hoy contra el rendimiento futuro del ahorro, **sin vender el
principal** y a **0% de interés**.

- `maxAdvance(user, vaultId)` → tope = `saldo × apyBps / 10000` (≈ 1 año de rendimiento) − deuda
- `requestAdvance(vaultId, amount)` → bloquea colateral 1:1 en la bóveda y entrega MXNB de la tesorería
- `repay(vaultId, amount)` → repaga (requiere `approve`) y libera el colateral
- `fundTreasury(amount)` / `withdrawTreasury(amount)` → owner gestiona la tesorería
- `treasuryBalance()` → MXNB disponible para adelantos

La tesorería la fondea Reyf (el `owner`). El colateral vive en la bóveda del
usuario (no en este contrato), así que retirar tesorería sobrante no toca
garantías de nadie.

## Direcciones MXNB
- Arbitrum Sepolia (testnet): `0x82B9e52b26A2954E113F94Ff26647754d5a4247D`
- Arbitrum One (mainnet):     `0xF197FFC28c23E0309B5559e7a166f2c6164C80aA`

## Compilar (Foundry)
```bash
cd contracts
forge build         # usa foundry.toml (src = ".")
```

## Tests
```bash
cd contracts
forge install foundry-rs/forge-std --no-git   # una vez (dependencia de tests, en lib/)
forge test -vv
```
21 tests cubren: abrir/abonar/retirar, aislamiento por usuario, lien
(lock/unlock + control de acceso), cierre con colateral, adelanto (tope,
colateral, repago total/parcial, tesorería) y **2 tests de reentrancy** (un
token malicioso reentra `withdraw` y `requestAdvance`; ambos revierten con
`"reentrant"`). `lib/` está en `.gitignore`.

## Seguridad (resumen)
- **Reentrancy:** guard `nonReentrant` en todas las funciones que mueven tokens
  + orden checks-effects-interactions (saldo/deuda se actualizan antes de
  transferir). Verificado con tests de ataque.
- **Control de acceso:** `setAdvanceManager`/tesorería = `onlyOwner`;
  `lock`/`unlock` = `onlyAdvanceManager`; cada usuario solo mueve sus bóvedas.
- **Aritmética:** Solidity 0.8 (overflow/underflow revierten).
- **Colateral:** `withdraw` solo permite el saldo libre; `closeVault` se bloquea
  si hay lien; `lock` no excede el saldo libre.
- **Supuestos:** MXNB es un ERC-20 estándar (sin hooks); el `owner` fondea la
  tesorería del adelanto. `apyBps` es informativo (proyección en el cliente).

## Desplegar (Arbitrum Sepolia) — en orden

```bash
export PRIVATE_KEY=0xtu_llave_privada           # wallet de prueba
export RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
export MXNB=0x82B9e52b26A2954E113F94Ff26647754d5a4247D

# 1) Bóvedas
forge create ReyfVaults.sol:ReyfVaults \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
  --constructor-args $MXNB --broadcast
# => guarda la dirección: export VAULTS=0x...

# 2) Adelanto (apunta a la bóveda y al token)
forge create ReyfAdvance.sol:ReyfAdvance \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
  --constructor-args $VAULTS $MXNB --broadcast
# => export ADVANCE=0x...

# 3) Autoriza el adelanto a bloquear colateral en la bóveda
cast send $VAULTS "setAdvanceManager(address)" $ADVANCE \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# 4) Fondea la tesorería del adelanto (ej. 10,000 MXNB = 10000_000000, 6 dec)
cast send $MXNB "approve(address,uint256)" $ADVANCE 10000000000 \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
cast send $ADVANCE "fundTreasury(uint256)" 10000000000 \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Conectar al frontend
En `.env.local`:
```bash
NEXT_PUBLIC_SEYF_VAULTS_ADDRESS=0x...   # dirección de ReyfVaults
# (cuando se cablee el adelanto on-chain)
# NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS=0x...
```
Reinicia `npm run dev`. La pantalla **Ahorro** opera las bóvedas contra el
contrato (badge "On-chain"). Sin la variable, la app sigue con la capa `store`
(degradación graceful).

> Gas patrocinado: las operaciones (abrir/abonar/retirar/adelanto) las paga la
> smart wallet del usuario vía el paymaster de Privy; el usuario solo necesita
> MXNB, no ETH.

> Nota: `out/`, `cache/` y `broadcast/` están en `.gitignore` (artefactos).
