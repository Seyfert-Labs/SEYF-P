#!/usr/bin/env bash
# Redespliega ReyfAdvance (modelo por AÑOS, LTV 90%) en Arbitrum Sepolia.
# Conserva ReyfVaults existente; actualiza advanceManager + fondea tesorería.
#
# Requisitos:
#   - foundry (forge)
#   - PRIVATE_KEY de la wallet owner de ReyfVaults (0xBC3B5d04… en Sepolia)
#   - MXNB en esa wallet para la tesorería del adelanto
#   - ETH en Sepolia para gas
#
# Uso:
#   export PRIVATE_KEY=0x...
#   export FUND_TREASURY_MXNB=50000   # opcional, default 50000
#   ./scripts/redeploy-advance-sepolia.sh

set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-https://sepolia-rollup.arbitrum.io/rpc}"
export VAULTS_ADDRESS="${VAULTS_ADDRESS:-0x0212d50490FE5D7183B5B3A403d5C44937a44cF1}"
export FUND_TREASURY_MXNB="${FUND_TREASURY_MXNB:-50000}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: export PRIVATE_KEY=0x... (debe ser owner de ReyfVaults)" >&2
  exit 1
fi

echo "ReyfVaults: $VAULTS_ADDRESS"
echo "Fondeo tesorería: $FUND_TREASURY_MXNB MXNB"
echo "RPC: $RPC_URL"
echo ""

forge script script/RedeployAdvance.s.sol:RedeployAdvance \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvv

echo ""
echo "Copia NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS del log arriba a Seyf2/.env y Vercel."
