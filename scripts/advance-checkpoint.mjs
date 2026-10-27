#!/usr/bin/env node
/**
 * Actualiza el corte de actividad del adelanto (`src/lib/advance/activity-checkpoint.json`).
 *
 * El RPC solo guarda ~7 días de eventos. La landing suma este corte más los
 * eventos `advance_opened` posteriores que el RPC todavía tiene. Este script
 * lee los eventos desde `ledger + 1` del corte actual, los suma y escribe el
 * corte nuevo. Hay que correrlo antes de que el ledger del corte salga de la
 * ventana del RPC; si ya salió, falla en vez de dejar un hueco.
 *
 * No firma nada. Excluye a la cuenta admin del contrato (sus adelantos son
 * pruebas del equipo, no uso de la app).
 *
 * Uso (mainnet):
 *   NEXT_PUBLIC_STELLAR_NETWORK=mainnet \
 *   NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT=CCZ77VBE…CWXH \
 *   node scripts/advance-checkpoint.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk'

const CHECKPOINT = fileURLToPath(new URL('../src/lib/advance/activity-checkpoint.json', import.meta.url))
const CHUNK_LEDGERS = 10_000
const PAGE_LIMIT = 100
const MAX_PAGES_PER_CHUNK = 20
const RETENTION_MARGIN_LEDGERS = 10
/** Cuenta fuente para simular lecturas; no necesita existir. */
const READ_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

const env = (k) => (process.env[k] ?? '').trim()

function config() {
  const network = env('NEXT_PUBLIC_STELLAR_NETWORK') || 'testnet'
  if (network !== 'testnet' && network !== 'mainnet') throw new Error(`Red inválida: "${network}"`)
  const contractId = env('NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT')
  if (!StrKey.isValidContract(contractId)) throw new Error('NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT falta o no es un C… válido')
  const rpcUrl =
    env('NEXT_PUBLIC_SOROBAN_RPC_URL') ||
    (network === 'mainnet' ? 'https://mainnet.sorobanrpc.com' : 'https://soroban-testnet.stellar.org')
  return { contractId, rpcUrl, passphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET }
}

async function readAdmin(server, cfg) {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, '0'), { fee: BASE_FEE, networkPassphrase: cfg.passphrase })
    .addOperation(new Contract(cfg.contractId).call('admin'))
    .setTimeout(60)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(`No se pudo leer admin(): ${sim.error ?? 'sin resultado'}`)
  return scValToNative(sim.result.retval)
}

const cursorLedger = (cursor) => Number(BigInt(cursor.split('-')[0]) >> 32n)

/** Mismo escaneo que `scanAdvanceEvents` en `src/lib/advance/events.ts`. */
async function eventsInRange(server, filters, start, end) {
  const out = []
  let request = { filters, startLedger: start, endLedger: end, limit: PAGE_LIMIT }
  for (let page = 0; page < MAX_PAGES_PER_CHUNK; page++) {
    const res = await server.getEvents(request)
    out.push(...res.events.filter((ev) => ev.ledger >= start && ev.ledger < end))
    if (!res.cursor || cursorLedger(res.cursor) >= Math.min(end, res.latestLedger) - 1) return out
    request = { filters, cursor: res.cursor, limit: PAGE_LIMIT }
  }
  throw new Error(`getEvents no terminó el tramo ${start}–${end}`)
}

async function main() {
  const cfg = config()
  const server = new rpc.Server(cfg.rpcUrl)
  const prev = JSON.parse(readFileSync(CHECKPOINT, 'utf8'))

  const health = await server.getHealth()
  const windowStart =
    Math.max(health.oldestLedger ?? 0, health.latestLedger - health.ledgerRetentionWindow) + RETENTION_MARGIN_LEDGERS
  const from = prev.ledger + 1
  if (from < windowStart) {
    throw new Error(
      `El corte (ledger ${prev.ledger}) ya salió de la ventana del RPC (empieza en ${windowStart}). ` +
        'No se puede actualizar sin un indexador.',
    )
  }
  const last = health.latestLedger + 1

  const topic = nativeToScVal('advance_opened', { type: 'symbol' }).toXDR('base64')
  const filters = [{ type: 'contract', contractIds: [cfg.contractId], topics: [[topic, '*']] }]
  const chunks = []
  for (let start = from; start < last; start += CHUNK_LEDGERS) {
    chunks.push(eventsInRange(server, filters, start, Math.min(start + CHUNK_LEDGERS, last)))
  }
  const seen = new Set()
  const events = (await Promise.all(chunks)).flat().filter((ev) => !seen.has(ev.id) && seen.add(ev.id))

  const admin = await readAdmin(server, cfg)
  const accounts = new Set(prev.accounts)
  let advances = prev.advances
  let backing = BigInt(prev.backing)
  for (const ev of events) {
    const user = Address.fromScVal(ev.topic[1]).toString()
    if (user === admin) continue
    const { value } = scValToNative(ev.value)
    advances += 1
    backing += value
    accounts.add(user)
  }

  const next = {
    contract: cfg.contractId,
    ledger: health.latestLedger,
    asOf: new Date(Number(health.latestLedgerCloseTime) * 1000).toISOString(),
    advances,
    accounts: [...accounts].sort(),
    backing: backing.toString(),
  }
  writeFileSync(CHECKPOINT, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`Corte: ${prev.ledger} → ${next.ledger} (${events.length} eventos nuevos, admin ${admin} excluido)`)
  console.log(JSON.stringify(next, null, 2))
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
