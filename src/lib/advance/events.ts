import 'server-only'

/**
 * Liquidaciones (`settle`) de un usuario, leídas de los eventos del contrato.
 *
 * `settle` lo firma el keeper (o cualquiera), así que Horizon no lo lista entre
 * las operaciones del usuario: la cuenta solo aparece como topic del evento
 * `advance_settled`. El RPC guarda eventos durante su `ledgerRetentionWindow`
 * (~7 días en mainnet); una liquidación más vieja ya no se puede leer.
 */

import { Address, nativeToScVal, scValToNative, type rpc } from '@stellar/stellar-sdk'
import { advanceContractId } from '@/lib/advance/config'
import { sorobanServer } from '@/lib/advance/soroban'

const SETTLED_TOPIC = nativeToScVal('advance_settled', { type: 'symbol' }).toXDR('base64')

/** Ventana de retención por defecto de Stellar RPC (7 días de ledgers de ~5 s). */
const DEFAULT_RETENTION_LEDGERS = 120_960

/** Margen sobre el ledger más viejo: el RPC sigue podando mientras se pagina. */
const RETENTION_MARGIN_LEDGERS = 10

/**
 * Cada `getEvents` escanea un tramo acotado de ledgers (10 000 en
 * mainnet.sorobanrpc.com) y responde con un cursor aunque no encuentre nada.
 * Se pide la ventana en tramos de ese tamaño, en paralelo.
 */
const CHUNK_LEDGERS = 10_000

const PAGE_LIMIT = 100
/** Tope de páginas por tramo, por si el proveedor escanea menos de `CHUNK_LEDGERS`. */
const MAX_PAGES_PER_CHUNK = 20

/** Montos en unidades mínimas (7 decimales), como en `src/lib/advance/contract.ts`. */
export type AdvanceSettledEvent = {
  id: string
  txHash: string
  ledger: number
  closedAt: string
  /** USDC retirado del vault hacia la tesorería: el adelanto, cobrado del rendimiento. */
  recovered: string
  sharesRedeemed: string
  sharesReturned: string
}

function toSettledEvent(ev: rpc.Api.EventResponse): AdvanceSettledEvent | null {
  const data = scValToNative(ev.value) as Record<string, unknown> | null
  const { recovered, shares_redeemed: redeemed, shares_returned: returned } = data ?? {}
  if (typeof recovered !== 'bigint' || typeof redeemed !== 'bigint' || typeof returned !== 'bigint') {
    console.error('[advance/events] evento advance_settled con forma inesperada:', ev.id)
    return null
  }
  return {
    id: ev.id,
    txHash: ev.txHash,
    ledger: ev.ledger,
    closedAt: ev.ledgerClosedAt,
    recovered: recovered.toString(),
    sharesRedeemed: redeemed.toString(),
    sharesReturned: returned.toString(),
  }
}

/** Ledger al que apunta un cursor de `getEvents` (TOID: el ledger va en los 32 bits altos). */
function cursorLedger(cursor: string): number {
  return Number(BigInt(cursor.split('-')[0]) >> 32n)
}

/** Eventos con ledger en [start, end). Un cursor no admite `endLedger`, así que se filtra aquí. */
async function eventsInRange(
  server: rpc.Server,
  filters: rpc.Api.EventFilter[],
  start: number,
  end: number,
): Promise<rpc.Api.EventResponse[]> {
  const out: rpc.Api.EventResponse[] = []
  let request: rpc.Api.GetEventsRequest = { filters, startLedger: start, endLedger: end, limit: PAGE_LIMIT }
  for (let page = 0; page < MAX_PAGES_PER_CHUNK; page++) {
    const res = await server.getEvents(request)
    out.push(...res.events.filter((ev) => ev.ledger >= start && ev.ledger < end))
    // Una página vacía no es el final: el RPC corta el escaneo y devuelve un
    // cursor. Se termina cuando el cursor alcanza el final del tramo.
    if (!res.cursor || cursorLedger(res.cursor) >= Math.min(end, res.latestLedger) - 1) return out
    request = { filters, cursor: res.cursor, limit: PAGE_LIMIT }
  }
  throw new Error(`getEvents no terminó el tramo ${start}–${end} en ${MAX_PAGES_PER_CHUNK} páginas`)
}

/** Liquidaciones de `user` dentro de la ventana del RPC, de la más vieja a la más nueva. */
export async function settledEvents(user: string): Promise<AdvanceSettledEvent[]> {
  const server = sorobanServer()
  const filters: rpc.Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [advanceContractId()],
      topics: [[SETTLED_TOPIC, new Address(user).toScVal().toXDR('base64')]],
    },
  ]

  const health = await server.getHealth()
  const retention = health.ledgerRetentionWindow || DEFAULT_RETENTION_LEDGERS
  const first =
    Math.max(health.oldestLedger ?? 0, health.latestLedger - retention) + RETENTION_MARGIN_LEDGERS
  const last = health.latestLedger + 1

  const chunks: Promise<rpc.Api.EventResponse[]>[] = []
  for (let start = first; start < last; start += CHUNK_LEDGERS) {
    chunks.push(eventsInRange(server, filters, start, Math.min(start + CHUNK_LEDGERS, last)))
  }
  const events = (await Promise.all(chunks)).flat()

  const seen = new Set<string>()
  const out: AdvanceSettledEvent[] = []
  for (const ev of events) {
    if (seen.has(ev.id)) continue
    seen.add(ev.id)
    const settled = toSettledEvent(ev)
    if (settled) out.push(settled)
  }
  return out.sort((a, b) => a.ledger - b.ledger)
}
