# SEYF — Base de datos (todo lo que ocupa Supabase hoy)

Esta carpeta es **autocontenida** para migrar TODA la base a nuevos servers Postgres
(Supabase u otro Postgres). No se usa Redis/Upstash: **toda** la persistencia vive aquí.

## Qué desplegar

- **`schema.sql`** — script **único e idempotente** con TODAS las tablas, índices, RLS y
  comentarios. Es lo único que necesitas correr en el server nuevo. Se puede ejecutar
  varias veces sin romper nada (usa `create table if not exists` / `add column if not exists`).
- **`migrations/`** — historial incremental por fecha (referencia). Para un server nuevo
  **no** las necesitas: basta con `schema.sql`.

### Pasos (server nuevo)

1. Crea el proyecto/instancia Postgres (Supabase → SQL Editor, o `psql`).
2. Ejecuta **todo** `schema.sql`.
3. Al final imprime dos comprobaciones: la lista de las 15 tablas y las columnas de `vaults`.
4. Apunta la app al server nuevo con estas variables (solo servidor):

```env
NEXT_PUBLIC_USE_SUPABASE=true
SUPABASE_URL=https://<nuevo-proyecto>.supabase.co   # o la URL del Postgres nuevo
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>          # NUNCA en el cliente
```

> RLS está activado en todas las tablas: solo el **service role** (servidor) accede.
> Cliente Postgres/PostgREST anónimo no puede leer/escribir.

## Inventario — 15 tablas (todas las que usa el código)

| Tabla | Guarda | Clave | Usada por |
|---|---|---|---|
| `profiles` | Perfil del usuario (wallet, email, Privy DID, nombre, teléfono, perfil de riesgo, stellar pk) | `wallet_address` | `lib/supabase/db.ts` · `/api/db/profile` |
| `deposit_clabes` | CLABE única de depósito SPEI→MXNB por usuario | `clabe` | `/api/db/clabe` · `useUserClabe` |
| `bank_accounts` | CLABEs bancarias destino para retiros/adelantos | `id` | `/api/db/banks` · `useUserBanks` |
| `vaults` | Bóvedas de ahorro (balance, apy, plan/estrategia DeFindex) — **money timer** | `id` | `/api/db/vaults` · `useVaults` |
| `bonus_claims` | Bono de bienvenida reclamado (monto, tx) | `wallet_address` | `store.setBonus` · `/api/db/bonus` |
| `transactions` | Movimientos on-chain (kind, monto, status, hash) | `id` (uuid) | `/api/db/*` · `usePendingTxns` |
| `conversions` | Conversiones FX (Bitso): from/to, montos, idempotencia por `oid` | `id` | `/api/convert` · `useConversions` |
| `monthly_limits` | Uso mensual de depósito/retiro por periodo | `(wallet_address, period)` | `useMonthlyLimits` |
| `liquidity_loans` | Adelantos de liquidez (monto, colateral, APR, status) | `id` (uuid) | flujo de adelanto |
| `kyc_state` | Snapshot del KYC Etherfuse (status, approvedAt, rechazo) | `(customer_id, wallet_public_key)` | `lib/seyf/kyc-state-store` · `/api/seyf/kyc/status` |
| `onboarding_sessions` | Mapa wallet Stellar → `{customerId, bankAccountId}` de Etherfuse | `wallet_public_key` | `lib/seyf/onboarding-session-store` |
| `kyc_agreements` | Aceptación de términos Etherfuse | `(customer_id, wallet_public_key)` | `lib/seyf/agreements-state-store` |
| `rate_limit_buckets` | Rate limiting server-side (hits, expira) | `bucket_key` | `lib/seyf/guards` |
| `advance_sessions` | Estado del cálculo de adelanto (payload jsonb) | `customer_id` | flujo de adelanto |
| `onramp_locks` | Lock distribuido para evitar órdenes onramp concurrentes | `customer_id` | `/api/seyf/etherfuse/order/onramp` |

## Money timer (saldo que crece en pantalla)

La UI **no** escribe el saldo cada segundo. Guarda `vaults.balance` (saldo real) y
`vaults.updated_at` (ancla temporal); la pantalla deriva:

```
valor = balance + balance × (APY/100) × (ahora − updated_at)
```

Tras cada abono/retiro la app actualiza `balance` y `updated_at`.

## Migrar los DATOS (no solo el esquema)

`schema.sql` crea la **estructura**. Para llevar también los datos del Supabase actual:

- **Opción A (Supabase → Supabase):** en el proyecto viejo, Dashboard → Database →
  Backups / `pg_dump`; restaura en el nuevo con `pg_restore`/`psql`.
- **Opción B (`pg_dump` solo datos):**
  ```bash
  # 1) estructura en el server nuevo
  psql "$NUEVA_URL" -f database/schema.sql
  # 2) copia solo los datos del viejo al nuevo
  pg_dump "$VIEJA_URL" --data-only --schema=public \
    --table=public.profiles --table=public.deposit_clabes --table=public.bank_accounts \
    --table=public.vaults --table=public.bonus_claims --table=public.transactions \
    --table=public.conversions --table=public.monthly_limits --table=public.liquidity_loans \
    --table=public.kyc_state --table=public.onboarding_sessions --table=public.kyc_agreements \
    --table=public.rate_limit_buckets --table=public.advance_sessions --table=public.onramp_locks \
    | psql "$NUEVA_URL"
  ```
  (Respeta el orden por las FKs a `profiles`; `--data-only` de todas las tablas juntas lo maneja.)

> Las credenciales de las bases (URLs, keys) **no** están en el repo — viven en `.env`
> (no versionado). Consíguelas del dashboard de Supabase actual.
