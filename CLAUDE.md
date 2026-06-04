@AGENTS.md

# Reyf — super app fintech (MXNB + Privy + Supabase)

## Stack
- Next.js 16.2 (App Router), React 19, TypeScript 5, Tailwind v4
- Privy 3.28 — auth + embedded wallet + smart wallet (ERC-4337, gas patrocinado)
- Juno/Bitso Business — MXNB (stablecoin peso, ERC-20 en Arbitrum, 6 decimales)
- Supabase — persistencia (perfiles, CLABEs, cuentas bancarias, bóvedas, bono)
- viem 2 + permissionless 0.2 — onchain

## Arquitectura

```
src/
  app/
    api/juno/*        # Route handlers — firman HMAC hacia Juno, nunca exponen secrets
    api/db/*          # Route handlers — Supabase con service_role (server only)
    app/              # Shell autenticada (/app/**)
  components/
    app/              # Toda la UI de la app (screens, modals, ui.tsx)
    landing/          # Landing pública
    wallet/           # WalletContext + PrivyBridge
  hooks/              # useJuno, useWallet, useVaults, useUserBanks, useUserClabe…
  lib/
    chain.ts          # Config Arbitrum + helpers MXNB on-chain
    juno/client.ts    # HMAC-SHA256, junoRequest()
    store.ts          # Capa storage: Supabase (NEXT_PUBLIC_USE_SUPABASE=true) o localStorage
  services/
    junoService.ts    # Cliente tipado para el navegador
  types/juno.ts       # Tipos compartidos de la API Juno
```

## Reglas de desarrollo

- Los secrets de Juno (`BITSO_APIKEY`, `BITSO_SECRET_APIKEY`) **solo viven en el servidor**. Nunca bajo `NEXT_PUBLIC_*`.
- Las API routes de Juno (`/api/juno/*`) son el único punto que firma HMAC. El cliente nunca llama a Juno directamente.
- La capa `store.ts` es el único lugar que decide Supabase vs localStorage — no duplicar esa lógica en componentes.
- Pantallas de la app (screens) son componentes dentro de `ReyfApp.tsx`; el router es el estado `route` interno, no Next.js router.
- `WalletContext` abstrae Privy — las screens no importan hooks de Privy directamente.
- El Mercado (`screens/market.tsx`) está oculto del tab bar por decisión de negocio, pero las rutas están activas.

## Variables de entorno

| Variable | Lado | Notas |
|---|---|---|
| `BITSO_APIKEY` | server | Juno API key |
| `BITSO_SECRET_APIKEY` | server | Juno API secret |
| `JUNO_BASE_URL` | server | Default: `https://stage.buildwithjuno.com` |
| `JUNO_WEBHOOK_SECRET` | server | Verificación firma webhook |
| `JUNO_BLOCKCHAIN` | server | Default: `arbitrum` |
| `JUNO_WITHDRAWAL_ASSET` | server | Default: `mxnbj` |
| `WELCOME_BONUS_AMOUNT` | server | Monto del bono de bienvenida |
| `SUPABASE_URL` | server | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Solo en server (route handlers) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | cliente | Si ausente, la app corre sin auth |
| `NEXT_PUBLIC_USE_SUPABASE` | cliente | `"true"` activa persistencia real |
| `NEXT_PUBLIC_CHAIN` | cliente | `arbitrum` o `arbitrum-sepolia` |
| `NEXT_PUBLIC_MXNB_ADDRESS` | cliente | Sobreescribe dirección por defecto |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | cliente | Tesorería: destino on-chain del MXNB al convertir a divisa (Opción A pooled+ledger). Sin valor, la conversión no mueve fondos on-chain |
| `NEXT_PUBLIC_ARBITRUM_RPC` | cliente | RPC custom (si no, usa el público) |
| `NEXT_PUBLIC_BACKEND_URL` | cliente | Solo si el backend está en otro origen |

## Comandos

```bash
npm run dev    # Inicia con turbopack
npm run build  # Verifica tipos + build
npm run lint   # ESLint
```

## Degradación graceful

Si Juno no está configurado o falla, la UI cae a datos mock del prototipo (`_prototype/`). Si Supabase no está activo, usa localStorage con la misma interfaz de `store`.
