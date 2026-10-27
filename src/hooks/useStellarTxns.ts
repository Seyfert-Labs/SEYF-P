'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Address, xdr } from '@stellar/stellar-sdk'
import { DEFINDEX_USDC_ISSUER_TESTNET, strategyByVaultAddress } from '@/lib/defindex/catalog'
import { horizonUrl } from '@/lib/stellar/network'
import { usdcIssuer } from '@/lib/stellar/usdc'

export interface StellarOperation {
  id: string
  type:
    | 'payment'
    | 'path_payment_strict_send'
    | 'path_payment_strict_receive'
    | 'change_trust'
    | 'create_account'
    | 'vault_deposit'
    | 'vault_withdraw'
    | 'advance_open'
    | 'advance_repay'
    | 'advance_settle'
    | 'other'
  direction: 'in' | 'out' | 'self'
  from: string
  to: string
  asset: string
  amount: number
  sourceAsset?: string
  sourceAmount?: number
  createdAt: number
  txHash: string
  ledger: number
  memo?: string
}

const OPS_LIMIT = 30

/** USDC y las acciones de los vaults usan 7 decimales en Stellar. */
const UNITS_PER_TOKEN = 10_000_000n

/** Contrato `seyf_advance`. Referencia estática: Next solo inyecta así los `NEXT_PUBLIC_*` en el cliente. */
const ADVANCE_CONTRACT = process.env.NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT?.trim() || ''

/** Emisores de USDC reales en la red activa (Circle; en testnet también el de DeFindex). */
const USDC_ISSUERS = new Set([usdcIssuer(), usdcIssuer(DEFINDEX_USDC_ISSUER_TESTNET)])

/**
 * Código del activo para mostrar, o `null` si es un "USDC" de otro emisor: cualquiera
 * puede emitir un activo con ese código, y no debe aparecer como USDC en el historial.
 */
function assetLabel(assetType: string, assetCode?: string, assetIssuer?: string): string | null {
  if (assetType === 'native') return 'XLM'
  const code = assetCode?.toUpperCase() ?? 'unknown'
  if (code === 'USDC' && !(assetIssuer && USDC_ISSUERS.has(assetIssuer))) return null
  return code
}

/** "6.0000000" → 60000000n. Horizon da los montos como decimal con hasta 7 cifras. */
function toUnits(amount: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount)
  if (!m) return null
  return BigInt(m[1]) * UNITS_PER_TOKEN + BigInt((m[2] ?? '').padEnd(7, '0'))
}

function fromUnits(units: bigint): number {
  return Number(units) / Number(UNITS_PER_TOKEN)
}

type BalanceChange = {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  from?: string
  to?: string
  amount: string
}

/**
 * Cambio neto del saldo del usuario en una invocación de contrato, según
 * `asset_balance_changes` de Horizon (solo cubre activos con SAC: USDC, XLM).
 * Devuelve el activo que movió y la contraparte del primer movimiento.
 */
function userBalanceFlow(
  changes: BalanceChange[] | undefined,
  user: string,
): { asset: string; delta: bigint; counterparty: string } | null {
  const byAsset = new Map<string, { delta: bigint; counterparty: string }>()
  for (const c of changes ?? []) {
    const asset = assetLabel(c.asset_type, c.asset_code, c.asset_issuer)
    const units = toUnits(c.amount)
    if (!asset || units == null || (c.to !== user && c.from !== user)) continue
    const entry = byAsset.get(asset) ?? { delta: 0n, counterparty: (c.to === user ? c.from : c.to) ?? '' }
    if (c.to === user) entry.delta += units
    if (c.from === user) entry.delta -= units
    byAsset.set(asset, entry)
  }
  for (const [asset, { delta, counterparty }] of byAsset) {
    if (delta !== 0n) return { asset, delta, counterparty }
  }
  return null
}

/** Contrato y función de una invocación (`parameters[0]` y `[1]` en Horizon). */
function invokedContract(op: Record<string, unknown>): { contractId: string; fn: string } | null {
  if (op.function !== 'HostFunctionTypeHostFunctionTypeInvokeContract') return null
  const params = op.parameters as { type: string; value: string }[] | undefined
  if (!params || params.length < 2 || params[0].type !== 'Address' || params[1].type !== 'Sym') return null
  try {
    return {
      contractId: Address.fromScVal(xdr.ScVal.fromXDR(params[0].value, 'base64')).toString(),
      fn: xdr.ScVal.fromXDR(params[1].value, 'base64').sym().toString(),
    }
  } catch {
    return null
  }
}

/** Solo se nombran las funciones de los contratos que la app conoce. */
function contractOpType(contractId: string, fn: string): StellarOperation['type'] | null {
  if (strategyByVaultAddress(contractId)) {
    if (fn === 'deposit') return 'vault_deposit'
    if (fn === 'withdraw') return 'vault_withdraw'
  }
  if (ADVANCE_CONTRACT && contractId === ADVANCE_CONTRACT) {
    if (fn === 'open_advance') return 'advance_open'
    if (fn === 'repay') return 'advance_repay'
    if (fn === 'settle') return 'advance_settle'
  }
  return null
}

function classifyInvoke(
  op: Record<string, unknown>,
  userAddress: string,
  base: Pick<StellarOperation, 'id' | 'createdAt' | 'txHash' | 'ledger'>,
): StellarOperation | null {
  const call = invokedContract(op)
  if (!call) return null
  const flow = userBalanceFlow(op.asset_balance_changes as BalanceChange[] | undefined, userAddress)
  const direction: StellarOperation['direction'] = !flow ? 'self' : flow.delta > 0n ? 'in' : 'out'
  const amount = flow ? fromUnits(flow.delta < 0n ? -flow.delta : flow.delta) : 0

  const type = contractOpType(call.contractId, call.fn)
  if (type) {
    const asset = flow?.asset ?? strategyByVaultAddress(call.contractId)?.assetSymbol ?? 'USDC'
    const fromUser = direction !== 'in'
    return {
      ...base,
      type,
      direction,
      from: fromUser ? userAddress : call.contractId,
      to: fromUser ? call.contractId : userAddress,
      asset,
      amount,
    }
  }

  // Otro contrato (p. ej. el SAC de USDC con `transfer`): si movió el saldo del
  // usuario es un pago; si no, no hay nada que mostrar.
  if (!flow) return null
  return {
    ...base,
    type: 'payment',
    direction,
    from: direction === 'in' ? flow.counterparty : userAddress,
    to: direction === 'in' ? userAddress : flow.counterparty,
    asset: flow.asset,
    amount,
  }
}

function classifyOp(
  op: Record<string, unknown>,
  userAddress: string,
): StellarOperation | null {
  const type = op.type as string
  const id = op.id as string
  const createdAt = new Date(op.created_at as string).getTime()
  const txHash = (op.transaction_hash as string) ?? ''
  const ledger = (op as { ledger?: number }).ledger ?? 0

  if (type === 'payment' || type === 'path_payment_strict_send' || type === 'path_payment_strict_receive') {
    const from = (op.from as string) ?? ''
    const to = (op.to as string) ?? ''
    const asset = assetLabel(op.asset_type as string, op.asset_code as string | undefined, op.asset_issuer as string | undefined)
    if (!asset) return null
    const amount = Number(op.amount ?? 0)

    let direction: 'in' | 'out' | 'self' = 'self'
    if (from === userAddress && to === userAddress) direction = 'self'
    else if (to === userAddress) direction = 'in'
    else if (from === userAddress) direction = 'out'

    const isPath = type.startsWith('path_payment')
    const sourceAsset = isPath
      ? assetLabel(op.source_asset_type as string, op.source_asset_code as string | undefined, op.source_asset_issuer as string | undefined)
      : undefined
    if (sourceAsset === null) return null
    const sourceAmount = isPath ? Number(op.source_amount ?? 0) : undefined

    const mappedType = isPath ? type as StellarOperation['type'] : 'payment'

    return { id, type: mappedType, direction, from, to, asset, amount, sourceAsset, sourceAmount, createdAt, txHash, ledger }
  }

  if (type === 'change_trust') {
    const asset = assetLabel(op.asset_type as string, op.asset_code as string | undefined, op.asset_issuer as string | undefined)
    if (!asset) return null
    return {
      id,
      type: 'change_trust',
      direction: 'self',
      from: userAddress,
      to: (op.trustor as string) ?? userAddress,
      asset,
      amount: 0,
      createdAt,
      txHash,
      ledger,
    }
  }

  if (type === 'create_account') {
    const funder = (op.funder as string) ?? ''
    const account = (op.account as string) ?? ''
    const amount = Number(op.starting_balance ?? 0)
    const direction = account === userAddress ? 'in' : 'out'
    return { id, type: 'create_account', direction, from: funder, to: account, asset: 'XLM', amount, createdAt, txHash, ledger }
  }

  if (type === 'invoke_host_function') {
    return classifyInvoke(op, userAddress, { id, createdAt, txHash, ledger })
  }

  return null
}

type HorizonPage = {
  ops: StellarOperation[]
  /** `createdAt` de la operación más vieja leída; `null` si Horizon devolvió toda la historia. */
  truncatedAt: number | null
}

async function fetchStellarOps(address: string, signal: AbortSignal): Promise<HorizonPage> {
  const url = `${horizonUrl()}/accounts/${address}/operations?order=desc&limit=${OPS_LIMIT}&include_failed=false`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    if (res.status === 404) return { ops: [], truncatedAt: null }
    throw new Error(`Horizon ${res.status}`)
  }
  const json = await res.json() as { _embedded?: { records?: Record<string, unknown>[] } }
  const records = json._embedded?.records ?? []
  const ops: StellarOperation[] = []
  for (const rec of records) {
    const op = classifyOp(rec, address)
    if (op) ops.push(op)
  }
  const oldest = records.at(-1)
  const truncatedAt =
    records.length === OPS_LIMIT && oldest ? new Date(oldest.created_at as string).getTime() : null
  return { ops, truncatedAt }
}

/** Forma de `AdvanceSettledEvent` (`src/lib/advance/events.ts`). */
type SettledEvent = { id: string; txHash: string; ledger: number; closedAt: string; recovered: string }

/** Liquidaciones del adelanto: las firma el keeper, así que no salen en las operaciones de Horizon. */
async function fetchSettled(address: string, signal: AbortSignal): Promise<StellarOperation[]> {
  if (!ADVANCE_CONTRACT) return []
  const res = await fetch(`/api/advance/history?${new URLSearchParams({ address })}`, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`advance/history ${res.status}`)
  const { settled } = await res.json() as { settled?: SettledEvent[] }
  return (settled ?? []).map((e) => ({
    id: `settle_${e.id}`,
    type: 'advance_settle',
    direction: 'out',
    from: address,
    to: ADVANCE_CONTRACT,
    asset: 'USDC',
    amount: fromUnits(BigInt(e.recovered)),
    createdAt: new Date(e.closedAt).getTime(),
    txHash: e.txHash,
    ledger: e.ledger,
  }))
}

/**
 * Junta las liquidaciones con la página de Horizon. Si el usuario mismo llamó a
 * `settle`, gana el evento (trae el monto). Si la página de Horizon no llega al
 * principio de la historia, se omiten las liquidaciones más viejas que ella
 * para no dejar huecos en medio de la lista.
 */
function withSettled(page: HorizonPage, settled: StellarOperation[]): StellarOperation[] {
  const settledTx = new Set(settled.map((s) => s.txHash))
  const ops = page.ops.filter((op) => !(op.type === 'advance_settle' && settledTx.has(op.txHash)))
  const visible = settled.filter((s) => page.truncatedAt == null || s.createdAt >= page.truncatedAt)
  return [...ops, ...visible].sort((a, b) => b.createdAt - a.createdAt)
}

export function useStellarTxns(address?: string) {
  const [ops, setOps] = useState<StellarOperation[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!address) { setOps([]); return }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const [page, settled] = await Promise.allSettled([
        fetchStellarOps(address, ctrl.signal),
        fetchSettled(address, ctrl.signal),
      ])
      if (ctrl.signal.aborted) return
      if (page.status === 'rejected') throw page.reason
      // Sin liquidaciones (RPC caído o sin contrato) se muestra igual lo de Horizon.
      setOps(withSettled(page.value, settled.status === 'fulfilled' ? settled.value : []))
    } catch {
      if (!ctrl.signal.aborted) setOps([])
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [address])

  useEffect(() => { void refresh() }, [refresh])

  return { ops, loading, refresh }
}
