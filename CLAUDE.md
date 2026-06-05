@AGENTS.md

# Reyf — super app fintech (MXNB + Privy + Supabase)

## Stack
- Next.js 16.2.6 (App Router), React 19.2, TypeScript 5.9, Tailwind v4
- Privy 3.28 — auth + embedded wallet + smart wallet (ERC-4337, gas patrocinado)
- Juno/Bitso Business — MXNB (stablecoin peso, ERC-20 en Arbitrum, 6 decimales)
- Bitso Exchange API — FX/órdenes de mercado (mismo HMAC, mismas llaves que Juno)
- Supabase — persistencia (perfiles, CLABEs, cuentas bancarias, bóvedas, conversiones, límites mensuales)
- viem 2.51 + permissionless 0.2 — onchain

## Arquitectura

```
src/
  app/
    api/juno/*          # Route handlers — firman HMAC hacia Juno, nunca exponen secrets
    api/bitso/*         # Balances, rates y conversiones vía Bitso Exchange API (server-side)
    api/convert/        # Orquestación server-side de conversión FX (idempotente)
    api/db/*            # Supabase con service_role: profile, clabe, banks, vaults,
                        #   bonus, conversions, limits
    api/treasury/reconcile/  # Reconciliación post-conversión (ajusta saldos on-chain vs ledger)
    app/                # Shell autenticada (/app/**)
  components/
    app/
      screens/          # core.tsx (Onboarding/Home/Wallet), invest.tsx (Bóvedas/FX),
                        #   account.tsx (Tarjeta/Perfil)
      modals/           # AddBankModal, DepositModal, RedeemModal, SendModal,
                        #   SendOnchainModal, MoreSheet
      ReyfApp.tsx       # Shell + router de estado interno
      ui.tsx            # Primitivas de UI (Icon, Spark, Flag, Ring…)
      shared.tsx        # Componentes compartidos entre screens
      ClabeCard.tsx     # Tarjeta con número CLABE del usuario
      IOSDevice.tsx     # Frame de celular para la landing
      WelcomeBonus.tsx  # Banner/flujo del bono de bienvenida
      RiskQuiz.tsx      # Quiz de perfil de riesgo (inversiones)
      ProjectionCard.tsx
      LiquidityAdvanceModal.tsx
      Portal.tsx        # Portal React para modales fuera del árbol
    landing/            # Landing pública
    wallet/             # WalletContext + PrivyBridge
  config/
    backend.ts          # URL base del backend (NEXT_PUBLIC_BACKEND_URL o mismo origen)
  hooks/
    useJuno.ts          # Hook principal Juno
    useBitsoRates.ts    # Tipos de cambio FX vía /api/bitso/rates
    useConversions.ts   # Historial de conversiones del usuario
    useMonthlyLimits.ts # Límites y uso mensual de conversión
    useOnchain.ts       # Lectura de balance MXNB on-chain
    usePendingTxns.ts   # Transacciones on-chain pendientes
    useUserBanks.ts
    useUserClabe.ts
    useVaults.ts
  lib/
    chain.ts            # Config Arbitrum + helpers MXNB on-chain
    juno/
      client.ts         # HMAC-SHA256, junoRequest()
      issue.ts          # Withdrawal MXNB on-chain desde el float del negocio
      respond.ts        # Helpers de respuesta uniformes para route handlers /api/juno/*
    bitso/
      client.ts         # HMAC-SHA256, bitsoRequest() — Bitso Exchange API (server-side)
      assets.ts         # Catálogo de activos/books disponibles
      orders.ts         # Ejecución de órdenes de mercado (conversión FX)
    supabase/
      server.ts         # Cliente Supabase con service_role
      db.ts             # Funciones de datos server-side (profile, conversions, limits…)
    store.ts            # Capa storage: Supabase (NEXT_PUBLIC_USE_SUPABASE=true) o localStorage
  services/
    junoService.ts      # Cliente tipado para el navegador
  types/juno.ts         # Tipos compartidos de la API Juno
```

## Reglas de desarrollo

- Los secrets de Juno/Bitso (`BITSO_APIKEY`, `BITSO_SECRET_APIKEY`) **solo viven en el servidor**. Nunca bajo `NEXT_PUBLIC_*`.
- Las API routes de Juno (`/api/juno/*`) y Bitso (`/api/bitso/*`) son el único punto que firma HMAC. El cliente nunca llama a esas APIs directamente.
- La capa `store.ts` es el único lugar que decide Supabase vs localStorage — no duplicar esa lógica en componentes.
- Las funciones de datos Supabase viven en `lib/supabase/db.ts`; el cliente Supabase con service_role en `lib/supabase/server.ts`. No crear clientes Supabase fuera de esos módulos.
- Pantallas de la app (screens) son componentes dentro de `ReyfApp.tsx`; el router es el estado `route` interno, no Next.js router.
- `WalletContext` abstrae Privy — las screens no importan hooks de Privy directamente.
- La conversión FX se orquesta en `/api/convert` (server-side, idempotente): transfiere MXNB a tesorería on-chain → ejecuta orden en Bitso → guarda en `conversions` → reconcilia saldo.

## Variables de entorno

| Variable | Lado | Notas |
|---|---|---|
| `BITSO_APIKEY` | server | Juno / Bitso Business API key |
| `BITSO_SECRET_APIKEY` | server | Juno / Bitso Business API secret |
| `JUNO_BASE_URL` | server | Default: `https://stage.buildwithjuno.com` |
| `BITSO_BASE_URL` | server | Default: `https://stage.bitso.com`. Producción: `https://api.bitso.com` |
| `JUNO_WEBHOOK_SECRET` | server | Verificación firma webhook |
| `JUNO_BLOCKCHAIN` | server | Default: `ARBITRUM` |
| `JUNO_WITHDRAWAL_ASSET` | server | Default: `MXNB` |
| `WELCOME_BONUS_AMOUNT` | server | Monto del bono de bienvenida |
| `SUPABASE_URL` | server | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Solo en server (route handlers) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | cliente | Si ausente, la app corre sin auth |
| `NEXT_PUBLIC_USE_SUPABASE` | cliente | `"true"` activa persistencia real |
| `NEXT_PUBLIC_CHAIN` | cliente | `arbitrum` o `arbitrum-sepolia` |
| `NEXT_PUBLIC_MXNB_ADDRESS` | cliente | Sobreescribe dirección por defecto |
| `NEXT_PUBLIC_SEYF_VAULTS_ADDRESS` | cliente | Contrato ReyfVaults on-chain; sin valor, bóvedas usan `store` |
| `NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS` | cliente | Contrato ReyfAdvance on-chain; sin valor, el adelanto de liquidez muestra aviso de configuración. Requiere `NEXT_PUBLIC_SEYF_VAULTS_ADDRESS` |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | cliente | Tesorería: destino on-chain del MXNB al convertir a divisa. Sin valor, la conversión no mueve fondos on-chain |
| `NEXT_PUBLIC_ARBITRUM_RPC` | cliente | RPC custom (si no, usa el público) |
| `NEXT_PUBLIC_BACKEND_URL` | cliente | Solo si el backend está en otro origen |

## Comandos

```bash
npm run dev    # Inicia el servidor de desarrollo
npm run build  # Verifica tipos + build
npm run lint   # ESLint
```

## Degradación graceful

Si Juno no está configurado o falla, la UI cae a datos mock del prototipo (`_prototype/`). Si Supabase no está activo, usa localStorage con la misma interfaz de `store`.
