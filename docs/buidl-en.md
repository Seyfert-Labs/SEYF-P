# SEYF: submission answers (HackMeridian 2026)

**Category:** Scale · **Track:** Stellar Composed

- **Live app:** https://www.seyf.app/app
- **Repo:** https://github.com/Seyfert-Labs/SEYF-P (branch `meridian`)
- **Contract:** [`CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH`](https://stellar.expert/explorer/public/contract/CCZ77VBEZZIRBK3Z7RO4W227764G76ILXKO664R622FOSJTE7BX4CWXH) (Stellar mainnet)
- **Scorecard against the rubric:** [docs/hackmeridian-2026.md](hackmeridian-2026.md)

## One line

Savings that pay you today: save USDC on Stellar, earn real yield from Blend through a DeFindex
vault, and get part of tomorrow's yield today, with no seed phrase and no XLM.

## Problem

In Mexico, most people save in a bank account that pays close to nothing. On-chain yield exists,
but it asks for things a regular saver doesn't have: a seed phrase, XLM for fees, trustlines and a
wallet extension. And yield only arrives later: someone facing an expense today has to break their
savings.

## Solution

1. **Sign in with an email.** Pollar creates a co-signed Stellar wallet (Turnkey 2-of-2).
2. **Receive USDC.** The app opens the USDC trustline. Our sponsor pays the reserve and every fee
   with a fee-bump, so the user never holds XLM.
3. **Save.** USDC goes into a DeFindex vault (Meru) that lends it on a Blend pool.
4. **Get an advance on your yield.** Our Soroban contract `seyf_advance` locks the vault shares and
   pays, from its own treasury, the yield they will earn over 1 to 30 days. The principal is never
   touched. The user can repay early, or wait: once the real yield covers the advance, a keeper
   calls `settle` and the full principal comes back.

## How it uses Stellar

| Piece | Role |
| --- | --- |
| Soroban `seyf_advance` (ours) | Escrows vault shares, advances their yield from an in-contract treasury, settles from real yield |
| DeFindex + Blend | The USDC vault and the lending pool behind it |
| Pollar | Email login, co-signed embedded wallet, signing dialog |
| Circle USDC (SAC) | The saved asset |
| SEP-10 + SEP-1 | Session auth, with the signing key published in `stellar.toml` |
| Fee-bump + CAP-33 | The user pays no fees and needs no XLM reserve |

## Proof on mainnet (26 Oct 2026)

The first four steps were made from the app, signed with a Pollar wallet that holds 0 XLM. The
last one is the keeper settling an earlier advance:

| Step | Transaction |
| --- | --- |
| Sponsored USDC trustline | [d8d98a95…](https://stellar.expert/explorer/public/tx/d8d98a958538a4183878f65eaf0863650eec9b232db714870cceb466aca9a840) |
| Deposit 5 USDC into the vault | [23572a98…](https://stellar.expert/explorer/public/tx/23572a98345f5973a144cd40422c22f815ac8d76b89e68e188cbcd8767a858d1) |
| `open_advance` | [ab42eac9…](https://stellar.expert/explorer/public/tx/ab42eac9fbd19885cbe6f7fa47a035531ff794f387fd3f5a171ce0fb4586606c) |
| `repay` | [5cfd5592…](https://stellar.expert/explorer/public/tx/5cfd5592482eac2cdb08a077df8b7e40696e1b2c24d284e1aaef98445bf4da80) |
| `settle` by the keeper, after real Blend yield covered the advance | [be77ba1e…](https://stellar.expert/explorer/public/tx/be77ba1e080e77d337c45b351226d535982bafb24be2fb9ef022ff58ec5e0e19) |

Every hash is in [`soroban/DEPLOYMENTS.md`](../soroban/DEPLOYMENTS.md).

## Built during HackMeridian

We arrived with an EVM prototype (MXNB on Arbitrum). During the event we moved the product to
Stellar mainnet: 99 commits and 36 merged pull requests on 25–26 October.

- `seyf_advance` with its treasury inside the contract, 17 tests and CI, deployed to mainnet.
- A keeper on GitHub Actions that settles covered advances.
- Server routes that build and simulate every transaction, and a sponsor that pays only for
  allowlisted operations with a capped `resourceFee`.
- Pollar login with a SEP-10 session, including an account-proof variant for co-signed wallets.
- The whole `/app` on Pollar and mainnet, with a redesigned home and savings screens.

## Challenges

- **Pollar co-signed wallets can't sign a standard SEP-10 challenge** (`/stellar/sep10/sign` returns
  502 for them). We added an account-proof challenge: a sequence-0 transaction from the user's own
  account that can never be submitted, verified on the server.
- **Users hold no XLM.** Every action goes through a server-side fee-bump, so the sponsor had to be
  locked down to an allowlist of operations and contracts.
- **The yield is real, so it is slow.** `settle` only works once the actual Blend yield covers the
  advance, which we proved on mainnet with the keeper.

## Known limits

- `seyf_advance` is not audited. Mainnet runs with caps of 1 USDC per user and 2 USDC in total, a
  pause that never blocks `repay` or `settle`, and no upgrade path.
- The Meru vault belongs to a third party and can be upgraded by a single key.

## What's next

SCF Build Award, Integration Track: our own non-upgradable DeFindex vault under a multisig and an
audit path for `seyf_advance`, then pesos in and out over SPEI with Etherfuse (on testnet today),
then higher caps and a public launch in Mexico.

## AI disclosure

Parts of the code, tests and documentation were written with an AI coding assistant (Claude Code)
and reviewed by the team. Every mainnet transaction was signed by the team.
