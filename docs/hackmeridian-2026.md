# SEYF at HackMeridian 2026: scorecard

**Category:** Scale · **Track:** Stellar Composed · **Event:** Lisbon, 25–26 Oct 2026

Judging for HackMeridian is an asynchronous review of the demo video, the pitch deck, the public
repo and the submission answers. For the **Scale** category, judges look at four criteria:
**milestones measured against the goals set at the pre-event intake, SCF eligibility, production
readiness and ecosystem impact.** (Source: meridian.stellar.org/hackmeridian, via the Stellar Raven
hackathon index, checked 2026-10-20.) This page maps each criterion to evidence in the repo and on
chain.

---

## 1. Milestones vs goals

> **Note for judges.** The pre-event intake goals were not copied into this repo. The goals below
> are the "in scope (mainnet)" list we set at the start of the build, in
> [`docs/hackmeridian-12h.md`](hackmeridian-12h.md) (Spanish), after the mentor sessions. They are
> compared here against what shipped.

| Goal set at the start | Status | Evidence |
| --- | --- | --- |
| Pollar login + SEP-10 session (fix for the Pollar v3 API) | ✅ Done | `5cd2856`, `24be722`, `17734a6` (account-proof for Turnkey wallets) |
| Account created by Pollar + **sponsored** USDC trustline, 0 XLM for the user | ✅ Done, mainnet | trustline tx [d8d98a95…](https://stellar.expert/explorer/public/tx/d8d98a958538a4183878f65eaf0863650eec9b232db714870cceb466aca9a840) |
| Receive USDC (G address + QR) | ✅ Done | Add money screen |
| Deposit and withdraw from the DeFindex USDC vault (Blend strategy) | ✅ Done, mainnet | deposit [23572a98…](https://stellar.expert/explorer/public/tx/23572a98345f5973a144cd40422c22f815ac8d76b89e68e188cbcd8767a858d1) · withdraw [082bee22…](https://stellar.expert/explorer/public/tx/082bee220cdde1d072b6d7d8792a6e4d1b53ae152433ac31bd7e225824ec45de) |
| See savings: balance, yield, projection | ✅ Done | Home + Savings screens |
| Yield advance: quote, open, repay, settle | ✅ Done, mainnet | open [ab42eac9…](https://stellar.expert/explorer/public/tx/ab42eac9fbd19885cbe6f7fa47a035531ff794f387fd3f5a171ce0fb4586606c) · repay [5cfd5592…](https://stellar.expert/explorer/public/tx/5cfd5592482eac2cdb08a077df8b7e40696e1b2c24d284e1aaef98445bf4da80) |
| Automatic settlement by a keeper | ✅ Done, mainnet | `.github/workflows/keeper.yml` · settle [be77ba1e…](https://stellar.expert/explorer/public/tx/be77ba1e080e77d337c45b351226d535982bafb24be2fb9ef022ff58ec5e0e19) |
| README, video and deck with mainnet hashes | ✅ Done | this repo, [contracts.md](contracts.md), [DEPLOYMENTS.md](../soroban/DEPLOYMENTS.md) |

**Beyond the original scope.** The plan only called for an isolated `/retiro` route. We also
brought the whole `/app` onto Stellar mainnet with Pollar (`311540a`), and redesigned the landing
in three languages (`54096a2`, `335be02`).

**Out of scope by decision**, not left unfinished: SPEI/Etherfuse on mainnet, Soroswap swaps,
passkeys and smart accounts, and the stellar-sdk 16 upgrade. See the roadmap below.

## 2. SCF eligibility

Checked against the SCF Handbook (Build Award: Submission Criteria, Integration Track, Open Track,
Audit Bank official rules) via Stellar Raven on 2026-10-26.

**Track fit.** SEYF fits the **Integration Track**: it combines existing building blocks (a wallet,
a DeFi vault, a lending protocol, a stablecoin and, next, an on/off-ramp) into an everyday
savings product. `seyf_advance` is the only new protocol piece. If it were pitched on its own as a
reusable primitive, the right fit would be the **Open Track**.

| Integration Track requirement | SEYF |
| --- | --- |
| Integrates at least one building block from the official SCF Integration List | Pollar, DeFindex, Blend, Circle USDC, and Etherfuse (next). *Which of these are on the current quarterly list is still to be confirmed against the list itself.* |
| Explain what is integrated, why it matters and the existing traction | Sections above. Live on mainnet with real transactions; user traction is still beta-sized. |
| Most of the budget goes to integration costs | Tranches below are integration-led (vault, ramp, wallet) |
| **On-chain success metric for tranche 3** (NAV, cumulative volume or similar) | Proposed: USDC NAV that SEYF users hold in the vault, plus cumulative advance volume through `seyf_advance`. *The target number is for the team to set.* |
| Self-contained submission with architecture and deliverables | [README](../README.md), [contracts.md](contracts.md), [how-it-works.md](how-it-works.md) |
| Disclosure of AI-assisted work | [README § AI disclosure](../README.md#ai-disclosure) |

**Proposed Build Award tranches**

1. **Hardening.** Our own non-upgradable DeFindex USDC vault with multisig roles instead of a
   third-party vault, a `cargo scout-audit` pass, and a STRIDE threat model for `seyf_advance`.
2. **Pesos in and out.** An MXN on/off-ramp over SPEI via Etherfuse, already integrated on testnet,
   plus tokenized CETES as a second savings asset.
3. **Launch.** Higher caps after the audit, and a public launch in Mexico measured by the on-chain
   metric above.

**Audit path.** The SCF Audit Bank only covers **SCF-funded** projects. It requires code deployed
on testnet (✅ done), extensive tests (✅ 17), the results of a self-service scan with a
remediation plan (to do), and a STRIDE threat model (to do). Until then, mainnet stays capped.

## 3. Production readiness

| Area | What is in place |
| --- | --- |
| **Live on mainnet** | Contract `CCZ77VBE…CWXH`, allowlist off: anyone can try it at [www.seyf.app/app](https://www.seyf.app/app) |
| **Risk controls** | Per-user cap of 1 USDC and global cap of 2 USDC. The pause switch blocks new advances but never `repay` or `settle`. No upgrade entry point. Two-step admin transfer. |
| **Tests** | 17 contract tests and a CI job on `soroban/`. `npm run build` is green. |
| **Gasless UX, done safely** | The fee-bump sponsor only signs allowlisted operations (contract, vault, USDC SAC, trustline), with a capped `resourceFee` |
| **Auth** | SEP-10 with the signing key published in SEP-1 [`stellar.toml`](https://www.seyf.app/.well-known/stellar.toml). The data API is gated by session (`wallet === sub`). |
| **Key management** | Admin key in the OS secure store, never on a server. Sponsor, keeper and SEP-10 keys are separate hot keys with minimal balances. |
| **Operations** | Keeper on GitHub Actions every 10 minutes. Supabase schema with RLS and no anonymous access ([`database/schema.sql`](../database/schema.sql)). |
| **Honest limits** | Documented in [contracts.md § Known limits](contracts.md#known-limits-of-the-beta): no audit yet, and the third-party vault is upgradable |

## 4. Ecosystem impact

- **A new primitive on top of existing yield.** `seyf_advance` turns any DeFindex vault share into
  collateral for a self-repaying advance. It works with any vault that exposes share value, without
  forking DeFindex or Blend. Other Stellar savings apps can reuse it.
- **Composition, not reinvention.** It brings together five ecosystem pieces in one consumer flow:
  Pollar, DeFindex, Blend, Circle USDC (SAC) and SEP-10/SEP-1, plus CAP-33 and fee-bump for a
  0-XLM user.
- **A real market.** It is aimed at Mexican savers, who measure everything in pesos and have never
  held crypto. The Etherfuse SPEI rail (testnet) is the next step to bring MXN liquidity onto
  Stellar.
- **Feedback upstream.** During the event we documented integration issues with Pollar 0.12: the
  DPoP nonce handshake, `SDK_WALLET_RECOVERY_REQUIRED` before signing, `SDK_COSIGN_DEVICE_NOT_ENROLLED` on a new browser, and SEP-10 signing on
  Turnkey wallets. The workarounds are in the code (`24be722`, `846b367`, `ce24b61`).

---

## Built during the event

`pre-hackmeridian` (`f1d8e46`) → `meridian`: **91 commits, 116 files, +13 385 / −2 537 lines.**

| Area | Highlights |
| --- | --- |
| Contract | Treasury moved inside `seyf_advance`, `repay` allowed while paused, treasury events, 17 tests, CI (`03c4537`, `b90af63`) |
| Mainnet | Deploy, funded treasury, full CLI cycle plus a full app cycle, allowlist opened (`7691367`, `7feab77`) |
| Keeper | Automatic `settle` from GitHub Actions (`647d7ad`, `f1939b4`) |
| Backend | `/api/vault/*` and `/api/advance/*` routes, an RPC client, BigInt units, an allowlisted sponsor with a capped `resourceFee` (`37d90b0`, `ad5cf28`, `8a2bc9f`) |
| Auth | Pollar v3 SEP-10 signing, account-proof for Turnkey wallets, recovery check before the session, "authorize this browser" on non-enrolled devices (`5cd2856`, `17734a6`, `846b367`, `ce24b61`) |
| SEP-1 | `stellar.toml` on www.seyf.app with the mainnet keys (`e4f3042`, `379f6c5`, `235a2a7`) |
| App | `/retiro` flow, then the full `/app` on Pollar and mainnet, a redesign, USDC-only on mainnet, vault creation validation (`eb45ed8`, `311540a`, `ecfff75`, `8177b5f`, `6d7a696`) |
| Landing | Scroll narrative, 3D symbol and coins, ES/EN/PT (`54096a2`, `2a825c7`, `335be02`) |
| Honesty fixes | Removed a $3,000,000 MXN "insurance" claim we can't back (`fad6e1b`) |

Reproduce the stats with `git diff --stat pre-hackmeridian origin/meridian`.
