# Integración Dynerox — on-ramp SPEI → cripto

Rama: `dynerox` (se mantiene rebasada sobre `main`). Aislada de Juno: no toca `lib/juno/*` ni `api/juno/*`.

## Qué es

API REST de on-ramp / off-ramp (fiat ↔ cripto). Auth por header **`x-api-key`** (sin HMAC).
Stage `https://api-stage.dynerox.com` · Prod `https://api.dynerox.com`. Keys por entorno, no intercambiables.

## Capas (calca el patrón de Juno)

- `lib/dynerox/client.ts` — `dyneroxRequest()` con `x-api-key`. Key solo server-side (`DYNEROX_API_KEY`).
- `lib/dynerox/respond.ts` — `ok` / `fail` / `badRequest`.
- `lib/dynerox/clabe.ts` — `isValidClabe()` / `normalizeClabe()`.
- `types/dynerox.ts` — DTOs del OpenAPI.
- `app/api/dynerox/*` — route handlers (único punto que habla con Dynerox; el cliente nunca llama directo).

### Route handlers

| Handler | Upstream | Notas |
|---|---|---|
| `GET /api/dynerox/probe` | varios | Diagnóstico. **Solo dev.** |
| `GET /api/dynerox/networks` | `/networks` | |
| `GET /api/dynerox/currencies?network=` | `/currencies` | |
| `GET /api/dynerox/users?user_id=` | `/users/{id}` | Sin `user_id` lista paginado |
| `POST /api/dynerox/users` | `/users` | `phone` en E.164 |
| `GET/POST /api/dynerox/routes` | `/routes` | El corazón. **Bloqueado en stage** (ver abajo) |
| `GET /api/dynerox/banks?clabe=` | `/banks/clabe/{clabe}` | Lookup de banco, no crea nada |
| `GET/POST /api/dynerox/beneficiary-accounts` | `/beneficiary-accounts` | Registra CLABE y **resuelve titular** |
| `GET/POST/DELETE /api/dynerox/webhooks` | `/webhooks` | Administración. **Solo dev** |
| `POST /api/dynerox/webhook` | — | **Receptor**: lo llama Dynerox a nosotros |

> `webhook` (singular) y `webhooks` (plural) son cosas distintas: el primero recibe
> eventos, el segundo los configura. No confundirlos.

**¿Por qué `webhooks` es solo dev?** `/api/dynerox/*` no lleva autenticación. Exponer el
alta y la baja de webhooks en producción dejaría que cualquiera redirija o borre nuestros
eventos. Se administran desde local o desde la referencia Scalar. Mismo criterio que `probe`.

**Validación de CLABE local.** `banks` y `beneficiary-accounts` verifican el dígito
verificador antes de llamar, porque Dynerox solo responde `Invalid CLABE` sin explicar.
La lógica está duplicada a propósito respecto a `services/junoService.ts`: esa es una clase
del navegador y esta rama mantiene Dynerox aislado de Juno.

## Variables (.env)

```
DYNEROX_API_KEY=sk_dev_...  # key de stage
DYNEROX_BASE_URL=https://api-stage.dynerox.com
DYNEROX_WEBHOOK_SECRET=
```

> Cuidado: si `.env` trae el bloque `DYNEROX_*` dos veces, `dotenv` conserva la **primera**
> ocurrencia. Un bloque vacío arriba deja la key en blanco y el probe reporta `configured: false`
> sin razón aparente.

## Verificado contra stage (2026-07-21)

- **Auth OK** con `x-api-key`.
- **Redes activas**: `spei` (mxn), `ethereum` (ETH, USDC, USDT), `solana` (SOL, USDC),
  `bitcoin` (sin monedas configuradas). **No hay Stellar ni Arbitrum** — el resto de SEYF
  vive en Stellar, así que el destino del on-ramp no conecta con las bóvedas todavía.
- **Alta de usuario**: `POST /v1/public/users` devuelve `user_id` (UUID) con
  `is_verified: false` y **sin** `authorization_url`. No fuerza un paso de identidad hosted
  en el alta; falta descubrir cómo se dispara/marca la verificación.
  `phone` exige formato E.164 (`+52...`).
- **Forma de los legs**: `currency` y `network` son **strings planos**, no objetos:
  `{ "currency": "mxn", "network": "spei" }`. (`types/dynerox.ts` ya corregido.)
- **`GET /routes` exige `user_id`** en UUID; sin él responde `Invalid UUID format`
  (igual `GET /beneficiary-accounts`).
- **Eventos de webhook (enum real)**: `user.created`, `route.created`, `kyc.completed`,
  `transfer.completed`, `order.completed`. Los que estaban inferidos antes
  (`order.created`, `identity.approved`…) **no existen**. `POST /webhooks` devuelve el
  `secret` con prefijo `whs_` — **solo en la creación**; eso es lo que va en
  `DYNEROX_WEBHOOK_SECRET`. `DELETE /webhooks/{id}` funciona.
- **`POST /beneficiary-accounts`** funciona y **resuelve el titular de la CLABE**:
  devuelve `beneficiary_name`, `institution_name`, `institution_code` y
  `verification_status` (arrancó en `manual_review` en stage). La CLABE debe traer
  dígito verificador válido — la del `example` del spec (`012180110400000810`) es
  inválida; la correcta es `...819`.
- **`GET /banks/clabe/{clabe}`** hace lookup de banco sin crear nada
  (`{account_prefix, bank_name, bank_code}`). Útil para validar en `AddBankModal`.
- **El bloqueo del merchant afecta SOLO a `/routes`**: usuarios, CLABEs, webhooks y
  lookups funcionan con normalidad.

## Dónde ver esto sin código

No hay dashboard/sandbox web (`app.` / `panel.` / `dashboard.dynerox.com` no resuelven).
Lo más parecido es la **referencia interactiva Scalar** en
<https://api-stage.dynerox.com/docs/> — permite ejecutar llamadas pegando la `x-api-key`.
La API es el único canal.

## Bloqueos abiertos

1. **Crear rutas falla en stage por provisión del lado de Dynerox**:
   `Merchant 16 has no provider configuration. Insert a row in merchant_provider first.`
   Falla igual para Solana y para Ethereum → no es nuestro payload. **Hay que pedirle a
   Dynerox que configure el provider del merchant en stage.** Hasta entonces no se puede
   confirmar si la ruta devuelve CLABE de depósito.
2. **¿Devuelve Dynerox una CLABE de depósito** en el leg `from`? Bloqueado por (1).
3. **¿Acepta identidad verificada externamente** (nuestro KYC con Etherfuse) o exige la suya?
4. **Esquema de firma del webhook** (header + algoritmo): no documentado. La verificación en
   `webhook/route.ts` es un placeholder HMAC-SHA256.
5. **¿Stellar en el roadmap?** Sin él, el on-ramp aterriza en una red que la app no usa.

## Cómo probar

```bash
npm run dev
# 1. Diagnóstico: autentica + lista redes/monedas
curl http://localhost:3000/api/dynerox/probe | jq
# 2. Crear usuario (phone en E.164)
curl -XPOST http://localhost:3000/api/dynerox/users -H 'content-type: application/json' -d '{
  "first_name":"Test","last_name":"Prueba","second_last_name":"Seyf",
  "email":"test@example.com","curp":"PUST900101HDFRYS09","phone":"+525555555555"
}' | jq
# 3. Lookup de banco por CLABE (no crea nada)
curl 'http://localhost:3000/api/dynerox/banks?clabe=012180110400000819' | jq
# 4. Registrar CLABE del usuario -> devuelve beneficiary_name + verification_status
curl -XPOST http://localhost:3000/api/dynerox/beneficiary-accounts -H 'content-type: application/json' -d '{
  "user_id":"<uuid>","clabe":"012180110400000819","currency":"MXN","network":"SPEI"
}' | jq
# 5. Crear ruta on-ramp (hoy falla por el bloqueo #1)
curl -XPOST http://localhost:3000/api/dynerox/routes -H 'content-type: application/json' -d '{
  "user_id": "<uuid>",
  "from": { "currency": "mxn", "network": "spei" },
  "to":   { "currency": "USDC", "network": "solana", "account": "<wallet>" }
}' | jq
```

### Registrar el webhook (cuando haya URL pública)

El `secret` se devuelve **una sola vez**, al crearlo. Si se pierde, hay que borrar el
webhook y crear otro.

```bash
curl -XPOST http://localhost:3000/api/dynerox/webhooks -H 'content-type: application/json' -d '{
  "url": "https://TU-DOMINIO/api/dynerox/webhook",
  "events": ["user.created","route.created","kyc.completed","transfer.completed","order.completed"]
}' | jq          # -> copia `secret` (whs_...) a DYNEROX_WEBHOOK_SECRET

curl http://localhost:3000/api/dynerox/webhooks | jq
curl -XDELETE 'http://localhost:3000/api/dynerox/webhooks?webhook_id=<uuid>'
```

## Flujo on-ramp (objetivo)

Usuario (KYC propio) → crear/asegurar usuario Dynerox → crear ruta `from: MXN/SPEI` → `to: cripto/wallet`
→ Dynerox devuelve CLABE de depósito → usuario manda SPEI → webhook `order.created`/confirmado →
cripto aterriza en el wallet del usuario.
