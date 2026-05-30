# Integración Bitso Business / Juno (MXNB) — SEYF2 / Utonoma

**Versión de la integración:** `1.0.0`
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

## 7. Changelog

### 1.0.0 — 2026-05-30
- Port inicial desde `puma-pay-campus-wallet`.
- 11 route handlers de Next.js + cliente tipado + hooks de React.
- Conexión de botones en Wallet y Convertir.
- Migración de `axios`/`uuid` a `fetch`/`crypto` nativos (sin deps extra).
