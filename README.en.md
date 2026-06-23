<div align="center">

# Reyf

### The retirement savings super app — save, invest, and spend without borders

Digital pesos that earn yield · Tokenized sovereign bonds · On-chain savings vaults · Multi-currency card (roadmap)  
Built on **MXNB** (Bitso Business / Juno), social smart wallets with no seed phrases, and gas-sponsored transactions on Arbitrum.

<br/>

[![Live Demo](https://img.shields.io/badge/Live_Demo-eth--mex2026.vercel.app-C8FF4D?style=for-the-badge)](https://eth-mex2026.vercel.app)
[![Repo](https://img.shields.io/badge/GitHub-EthMex2026-8B5CF6?style=for-the-badge)](https://github.com/MarxMad/EthMex2026)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)
![Arbitrum](https://img.shields.io/badge/Arbitrum-Sepolia-28A0F0?style=for-the-badge&logo=arbitrum)
![Privy](https://img.shields.io/badge/Privy-Smart_Wallets-6A4BFF?style=for-the-badge)

</div>

---

## Description

**Reyf** is a mobile-first personal finance and retirement-savings platform for Mexico. It combines the familiarity of a neobank (SPEI deposits, peso balances, simple copy) with on-chain infrastructure users never have to think about: **MXNB** on Arbitrum, ERC-4337 smart wallets, and programmatic access to yield and sovereign fixed income.

### The problem we address

Mexico’s mandatory pension system (AFORE) leaves most workers under-covered:

- **~30% replacement rate** at retirement for many contributors.
- **~57% labor informality** — gig workers and freelancers often have **no AFORE at all**.
- **Low real returns and poor transparency** — annual statements are opaque; voluntary savings are underused.
- **No liquidity** without punitive early withdrawals from long-term products.

Reyf targets Mexicans aged **25–55** who want a **voluntary, transparent, liquid** alternative: save in digital pesos, earn real yield, diversify into tokenized government bonds, and access liquidity without selling their positions.

### What we built

Reyf is a **single Next.js application** with two layers:

1. **Neobank UX (Arbitrum + MXNB)**  
   Email login via Privy → smart wallet with **no seed phrase** → gasless transfers via ZeroDev/Pimlico → SPEI on/off-ramp through Juno/Bitso Business → real MXNB balance on-chain.

2. **Retirement vaults (Solidity + app shell)**  
   Custom **`ReyfVaults`** contract: users open named vaults with a risk profile (`apyBps`), deposit MXNB, withdraw free balance, and track goals. Custom **`ReyfAdvance`** contract: **0% interest liquidity advance** against **future yield** — users receive MXNB today and lock collateral in the vault until they repay. This is Reyf’s answer to AFORE pension loans at **35% + VAT** vs **0%** (it is their own yield, advanced).

3. **Sovereign bonds track (Etherfuse + Stellar)**  
   Programmatic **KYC** and **CETES / Stablebonds** on-ramp via Etherfuse, with a Stellar wallet (Pollar) parallel to the Privy/Arbitrum stack. KYC lives inside the app shell; users never see “Stellar” or “Etherfuse” in the product copy.

4. **FX and treasury (Bitso pooled + ledger)**  
   Users convert MXNB ↔ USD/EUR/BRL with real Bitso market orders. On-chain MXNB moves to a business treasury address; per-user balances are attributed in Supabase with a **solvency reconcile** endpoint (`SUM(ledger) ≤ pool balance`).

### Core user flows (live on testnet)

| Flow | What happens |
|------|----------------|
| **Onboard** | Email OTP → smart wallet → 5-question risk quiz → profile synced to Supabase |
| **Deposit** | SPEI / mock issuance → MXNB minted → funded to user wallet; optimistic “pending → confirmed” UI |
| **Save in vault** | Approve + `deposit(vaultId, amount)` on `ReyfVaults`; balance read on-chain |
| **Advance yield** | User selects **1 year of yield** (current contract limit); app computes MXNB amount → `requestAdvance(vaultId, amountInUnits)` on `ReyfAdvance` |
| **Repay advance** | Approve + `repay(vaultId, amount)`; collateral released proportionally |
| **Redeem** | MXNB → MXN SPEI to registered CLABE via Juno redemption |
| **KYC (Etherfuse)** | In-app identity flow → documents → agreements → vault gated for sovereign strategy |

### Smart contracts (Arbitrum Sepolia)

| Contract | Address | Role |
|----------|---------|------|
| **MXNB** | `0x82B9e52b26A2954E113F94Ff26647754d5a4247D` | ERC-20, 6 decimals (Bitso/Juno) |
| **ReyfVaults** | `0x0212d50490FE5D7183B5B3A403d5C44937a44cF1` | Custody vault balances; `advanceManager` can lock collateral |
| **ReyfAdvance** | `0x6C9b17C9C28cDE1378CFC88f9e48c6900a6F7654` | Treasury-funded advances; legacy v1 uses **amount** param (see Progress) |
| **Treasury** | `0xae0AEAd08f5984E6CD00aB4Fd4e9c569D11b2eaF` | Pooled MXNB for FX conversion |

Contract source, tests (21 Foundry tests including reentrancy), and deploy scripts: [`contracts/`](contracts/).

### Design principles

- **Secrets stay server-side** — Juno HMAC, Supabase service role, Etherfuse API keys never in the client.
- **Real balances on-chain** — vault and wallet balances from `viem` reads, not fabricated UI numbers.
- **Graceful degradation** — without contract env vars, vaults fall back to Supabase/localStorage; without Privy, demo mode works locally.
- **Spanish-first product copy** — Mexican Spanish UX; English for dev docs and hackathon submissions.

**Links**

- Live app: https://eth-mex2026.vercel.app  
- Repository: https://github.com/MarxMad/EthMex2026  

---

## Progress During Buildathon

### Week 1 — Foundation (wallet + fiat rails)

- Ported landing and app shell to **Next.js 16 / React 19** with dark glassmorphism brand (lime + purple).
- Integrated **Privy** (email OTP) + **ERC-4337 Kernel** smart wallets + **ZeroDev** paymaster + **Pimlico** bundler on **Arbitrum Sepolia**.
- Wired **Juno / Bitso Business** server routes (HMAC-SHA256): issuance, fund-wallet, redeem, CLABE creation, webhooks.
- Implemented **real MXNB balance** reads, on-chain transfer history (`getLogs`), and **optimistic pending transactions**.
- Added **Supabase** persistence: profiles, CLABEs, bank accounts, vaults metadata, FX conversions, monthly limits, welcome bonus.

### Week 2 — Vaults + liquidity advance (core DeFi differentiator)

- Authored and deployed **`ReyfVaults.sol`**: per-user vaults with name, goal, `apyBps`, deposit/withdraw, and **lien** API for the advance manager.
- Authored and deployed **`ReyfAdvance.sol`**: 0% advance against future yield; treasury funding; repay with proportional collateral release.
- Built **Foundry test suite** (21 tests): vault isolation, lien access control, advance caps, partial repay, treasury, **reentrancy attacks** on withdraw and advance.
- Connected app **`useVaults`** hook: `openVault`, `deposit`, `withdraw`, `closeVault` via gasless smart-wallet transactions.
- Built **LiquidityAdvanceModal**: year selection, yield projection, confirm flow, on-chain receipt link, active-advance management + **RepayModal**.

### Week 3 — FX, risk product, Etherfuse integration

- Shipped **`/api/convert`**: idempotent Bitso orders + ledger settlement + on-chain treasury transfer for MXNB out.
- Added **risk quiz** (5 questions) → four strategies (Conservador / Moderado / Balanceado / Crecimiento) with AFORE fee comparison and 10/20/30-year projections.
- Ported **Etherfuse KYC + Stablebonds** stack from a sibling codebase: `/api/reyf/kyc/*`, ramp APIs, webhooks, Pollar Stellar wallet, in-app **`ScreenKyc`** (no external Etherfuse UI).
- Connected KYC status to **home/profile banners** (“verify account” → “account verified”).
- Documented product roadmap and sovereign-vault funding rail decision (SPEI to Etherfuse vs MXNB path).

### Week 4 — Production hardening (vault advance bug bash)

This was a major focus during the buildathon demo period:

**Problem discovered:** Users deposited **$7,000 MXNB** into a vault successfully (verified on Arbiscan: `7_000_000_000` units, vault id `0`), but **liquidity advance** transactions only transferred **~0.000001 MXNB** while the UI showed **$700–$5,985**.

**Root cause:** ABI mismatch between **deployed** `ReyfAdvance` (legacy v1: `requestAdvance(vaultId, amountInTokenUnits)`) and **frontend** (new model: `requestAdvance(vaultId, years)`). Sending `years = 9` was interpreted on-chain as **9 wei** of MXNB.

**Fix shipped (no redeploy required for testnet demo):**

1. **Contract version detection** — try `quoteAdvance` / `maxYears` (new contract); fall back to `maxAdvance` (legacy).
2. **Years → amount translation** — UI still lets users think in “years of yield”; server-side quote computes `amount = balance × apy × years`, capped by `maxAdvance()`.
3. **Correct calldata** — legacy path sends `requestAdvance(vaultId, 665_000_000)` not `requestAdvance(vaultId, 9)`.
4. **Honest UX** — legacy contract allows **~1 year of yield per advance** (~$665 on $7k at 9.5% APY). UI now states clearly: *“You can advance up to 1 year of yield”* instead of showing misleading 9-year chips.
5. **On-chain quote as source of truth** — `readAdvanceQuote()` drives all displayed amounts before confirm.

**Verified on-chain (Arbitrum Sepolia):**

- Vault balance: **7,000 MXNB** ✓  
- `maxAdvance(user, vault0)`: **665 MXNB** ✓  
- `advanceManager` correctly points to deployed advance contract ✓  

**Prepared but optional:** `contracts/scripts/redeploy-advance-sepolia.sh` to deploy **model B** contract (`requestAdvance(vaultId, years)`, up to **9 years / 90% LTV**) when the team is ready — no change to `ReyfVaults` required.

### What works end-to-end today

- Login → quiz → welcome bonus → deposit → vault fund → **1-year yield advance** → repay → redeem SPEI  
- KYC submit flow against Etherfuse sandbox (after API key fix)  
- FX conversion MXNB ↔ fiat currencies with ledger + reconcile  
- Pitch deck, demo video, and Instaward application materials  

### Known limitations (honest scope)

- Legacy advance contract: **1 year of yield max** per operation (multi-year single-tx requires contract redeploy).
- Sovereign vault **on-ramp** not fully wired (MXNB vs SPEI-to-Etherfuse rail decision pending).
- Etherfuse auto-deploy post-deposit is stubbed; sandbox SPEI simulation route not yet ported.
- Privy JWT not yet enforced on all `/api/reyf/*` routes (scoped by wallet + session cookie today).

---

## Tech Stack

Select up to **8** for the submission form; full stack below for reference.

### Recommended tags for the form

| Tag | How we use it |
|-----|----------------|
| **React** | UI components, hooks, app shell (`ReyfApp`, modals, screens) |
| **Next** | App Router, API routes, SSR landing, Vercel deploy |
| **Web3** | Smart wallets, on-chain reads, vault/advance transactions |
| **Ethers** | *(via **viem** — Ethereum JSON-RPC, ABI encode, `readContract`, `getLogs`)* |
| **Solidity** | `ReyfVaults`, `ReyfAdvance`, Foundry tests |
| **Node** | Next.js server handlers, Juno HMAC, Etherfuse orchestration |

> If the form allows free text: **viem**, **Privy**, **Supabase**, **TypeScript**, **Tailwind**, **Etherfuse**, **Stellar/Pollar**.

### Full stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 |
| **Wallets & auth** | Privy (email OTP) · ERC-4337 Kernel smart accounts |
| **Gas abstraction** | ZeroDev paymaster · Pimlico bundler |
| **On-chain client** | viem · permissionless |
| **Smart contracts** | Solidity 0.8.24 · Foundry (forge build / test) |
| **Chain** | Arbitrum Sepolia (testnet) · MXNB ERC-20 (6 decimals) |
| **Fiat / stablecoin rails** | Juno / Bitso Business (issuance, redeem, CLABE, SPEI) |
| **Exchange / FX** | Bitso REST API (market orders, pooled treasury model) |
| **Database** | Supabase (Postgres) — profiles, ledger, vaults metadata, conversions |
| **Sovereign bonds / KYC** | Etherfuse REST API · Pollar (Stellar wallet) · Upstash Redis (optional) |
| **Deploy** | Vercel (frontend) · Foundry scripts (contracts) |

### Repository layout (high level)

```
Seyf2/
├── src/app/api/juno/          # Fiat rails (HMAC)
├── src/app/api/db/            # Supabase persistence
├── src/app/api/reyf/          # Etherfuse KYC + ramp
├── src/components/app/        # Mobile app UI + LiquidityAdvanceModal
├── src/lib/chain.ts           # viem, vault/advance ABIs, readAdvanceQuote
├── contracts/
│   ├── ReyfVaults.sol
│   ├── ReyfAdvance.sol
│   └── test/                  # 21 Foundry tests
└── docs/                      # PRD, pitch, Etherfuse integration notes
```

---

## Fundraising Status

**Stage:** Pre-seed / hackathon & grant pipeline (EthMex 2026, Instaward application in progress).

**What we are raising for (12–18 months):**

| Use of funds | Purpose |
|--------------|---------|
| **Regulatory & legal** | Fintech counsel (CNBV-adjacent structure), KYC/AML program design |
| **Smart contract audit** | `ReyfVaults` + `ReyfAdvance` before mainnet real funds |
| **Etherfuse / SPEI production** | Live sovereign-bond rail, webhook ops, treasury float for advances |
| **Team** | 1 backend (rails + ledger), 1 mobile/frontend, 1 part-time compliance |

**Traction to date (testnet):**

- Working demo: wallet, SPEI mock, vaults, 1-year yield advance, KYC flow, FX conversion architecture.
- Dual-rail architecture documented (Arbitrum/MXNB + Stellar/CETES).
- Solvency reconcile endpoint for pooled treasury model.

**Business model (summary):**

- Spread on FX vs Google-rate card spend (roadmap).
- Yield differential on vault strategies (user sees projected APY; protocol captures spread vs underlying instruments).
- B2B white-label vault infrastructure for cooperatives and gig platforms (longer term).

**Not raising via token.** MXNB is Bitso/Juno’s regulated digital peso — Reyf is the UX and orchestration layer, not a new stablecoin issuer.

**Contact:** submission via EthMex 2026 / GitHub issues on the repo. Team details in pitch deck (`docs/reyf-pitch.html`).

---

## Quick start (developers)

```bash
cp .env.example .env.local
npm install
npm run dev    # http://localhost:3000
```

See [`.env.example`](.env.example) and [`contracts/README.md`](contracts/README.md) for Juno, Privy, ZeroDev, vault contract addresses, and advance redeploy instructions.

---

## Security notes

- Juno and Supabase secrets are **server-only** (never `NEXT_PUBLIC_*`).
- Idempotency keys on fund-wallet, redeem, and convert.
- Webhook signature verification (Juno + Etherfuse).
- Reentrancy guards on vault withdraw and advance paths (tested in Foundry).

---

<div align="center">

**Built for EthMex 2026** · MXNB · Arbitrum · Privy · ZeroDev · Juno · Etherfuse · Supabase

[Live Demo](https://eth-mex2026.vercel.app) · [GitHub](https://github.com/MarxMad/EthMex2026)

</div>
