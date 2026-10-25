# SEYF — contexto Stellar y los 4 checks

Correr estos 4 checks antes de construir cualquier cosa sobre Stellar en SEYF.
Verificados el **2026-10-25** (mainnet en Protocol 29). Revalidar si pasa >1 mes.

| # | Check | Fuente | Para qué |
|---|---|---|---|
| 1 | **llms.txt** | docs oficiales en formato para agentes | referencia de protocolo/APIs |
| 2 | **skills.stellar.org** | skills oficiales + comunitarios | how-to probado por SDF |
| 3 | **stellar-build** | instalador de SDF DevRel (kaankacar) | journey idea → mainnet → SCF |
| 4 | **ecosystem-resources** | `stellar/ecosystem-resources` | qué reusar, qué es seguro |

Transversal a los 4: **stellar-raven** (MCP `search` + `execute`) es la fuente
de verdad en vivo. Ya está conectado en Claude Code.

---

## Check 1 — llms.txt

| Índice | URL | Contenido |
|---|---|---|
| Docs (raíz) | https://developers.stellar.org/llms.txt | Learn, Tokens, Tools, Networks, Validators, Meeting notes, OpenAPI |
| Build | https://developers.stellar.org/_llms/build.txt | 193 páginas: contratos, apps, smart accounts, agentic payments |
| Data | https://developers.stellar.org/_llms/data.txt | 305 páginas: RPC, Horizon, Hubble, indexers, oráculos |
| Platforms | https://developers.stellar.org/_llms/platforms.txt | 189 páginas: Anchor Platform, SEPs, SDP |
| Skills | https://skills.stellar.org/llms.txt | índice de los 8 skills oficiales + 50 comunitarios |
| DeFi: XOXNO | https://xoxno.com/llms.txt | (no usado por SEYF hoy) |

No hay `llms-full.txt`. Seguir los índices recursivamente.
También existe el **Stellar Docs MCP**: `claude mcp add --transport http --scope user stellar-docs "https://developers.stellar.org/mcp"`.

## Check 2 — skills.stellar.org

Instalados en `.claude/skills/` (scope de proyecto, ignorado por git) con
`bash scripts/install-stellar-skills.sh`.

**Oficiales (SDF):**

| Skill | Uso en SEYF |
|---|---|
| `dapp` (+ react, data-fetching, **smart-accounts**) | Next.js + Pollar; passkeys y fee sponsorship (stretch) |
| `data` (+ horizon) | migración Horizon → RPC (7 archivos aún usan Horizon) |
| `assets` | trustlines USDC/CETES, SAC |
| `standards` (+ ecosystem, resources) | SEP-1/10/24/45, CAP-33 |
| `smart-contracts` | solo si se porta el adelanto a Soroban |

**Comunitarios (SDF no los revisa — evaluar antes de seguirlos):**

| Skill | Uso |
|---|---|
| `pollar-wallet-auth` | login/wallet única de SEYF |
| `defindex-sdk` | bóvedas |
| `soroswap-sdk` | swaps/FX |
| `stellar-anchors` (Cheesecake Labs) | rampas SEP-6/24, Etherfuse |
| `stellar-prices-api` (Rumblefish) | candidato de precios tras quitar Reflector — sin vetar (repoScore 27) |

Descartados por ahora: agentic-payments, zk-proofs, cross-chain, XOXNO (licencia
no comercial, sin auditoría listada), Trustless Work (ver §Check 4).

## Check 3 — stellar-build

`curl -fsSL https://raw.githubusercontent.com/kaankacar/stellar-build/main/install.sh | bash`
— 47 skills + catálogo (728 proyectos LumenLoop, 9 027 repos Electric Capital,
ecosystem-resources) + Raven.

⚠️ **No se usa el one-liner global.** Leído `install.sh` (commit `989ae9b`): en
`$HOME` agrega `Bash, Read, Glob, Grep` a `permissions.allow` de
`~/.claude/settings.json`, registra hooks `UserPromptSubmit` que reescriben cada
prompt (`reprompt.sh`) en todos los proyectos, y manda un ping de telemetría.
`scripts/install-stellar-skills.sh` lo corre en un prefijo temporal con
`STELLAR_BUILD_NO_TELEMETRY=1` y copia solo:

| Skill | Cuándo |
|---|---|
| `deploy-stellar-mainnet` | B3 — 3 gates: verificación, mecánica, post-deploy |
| `stellar-competitive-landscape` | pitch: competidores con datos |
| `scf-round-watcher`, `scf-prescreen-checker`, `scf-submission-drafter`, `scf-budget-builder` | SCF #46 (cierre 2026-11-08) |
| `review-edge-case-hunter` | revisión antes de entregar |
| `data/` (guías + catálogos) | lo leen los anteriores |

## Check 4 — ecosystem-resources (apalancarse, no empezar de cero)

Fuente: https://github.com/stellar/ecosystem-resources (commit `0f0cb0d`, 2026-10-24).
Señales de confianza vía Raven `scout.searchRepos` (repoScore 0–100, actividad) el 2026-10-25.

### Qué SEYF ya usa y está bien elegido

| Pieza | Estado en el ecosistema |
|---|---|
| Pollar (`pollar-xyz/pollar`) | activo (oct-2026), repoScore 53, skill oficial listado |
| DeFindex SDK (`paltalabs/defindex-sdk`) | mantenido (sep-2026), integrado por Blend/Beans |
| Soroswap SDK | primer DEX/agregador de Soroban |
| Etherfuse | rampa MXN↔CETES vía SPEI, destacada en ecosystem-resources |
| SEP-10 + CAP-33 + fee-bump | primitivas nativas, ya implementadas |

### Qué reusar en vez de escribir

| Recurso | Para | Confianza | Cómo |
|---|---|---|---|
| **Regional Starter Pack** (`ElliotFriend/regional-starter-pack`) | cliente Etherfuse portable + libs SEP-1/6/10/12/24/31/38 | activo (oct-2026), de SDF DevRel | comparar con `src/lib/etherfuse`; copiar offramp si falta |
| **Smart Account Kit** (`stellar/smart-account-kit`) | passkeys (stretch) | repoScore **85**, activo; sobre contratos OZ auditados; **pre-1.0 (v0.6.x)** con breaking changes | detrás de flag |
| **OZ Relayer + Channels plugin** | envío Soroban patrocinado (reemplaza Launchtube, retirado) | activo, repoScore 52 | para DeFindex/Soroswap; reservas siguen con CAP-33 propio |
| ~~Trustless Work~~ | evaluado para el adelanto y **descartado** (2026-10-25) | auditado (Runtime Verification) y en mainnet, pero el escrow no puede depositar en DeFindex, no tiene time-lock y congela montos al fondear | se reemplaza por `soroban/seyf-lock` |
| `carstenjacobsen/ai-{passkeys,etherfuse,defindex,soroswap}-integration` | referencia de integración (passkeys + rampa MXN) | **dormidos desde mar-2026**, repoScore ≤31 | solo leer, no copiar |
| Stellar DeFi Gotchas (`kaankacar/stellar-defi-gotchas`) | 400+ hallazgos | no indexado en Scout | checklist de revisión |
| Anchor Directory / Demo Wallet / Anchor Test Suite | validar `stellar.toml` y SEPs | oficiales SDF | B3 |

### Gotchas que ya aplican a SEYF (guía Hack+ Alebrije CDMX, SDF DevRel)

- Soroban: `simulateTransaction` + `assembleTransaction` antes de `sendTransaction`; `sendTransaction` devuelve `PENDING` → `rpc.Server.pollTransaction`.
- DeFindex: montos siempre en arreglo, endpoint `/vault/` (no `/vaults/`), éxito = HTTP 201, `Authorization: Bearer <key>`.
- Etherfuse: `Authorization: <key>` **sin** `Bearer`; `customer_id` y `bankAccountId` son permanentes por usuario, no regenerar por sesión; en sandbox los pedidos no avanzan solos → `POST /ramp/order/fiat_received`.
- Testnet USDC tiene varios issuers que no comparten liquidez: el equivocado hace fallar swaps sin error claro.
- Mainnet: SDF no corre RPC público de mainnet; elegir proveedor (developers.stellar.org/docs/data/apis/rpc/providers).

### Seguridad (si se escriben contratos)

`cargo scout-audit` (CoinFabrik), skill `soroban-common-mistakes`, OZ Contracts
para Stellar; Audit Bank del SCF para la auditoría.

---

## Hechos de red verificados (Raven, 2026-10-25)

- Mainnet: **Protocol 29** (1-oct-2026). `@stellar/stellar-sdk` 16.4.1 (repo en 14.6 → subir).
- Horizon en fin de vida (sin features nuevas) → Stellar RPC + Portfolio APIs.
- Launchtube retirado → OpenZeppelin Relayer / Stellar Channels.
- SEP-45 = Web Auth para cuentas de contrato (C-accounts), complemento de SEP-10.
- USDC mainnet (Circle): `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`.
- HackMeridian 2026: entrega lun 26-oct 12:00 Lisboa; categoría Scale; track Stellar Composed. Ver `docs/hackmeridian-plan.md`.
