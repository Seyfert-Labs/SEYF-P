'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'

export interface StellarOperation {
  id: string
  type: 'payment' | 'path_payment_strict_send' | 'path_payment_strict_receive' | 'change_trust' | 'create_account' | 'other'
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

const HORIZON_BASE = () =>
  isPublicStellarTestnet()
    ? 'https://horizon-testnet.stellar.org'
    : 'https://horizon.stellar.org'

function normalizeAsset(assetType: string, assetCode?: string): string {
  if (assetType === 'native') return 'XLM'
  return assetCode?.toUpperCase() ?? 'unknown'
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
    const asset = normalizeAsset(op.asset_type as string, op.asset_code as string | undefined)
    const amount = Number(op.amount ?? 0)

    let direction: 'in' | 'out' | 'self' = 'self'
    if (from === userAddress && to === userAddress) direction = 'self'
    else if (to === userAddress) direction = 'in'
    else if (from === userAddress) direction = 'out'

    const sourceAsset = type.startsWith('path_payment')
      ? normalizeAsset(op.source_asset_type as string, op.source_asset_code as string | undefined)
      : undefined
    const sourceAmount = type.startsWith('path_payment') ? Number(op.source_amount ?? 0) : undefined

    const mappedType = type === 'path_payment_strict_send' || type === 'path_payment_strict_receive'
      ? type as StellarOperation['type']
      : 'payment'

    return { id, type: mappedType, direction, from, to, asset, amount, sourceAsset, sourceAmount, createdAt, txHash, ledger }
  }

  if (type === 'change_trust') {
    const asset = normalizeAsset(op.asset_type as string, op.asset_code as string | undefined)
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

  return null
}

async function fetchStellarOps(address: string, limit = 30): Promise<StellarOperation[]> {
  const url = `${HORIZON_BASE()}/accounts/${address}/operations?order=desc&limit=${limit}&include_failed=false`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Horizon ${res.status}`)
  }
  const json = await res.json() as { _embedded?: { records?: Record<string, unknown>[] } }
  const records = json._embedded?.records ?? []
  const ops: StellarOperation[] = []
  for (const rec of records) {
    const op = classifyOp(rec, address)
    if (op) ops.push(op)
  }
  return ops
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
      const result = await fetchStellarOps(address)
      if (!ctrl.signal.aborted) setOps(result)
    } catch {
      if (!ctrl.signal.aborted) setOps([])
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [address])

  useEffect(() => { void refresh() }, [refresh])

  return { ops, loading, refresh }
}
