# Integración Bitso Business / Juno (MXNB) + Wallets sociales — Seyf

**Versión de la integración:** `1.2.0`
**Entorno por defecto:** `stage` (`https://stage.buildwithjuno.com`)
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5

Portada desde `puma-pay-campus-wallet` (carpeta `api/` + `src/services`) y reescrita
como **route handlers de Next.js**. Las credenciales viven **solo en el servidor**;
el frontend nunca firma HMAC ni ve los secretos.

---

## 1. Arquitectura

```
Navegador (UI)                Servidor (Next.js)                 Juno / Bitso
─────────────                 ──────────────────                 ────────────
src/components/app/*  ──▶  src/hooks/useJuno.ts
                           src/services/junoService.ts
                                     │  fetch /api/juno/*
                                     ▼
                           src/app/api/juno/*/route.ts  ──HMAC──▶  buildwithjuno.com
                           src/lib/juno/client.ts (firma + fetch)
```

- **`src/lib/juno/client.ts`** — `buildJunoAuthHeader()` (HMAC-SHA256, esquema
  `Bitso <key>:<nonce>:<sig>`) + `junoRequest()` (fetch firmado, idempotencia, timeout).
  Usa `crypto` y `fetch` nativos: **cero dependencias extra**.
- **`src/lib/juno/respond.ts`** — helpers `ok` / `fail` / `badRequest`.
- **`src/app/api/juno/*`** — 11 endpoints (ver tabla).
- **`src/services/junoService.ts`** — cliente tipado para el navegador.
- **`src/hooks/useJuno.ts`** — hooks de React (`useMXNBBalance`, `useTransactions`,
  `useBankAccounts`, `useAccountClabes`, `useJunoAction`).
- **`src/types/juno.ts`** — tipos compartidos.

## 2. Endpoints (`/api/juno/*`)

| Método | Ruta interna | Juno upstream | Función |
|--------|--------------|---------------|---------|
| GET  | `/api/juno/health`          | —                                        | Estado + si hay credenciales |
| GET  | `/api/juno/account-details` | `/spei/v1/clabes?clabe_type=AUTO_PAYMENT`| CLABEs de depósito |
| POST | `/api/juno/create-clabe`    | `/mint_platform/v1/clabes`               | Crear CLABE única |
| POST | `/api/juno/mock-deposit`    | `/spei/test/deposits`                    | Simular depósito SPEI (stage) → issuance |
| GET  | `/api/juno/balance`         | `/mint_platform/v1/balances`             | Balances (MXNB) |
| GET  | `/api/juno/transactions`    | `/mint_platform/v1/transactions`         | Historial |
| GET  | `/api/juno/bank-accounts`   | `/mint_platform/v1/accounts/banks`       | Cuentas registradas |
| POST | `/api/juno/register-bank`   | `/mint_platform/v1/accounts/banks`       | Registrar CLABE destino |
| POST | `/api/juno/redeem`          | `/mint_platform/v1/redemptions`          | Redimir MXNB → MXN (idempotente) |
| POST | `/api/juno/withdrawal`      | `/mint_platform/v1/withdrawals`          | Retiro on-chain (idempotente) |
| POST | `/api/juno/webhook`         | —                                        | Recibir eventos (firma verificada) |

## 3. Variables de entorno

Define en `.env.local` (ver `.env.example`):

| Variable | Lado | Requerida | Descripción |
|----------|------|-----------|-------------|
| `BITSO_APIKEY`         | server | ✅ | API key de Juno (stage) |
| `BITSO_SECRET_APIKEY`  | server | ✅ | API secret de Juno (stage) |
| `JUNO_BASE_URL`        | server | ⬜ | Default `https://stage.buildwithjuno.com` |
| `JUNO_WEBHOOK_SECRET`  | server | ⬜ | Verificación de firma de webhooks |
| `NEXT_PUBLIC_BACKEND_URL` | cliente | ⬜ | Solo si el backend vive en otro origen |

> ⚠️ Nunca pongas las llaves de Juno bajo `NEXT_PUBLIC_*`.

## 4. Flujos conectados en la UI

| Pantalla | Botón | Acción Juno |
|----------|-------|-------------|
| **Home** (`screens/core.tsx`) | Patrimonio / Pesos digitales | `GET /balance` (MXNB en vivo) |
| Home | **Agregar** / **Enviar** | `DepositModal` / `RedeemModal` |
| **Wallet** (`screens/core.tsx`) | Saldo disponible | `GET /balance` (`useMXNBBalance`) |
| Wallet | Movimientos | `GET /transactions` (`useTransactions`) |
| Wallet | **Agregar** | `DepositModal` → `create-clabe` + `mock-deposit` |
| Wallet | **Enviar** | `RedeemModal` → `register-bank` + `redeem` |
| **Convertir** (`screens/invest.tsx`) | Redimir MXNB a pesos | `RedeemModal` → `redeem` |

Si Juno no está configurado o no responde, la UI cae a los datos demo del
prototipo (saldo y movimientos mock) para no romper la experiencia.

## 5. Cómo probar

```bash
cp .env.example .env.local   # añade BITSO_APIKEY / BITSO_SECRET_APIKEY
npm install
npm run dev                  # http://localhost:3000

# smoke test del backend:
curl http://localhost:3000/api/juno/health
curl http://localhost:3000/api/juno/balance
```

En la app: **Inicio → Agregar** (genera CLABE y simula un depósito) y luego
**Enviar** (registra una CLABE y redime a MXN).

## 6. Seguridad

- Flujo **solo vía backend** para issuance/redeem (sin HMAC en el cliente).
- Idempotencia (`X-Idempotency-Key`) en `redeem` y `withdrawal`.
- Webhook con verificación de firma `timingSafeEqual`.
- `mock-deposit` está restringido al endpoint `/spei/test/*` de stage.

## 8. Wallets sociales (Privy) + saldo on-chain

Login social con **Privy** (Google / Email OTP) que crea una **wallet embebida sin
seed phrase** en Arbitrum. El usuario no maneja llaves ni firma para entrar.

- **`src/components/Providers.tsx`** — `PrivyProvider` (montado solo en `/app` vía
  `src/app/app/layout.tsx`). Sin `NEXT_PUBLIC_PRIVY_APP_ID`, la app corre en modo demo.
- **`src/components/wallet/PrivyBridge.tsx`** — traduce el estado de Privy + el saldo
  MXNB on-chain al `WalletContext`.
- **`src/components/wallet/WalletContext.tsx`** — `useWallet()` que consumen las pantallas
  (no llaman hooks de Privy directamente).
- **`src/lib/chain.ts`** — chain (Arbitrum Sepolia/One), dirección de MXNB y lectura del
  saldo ERC-20 con viem (`readMXNBBalance`).

**Dato clave:** `/api/juno/balance` es el saldo de la **cuenta de negocio** (Bitso
Business), no el de cada usuario. El saldo **por usuario** se lee on-chain de su wallet
(`Home`/`Wallet` muestran `wallet.balance`). El onboarding (`/app`) gatea por sesión:
sin login se muestra el onboarding; al iniciar sesión aparece la app.

Variables nuevas (ver `.env.example`): `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_CHAIN`,
`NEXT_PUBLIC_MXNB_ADDRESS`, `NEXT_PUBLIC_ARBITRUM_RPC`.

> Siguiente paso (gasless real): activar **smart wallets** de Privy + un paymaster
> (Pimlico/ZeroDev) para patrocinar gas en transferencias on-chain del usuario.

## 9. Changelog

### 1.2.0 — 2026-05-30
- Wallets sociales con **Privy** (Google / Email), wallet embebida sin seed phrase.
- Saldo **MXNB on-chain real por usuario** (viem, Arbitrum Sepolia).
- Onboarding gateado por sesión; Perfil muestra wallet + cerrar sesión.

### 1.1.0 — 2026-05-30
- Marca renombrada Utonoma → **Seyf**.
- App responsiva (móvil/escritorio), sin marco de teléfono.
- Home conectado a Juno: saldo MXNB en vivo + accesos a depósito/redención.

### 1.0.0 — 2026-05-30
- Port inicial desde `puma-pay-campus-wallet`.
- 11 route handlers de Next.js + cliente tipado + hooks de React.
- Conexión de botones en Wallet y Convertir.
- Migración de `axios`/`uuid` a `fetch`/`crypto` nativos (sin deps extra).
