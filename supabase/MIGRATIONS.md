# Migraciones Supabase — SEYF

## Para tu colaborador (un solo paso)

1. Abre el proyecto en [Supabase](https://supabase.com) → **SQL Editor** → **New query**.
2. Copia y pega **todo** el archivo [`EJECUTAR_EN_SUPABASE.sql`](./EJECUTAR_EN_SUPABASE.sql).
3. Pulsa **Run**. Debe terminar sin errores (es idempotente: se puede repetir).
4. Al final verás dos resultados de comprobación:
   - Lista de **15 tablas** (`profiles`, `vaults`, `kyc_state`, …).
   - Columnas de `vaults` incluyendo `balance`, `apy`, `updated_at`, `plan_id`, `strategy_id`.

## Variables de entorno (`.env`)

```env
NEXT_PUBLIC_USE_SUPABASE=true
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo servidor — nunca en el cliente
```

**No configures Redis / Upstash.** La app ya no lo usa.

## Money timer (saldo que crece en pantalla)

| Qué | Dónde |
|-----|--------|
| Saldo real | `vaults.balance` |
| Tasa APY | `vaults.apy` |
| Ancla temporal | `vaults.updated_at` |
| Estrategia DeFindex | `vaults.plan_id`, `vaults.strategy_id` |

La UI **no escribe** el número cada segundo. Calcula:

`valor = balance + balance × (APY/100) × (ahora − updated_at)`

Tras cada abono o retiro, la app actualiza `balance` y `updated_at` vía `/api/db/vaults`.

## Archivos históricos

La carpeta `migrations/` conserva migraciones incrementales por fecha. Para un proyecto nuevo o para poner al día todo de una vez, usa solo **`EJECUTAR_EN_SUPABASE.sql`**.
