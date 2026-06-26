import { NextResponse } from 'next/server'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { DEFINDEX_STRATEGIES } from '@/lib/defindex/catalog'
import { defindexErrorText, isDefindexTransientError } from '@/lib/defindex/api-error'
import { fromUnits, resolveVaultAddress } from '@/lib/defindex/vaults'
import { isValidStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'

const zeroBalance = (planId?: string) => ({
  dfTokens: 0,
  underlyingBalance: 0,
  underlyingRaw: 0,
  planId,
  vaultAddress: resolveVaultAddress(planId),
})

/**
 * GET /api/defindex/balance?publicKey=G...&planId=conservador
 * Cualquier fallo de DeFindex sin posición → saldo 0 (evita 500 en la UI).
 */
export async function GET(req: Request) {
  const publicKey = new URL(req.url).searchParams.get('publicKey')?.trim() || ''
  const planId = new URL(req.url).searchParams.get('planId')?.trim() || undefined
  const vaultAddress = resolveVaultAddress(planId)

  if (!vaultAddress) {
    return NextResponse.json({ error: 'DeFindex vault no configurada' }, { status: 503 })
  }
  if (!isValidStellarPublicKey(publicKey)) {
    return NextResponse.json({ error: 'publicKey inválida' }, { status: 400 })
  }

  try {
    const sdk = getDefindexSDK()
    const balance = await sdk.getVaultBalance(vaultAddress, publicKey, defindexNetwork())
    const underlyingRaw = Number(balance.underlyingBalance?.[0] ?? 0)
    return NextResponse.json({
      dfTokens: Number(balance.dfTokens),
      underlyingBalance: fromUnits(underlyingRaw, planId),
      underlyingRaw,
      planId,
      vaultAddress,
    })
  } catch (e) {
    const detail = defindexErrorText(e)
    if (detail) console.warn('[defindex/balance]', planId, detail)
    // Rate-limit / 5xx / red intermitente → NO afirmamos 0 (eso borraría el saldo
    // real en la UI). `unavailable` hace que el cliente conserve el último saldo.
    if (isDefindexTransientError(e)) {
      return NextResponse.json({ planId, vaultAddress, unavailable: true })
    }
    // Resto (sin posición / cuenta nueva) → saldo 0 real.
    return NextResponse.json(zeroBalance(planId))
  }
}
