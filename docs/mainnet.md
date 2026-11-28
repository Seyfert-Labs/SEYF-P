# SEYF en mainnet: contratos, invocaciones y cómo los usa el frontend

Estado al 2026-11-28. Las direcciones salen de [`soroban/DEPLOYMENTS.md`](../soroban/DEPLOYMENTS.md),
que es la única fuente válida (hay cuentas *look-alike* en el historial).

App: https://www.seyf.app/app · Release: [v0.1.0](https://github.com/Seyfert-Labs/SEYF-P/releases/tag/v0.1.0) (beta con topes, contrato sin auditar).

## Contratos

| Contrato | Dirección | Explorer |
| --- | --- | --- |
| `seyf_advance` (propio, Soroban) | `CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH` | [stellar.expert](https://stellar.expert/explorer/public/contract/CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH) |
| Vault USDC Meru (DeFindex, presta en Blend) | `CCA2ZJP5BVRXYTQH4FAGHCAUMRYCXVC4CRYC2NXHWMR7TIVX36U7F5HR` | [stellar.expert](https://stellar.expert/explorer/public/contract/CCA2ZJP5BVRXYTQH4FAGHCAUMRYCXVC4CRYC2NXHWMR7TIVX36U7F5HR) |

Parámetros vigentes de `seyf_advance`: `apy_bps` 50, `max_advance_bps` 500, plazo de 1 a 30 días,
tope de 1 USDC por usuario y 2 USDC en total, allowlist apagada.

## Cómo firma el frontend

Todas las escrituras siguen el mismo camino (`src/components/retiro/api.ts` → `buildSignSubmit`):

1. El frontend pide el XDR a una ruta del servidor (`/api/advance/build`, `/api/vault/build` o `/api/defindex/prepare`).
2. El servidor arma la invocación, la **simula** (`simulateTransaction` + `assembleTransaction`) y devuelve el XDR.
3. El usuario la firma en el diálogo de **Pollar** (wallet cofirmada Turnkey 2 de 2, sin seed phrase).
4. `/api/stellar/sponsor/submit` la envuelve en un **fee-bump** del sponsor (`GDPVVG…HB72`): el usuario no necesita XLM.
5. El servidor espera el resultado (`pollTransaction`) y la app muestra el enlace a stellar.expert.

## Las 5 invocaciones en mainnet

| # | Función | Contrato | Pantalla del frontend | Ruta / código | Transacción en mainnet | Quién firmó |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `deposit` | Vault Meru | `/app`: Ahorro → bóveda → **Abonar** · `/retiro`: **Depositar** | `/app`: `src/lib/defindex/sign-and-submit.ts` → `POST /api/defindex/prepare` + `/api/defindex/submit` · `/retiro`: `AhorroScreen.tsx` → `POST /api/vault/build {action:'deposit'}` → `buildVaultDeposit` (`src/lib/advance/vault.ts`) | [23572a98…](https://stellar.expert/explorer/public/tx/23572a98345f5973a144cd40422c22f815ac8d76b89e68e188cbcd8767a858d1) | Usuario desde la app (Pollar) |
| 2 | `open_advance` | `seyf_advance` | Adelanto → plazo → **Pedir adelanto** | `AdelantoScreen.tsx` → `POST /api/advance/build {action:'open'}` → `buildOpenAdvance` (`src/lib/advance/contract.ts`) | [ab42eac9…](https://stellar.expert/explorer/public/tx/ab42eac9fbd19885cbe6f7fa47a035531ff794f387fd3f5a171ce0fb4586606c) | Usuario desde la app (Pollar) |
| 3 | `repay` | `seyf_advance` | Adelanto activo → **Repagar … USDC y liberar ya** | `AdelantoScreen.tsx` → `POST /api/advance/build {action:'repay'}` → `buildCloseAdvance` | [5cfd5592…](https://stellar.expert/explorer/public/tx/5cfd5592482eac2cdb08a077df8b7e40696e1b2c24d284e1aaef98445bf4da80) | Usuario desde la app (Pollar) |
| 4 | `settle` | `seyf_advance` | "Tu rendimiento ya cubrió" → **Liberar mi ahorro** | `AdelantoScreen.tsx` → `POST /api/advance/build {action:'settle'}` → `buildCloseAdvance` | [be77ba1e…](https://stellar.expert/explorer/public/tx/be77ba1e080e77d337c45b351226d535982bafb24be2fb9ef022ff58ec5e0e19) | Keeper (`scripts/keeper.mjs`); `settle` lo puede llamar cualquiera |
| 5 | `withdraw` | Vault Meru | `/app`: bóveda → **Retirar** · `/retiro`: **Retirar** | `/app`: `sign-and-submit.ts` (DeFindex) · `/retiro`: `AhorroScreen.tsx` → `POST /api/vault/build {action:'withdraw'}` → `buildVaultWithdraw` | [082bee22…](https://stellar.expert/explorer/public/tx/082bee220cdde1d072b6d7d8792a6e4d1b53ae152433ac31bd7e225824ec45de) | Admin por CLI, misma invocación que arma la app |

Los cinco hashes se verificaron en Horizon (`successful: true`) el 2026-11-28. Las filas 1–3 salieron de la
wallet de Pollar del usuario `GAG2HATH…GRK2` con fee-bump del sponsor; la cuenta del usuario sigue en 0 XLM.

## Lecturas (simuladas, sin transacción)

El frontend también llama funciones de solo lectura de `seyf_advance` simulándolas en Soroban RPC:

| Función | Uso en el frontend | Ruta |
| --- | --- | --- |
| `quote(user, shares, term_days)` | Cotización en vivo de "Recibes hoy" al mover el plazo | `GET /api/advance/quote` → `quoteAdvance` |
| `position(user)`, `unlock_status(user)` | Estado del adelanto activo y si ya se puede cerrar con `settle` | `GET /api/advance/position` → `advancePosition` |
| `params()`, `treasury()` | Plazo mínimo y máximo del slider, topes y saldo disponible de la tesorería | `GET /api/advance/position` |

La landing muestra la actividad del contrato (`/api/advance/activity`), leída de sus eventos.

## Funciones de administración (no van en el frontend)

`fund_treasury`, `set_params`, `set_allowed`, `pause`/`unpause` y `propose_admin`/`accept_admin` solo las firma la
llave admin por CLI. Esa llave nunca va a un servidor. Sus hashes están en `soroban/DEPLOYMENTS.md`.
