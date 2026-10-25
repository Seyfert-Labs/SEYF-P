#!/usr/bin/env bash
# E2E de SeyfLock contra una bóveda DeFindex REAL en testnet (XLM vault).
# Requiere las identidades seyf-testnet-admin / seyf-testnet-user (stellar keys generate … --fund)
# y el alias seyf-lock-xlm (stellar contract deploy … --alias seyf-lock-xlm).
#
# Uso: bash soroban/scripts/testnet-e2e.sh early     # bloqueo 1 año + salida anticipada
#      bash soroban/scripts/testnet-e2e.sh short     # bloqueo de 60 s (para probar settle)
#      bash soroban/scripts/testnet-e2e.sh settle    # cerrar el bloqueo vencido (lo firma el admin)
#      bash soroban/scripts/testnet-e2e.sh status
set -euo pipefail

ST="${STELLAR_BIN:-stellar}"
NET=(--network testnet)
XLM=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC   # SAC de XLM nativo (testnet)
VAULT=CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6 # DeFindex XLM vault (testnet)
LOCK=seyf-lock-xlm
USER_ADDR=$("$ST" keys address seyf-testnet-user)
ADMIN_ADDR=$("$ST" keys address seyf-testnet-admin)
LOCK_ADDR=$("$ST" contract alias show "$LOCK" "${NET[@]}")

view() { "$ST" contract invoke --id "$1" "${NET[@]}" --source seyf-testnet-user --send=no -- "${@:2}"; }
send() { local src=$1; shift; "$ST" contract invoke --id "$LOCK" "${NET[@]}" --source "$src" -- "$@" 2>&1 | grep -vE "^ℹ️|Signing|Simulat" ; }

status() {
  echo "usuario XLM     : $(view $XLM balance --id "$USER_ADDR")"
  echo "pool SeyfLock   : $(view $LOCK pool_balance)"
  echo "shares en bóveda: $(view $VAULT balance --id "$LOCK_ADDR")"
  echo "posición        : $(view $LOCK position --user "$USER_ADDR")"
}

case "${1:-status}" in
  early)
    echo "quote 1000 XLM / 1 año: $(view $LOCK quote --amount 10000000000 --term_secs 31536000)"
    status
    send seyf-testnet-user lock --user "$USER_ADDR" --amount 10000000000 --term_secs 31536000 --min_shares 0
    status
    send seyf-testnet-user unlock --user "$USER_ADDR" --min_out 0
    status ;;
  short)
    send seyf-testnet-user lock --user "$USER_ADDR" --amount 10000000000 --term_secs 60 --min_shares 0
    status ;;
  settle)
    send seyf-testnet-admin settle --user "$USER_ADDR" --min_out 0
    status ;;
  status) status ;;
esac
