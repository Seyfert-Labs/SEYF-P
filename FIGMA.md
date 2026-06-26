# Figma → Code Integration Rules (SEYF)

Rules for translating Figma designs into this codebase via the Figma MCP. **Read this before generating any UI from a Figma node.** The golden rule: this app does **not** use Tailwind utility classes or a component-prop design system — it uses **CSS custom properties (tokens) + semantic CSS classes** defined in one global stylesheet, plus inline `style={{}}` for layout one-offs. Match that.

---

## 1. Token Definitions

**Single source of truth:** `src/app/globals.css`, in the `:root` block (lines ~10–40). Tokens are plain CSS custom properties. There is **no** token transformation pipeline (no Style Dictionary, no Tailwind theme config, no JSON tokens).

When a Figma node reports a color/size, **map it to the nearest token** below — do not hardcode hex/px unless no token fits, and if a new value recurs, add a token to `:root` rather than inlining.

### Color tokens
| Figma role | Token | Value |
|---|---|---|
| Page background | `--bg` | `#08080D` |
| Card / surface | `--surface` | `#131120` |
| Raised surface | `--surface-2` | `#1A1729` |
| Highest surface / tracks | `--surface-3` | `#231F36` |
| Hairline border | `--line` | `rgba(255,255,255,0.07)` |
| Strong border | `--line-strong` | `rgba(255,255,255,0.13)` |
| Primary text | `--txt` | `#F4F2FB` |
| Muted text | `--txt-muted` | `#9C96B4` |
| Dim text / eyebrows | `--txt-dim` | `#67627E` |
| Negative / error | `--neg` | `#FF7A7A` |
| **Accent (lima)** | `--accent` / `--pos` | `#C8FF4D` |
| **Accent 2 (violeta)** | `--accent-2` | `#8B5CF6` |
| Text on accent | `--on-accent` | `#0A0A0F` |
| Accent tint bg | `--accent-soft` | `rgba(200,255,77,0.14)` |
| Accent-2 tint bg | `--accent-2-soft` | `rgba(139,92,246,0.18)` |

This is a **dark-theme-only** app. Lima (`--accent`) is the primary CTA / positive color; violeta (`--accent-2`) is secondary/decorative. There is no light mode.

### Type scale (`--t-*`)
`--t-hero 44px` · `--t-xl 30px` · `--t-lg 22px` · `--t-md 17px` · `--t-sm 15px` · `--t-xs 13px` · `--t-xxs 11px`. Map Figma font sizes to the closest step.

### Radii (`--r-*`)
`--r-card 26px` (cards) · `--r-tile 20px` (tiles) · `--r-pill 999px` (chips/pills/avatars). One-off radii (16px buttons, 24px credit card, 14px inputs) are written literally in component classes — follow existing precedent.

---

## 2. Typography / Fonts

Two Google fonts loaded via `next/font/google` in `src/app/layout.tsx`, exposed as CSS vars on `<html>`:
- `--font-sans` → **Manrope** (body/UI; weights 400–800)
- `--font-display` → **Space Grotesk** (numbers & brand; weights 400–700)

Helper classes in `globals.css`:
- `.num` → display font + tabular numerals (`tnum`) + tight tracking. **Use for all monetary amounts / figures.**
- `.brand` → display font, weight 700, tight tracking (wordmarks).

Body defaults to `--font-sans`. When a Figma text layer is a number/currency, render it with `className="num"`.

---

## 3. Frameworks & Libraries

- **Framework:** Next.js 16.2.6 (App Router) — ⚠️ breaking changes vs older Next; consult `node_modules/next/dist/docs/` per `AGENTS.md`.
- **UI:** React 19.2, TypeScript 5.9.
- **Styling:** Tailwind v4 (`@tailwindcss/postcss`) is installed and `@import "tailwindcss"` is at the top of `globals.css`, **but utility classes are effectively unused** (only `grid` appears, ~5×). **Do not generate Tailwind utility soup.** Author semantic classes in `globals.css` instead.
- **Animation:** `motion` (Framer Motion v12) — used in `Celebration.tsx`, `GrowingAmount.tsx`, `screens/kyc.tsx`, `screens/invest.tsx`. CSS keyframes in `globals.css` handle most transitions (`scrIn`, `fadeIn`, `sheetUp`, `spin`, `shimmer`).
- **Build:** `npm run dev` / `npm run build` (types + build) / `npm run lint`.

---

## 4. Styling Approach (most important)

**Methodology: global semantic CSS classes + design tokens + inline-style layout.** No CSS Modules, no styled-components, no Tailwind utilities.

1. **Structural/visual classes** live in `globals.css` and are named semantically: `.card`, `.tile`, `.chip`, `.btn` (`.btn-primary` / `.btn-ghost` / `.btn-violet`), `.input`, `.modal-sheet`, `.lrow`, `.quick`, `.tabbar`, `.seg`, `.alert` (`-error`/`-ok`/`-info`), `.eyebrow`, `.pos-pill`/`.neg-pill`, etc. **Reuse these before inventing new ones.**
2. **One-off layout** (gaps, flex, widths, margins for a single instance) uses **inline `style={{}}`** — this is idiomatic here (~999 occurrences). Don't add a new global class for a single layout tweak.
3. **App container:** everything lives inside `.app-shell` → `.uto-root` (max-width **480px**, `100dvh`, dark, flex column). **This is a mobile-first, single-column phone-width app.** Design generated layouts for a ~480px column, not a desktop grid.
4. **Expressive theme:** the `.style-expresivo` class on `.uto-root` toggles ambient glows/shadows (radial gradients, `box-shadow` on cards/buttons). Decorative glow belongs behind this modifier.
5. **Responsive:** only one breakpoint — `@media (min-width: 481px)` adds side borders to frame the column on wide screens. No multi-column responsive grids.

**When implementing a Figma frame:** add or extend a semantic class in `globals.css` using tokens, then apply it in the component; use inline styles only for instance-specific spacing.

---

## 5. Component Library

No Storybook, no documented design-system package. Components are plain React function components.

- **UI primitives:** `src/components/app/ui.tsx` — `Icon`, `Flag`, `Spark` (sparkline SVG), `Ring` (progress ring SVG). All are inline-SVG, prop-driven (`size`, `color`, `stroke`).
- **Shared layout:** `src/components/app/shared.tsx` — `TopBar`, `AvatarButton`, `SubHeader`, `TxnRow`, `PendingTxnRow`, `ConvTxnRow`.
- **Screens:** `src/components/app/screens/{core,invest,account,kyc}.tsx`. Screens are NOT Next.js routes — routing is internal state (`route`) in `SeyfApp.tsx`; navigation via a `go(screen)` callback (`Go` type in `nav.ts`).
- **Modals:** `src/components/app/modals/*` rendered through `Portal.tsx` (portals to `<body>`); styled with `.modal-overlay` + `.modal-sheet` (bottom-sheet pattern, `sheetUp` animation, `.modal-grab` handle).
- **Brand:** `src/components/brand/SeyfLogo.tsx` — `SeyfSymbol`, `SeyfMark`, etc., rendering SVGs from `/public/brand`.

`WalletContext` (`src/components/wallet/`) abstracts Privy — screens never import Privy hooks directly.

---

## 6. Icon System

**Custom inline-SVG icon set** — there is no icon font or `@svgr` import. All icons live in the `paths` map inside `Icon()` in `src/components/app/ui.tsx`.

- Usage: `<Icon name="send" size={20} stroke={2} color="currentColor" />`.
- All icons are 24×24 `viewBox`, stroke-based (`fill="none"`, round caps/joins), inheriting `currentColor`.
- Naming: short camelCase keys (`bell`, `gear`, `chevR`, `recv`, `qr`, `bolt`…). See the `IconName` union (lines 4–10) for the full set.
- **When a Figma design needs a new icon:** add a new entry to the `paths` map (24×24, stroke 2, round) and extend the `IconName` union — do **not** add an SVG file or a new icon dependency.
- `Flag` (country flags) is a separate inline-SVG map keyed by country code (`mx`, `us`, `br`, `kr`, `eu`).

---

## 7. Asset Management

- Static assets in `public/`; brand assets in **`public/brand/`** (`seyf-symbol.svg`, `seyf-appicon.svg`, `seyf-horizontal-{dark,light}.svg`, `seyf-stacked-dark.svg`, `seyf-mono-{black,white}.svg`, favicon).
- Reference via root-relative paths (`/brand/seyf-symbol.svg`) inside `<img>` (brand components intentionally use `<img>` with `eslint-disable @next/next/no-img-element`, since assets are SVG).
- **Prefer SVG.** Decorative shapes (card sheen/mesh, glows) are CSS `radial-gradient`, not raster images. No CDN, no image optimization pipeline configured.
- **When Figma export yields raster assets:** prefer recreating as SVG/CSS gradients to match existing patterns; if a real image is required, place it under `public/` and reference root-relative.

---

## 8. Project Structure

```
src/
  app/                    # Next App Router: layout.tsx (fonts+metadata),
                          #   globals.css (ALL tokens+classes), landing.css,
                          #   api/* route handlers, app/ (authed shell)
  components/
    app/
      ui.tsx              # Icon / Flag / Spark / Ring primitives
      shared.tsx          # TopBar, SubHeader, Txn rows
      SeyfApp.tsx         # shell + internal state router
      screens/            # core, invest, account, kyc (state-routed "pages")
      modals/             # bottom-sheet modals via Portal
      data.ts, nav.ts     # mock data + nav types (Go/Screen)
    brand/                # SeyfLogo (SVG brand marks)
    wallet/               # WalletContext (Privy abstraction)
    landing/              # public landing
```

**Conventions to honor when generating from Figma:**
- New screen → a function component in `screens/`, wired into the `route` state + `nav.ts`, **not** a Next route file.
- New visual element → semantic class in `globals.css` using tokens + a React component; inline styles for instance spacing.
- Mobile/phone-width column (max 480px), dark theme, lima/violeta accents, Manrope body + Space Grotesk for numbers.
- Comments and copy in this codebase are in **Spanish** — match that for user-facing strings and inline comments.

---

## Quick checklist before committing Figma-derived code
- [ ] Colors mapped to `--*` tokens (no stray hex)?
- [ ] Font sizes mapped to `--t-*`; numbers use `.num`?
- [ ] Reused existing semantic classes (`.card`, `.btn-*`, `.input`, `.modal-sheet`…) before adding new ones?
- [ ] No Tailwind utility classes introduced?
- [ ] Icons added to `ui.tsx` `paths` map (not new files)?
- [ ] Layout fits the 480px single-column shell; modals via `Portal` + `.modal-sheet`?
- [ ] `npm run build` (types) and `npm run lint` pass?
```
