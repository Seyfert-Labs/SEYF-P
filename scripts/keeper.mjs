#!/usr/bin/env node
/**
 * keeper — liquida automáticamente los adelantos de `seyf_advance` cuyo
 * rendimiento ya cubre el adelanto.
 *
 * 1. Lee los eventos `advance_opened` del contrato vía RPC `getEvents` desde
 *    `KEEPER_START_LEDGER` (o desde el ledger más viejo que guarde el RPC).
 * 2. Por cada usuario, revisa `position(user)` y simula `settle(user)`.
 *    `settle` no pide auth y el contrato solo lo deja pasar si
 *    V_now >= V_open + A: si la simulación falla, aún no toca.
 * 3. Si pasa (y no es dry-run), arma, firma con `KEEPER_SECRET`, envía y hace
 *    polling hasta tener el resultado.
 *
 * La llave del keeper solo paga comisiones: nunca recibe fondos de nadie.
 *
 * Env:
 *   NEXT_PUBLIC_STELLAR_NETWORK            testnet | mainnet (default testnet)
 *   NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT   C… del contrato seyf_advance
 *   SOROBAN_RPC_URL                        opcional (también NEXT_PUBLIC_SOROBAN_RPC_URL)
 *   KEEPER_SECRET                          S… de la cuenta que paga las comisiones
 *   KEEPER_START_LEDGER                    opcional; ledger desde el que buscar eventos
 *   KEEPER_EXTRA_USERS                     opcional; G… separados por coma (eventos que
 *                                          ya salieron de la ventana del RPC)
 *   KEEPER_DRY_RUN=1                       solo simula; KEEPER_SECRET es opcional
 *
 * Salida: 0 aunque no haya nada que liquidar; 2 por error de config; 1 por
 * error de RPC o si un envío falla.
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk'

// --- interfaz del contrato ---------------------------------------------------
// Si el frente C cambia nombres, solo se toca este bloque.
const IFACE = {
  openedEventTopic: 'advance_opened', // #[contractevent(topics = ["advance_opened"])], user como 2.º tópico
  settleFn: 'settle', // settle(user: Address) -> Result<(), Error>
  positionFn: 'position', // position(user: Address) -> Option<Position>
  errors: {
    1: 'Paused',
    2: 'NotAllowed',
    3: 'PositionExists',
    4: 'NoPosition',
    5: 'YieldNotCovered',
    6: 'TermOutOfRange',
    7: 'ZeroShares',
    8: 'ExceedsLtv',
    9: 'ExceedsUserCap',
    10: 'ExceedsGlobalCap',
    11: 'InsufficientLiquidity',
    12: 'AdvanceBelowMin',
    13: 'InvalidParams',
    14: 'InvalidAmount',
    15: 'NoPendingAdmin',
    16: 'InvalidVaultValue',
    17: 'MathOverflow',
  },
}

// ~7 días de ledgers a 5 s: lo que guarda un RPC por defecto.
const DEFAULT_RETENTION = 120_960
const EVENTS_PAGE = 100
const MAX_PAGES = 500

class ConfigError extends Error {}

const env = (k) => (process.env[k] ?? '').trim()
const log = (...a) => console.log(...a)

function loadConfig() {
  const network = env('NEXT_PUBLIC_STELLAR_NETWORK') || 'testnet'
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new ConfigError(`NEXT_PUBLIC_STELLAR_NETWORK inválida: "${network}" (testnet | mainnet)`)
  }

  const contractId = env('NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT')
  if (!StrKey.isValidContract(contractId)) {
    throw new ConfigError('NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT falta o no es un C… válido')
  }

  const rpcUrl =
    env('SOROBAN_RPC_URL') ||
    env('NEXT_PUBLIC_SOROBAN_RPC_URL') ||
    (network === 'mainnet' ? 'https://mainnet.sorobanrpc.com' : 'https://soroban-testnet.stellar.org')

  const dryRun = ['1', 'true', 'yes'].includes(env('KEEPER_DRY_RUN').toLowerCase())

  let keypair = null
  const secret = env('KEEPER_SECRET')
  if (secret) {
    try {
      keypair = Keypair.fromSecret(secret)
    } catch {
      throw new ConfigError('KEEPER_SECRET no es una llave secreta S… válida')
    }
  } else if (!dryRun) {
    throw new ConfigError('KEEPER_SECRET es obligatoria fuera de dry-run')
  }

  const startRaw = env('KEEPER_START_LEDGER')
  let startLedger = null
  if (startRaw) {
    startLedger = Number(startRaw)
    if (!Number.isInteger(startLedger) || startLedger <= 0) {
      throw new ConfigError(`KEEPER_START_LEDGER inválido: "${startRaw}"`)
    }
  }

  const extraUsers = env('KEEPER_EXTRA_USERS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const u of extraUsers) {
    if (!StrKey.isValidEd25519PublicKey(u) && !StrKey.isValidContract(u)) {
      throw new ConfigError(`KEEPER_EXTRA_USERS tiene una dirección inválida: "${u}"`)
    }
  }

  return {
    network,
    passphrase: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
    contractId,
    rpcUrl,
    dryRun,
    keypair,
    startLedger,
    extraUsers,
  }
}

// --- candidatos --------------------------------------------------------------

/** Primer ledger que el RPC todavía puede servir. */
async function resolveStartLedger(server, requested) {
  const health = await server.getHealth()
  const latest = health.latestLedger ?? (await server.getLatestLedger()).sequence
  const window = health.ledgerRetentionWindow || DEFAULT_RETENTION
  // Margen: mientras corre el keeper el RPC sigue podando ledgers viejos.
  const oldest = Math.max(health.oldestLedger ?? 0, latest - window) + 10
  if (requested == null) return { start: oldest, latest, clamped: false }
  if (requested < oldest) return { start: oldest, latest, clamped: true }
  return { start: Math.min(requested, latest), latest, clamped: false }
}

async function fetchOpenedUsers(server, contractId, startLedger) {
  const topic = nativeToScVal(IFACE.openedEventTopic, { type: 'symbol' }).toXDR('base64')
  const filters = [{ type: 'contract', contractIds: [contractId], topics: [[topic, '*']] }]
  const users = new Set()
  let request = { startLedger, filters, limit: EVENTS_PAGE }
  let events = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await server.getEvents(request)
    for (const ev of res.events) {
      events++
      const userTopic = ev.topic?.[1]
      if (!userTopic) continue
      users.add(Address.fromScVal(userTopic).toString())
    }
    // Se pagina hasta una página vacía: el RPC puede cortar el escaneo antes
    // de llenar `limit`, y el cursor sigue siendo válido.
    if (res.events.length === 0 || !res.cursor) break
    request = { cursor: res.cursor, filters, limit: EVENTS_PAGE }
  }
  return { users: [...users], events }
}

// --- contrato ----------------------------------------------------------------

function contractErrorName(message) {
  const m = /Error\(Contract, #(\d+)\)/.exec(message ?? '')
  if (!m) return null
  return `${IFACE.errors[m[1]] ?? 'desconocido'} (#${m[1]})`
}

function shortReason(message) {
  return (
    contractErrorName(message) ??
    String(message ?? 'sin detalle')
      .split('\n')[0]
      .slice(0, 160)
  )
}

async function buildCall(server, cfg, sourcePublicKey, fn, user) {
  const source = cfg.keypair
    ? await server.getAccount(sourcePublicKey)
    : new Account(sourcePublicKey, '0') // dry-run sin llave: la simulación no valida la secuencia
  const contract = new Contract(cfg.contractId)
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: cfg.passphrase })
    .addOperation(contract.call(fn, new Address(user).toScVal()))
    .setTimeout(60)
    .build()
}

async function readPosition(server, cfg, sourcePublicKey, user) {
  const tx = await buildCall(server, cfg, sourcePublicKey, IFACE.positionFn, user)
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) return { error: shortReason(sim.error) }
  const retval = sim.result?.retval
  return { position: retval ? scValToNative(retval) : null }
}

async function submitAndWait(server, tx) {
  const sent = await server.sendTransaction(tx)
  if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
    const code = sent.errorResult?.result().switch().name ?? sent.status
    throw new Error(`sendTransaction ${sent.status}: ${code}`)
  }
  const got = await server.pollTransaction(sent.hash, {
    attempts: 30,
    sleepStrategy: () => 2000,
  })
  return { hash: sent.hash, status: got.status, ledger: got.ledger }
}

// --- main --------------------------------------------------------------------

async function main() {
  const cfg = loadConfig()
  const server = new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith('http://') })
  const sourcePublicKey = cfg.keypair ? cfg.keypair.publicKey() : Keypair.random().publicKey()

  log(
    `keeper · red=${cfg.network} · contrato=${cfg.contractId} · rpc=${cfg.rpcUrl}` +
      ` · ${cfg.dryRun ? 'DRY-RUN' : 'envío real'}` +
      ` · keeper=${cfg.keypair ? sourcePublicKey : '(sin llave)'}`,
  )

  const { start, latest, clamped } = await resolveStartLedger(server, cfg.startLedger)
  if (clamped) {
    log(
      `KEEPER_START_LEDGER=${cfg.startLedger} ya salió de la ventana del RPC; uso ${start}.` +
        ' Los adelantos abiertos antes van en KEEPER_EXTRA_USERS.',
    )
  }
  const { users: fromEvents, events } = await fetchOpenedUsers(server, cfg.contractId, start)
  const candidates = [...new Set([...fromEvents, ...cfg.extraUsers])]
  log(
    `eventos ${IFACE.openedEventTopic}: ${events} en ledgers ${start}..${latest}` +
      ` · candidatos: ${candidates.length}`,
  )

  let settled = 0
  let ready = 0
  let failures = 0
  for (const user of candidates) {
    const pos = await readPosition(server, cfg, sourcePublicKey, user)
    if (pos.error) {
      log(`- ${user} · position falló: ${pos.error}`)
      continue
    }
    if (!pos.position) {
      log(`- ${user} · sin posición (ya liquidada o repagada)`)
      continue
    }
    const { advance, value_at_open: valueAtOpen } = pos.position
    const info = `A=${advance} V_open=${valueAtOpen}`

    const tx = await buildCall(server, cfg, sourcePublicKey, IFACE.settleFn, user)
    const sim = await server.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      log(`- ${user} · ${info} · settle no procede: ${shortReason(sim.error)}`)
      continue
    }
    ready++
    if (cfg.dryRun) {
      log(`✓ ${user} · ${info} · settle simulado OK (dry-run, no se envía)`)
      continue
    }

    try {
      const prepared = rpc.assembleTransaction(tx, sim).build()
      prepared.sign(cfg.keypair)
      const res = await submitAndWait(server, prepared)
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        settled++
        log(`✓ ${user} · ${info} · settle OK · ledger ${res.ledger} · hash ${res.hash}`)
      } else {
        failures++
        log(`✗ ${user} · settle ${res.status} · hash ${res.hash}`)
      }
    } catch (err) {
      failures++
      log(`✗ ${user} · envío falló: ${shortReason(err?.message)}`)
    }
  }

  log(
    `resumen: ${candidates.length} candidatos · ${ready} liquidables` +
      (cfg.dryRun ? '' : ` · ${settled} liquidados · ${failures} fallidos`),
  )
  return failures > 0 ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (err) => {
    if (err instanceof ConfigError) {
      console.error(`config: ${err.message}`)
      process.exit(2)
    }
    console.error(`rpc: ${shortReason(err?.message ?? String(err))}`)
    process.exit(1)
  },
)
