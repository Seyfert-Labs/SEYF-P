<div align="center">

# Reyf

### La super app de finanzas para ahorrar, invertir y gastar sin fronteras

Pesos digitales que rinden · Bonos de gobierno de 4 países · Bóvedas de ahorro · Tarjeta multi-divisa
Construida sobre **MXNB** (Bitso Business / Juno), wallets sociales sin seed phrase y transacciones con gas patrocinado.

<br/>

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Privy](https://img.shields.io/badge/Privy-Auth%20%2B%20Smart%20Wallets-6A4BFF?style=for-the-badge)
![ZeroDev](https://img.shields.io/badge/ZeroDev-Paymaster-7C3AED?style=for-the-badge)
![Arbitrum](https://img.shields.io/badge/Arbitrum-Sepolia-28A0F0?style=for-the-badge&logo=arbitrum)
![MXNB](https://img.shields.io/badge/MXNB-Bitso%20Business%20·%20Juno-C8FF4D?style=for-the-badge&labelColor=0A0A0F)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

</div>

---

## Capturas

<div align="center">

| Inicio | Invertir | Landing |
|:------:|:--------:|:-------:|
| <img src="docs/screenshots/home.png" width="240" alt="Inicio"/> | <img src="docs/screenshots/bonds.png" width="240" alt="Invertir"/> | <img src="docs/screenshots/landing.png" width="240" alt="Landing"/> |

</div>

> Las imágenes viven en [`docs/screenshots/`](docs/screenshots). Coloca ahí `home.png`, `bonds.png` y `landing.png`.

---

## Tabla de contenidos

- [Qué es Reyf](#qué-es-reyf)
- [Tecnologías](#tecnologías)
- [Arquitectura](#arquitectura)
- [Flujos](#flujos)
- [Funcionalidades](#funcionalidades)
- [API (endpoints)](#api-endpoints)
- [Rutas](#rutas)
- [Configuración (Juno · Privy · ZeroDev)](#configuración-juno--privy--zerodev)
- [Variables de entorno](#variables-de-entorno)
- [Arranque](#arranque)
- [Estructura](#estructura)
- [Seguridad](#seguridad)
- [Roadmap](#roadmap)

---

## Qué es Reyf

Reyf es una wallet de finanzas personales que une tres mundos en una sola app:

| | |
|---|---|
| **Fiat ↔ Cripto sin fricción** | Depósitos y retiros (SPEI) se convierten a **MXNB** (stablecoin MXN) vía **Bitso Business / Juno**. |
| **Onboarding sin seed phrase** | El usuario entra con **correo** y obtiene una **smart wallet** en Arbitrum, sin extensiones ni frases semilla. |
| **Sin gas, sin firmas** | Las transacciones on-chain del usuario son **patrocinadas** (account abstraction ERC-4337 + paymaster). |
| **Ahorro inteligente** | Cuestionario de perfil de riesgo · 4 estrategias de bóvedas · comparativo vs AFORE tradicional. |

Cada usuario tiene **saldo real on-chain**, **historial real** (transferencias MXNB), su **CLABE de depósito** propia y un **perfil persistido en Supabase** (multi-dispositivo). Diseño dark glassmorphism, responsive (móvil y escritorio).

---

## Tecnologías

| Capa | Tecnología | Rol |
|------|-----------|-----|
| **Framework** | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 | UI + API routes en un solo proyecto |
| **Estilos** | Tailwind v4 + design tokens (CSS vars) | Tema dark glassmorphism (lima/violeta) |
| **Identidad / wallets** | [Privy](https://privy.io) (`@privy-io/react-auth`) | Login social (Email OTP) + wallet embebida (EOA) sin seed phrase |
| **Account abstraction** | ERC-4337 · Kernel (smart account) | La wallet del usuario es una cuenta inteligente |
| **Paymaster (gas)** | [ZeroDev](https://zerodev.app) | Patrocina el gas de las transacciones del usuario |
| **Bundler** | [Pimlico](https://pimlico.io) | Empaqueta y envía las UserOperations |
| **On-chain** | [viem](https://viem.sh) · `permissionless` | Lectura de saldo/eventos ERC-20 y transfers |
| **Rieles fiat** | [Juno / Bitso Business](https://docs.bitso.com/juno) | Issuance/redeem de **MXNB**, CLABEs, SPEI (HMAC-SHA256) |
| **Persistencia** | [Supabase](https://supabase.com) (Postgres) | Perfiles, CLABEs, cuentas bancarias, bóvedas, conversiones FX, límites mensuales y bono |
| **Red / activo** | Arbitrum Sepolia · **MXNB** (ERC-20, 6 decimales) | Donde vive y se mueve el dinero del usuario |

---

## Arquitectura

```mermaid
flowchart TB
    subgraph Client["Cliente · Next.js 16 + React 19"]
        Landing["Landing /"]
        App["App /app"]
        Hooks["Hooks\nuseWallet · useOnchainTxns\nusePendingTxns · useVaults · useUserClabe"]
        Store["store.ts\nSupabase ↔ localStorage"]
    end

    subgraph Auth["Identidad y cuentas · Privy"]
        Login["Login social\n(Email OTP)"]
        Embedded["Wallet embebida\n(EOA · sin seed phrase)"]
        Smart["Smart Wallet\nERC-4337 · Kernel"]
    end

    subgraph AA["Account Abstraction · gas patrocinado"]
        Bundler["Bundler\nPimlico"]
        Paymaster["Paymaster\nZeroDev"]
    end

    subgraph Server["Servidor · Route Handlers (Next.js)"]
        APIJuno["/api/juno/*\nfirma HMAC-SHA256"]
        APIDB["/api/db/*\nservice_role Supabase"]
    end

    subgraph Rails["Rieles financieros"]
        Juno[("Juno / Bitso Business\nMXNB issuance · redeem · CLABE")]
        Arb[("Arbitrum Sepolia\nMXNB ERC-20")]
        SB[("Supabase\nPostgres")]
    end

    Landing -->|Iniciar| App
    App --> Hooks
    App --> Store
    Login --> Embedded --> Smart
    Hooks --> Login
    Smart -->|UserOperation| Bundler --> Paymaster -->|sponsor gas| Arb
    Hooks -->|fetch /api/juno/*| APIJuno -->|HMAC| Juno
    Juno -->|mint · transfer on-chain| Arb
    Hooks -->|viem readContract / getLogs| Arb
    Store -->|fetch /api/db/*| APIDB --> SB

    classDef chain fill:#28A0F0,stroke:#fff,color:#fff;
    classDef juno fill:#0A0A0F,stroke:#C8FF4D,color:#C8FF4D;
    classDef aa fill:#2B1769,stroke:#A78BFA,color:#fff;
    classDef db fill:#1C1C1C,stroke:#3ECF8E,color:#3ECF8E;
    class Arb chain
    class Juno juno
    class Bundler,Paymaster aa
    class SB db
```

**Principios de diseño**

- Los **secretos de Juno viven solo en el servidor** (los route handlers firman HMAC). El frontend nunca firma ni ve credenciales.
- El **saldo por usuario** se lee on-chain de su smart wallet (no del balance de negocio de Juno).
- El **gas** lo paga el paymaster de ZeroDev: el usuario no firma popups ni paga comisiones de red.
- La capa **`store.ts`** es el único lugar que decide Supabase vs localStorage — si `NEXT_PUBLIC_USE_SUPABASE=true` persiste en Postgres (multi-dispositivo), si no cae a localStorage (modo demo).

---

## Flujos

### Onboarding + smart wallet (sin seed phrase)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant App
    participant Privy
    participant SB as Supabase
    participant Arb as Arbitrum
    U->>App: Abrir /app y "Crear mi cuenta"
    App->>Privy: login (Email OTP)
    Privy-->>U: código al correo
    U->>Privy: ingresa código
    Privy->>Privy: crea wallet embebida (EOA) sin seed phrase
    Privy->>Privy: deriva smart wallet ERC-4337 (Kernel)
    Privy-->>App: authenticated + smartAddress
    App->>SB: upsertProfile (wallet, email, did)
    App->>SB: syncRiskProfile ← risk_profile guardado
    App->>Arb: readMXNBBalance(smartAddress)
    Arb-->>App: saldo real on-chain
```

### Cuestionario de perfil de riesgo

```mermaid
sequenceDiagram
    actor U as Usuario
    participant App
    participant SB as Supabase
    U->>App: Responde 5 preguntas (Typeform-style)
    App->>App: suma puntaje → recommendPlan()
    App->>App: guarda perfil en localStorage
    App->>SB: POST /api/db/profile {riskProfile}
    App-->>U: muestra plan (Conservador/Moderado/Balanceado/Crecimiento)
    Note over U,SB: el perfil se sincroniza entre dispositivos desde Supabase
```

### Depósito (fondear la wallet del usuario) con UI optimista

```mermaid
sequenceDiagram
    actor U as Usuario
    participant App
    participant API as /api/juno/fund-wallet
    participant Juno
    participant Arb as Arbitrum
    U->>App: Agregar $500
    App->>API: POST {address, amount}
    API->>Juno: withdrawal MXNB → address (HMAC, idempotente)
    Juno-->>App: aceptado
    App->>App: agrega movimiento "Pendiente" y cierra el loader
    Juno->>Arb: transfiere MXNB on-chain
    App->>Arb: getLogs(Transfer) detecta la confirmación
    App->>App: el movimiento pasa de "Pendiente" a confirmado
```

### Envío on-chain gasless (account abstraction)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant App
    participant SW as Smart Wallet
    participant PM as Paymaster (ZeroDev)
    participant BN as Bundler (Pimlico)
    participant Arb as Arbitrum
    U->>App: Enviar MXNB a 0x...
    App->>SW: sendTransaction(transfer)
    SW->>PM: solicita patrocinio de gas
    PM-->>SW: UserOp patrocinada
    SW->>BN: envía UserOperation
    BN->>Arb: ejecuta (gas pagado por el paymaster)
    Arb-->>App: se resta del saldo del usuario
```

### Redención (MXNB → MXN por SPEI)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant App
    participant API as /api/juno/redeem
    participant Juno
    participant Bank as Banco (CLABE)
    U->>App: Redimir a pesos
    App->>API: register-bank → redeem
    API->>Juno: redemption MXNB → MXN (idempotente)
    Juno->>Bank: transferencia SPEI
    Juno-->>App: REDEMPTION en progreso
```

### CLABE de depósito por usuario

```mermaid
sequenceDiagram
    actor U as Usuario
    participant App
    participant API as /api/juno/create-clabe
    participant Juno
    participant SB as Supabase
    U->>App: "Crear mi CLABE"
    App->>API: POST
    API->>Juno: create CLABE (AUTO_PAYMENT)
    Juno-->>App: { clabe, type }
    App->>SB: POST /api/db/clabe {wallet, clabe}
    App->>App: muestra la tarjeta de depósito
    Note over U,Juno: en producción, el webhook de Juno acredita los depósitos a su wallet
```

---

## Funcionalidades

| Módulo | Descripción | Estado |
|--------|-------------|:------:|
| Landing | Hero animado, contadores, marquee, bento, FAQ, tilt 3D — CTA Iniciar → /app | Listo |
| Login social (Privy) | Email OTP, wallet embebida sin seed phrase | Listo |
| Account abstraction | Smart wallet ERC-4337 (Kernel) + paymaster (ZeroDev) + bundler (Pimlico) | Listo |
| Saldo on-chain real | Lectura de MXNB (ERC-20) de la wallet del usuario (viem), refresco cada 20 s | Listo |
| Agregar (depósito) | Fondea la wallet del usuario con MXNB; UI optimista (pendiente → confirmado) | Listo |
| Enviar | Transferencia MXNB on-chain gasless; se resta del saldo del usuario | Listo* |
| Historial | Transferencias MXNB reales on-chain + pendientes (viem getLogs) | Listo |
| CLABE de depósito | CLABE única por usuario + tarjeta de depósito (SPEI → MXNB) | Listo |
| Redeem | MXNB → MXN por SPEI a una CLABE registrada | Listo |
| Bóvedas | Metas de ahorro reales por usuario (crear/abonar/retirar) + Supabase | Listo |
| Convertir | Calculadora multi-activo + acción real para el par MXNB ↔ MXN; historial en Supabase | Listo |
| Bono de bienvenida | 1,500 MXNB on-chain a usuarios nuevos (testnet) | Listo |
| Perfil de riesgo | Cuestionario 5 preguntas Typeform-style → Conservador / Moderado / Balanceado / Crecimiento | Listo |
| Planes de ahorro | 4 estrategias de bóveda + producto AFORE · comparativo vs comisiones AFORE tradicional | Listo |
| Perfil persistido | Upsert de perfil (wallet, email, DID, risk_profile) en Supabase; sync multi-dispositivo | Listo |
| Límites mensuales | Control de uso de depósito/retiro por período (Supabase o localStorage) | Listo |

\* El envío gasless requiere una política de patrocinio activa en ZeroDev (ver [Configuración](#configuración-juno--privy--zerodev)).

---

## API (endpoints)

### `/api/juno/*` — Rieles fiat (HMAC-SHA256, server-side)

| Método | Ruta | Función |
|:------:|------|---------|
| `GET`  | `/api/juno/health` | Estado + si hay credenciales |
| `GET`  | `/api/juno/account-details` | CLABEs de depósito del negocio |
| `POST` | `/api/juno/create-clabe` | Crear CLABE única (por usuario) |
| `POST` | `/api/juno/mock-deposit` | Issuance (SPEI test → MXNB al negocio) |
| `POST` | `/api/juno/fund-wallet` | Enviar MXNB on-chain a la wallet del usuario (depósito) |
| `GET`  | `/api/juno/balance` | Balances del negocio (MXNB) |
| `GET`  | `/api/juno/transactions` | Historial del negocio |
| `GET`  | `/api/juno/bank-accounts` | Cuentas registradas |
| `POST` | `/api/juno/register-bank` | Registrar CLABE destino |
| `POST` | `/api/juno/redeem` | Redemption (MXNB → MXN) |
| `POST` | `/api/juno/withdrawal` | Retiro on-chain de MXNB |
| `POST` | `/api/juno/welcome-bonus` | Bono de bienvenida (1,500 MXNB) |
| `POST` | `/api/juno/webhook` | Eventos async (firma verificada) |

### `/api/db/*` — Persistencia Supabase (service_role, server-side)

| Método | Ruta | Función |
|:------:|------|---------|
| `GET` / `POST` | `/api/db/profile` | Leer / upsert perfil de usuario (wallet, email, DID, risk_profile, fullName, phone) |
| `GET` / `POST` | `/api/db/clabe` | Leer / guardar CLABE de depósito del usuario |
| `GET` / `POST` / `DELETE` | `/api/db/banks` | Listar / agregar / eliminar cuentas bancarias de retiro |
| `GET` / `POST` / `DELETE` | `/api/db/vaults` | Listar / upsert / eliminar bóvedas de ahorro |
| `GET` / `POST` | `/api/db/conversions` | Listar / registrar conversiones FX |
| `GET` / `POST` | `/api/db/limits` | Consultar / acumular uso mensual (depósito/retiro) |
| `GET` / `POST` | `/api/db/bonus` | Leer / marcar bono de bienvenida como reclamado |

---

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/` | Landing — primera pantalla, CTA Iniciar / Iniciar ahora → /app |
| `/app` | App — onboarding (login + quiz perfil) → Inicio · Wallet · Bonos · Bóvedas · Tarjeta · Perfil |

---

## Configuración (Juno · Privy · ZeroDev)

**1. Juno / Bitso Business** — genera un par de llaves de API en el dashboard de stage (`stage.buildwithjuno.com`) y ponlas en `.env.local` (`BITSO_APIKEY`, `BITSO_SECRET_APIKEY`). Sin restricción de IP, o whitelistea la tuya.

**2. Privy** — crea una app en [dashboard.privy.io](https://dashboard.privy.io):
- Activa **Email** como método de login.
- En **App settings → Allowed origins**, agrega `http://localhost:3000`.
- En **Smart wallets**, activa Kernel en **Arbitrum Sepolia** y configura el **bundler (Pimlico)** y **paymaster (ZeroDev)**.
- Copia el **App ID** a `NEXT_PUBLIC_PRIVY_APP_ID`.

**3. ZeroDev** — en [dashboard.zerodev.app](https://dashboard.zerodev.app), en tu proyecto:
- Ve a **Gas Policies** y crea una política de **patrocinio** para **Arbitrum Sepolia** (p. ej. "sponsor all", o limitada al contrato MXNB y método `transfer`).
- Sin esta política, el envío gasless falla con `userOp did not match any gas sponsoring policies`.

**4. Supabase** — crea un proyecto en [supabase.com](https://supabase.com):
- Copia la **URL del proyecto** a `SUPABASE_URL` y la **service_role key** a `SUPABASE_SERVICE_ROLE_KEY`.
- Activa `NEXT_PUBLIC_USE_SUPABASE=true` para habilitar la persistencia real (sin él la app usa localStorage).
- Las tablas necesarias: `profiles`, `deposit_clabes`, `bank_accounts`, `vaults`, `bonus_claims`, `conversions`, `monthly_limits`.

---

## Variables de entorno

Ver [`.env.example`](.env.example).

| Variable | Lado | Req. | Descripción |
|----------|:----:|:----:|-------------|
| `BITSO_APIKEY` | server | sí | API key de Juno (stage) |
| `BITSO_SECRET_APIKEY` | server | sí | API secret de Juno (stage) |
| `JUNO_BASE_URL` | server | no | Default `https://stage.buildwithjuno.com` |
| `JUNO_WITHDRAWAL_ASSET` | server | no | Default `mxnbj` |
| `JUNO_BLOCKCHAIN` | server | no | Default `arbitrum` |
| `WELCOME_BONUS_AMOUNT` | server | no | Default `1500` |
| `JUNO_WEBHOOK_SECRET` | server | no | Verificación de webhooks |
| `SUPABASE_URL` | server | sí* | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | server | sí* | Solo en server (route handlers) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | cliente | sí† | App ID de Privy (sin él → modo demo) |
| `NEXT_PUBLIC_USE_SUPABASE` | cliente | no | `"true"` activa persistencia real en Supabase |
| `NEXT_PUBLIC_CHAIN` | cliente | no | `arbitrum-sepolia` (default) o `arbitrum` |
| `NEXT_PUBLIC_MXNB_ADDRESS` | cliente | no | Contrato MXNB (autodetecta por red) |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | cliente | no | Tesorería on-chain para conversión pooled+ledger |
| `NEXT_PUBLIC_ARBITRUM_RPC` | cliente | no | RPC custom de Arbitrum |
| `NEXT_PUBLIC_BACKEND_URL` | cliente | no | Solo si el backend está en otro origen |

\* Requerido solo si `NEXT_PUBLIC_USE_SUPABASE=true`.  
† Sin él la app corre en modo demo con localStorage.

Las llaves de Juno nunca van con prefijo `NEXT_PUBLIC_`.

**Contratos MXNB (oficiales):** Sepolia `0x82B9e52b26A2954E113F94Ff26647754d5a4247D` · Mainnet `0xF197FFC28c23E0309B5559e7a166f2c6164C80aA` (6 decimales).

---

## Arranque

```bash
cp .env.example .env.local      # Juno keys + NEXT_PUBLIC_PRIVY_APP_ID
npm install
npm run dev                     # http://localhost:3000
```

Probar los rieles fiat de Juno:

```bash
curl -s localhost:3000/api/juno/account-details          # CLABE del negocio
curl -s -X POST localhost:3000/api/juno/mock-deposit \
  -H 'content-type: application/json' \
  -d '{"amount":"2000","receiver_clabe":"<CLABE>","receiver_name":"Reyf","sender_name":"Test"}'
curl -s localhost:3000/api/juno/balance                  # confirma MXNB
```

En la app: entra con tu correo, completa el quiz de perfil de riesgo, reclama el bono, agrega fondos y envía MXNB on-chain (sin gas).

---

## Estructura

```
src/
  app/
    page.tsx                 # Landing (/)
    landing.css              # estilos landing (scoped .lp)
    app/
      layout.tsx             # Providers (Privy) solo en /app
      page.tsx               # App (/app)
    layout.tsx · globals.css
    api/
      juno/*/route.ts        # 13 endpoints (HMAC-SHA256 → Juno)
      db/*/route.ts          # 7 endpoints (service_role → Supabase)
  components/
    landing/Landing.tsx      # landing portada
    Providers.tsx            # PrivyProvider + SmartWalletsProvider
    wallet/                  # WalletContext + PrivyBridge (auth · saldo · gasless · profile sync)
    app/
      ReyfApp.tsx            # shell + router + tabbar
      data.ts                # mock data + VaultPlan + RISK_QUESTIONS + helpers (projectSavings, aforeVsReyf…)
      RiskQuiz.tsx           # OnboardingQuiz (Typeform) + RiskQuizBanner + RiskQuizModal
      screens/               # core · invest · account
      modals/                # Deposit · Redeem · SendOnchain
      ClabeCard.tsx          # tarjeta de depósito (CLABE)
      WelcomeBonus.tsx       # bono de bienvenida
  hooks/                     # useJuno · useOnchain · usePendingTxns · useVaults · useUserClabe
  services/junoService.ts    # cliente tipado
  lib/
    juno/                    # firma HMAC + cliente server-side
    supabase/
      server.ts              # cliente Supabase con service_role
      db.ts                  # helpers: profiles · clabes · banks · vaults · conversions · limits · bonus
    chain.ts                 # viem · MXNB · readBalance · readTransfers
    store.ts                 # capa storage: /api/db/* (Supabase) o localStorage
  types/juno.ts
docs/screenshots/            # capturas del README
```

---

## Seguridad

- Secretos de Juno solo en el servidor; el cliente nunca ve credenciales ni firma HMAC.
- `SUPABASE_SERVICE_ROLE_KEY` solo en route handlers server-side; nunca expuesto como `NEXT_PUBLIC_*`.
- Sin seed phrase: wallets embebidas/inteligentes de Privy; acceso con correo.
- Idempotencia (`X-Idempotency-Key`) en redeem, withdrawal y fund-wallet.
- Webhook con verificación de firma (`timingSafeEqual`).
- `mock-deposit` restringido al endpoint de pruebas de stage.

---

## Roadmap

- Verificación de usuario en el backend (Privy `server-auth` + App Secret) para atar issuance/redeem y `/api/db/*` al usuario logueado (hoy se scopea por dirección de wallet).
- Redeem no custodial (que el cash-out reste del saldo on-chain del usuario).
- Integración con Etherfuse para comprar bonos de gobierno tokenizados con MXNB.
- Webhooks de Juno → actualización de saldos e historial en tiempo real.
- Pantalla de Mercado (lista de activos/bonos) — rutas activas, oculta del tab bar por decisión de negocio.

---

## Documentación

- [`INTEGRATION.md`](./INTEGRATION.md) — integración Juno/Bitso + Privy (endpoints, env, flujos, changelog).

<div align="center">
<br/>
Hecho para EthMex 2026 · MXNB · Arbitrum · Privy · ZeroDev · Juno · Supabase
</div>
