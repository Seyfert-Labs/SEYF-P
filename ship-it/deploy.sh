#!/usr/bin/env bash
# Bóveda Ship-It — deploy, recarga y pruebas por CLI. **Solo testnet.**
#
#   ./deploy.sh deploy [--label ensayo|oficial]   compila, despliega, deposita 5555 XLM,
#                                                 escribe deployments.json e imprime los links
#   ./deploy.sh fund   [--source ID] [--xlm N]    recarga (por defecto: shipit-tn-backup, 5555)
#   ./deploy.sh claim  --source ID [--code TXT]   reclama por CLI (ensayo)
#   ./deploy.sh balance                           saldo de la bóveda
#   ./deploy.sh new-account ID                    crea y fondea (friendbot) una identidad de testnet
#   ./deploy.sh links                             imprime los links para entregar
#
# Por defecto: deployer = shipit-tn-oficial, respaldo = shipit-tn-respaldo
# (se cambian con SHIPIT_DEPLOYER / SHIPIT_BACKUP). Friendbot da 10 000 XLM una sola vez
# por cuenta, así que cada cuenta alcanza para un depósito de 5555.
# Identidades: solo `shipit-tn-*`, creadas con `stellar keys generate --network testnet --fund`.
# Las llaves viven en el keystore de stellar CLI, nunca en el repo.
set -euo pipefail

NETWORK=testnet
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENTS="$HERE/deployments.json"
CONTRACT_DIR="$HERE/contract"
WASM="$CONTRACT_DIR/target/wasm32v1-none/release/ship_it_vault.wasm"
DEPLOYER="${SHIPIT_DEPLOYER:-shipit-tn-oficial}"
BACKUP="${SHIPIT_BACKUP:-shipit-tn-respaldo}"
CODE="Ship It"
PRIZE_STROOPS=55550000000 # 5555 XLM
EXPERT="https://stellar.expert/explorer/testnet"

die() { echo "ERROR: $*" >&2; exit 1; }
log() { echo "==> $*" >&2; }

# Guardia: nunca mainnet. Solo identidades con prefijo shipit-tn-.
guard_identity() {
  case "$1" in
    shipit-tn-*) ;;
    *) die "identidad '$1' no permitida: usa una que empiece con shipit-tn- (solo testnet)" ;;
  esac
}

ensure_account() {
  local id="$1"
  guard_identity "$id"
  if ! stellar keys address "$id" >/dev/null 2>&1; then
    log "Creando identidad $id y fondeándola con friendbot (testnet)"
    stellar keys generate "$id" --network "$NETWORK" --fund >&2
  fi
  stellar keys address "$id"
}

contract_id() {
  [ -f "$DEPLOYMENTS" ] || die "no existe $DEPLOYMENTS; corre ./deploy.sh deploy"
  node -e 'const d=require(process.argv[1]);if(!d.contractId)process.exit(1);process.stdout.write(d.contractId)' "$DEPLOYMENTS" \
    || die "deployments.json sin contractId"
}

xlm_to_stroops() {
  node -e 'const x=process.argv[1];if(!/^\d+(\.\d{1,7})?$/.test(x))process.exit(1);const [i,f=""]=x.split(".");process.stdout.write((BigInt(i)*10000000n+BigInt((f+"0000000").slice(0,7))).toString())' "$1" \
    || die "monto inválido: $1"
}

# Saldo XLM (stroops) de una cuenta G…, leído del SAC nativo por simulación.
xlm_balance() {
  local token; token="$(stellar contract id asset --asset native --network "$NETWORK")"
  stellar contract invoke --id "$token" --source-account "$DEPLOYER" --network "$NETWORK" --send=no     -- balance --id "$1" 2>/dev/null | tr -d '"'
}

require_xlm() { # require_xlm <addr> <stroops> <id>
  local have; have="$(xlm_balance "$1")"
  [ -n "$have" ] || die "no pude leer el saldo de $3"
  # +10 XLM de margen para comisiones y reserva.
  node -e 'process.exit(BigInt(process.argv[1]) >= BigInt(process.argv[2]) + 100000000n ? 0 : 1)' "$have" "$2"     || die "$3 tiene $have stroops, no alcanza para depositar $2 (+10 XLM de margen). Usa otra cuenta: ./deploy.sh new-account shipit-tn-respaldoN"
}

invoke() { # invoke <source> <send:yes|no> -- fn args...
  local src="$1" send="$2"; shift 2
  stellar contract invoke --id "$(contract_id)" --source-account "$src" --network "$NETWORK" --send="$send" "$@"
}

print_links() {
  local id; id="$(contract_id)"
  echo
  echo "================ ENTREGA ================"
  echo "Contrato (stellar.expert): $EXPERT/contract/$id"
  echo "App:                       ${SHIPIT_APP_URL:-<URL del proyecto de Vercel ship-it>}"
  echo "========================================="
}

cmd_deploy() {
  local label="ensayo"
  while [ $# -gt 0 ]; do
    case "$1" in
      --label) label="$2"; shift 2 ;;
      *) die "argumento desconocido: $1" ;;
    esac
  done

  local admin token hash wasm_hash id fund_out
  admin="$(ensure_account "$DEPLOYER")"
  log "Admin/deployer: $admin"
  require_xlm "$admin" "$PRIZE_STROOPS" "$DEPLOYER"

  log "Compilando contrato"
  (cd "$CONTRACT_DIR" && stellar contract build >&2)
  [ -f "$WASM" ] || die "no se generó $WASM"

  token="$(stellar contract id asset --asset native --network "$NETWORK")"
  log "SAC de XLM nativo (testnet): $token"
  hash="$(printf '%s' "$CODE" | sha256sum | cut -d' ' -f1)"
  log "code_hash = sha256(\"$CODE\") = $hash"

  log "Subiendo wasm"
  wasm_hash="$(stellar contract upload --wasm "$WASM" --source-account "$DEPLOYER" --network "$NETWORK")"
  log "wasm hash: $wasm_hash"

  log "Desplegando"
  id="$(stellar contract deploy --wasm-hash "$wasm_hash" --source-account "$DEPLOYER" --network "$NETWORK" \
    -- --admin "$admin" --token "$token" --code_hash "$hash")"
  log "Contrato: $id"

  node -e '
    const fs=require("fs");
    const [file,label,id,token,admin,hash,wasm]=process.argv.slice(1);
    fs.writeFileSync(file, JSON.stringify({
      network:"testnet", label, contractId:id, token, admin,
      codeHash:hash, wasmHash:wasm, prizeStroops:"55550000000",
      deployedAt:new Date().toISOString()
    },null,2)+"\n");' "$DEPLOYMENTS" "$label" "$id" "$token" "$admin" "$hash" "$wasm_hash"
  log "Escrito $DEPLOYMENTS"

  require_xlm "$admin" "$PRIZE_STROOPS" "$DEPLOYER"
  log "Depositando 5555 XLM desde $DEPLOYER"
  fund_out="$(invoke "$DEPLOYER" yes -- fund --from "$admin" --amount "$PRIZE_STROOPS" | tr -d '"')"
  log "Saldo de la bóveda tras fund: $fund_out stroops"

  print_links
  echo "Siguiente: commit + push de ship-it/deployments.json para que la app use este contrato."
}

cmd_fund() {
  local src="$BACKUP" xlm="5555"
  while [ $# -gt 0 ]; do
    case "$1" in
      --source) src="$2"; shift 2 ;;
      --xlm) xlm="$2"; shift 2 ;;
      *) die "argumento desconocido: $1" ;;
    esac
  done
  local from amount
  from="$(ensure_account "$src")"
  amount="$(xlm_to_stroops "$xlm")"
  require_xlm "$from" "$amount" "$src"
  log "Recargando $xlm XLM desde $src ($from)"
  invoke "$src" yes -- fund --from "$from" --amount "$amount"
}

cmd_claim() {
  local src="" code="$CODE"
  while [ $# -gt 0 ]; do
    case "$1" in
      --source) src="$2"; shift 2 ;;
      --code) code="$2"; shift 2 ;;
      *) die "argumento desconocido: $1" ;;
    esac
  done
  [ -n "$src" ] || die "falta --source"
  local to; to="$(ensure_account "$src")"
  log "Reclamando con \"$code\" hacia $to"
  invoke "$src" yes -- claim --to "$to" --code "$code"
}

cmd_balance() {
  local src; ensure_account "$DEPLOYER" >/dev/null; src="$DEPLOYER"
  local b; b="$(invoke "$src" no -- balance | tr -d '"')"
  node -e 'const b=BigInt(process.argv[1]);console.log(`${b} stroops = ${b/10000000n}.${(b%10000000n).toString().padStart(7,"0")} XLM`)' "$b"
}

case "${1:-}" in
  deploy) shift; cmd_deploy "$@" ;;
  fund) shift; cmd_fund "$@" ;;
  claim) shift; cmd_claim "$@" ;;
  balance) shift; cmd_balance ;;
  new-account) shift; [ -n "${1:-}" ] || die "falta ID"; ensure_account "$1" ;;
  links) print_links ;;
  *) sed -n "2,16p" "$0"; exit 1 ;;
esac
