# SEYF × HackMeridian 2026 — plan de ejecución

> Rama: `meridian` (nunca `main`). Repo público: github.com/Seyfert-Labs/SEYF-P
> Fuente de verdad Stellar: **stellar-raven** (docs oficiales, Scout, Lumenloop). Nada de direcciones ni APIs de memoria.

## Contexto verificado (Raven, 2026-10-25)

| Dato | Valor |
|---|---|
| Hacking | dom 25-oct 09:00 → **lun 26-oct 12:00 (Lisboa)**. Sin entregas tardías |
| Categoría | **Scale** (producto existente → producción). Se juzga: hitos vs. metas del intake, elegibilidad SCF, *production readiness*, impacto en el ecosistema |
| Track temático | **Stellar Composed** (≥2 herramientas del ecosistema combinadas): Pollar + DeFindex + Soroswap + Etherfuse + SEP-10/CAP-33 |
| Prioridades del evento | smart contracts, **smart accounts**, cross-chain |
| Entregables | video demo, pitch deck, repo GitHub, respuestas del formulario |
| Final | finalistas pitchean en vivo en Meridian, 28-oct |
| Red | Mainnet en **Protocol 29** (1-oct-2026). `@stellar/stellar-sdk` actual: **16.4.1** (repo en 14.6) |
| Fee sponsorship | Launchtube retirado → **OpenZeppelin Relayer / Stellar Channels** |
| Horizon | en fin de vida (sin features nuevas) → Stellar RPC |
| USDC mainnet (Circle) | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| SCF #46 | fase Submission, cierre 2026-11-08 |

## Decisiones tomadas (defaults; cambiar aquí si no)

1. **Reflector se elimina.** Precios: Etherfuse (CETES) + Soroswap quote (XLM/USDC→MXN vía USDC) + Bitso ticker público como respaldo solo para MXN/USD.
2. **Pollar es el único login + wallet** (cuenta G). Privy, ERC-4337, viem, Arbitrum, MXNB, Juno, Bitso-órdenes y Dynerox salen de `meridian`.
3. **Etherfuse es la única rampa MXN** (SPEI ↔ CETES/MXNe en Stellar).
4. **Bóvedas = DeFindex.** `contracts/` (Solidity) sale del árbol.
5. **Adelanto de liquidez** queda oculto tras flag (`NEXT_PUBLIC_FEATURE_ADVANCE=false`) — no hay contrato Soroban todavía.
6. **Mainnet honesto:** lo que exista en mainnet corre en mainnet (SEP-10, cuenta patrocinada, trustline, swap Soroswap); lo que no (p. ej. vault CETES si DeFindex no lo tiene) se demuestra en testnet y se dice así en el README/deck.
7. **Smart accounts (passkeys)** = stretch goal: solo si el bloque B2 cierra a tiempo.

## Bloques (hora Lisboa)

| # | Ventana | Bloque | Hecho cuando |
|---|---|---|---|
| B0 | 13:30–14:00 | Intake: confirmar las metas declaradas al registrarse (Scale se juzga contra ellas) | metas copiadas en §Metas |
| B1 | 14:00–15:00 | **Red al día:** quitar Reflector, subir stellar-sdk a 16.x, build verde | `npm run build` exit 0 |
| B2 | 15:00–20:00 | **Fuera EVM:** WalletContext sobre Pollar, borrar riel Arbitrum, recablear modales | `grep -riE "privy\|viem\|arbitrum\|mxnb\|juno"` en `src/` = 0; build verde; flujo login→home→depósito→bóveda→swap→envío funciona en testnet |
| B3 | 20:00–23:00 | **Mainnet:** env de producción, sponsor fondeado, `check:mainnet` verde, txs reales | hashes de mainnet (SEP-10, create-account patrocinada, trustline USDC, swap) en el README |
| B4 | 23:00–02:00 | **Landing + pulido app** | landing nueva en Vercel prod; sin pantallas mock en el flujo demo |
| — | 02:00–07:00 | Dormir | — |
| B5 | 07:00–10:00 | README, deck, video (≤3 min) — *(passkeys solo si B2 cerró antes de 18:00)* | 3 entregables listos |
| B6 | 10:00–11:30 | Entrega en el portal + buffer | enviado antes de 11:30 |

## Mapa de cambios B2 (pantalla → riel Stellar)

| Hoy (EVM) | Queda (Stellar) |
|---|---|
| `Providers.tsx` + `PrivyBridge` + `SmartWalletsProvider` | `SeyfPollarProvider` + nuevo `StellarWalletBridge` que llena `WalletCtx` |
| `WalletState.sendMXNB / sendTx / smartAddress / gaslessReady` | `sendPayment(to, asset, amount)` (fee-bump vía sponsor), `address` = G…, `gaslessReady` = sponsor configurado |
| `useOnchain` (saldo MXNB viem) | saldos Stellar (XLM, USDC, CETES) por RPC/Horizon |
| `DepositModal` / `ClabeCard` (Juno CLABE) | `/api/seyf/etherfuse/deposit-info` + onramp |
| `RedeemModal` (Juno redeem) | offramp Etherfuse (si no hay endpoint: ocultar) |
| `AddBankModal` (Juno register-bank) | `/api/seyf/etherfuse/bank-account` |
| `SendModal` (MXNB) | pago Stellar (`/api/stellar/pay/build` + `sponsor/submit`) |
| Conversión FX (`/api/convert`, Bitso órdenes) | swap Soroswap (`/api/swap/*`) |
| `WelcomeBonus` (1,500 MXNB) | onboarding patrocinado (cuenta + trustlines gratis) |
| `LiquidityAdvanceModal` / `RepayModal` / `useAdvance` | ocultos tras flag |
| `usePendingTxns` / historial | operaciones de la cuenta Stellar |

Borrar: `src/app/api/{juno,bitso/convert,convert,treasury,dynerox}`, `src/lib/{juno,chain.ts,dynerox,bitso/orders.ts}`, `src/services/junoService.ts`, `src/types/juno.ts`, `src/hooks/useJuno.ts`, `src/components/wallet/PrivyBridge.tsx`, `contracts/`, `src/lib/stellar/reflector.ts`, `src/app/api/prices/reflector`. Deps: `@privy-io/react-auth`, `viem`, `permissionless`, `ox`.

## Metas (pegar las del intake)

- [ ] …

## Riesgos

1. stellar-sdk 16 vs Pollar/Soroswap/DeFindex (peer deps) — se valida en B1; si rompe, fijar 14.x y anotarlo.
2. No exista vault CETES de DeFindex en mainnet → regla 6.
3. Pollar sin soporte mainnet → la demo mainnet usa cuenta de prueba firmada en servidor solo para las txs de evidencia, y se declara.
4. Tiempo: si a las 20:00 B2 no está verde, se congela alcance (sin landing nueva; solo pulido).

---

## MASTER PROMPT

Pega esto en una sesión nueva de Claude Code abierta en `Seyf2/` (o úsalo como checklist para esta).

```text
Eres el ingeniero principal de SEYF en HackMeridian 2026 (categoría Scale, track Stellar Composed).
Deadline duro: lunes 26-oct-2026 12:00 hora de Lisboa. Optimiza para entregar, no para perfección.

ANTES DE EMPEZAR
- Lee SOUL.md y docs/seyf-context.md (los 4 checks: llms.txt, skills.stellar.org,
  stellar-build, ecosystem-resources). Si .claude/skills/ está vacío:
  `bash scripts/install-stellar-skills.sh`. Usa los skills instalados (dapp, data,
  assets, standards, pollar-wallet-auth, defindex-sdk, soroswap-sdk, stellar-anchors,
  deploy-stellar-mainnet) y reusa lo de §Check 4 antes de escribir código nuevo.

REGLAS
- Trabaja SOLO en la rama `meridian`. Nunca toques `main`. Commits pequeños por bloque,
  mensaje en español estilo del repo (feat(...)/fix(...)/chore(...)).
- Cualquier hecho de Stellar (direcciones de contrato/issuer, APIs del SDK, versiones, SEPs,
  endpoints de Soroswap/DeFindex/Etherfuse/Pollar, OZ Relayer) se verifica con stellar-raven
  (search → execute; stellarDocs para referencia, skills para how-to, scout/lumenloop para ecosistema).
  Nunca inventes una dirección C…/G…. Si Raven no la confirma, déjala en env y márcala.
- Secretos solo server-side, nunca NEXT_PUBLIC_*. No leas ni imprimas .env.
- Respeta las reglas de CLAUDE.md (store.ts decide Supabase/localStorage; clientes Supabase solo
  en lib/supabase; las screens no importan SDKs de wallet, solo useWallet()).
- Gate de cada bloque: `npm run build` exit 0. Si algo no cabe en tiempo, ocúltalo tras flag,
  no lo dejes roto.
- Plan y decisiones: docs/hackmeridian-plan.md. Si cambias una decisión, actualízala ahí.

BLOQUES (en orden; reporta al terminar cada uno con qué cambió y cómo se verificó)
B1 Red al día
  - Elimina Reflector: src/lib/stellar/reflector.ts, /api/prices/reflector, su uso en
    /api/prices/mxn (fuentes: etherfuse para CETES, Soroswap quote vía USDC, Bitso ticker
    público solo como respaldo MXN/USD), menciones en .env.example, docs y stellar.toml.
  - Con Raven: notas de release de js-stellar-sdk 15→16 y peer deps de @soroswap/sdk,
    @defindex/sdk, @pollar/core. Sube @stellar/stellar-sdk a 16.x si es compatible; si no, fija y anótalo.
B2 Fuera EVM (Pollar = único login/wallet)
  - Reescribe WalletState para Stellar (address G…, balances XLM/USDC/CETES, sendPayment
    con fee-bump del sponsor, login/logout vía Pollar). Crea StellarWalletBridge; elimina
    PrivyProvider/SmartWalletsProvider/PrivyBridge.
  - Recablea según la tabla "Mapa de cambios B2" del plan. Borra la lista "Borrar" y las deps EVM.
  - StellarConnectGate: ya no hay "login Privy previo"; el OTP de Pollar es el login.
  - Actualiza CLAUDE.md, README.md y .env.example al stack full Stellar.
  - Verifica: grep -riE "privy|viem|arbitrum|mxnb|juno|permissionless" src = 0 resultados;
    build verde; `npm run dev` y recorre login→home→depósito→bóveda→swap→envío en testnet.
B3 Mainnet
  - Con Raven confirma: vaults DeFindex en mainnet (¿existe CETES?), asset CETES/MXNe de
    Etherfuse en mainnet, soporte mainnet de Pollar, endpoint mainnet de Soroswap.
  - Completa public/.well-known/stellar.toml (SIGNING_KEY derivada de SEP10_SERVER_SECRET,
    dominio, USDC issuer, contacto). Pasa `npm run check:mainnet` a verde.
  - Genera evidencia on-chain en mainnet: SEP-10, create-account patrocinada, trustline USDC,
    un swap Soroswap. Pega los hashes (stellar.expert) en README §Mainnet.
  - Lo que no exista en mainnet: se queda en testnet y se declara explícitamente.
B4 Landing + pulido
  - Landing: mensaje "ahorro en CETES y dólares, sin seed phrase ni comisiones, sobre Stellar";
    sección "Construido con" (Pollar, DeFindex, Soroswap, Etherfuse, SEP-10, CAP-33);
    CTA a /app; sin "neobank/banco" (regulación MX). Responsive, carga rápida.
  - App: quita mocks del flujo demo, estados vacíos/carga/error claros, montos en MXN.
B5 Entregables
  - README en inglés+español: problema, demo, arquitectura (diagrama), qué es Stellar-native,
    evidencia mainnet, cómo correrlo, roadmap SCF (#46, 3 tranches).
  - Guion de video ≤3 min y outline del deck (10 slides) en docs/.
  - Stretch (solo si B2 cerró antes de 18:00): wallet con passkey (Smart Account Kit +
    OZ Relayer) detrás de flag — consulta skills/stellarDocs de smart accounts con Raven.

AL FINAL
  - Resumen: qué quedó en mainnet, qué en testnet, qué se ocultó, y riesgos abiertos.
```
