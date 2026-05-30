# SEYF2 / Utonoma

Super app de finanzas (pesos digitales, bonos de gobierno, bóvedas de ahorro y
tarjeta multi-divisa) con integración **Bitso Business / Juno** para emisión y
redención de **MXNB**.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4
- **Diseño:** dark glassmorphism, acento lima `#C8FF4D` + violeta `#8B5CF6`
- **Integración MXNB:** ver [`INTEGRATION.md`](./INTEGRATION.md)

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/`     | **Landing** (primera pantalla) — botón **Iniciar / Iniciar ahora** → `/app` |
| `/app`  | **App** de wallet (onboarding → Home/Wallet/Bonos/Bóvedas/Tarjeta/Perfil) |
| `/api/juno/*` | Endpoints de la integración Juno/Bitso Business |

## Arranque rápido

```bash
cp .env.example .env.local   # añade tus llaves de Juno (BITSO_APIKEY / BITSO_SECRET_APIKEY)
npm install
npm run dev                  # http://localhost:3000
```

## Estructura

```
src/
  app/
    page.tsx                 # landing (/)
    landing.css              # estilos de la landing (scoped bajo .lp)
    app/page.tsx             # app de wallet (/app)
    layout.tsx               # fuentes (Manrope + Space Grotesk), metadata
    globals.css              # tokens + estilos de la app
    api/juno/*/route.ts      # 11 endpoints firmados (Bitso Business / Juno)
  components/landing/        # Landing portada de Utonoma Landing.html
  components/app/            # UI portada del prototipo (pantallas, iconos, device)
    screens/                 # core (Home/Wallet), invest (Bonos/Convertir), account
    modals/                  # DepositModal, RedeemModal (conectados a Juno)
  hooks/useJuno.ts           # hooks de React para la UI
  services/junoService.ts    # cliente tipado del navegador
  lib/juno/                  # firma HMAC + cliente server-side
  types/juno.ts              # tipos compartidos
  config/backend.ts          # config de endpoints del cliente
_prototype/                  # prototipo original (HTML/JSX) — referencia de diseño
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev`   | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servir el build |
| `npm run lint`  | ESLint |

## Documentación

- [`INTEGRATION.md`](./INTEGRATION.md) — integración Juno/Bitso (endpoints, env, flujos, versiones)
- [`PLAN-NextJS-ClaudeCode.md`](./PLAN-NextJS-ClaudeCode.md) — plan de la landing
