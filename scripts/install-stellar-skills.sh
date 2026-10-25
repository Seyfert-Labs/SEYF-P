#!/usr/bin/env bash
# install-stellar-skills — instala en .claude/skills/ (scope de proyecto) solo
# los skills de Stellar que SEYF usa. Ver docs/seyf-context.md §Check 2 y §Check 3.
#
# Por qué no `curl … stellar-build/install.sh | bash`: en modo global ese
# instalador agrega Bash/Read/Glob/Grep a los permisos auto-permitidos de
# ~/.claude/settings.json y registra hooks que reescriben cada prompt en todos
# los proyectos. Aquí lo corremos en un prefijo temporal y copiamos lo necesario.
#
# Uso: bash scripts/install-stellar-skills.sh   (idempotente; .claude/ está en .gitignore)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/.claude/skills"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STELLAR_BUILD_REF="989ae9b"   # kaankacar/stellar-build, revisado 2026-10-25

# Oficiales (stellar/stellar-dev-skill, vía stellar-build) + journey de stellar-build
BUNDLED=(
  dapp data assets standards smart-contracts         # skills.stellar.org (oficiales)
  deploy-stellar-mainnet                              # gate testnet → mainnet
  stellar-competitive-landscape                       # prior art / competidores
  scf-round-watcher scf-submission-drafter scf-prescreen-checker scf-budget-builder
  review-edge-case-hunter
)

# Comunitarios (skills.stellar.org/llms.txt §Community) — SDF no los revisa
# "nombre|url" (bash 3.2 de macOS no tiene arrays asociativos)
COMMUNITY=(
  "pollar-wallet-auth|https://raw.githubusercontent.com/pollar-xyz/pollar/main/skills/pollar-wallet-auth/SKILL.md"
  "defindex-sdk|https://raw.githubusercontent.com/paltalabs/defindex-sdk/main/defindex-sdk-skill.md"
  "soroswap-sdk|https://raw.githubusercontent.com/soroswap/sdk/main/skills/soroswap-sdk/SKILL.md"
  "stellar-anchors|https://raw.githubusercontent.com/CheesecakeLabs/stellar-anchor-skill/main/SKILL.md"
  "stellar-prices-api|https://raw.githubusercontent.com/rumblefishdev/stellar-prices-api/master/skills/stellar-prices-api/SKILL.md"
  "trustless-work|https://raw.githubusercontent.com/Trustless-Work/trustlesswork-skill/main/trustless-work-dev/SKILL.md"
)

echo "→ stellar-build@$STELLAR_BUILD_REF en prefijo temporal"
git clone -q https://github.com/kaankacar/stellar-build "$TMP/sb"
git -C "$TMP/sb" checkout -q "$STELLAR_BUILD_REF"
mkdir -p "$TMP/prefix"
STELLAR_BUILD_NO_TELEMETRY=1 STELLAR_BUILD_NO_RAVEN_LOGIN=1 \
  bash "$TMP/sb/install.sh" --prefix="$TMP/prefix" >/dev/null

mkdir -p "$DEST"
for s in "${BUNDLED[@]}"; do
  rm -rf "${DEST:?}/$s"
  cp -R "$TMP/prefix/.claude/skills/$s" "$DEST/$s"
done
# Nota: `data/` ya trae el skill oficial RPC/Horizon + el catálogo de stellar-build
# (LumenLoop, Electric Capital, guías de ecosystem-resources) que leen deploy/landscape/scf.

for entry in "${COMMUNITY[@]}"; do
  name="${entry%%|*}"
  mkdir -p "$DEST/$name"
  curl -fsSL "${entry#*|}" -o "$DEST/$name/SKILL.md"
done

echo "✓ $(( ${#BUNDLED[@]} + ${#COMMUNITY[@]} )) skills en $DEST"
