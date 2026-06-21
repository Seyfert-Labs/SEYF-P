# Integración Dynerox — on-ramp SPEI → cripto

Rama: `feat/dynerox-onramp-spei`. Aislada de Juno: no toca `lib/juno/*` ni `api/juno/*`.

## Qué es

API REST de on-ramp / off-ramp (fiat ↔ cripto). Auth por header **`x-api-key`** (sin HMAC).
Stage `https://api-stage.dynerox.com` · Prod `https://api.dynerox.com`. Keys por entorno, no intercambiables.

## Capas (calca el patrón de Juno)

- `lib/dynerox/client.ts` — `dyneroxRequest()` con `x-api-key`. Key solo server-side (`DYNEROX_API_KEY`).
- `lib/dynerox/respond.ts` — `ok` / `fail` / `badRequest`.
- `types/dynerox.ts` — DTOs del OpenAPI.
- `app/api/dynerox/*` — route handlers (único punto que habla con Dynerox; el cliente nunca llama directo):
  - `GET  /api/dynerox/probe` — diagnóstico (solo dev).
  - `GET  /api/dynerox/networks`
  - `GET  /api/dynerox/currencies?network=`
  - `GET/POST /api/dynerox/users`
  - `GET/POST /api/dynerox/routes` — instrucciones (el corazón).
  - `POST /api/dynerox/webhook` — receptor de eventos.

## Variables (.env)

```
DYNEROX_API_KEY=            # pendiente: pegar key de stage
DYNEROX_BASE_URL=https://api-stage.dynerox.com
DYNEROX_WEBHOOK_SECRET=
```

## Incógnitas a confirmar en stage (cuando haya key)

1. **¿El alta de usuario fuerza el paso de identidad de Dynerox** (`status: pending_identity`
   + `authorization_url` hosted), o acepta identidad ya verificada por nuestro KYC propio (Etherfuse)?
2. **Forma real del leg `from` para on-ramp** y, crítico: **¿Dynerox devuelve una CLABE de depósito**
   para que el usuario mande el SPEI? Los DTOs `InstructionLegFromDto`/`InstructionLegToDto` NO venían
   en el OpenAPI (`api-1.json`); las formas en `types/dynerox.ts` están inferidas de los `example`.
3. **Esquema de firma del webhook** (header + algoritmo): no documentado. La verificación en
   `webhook/route.ts` es un placeholder HMAC-SHA256.

## Cómo probar (cuando haya key)

```bash
# 1. Pega la key en .env (DYNEROX_API_KEY=...)
npm run dev
# 2. Diagnóstico: autentica + lista redes/monedas
curl http://localhost:3000/api/dynerox/probe | jq
# 3. Crear ruta on-ramp (forma tentativa, ajustar con lo aprendido en el probe):
curl -XPOST http://localhost:3000/api/dynerox/routes -H 'content-type: application/json' -d '{
  "user_id": "<id>",
  "from": { "currency": { "symbol": "mxn" }, "network": { "name": "spei" } },
  "to":   { "currency": { "symbol": "usdt" }, "network": { "name": "arbitrum" }, "account": "<wallet>" }
}' | jq
```

## Flujo on-ramp (objetivo)

Usuario (KYC propio) → crear/asegurar usuario Dynerox → crear ruta `from: MXN/SPEI` → `to: cripto/wallet`
→ Dynerox devuelve CLABE de depósito → usuario manda SPEI → webhook `order.created`/confirmado →
cripto aterriza en el wallet del usuario.
