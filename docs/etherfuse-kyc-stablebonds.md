# Etherfuse KYC & Stablebonds — estado de implementación

**Rama:** `etherfuse-kyc-stablebonds`  
**Origen:** portado desde `/Users/gerryvela/Documents/seyf-app`  
**Fecha:** junio 2026  
**App:** SEYF (`Seyf2/`)

---

## Resumen

Se integró en SEYF el flujo de **KYC programático** y **compra de CETES** (Stablebonds) vía **Etherfuse**, usando una **wallet Stellar con Pollar** en paralelo al stack existente de **Privy + Arbitrum (MXNB)**.

| Área | Estado |
|------|--------|
| Cliente HTTP Etherfuse (`lib/etherfuse`) | ✅ Portado |
| Orquestación server (`lib/seyf`) | ✅ Portado (adaptado a rutas `/api/seyf`) |
| APIs KYC + rampa + webhook | ✅ Implementadas |
| **KYC dentro del shell (Perfil), sin jerga** | ✅ `ScreenKyc` (router interno `kyc`) |
| **Pollar headless (OTP en nuestra UI, sin modal)** | ✅ `use-seyf-stellar-wallet` |
| **`PollarProvider` global** (envuelve toda la app) | ✅ `components/Providers.tsx` |
| **Bóveda soberana designada + gating KYC** | ✅ plan `conservador` (`backend: "etherfuse"`, `kycGated`) |
| **Jerga CETES/Stablebonds fuera del front** | ✅ datos, quiz, home, ahorro |
| Build (`npm run build`) | ✅ Pasa |
| **Orquestación swap MXN→bono al fondear bóveda** | ❌ Bloqueada por decisión de riel (ver abajo) |
| Auto-deploy post-depósito (MVP seyf-app) | ⏸ Stub (solo log) |
| Rutas/componentes front de Etherfuse (`/app/etherfuse/*`, `components/etherfuse/*`) | 🗑️ Eliminados (KYC es interno) |
| Sandbox `fiat_received` / simulación SPEI | ❌ Ruta no portada aún |
| Unificación perfil Privy ↔ Stellar en Supabase | ❌ Pendiente |
| Tests Vitest de `lib/etherfuse` | ⚠️ Archivos copiados, no cableados en `package.json` |

### ⚠️ Decisión pendiente — riel de fondeo de la bóveda soberana

El onramp de Etherfuse es **fiat MXN (SPEI/CLABE) → CETES en Stellar**: no acepta una
stablecoin (MXNB) como origen. Las bóvedas de SEYF hoy se fondean con **MXNB on-chain
(Arbitrum)**. Para que "fondear la bóveda soberana" compre bonos por detrás hay que decidir
el flujo de dinero:

- **(A) SPEI directo a Etherfuse:** el depósito de esa bóveda va por SPEI a la CLABE de
  Etherfuse (no a Juno). Reusa el onramp tal cual; el saldo no pasa por MXNB.
- **(B) Off-ramp + on-ramp:** convertir MXNB del usuario a fiat y re-inyectar por SPEI a
  Etherfuse. Dos rampas, más fricción y costo.
- **(C) Swap on-chain stable→bono:** requeriría que Etherfuse exponga compra con stablecoin
  como origen (hoy **no** está en el cliente). A confirmar con Etherfuse.

Hasta resolver esto, la bóveda soberana queda **designada y gateada por KYC**, pero el
disparo del onramp al fondear no está cableado.

---

## Arquitectura

```
Usuario
  │
  ├─► Privy (email) ──► Arbitrum Sepolia ──► MXNB, bóvedas, SPEI Juno/Bitso
  │                     (flujo SEYF existente)
  │
  └─► Pollar (Stellar) ──► Etherfuse ramp ──► CETES tokenizados
                          (flujo nuevo en esta rama)
```

**Por qué dos wallets:** Etherfuse acredita CETES en **Stellar**. MXNB y bóvedas viven en **Arbitrum**. No se reemplazó Privy; se añadió Pollar solo para el producto Stablebonds.

**Sesión Etherfuse:** cookie httpOnly `seyf_ef_onboarding` (nombre heredado de seyf-app) + opcional **Upstash Redis** para caché KYC, acuerdos y rate limits.

---

## Qué se hizo (changelog)

### 1. Librerías

**`src/lib/etherfuse/`** — cliente y wrappers REST Etherfuse:
- `client.ts`, `config.ts`, `errors.ts`
- `kyc.ts`, `onboarding.ts`, `agreements.ts`
- `ramp-api.ts`, `orders-api.ts`, `bank-accounts.ts`, `wallets.ts`
- `stablebonds-lookup.ts`, `cetes-rate.ts`
- `webhook-verify.ts`, utilidades Stellar/SPEI

**`src/lib/seyf/`** — capa SEYF (antes `lib/seyf` en seyf-app):
- Guards: `etherfuse-kyc-guard`, `etherfuse-ramp-guard`, `etherfuse-ramp-context`
- Flujo depósito: `etherfuse-spei-deposit-prepare`, `etherfuse-readiness`
- Estado: `onboarding-session-store`, `kyc-state-store`, `agreements-state-store`
- Stellar: `stellar-trustline`, `use-ensure-cetes-trustline`
- Infra: `api-error`, `redis-guards`, `upstash-redis`
- Cliente: `use-seyf-stellar-wallet`, `stellar-wallet-network`

### 2. APIs (`/api/seyf/...`)

| Método | Ruta | Función |
|--------|------|---------|
| `POST` | `/api/seyf/kyc/submit` | Identidad → Etherfuse + registro wallet + sesión |
| `POST` | `/api/seyf/kyc/documents` | INE frente/reverso + selfie |
| `POST` | `/api/seyf/kyc/agreements` | Acuerdos legales (×3) |
| `GET` | `/api/seyf/kyc/status` | Estado KYC (live + caché) |
| `GET` | `/api/seyf/etherfuse/ramp-context` | Contexto rampa + gate KYC |
| `GET` | `/api/seyf/etherfuse/readiness` | Checklist onramp completo |
| `GET` | `/api/seyf/etherfuse/deposit-info` | KYC + CLABE depósito |
| `POST` | `/api/seyf/etherfuse/quote/onramp` | Cotización MXN → CETES |
| `POST` | `/api/seyf/etherfuse/order/onramp` | Orden onramp (CLABE SPEI) |
| `POST` | `/api/seyf/etherfuse/onramp/prepare-transfer` | Quote + order atómicos |
| `POST` | `/api/seyf/etherfuse/bank-account` | Alta CLABE post-KYC |
| `GET` | `/api/seyf/etherfuse/lookup/stablebonds` | Precios Stablebonds/CETES |
| `POST` | `/api/seyf/stellar-trustline/cetes` | XDR `changeTrust` CETES |
| `POST` | `/api/webhooks/etherfuse` | `kyc_updated` + onramp confirmado |

> En seyf-app las rutas eran `/api/seyf/...`. Aquí se renombraron a `/api/seyf/...` manteniendo la misma lógica.

### 3. UI

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/app/etherfuse/identidad` | `KycEtherfuseClient` | Wallet Pollar → datos → documentos → acuerdos |
| `/app/etherfuse/cetes` | `CetesEtherfuseClient` | Monto MXN → SPEI → acreditación CETES |
| `/app` → Ahorro | tarjeta en `invest.tsx` | Enlace “CETES tokenizados” |

**Layout:** `src/app/app/etherfuse/layout.tsx` envuelve con `SeyfPollarProvider` (`@pollar/react`).

### 4. Dependencias nuevas (`package.json`)

- `@pollar/react`, `@pollar/core`
- `@stellar/stellar-sdk`
- `@upstash/redis`
- `zod`, `canonicalize`

### 5. Variables de entorno

Documentadas en `.env.example`. Las que ya configuraste deberían incluir al menos:

```env
ETHERFUSE_API_BASE_URL=https://api.sand.etherfuse.com
ETHERFUSE_API_KEY=...
ETHERFUSE_ONBOARDING_MODE=programmatic
ETHERFUSE_DEFAULT_BLOCKCHAIN=stellar
SEYF_ALLOW_ETHERFUSE_RAMP=true
NEXT_PUBLIC_POLLAR_API_KEY=...
NEXT_PUBLIC_POLLAR_STELLAR_NETWORK=testnet
```

Opcionales pero recomendadas:

```env
ETHERFUSE_WEBHOOK_SECRET=...          # base64, para POST /api/webhooks/etherfuse
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SEYF_ALLOW_KYC_RESET=true               # botón reiniciar prueba en dev
```

Compatibilidad: varias vars aceptan el prefijo legacy `SEYF_*` (ej. `SEYF_ALLOW_ETHERFUSE_RAMP`).

**Webhook en Etherfuse:** registrar `https://TU-DOMINIO/api/webhooks/etherfuse` con evento `kyc_updated`.

---

## Flujo de usuario (end-to-end)

### A) KYC

```
1. /app/etherfuse/identidad
2. Conectar wallet Pollar (Stellar testnet)
3. POST /api/seyf/kyc/submit        → datos personales + CURP/RFC
4. POST /api/seyf/kyc/documents     → INE + selfie
5. POST /api/seyf/kyc/agreements    → firmas legales
6. GET  /api/seyf/kyc/status        → proposed / approved
7. POST /api/seyf/stellar-trustline/cetes → trustline CETES (firma en Pollar)
```

En **sandbox/testnet**, el guard KYC puede tratar `proposed` como suficiente para rampa (igual que seyf-app).

### B) Compra CETES (onramp SPEI)

```
1. /app/etherfuse/cetes
2. Verificar ramp-context (KYC aprobado)
3. POST /api/seyf/etherfuse/onramp/prepare-transfer
   → devuelve CLABE + monto SPEI
4. Usuario transfiere desde su banco
5. [sandbox] simular recepción fiat (ruta no portada aún)
6. Etherfuse acredita CETES en wallet Stellar
7. Saldo visible vía Pollar / lookup stablebonds
```

---

## Cómo probar en local

```bash
cd Seyf2
npm run dev
```

1. Abre `http://localhost:3000/app`
2. Ve a **Ahorro** → **CETES tokenizados**
3. Completa **Identidad** (`/app/etherfuse/identidad`)
4. Activa **trustline CETES**
5. En **Comprar CETES**, genera la transferencia SPEI

**Pollar:** en el dashboard de Pollar, agrega `http://localhost:3000` como origen permitido.

**Verificar API key Etherfuse** (opcional, script existe en seyf-app como referencia):

```bash
# En seyf-app: npm run etherfuse:verify
# Equivalente: GET /ramp/me con ETHERFUSE_API_KEY
```

---

## Diferencias vs seyf-app

| Tema | seyf-app | SEYF (esta rama) |
|------|----------|------------------|
| Prefijo API | `/api/seyf/` | `/api/seyf/` |
| Wallet principal | Pollar | Privy (Arbitrum) + Pollar (solo CETES) |
| UI KYC | `identidad-client.tsx` completo | `KycEtherfuseClient` simplificado |
| UI depósito | `/anadir/monto` + dev panel | `/app/etherfuse/cetes` |
| Auto-deploy inversión | `investment-mvp` + notificaciones | Stub en `spei-deposit-auto-deploy.ts` |
| Rutas dev/sandbox | `sandbox/fiat-received`, `prueba/mxn-cetes` | No portadas |
| i18n | `messages/es-MX.json` | Textos inline en español |

---

## Pendiente (próximos pasos sugeridos)

1. **Portar sandbox** — `POST /api/seyf/etherfuse/sandbox/fiat-received` para probar SPEI sin banco real.
2. **UI KYC** — traer `identidad-client.tsx` de seyf-app o pulir validaciones/UX del MVP actual.
3. **Dashboard CETES** — saldo y equivalente MXN (`dashboard-cetes-saldo`, `cetes-mxne-equiv` ya están en `lib/seyf` pero no conectados a Home).
4. **Supabase** — ligar `profiles.wallet` (Privy) con `stellar_public_key` + `etherfuse_customer_id`.
5. **Auth server-side** — las APIs `/api/seyf/*` siguen scoped por wallet en body/cookie, sin JWT Privy.
6. **Tests** — cablear `lib/etherfuse/__tests__` en CI.
7. **Commit + push** de la rama `etherfuse-kyc-stablebonds` cuando el equipo valide en sandbox.

---

## Estructura de archivos clave

```
Seyf2/
├── src/
│   ├── lib/
│   │   ├── etherfuse/          # Cliente Etherfuse (REST)
│   │   └── seyf/               # Orquestación SEYF
│   ├── app/
│   │   ├── api/seyf/           # KYC + rampa
│   │   ├── api/webhooks/etherfuse/
│   │   └── app/etherfuse/      # UI identidad + cetes
│   └── components/
│       ├── etherfuse/          # KycEtherfuseClient, CetesEtherfuseClient
│       └── providers/SeyfPollarProvider.tsx
├── .env.example                # Variables documentadas
└── docs/etherfuse-kyc-stablebonds.md   # Este archivo
```

---

## Notas técnicas

- **Modo KYC:** `ETHERFUSE_ONBOARDING_MODE=programmatic` (formulario en SEYF). Alternativa: `hosted` (redirect a UI Etherfuse) — lógica portada en `onboarding.ts`, UI hosted no expuesta aún.
- **Producción:** `SEYF_ALLOW_ETHERFUSE_RAMP=true` obligatorio si `NODE_ENV=production` y no es preview de Vercel.
- **Redis:** sin Upstash, parte del estado cae a cookie + memoria; rate limits KYC pueden ser más permisivos.
- **Cookie onboarding:** nombre `seyf_ef_onboarding` conservado para no romper sesiones si migras datos desde seyf-app.

---

## Contacto / referencias

- [Etherfuse docs](https://docs.etherfuse.com/)
- [Pollar docs](https://docs.pollar.xyz/)
- Implementación de referencia: `~/Documents/seyf-app`
- PRD SEYF general: `docs/seyf-app-prd.md`
