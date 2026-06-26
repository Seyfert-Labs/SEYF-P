# 🏦 SEYF — The AFORE of the Future

> **The dignified retirement the system won't give you: in digital pesos and dollars, earning yield from day one, on-chain, and for everyone — including the 57% no pension fund covers.**

**SEYF** is a retirement-savings super app built on **MXNB** (Bitso/Juno's digital peso on Arbitrum). It turns crypto rails into a neobank experience anyone understands: no gas, no seed phrases, no idea there's a blockchain underneath.

- 🔗 **Live demo:** https://eth-mex2026.vercel.app
- 💻 **Code:** https://github.com/MarxMad/EthMex2026

---

## 🔴 The problem

Mexico's pension system is broken by design:

- **~30% replacement rate** → you retire on less than a third of your last salary.
- **~57% informality** → most workers (gig, freelancers, self-employed) have **no AFORE at all**.
- **Concentration + inflation** → pension funds sit almost entirely in peso assets; 40 years of devaluation erode your purchasing power.
- **Opacity** → nobody reads the annual statement; tax-advantaged voluntary savings are massively underused.

## 🟢 The solution

SEYF is **the AFORE of the future**: voluntary, global, on-chain, and for everyone. Every peso you save lives on-chain as MXNB — genuinely yours, yield-bearing, and globally mobile — but the app feels like any bank.

| Feature | Why it matters for retirement |
|---|---|
| 💰 **Yield-bearing MXNB** | Compound interest from peso #1 |
| 💵 **Dollar diversification (fair FX)** | Shield against 40 years of peso devaluation |
| 🏛️ **Sovereign bonds from 4 countries, from $50** | A pension's portfolio — global, no minimums |
| 🎯 **Goal vaults with auto-contributions** | Voluntary saving turned into a habit |
| ⚡ **Liquidity advance** | Emergencies without breaking your retirement |
| 👁️ **On-chain, real-time** | Watch your retirement grow today, not in a yearly PDF |

---

## ✨ What's genuinely innovative (the architecture)

The challenge: how does a small fintech offer **exchange-grade FX and yield** without each user holding an exchange account? Bitso/Juno sees **one business (pooled) account**. Per-user attribution isn't requested from the exchange — **it lives in our reconciled ledger**.

```
1. User smart wallets  (on-chain, per-user, hold MXNB)
          |  transfer MXNB
          v
2. Business pool — ONE Bitso/Juno account (commingled MXN/USDT)
          |  every move attributed to wallet_address
          v
3. Per-user ledger (Supabase, keyed by wallet_address)
          |
          v
4. Solvency invariant:  SUM(all users) <= real pool balance
```

**Orchestrated, atomic & idempotent conversion** (`/api/convert`):

```ts
// 1. idempotent reservation (a retry does NOT duplicate the order)
await beginConversion(wallet, { id: key, from, to, kind });
// 2. real market order on Bitso
const order = await placeConversionOrder(from, to, amount);
// 3. (reverse) mint MXNB on-chain to the user's wallet via Juno
if (inverse) await withdrawMXNB(address, filledTo, key);
// 4. settle the ledger with the REAL executed amounts
await completeConversion(key, { amountFrom, amountTo, oid: order.oid });
```

A verifiable **solvency invariant** (`/api/treasury/reconcile`): for each asset, `SUM(all users' ledger) <= real pool balance`. The surplus is the business reserve.

---

## 🔌 Bitso / Juno / MXNB integration (sponsor track)

- **MXNB on Arbitrum** as the base asset (ERC-20, 6 decimals) — balance, transfers, yield.
- **Juno Mint Platform** — issuance (SPEI deposit → mint MXNB), **withdrawals** (MXNB on-chain to the user's wallet), **redemptions** (MXNB → MXN, funding the pool).
- **Bitso Exchange API** — market orders for real FX (MXNB ↔ USDT) at interbank rates.
- **Server-side HMAC signing** — Bitso/Juno keys **never** touch the client; every order is signed in route handlers.
- ✅ **Tested end-to-end on stage:** redemption funds the pool; forward (MXN→USDT) and reverse (USDT→MXNB on-chain) execute with ledger + healthy reconciliation.

## 🧱 Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind v4**
- **Privy** — auth + embedded wallet + **ERC-4337 smart wallet with sponsored gas** (gasless UX)
- **viem 2 + permissionless 0.2** — onchain
- **Supabase** — persistence + reconciled per-user ledger
- **Foundry** — contracts (`SeyfVaults`, `SeyfAdvance`)
- **Arbitrum** — cheap, fast L2 settlement

## 📲 Features

- Onboarding with a risk-profile quiz
- Goal-based savings vaults with auto-contributions
- Convert MXN ⇄ currencies at the real exchange rate (confirmation pop-up + pending state in history)
- Sovereign bonds from 4 countries
- Liquidity advance against your savings
- Global multi-currency card
- Welcome bonus, deposit CLABE (SPEI), monthly limits

## 🛣️ Roadmap

1. **Today** — a **voluntary** retirement-savings layer (100% legal, no AFORE license needed)
2. **Next** — USD payroll landing in seconds · automated recurring savings · server-side reconciliation + auth
3. **Vision** — the on-chain retirement standard for LatAm as digital-asset regulation matures

> **Don't wait for a pension. Build it.**

---
