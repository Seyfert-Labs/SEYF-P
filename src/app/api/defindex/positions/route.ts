import { NextResponse } from 'next/server'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { DEFINDEX_STRATEGIES } from '@/lib/defindex/catalog'
import { defindexErrorText } from '@/lib/defindex/api-error'
import { fromUnits } from '@/lib/defindex/vaults'
import { isValidStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'

/**
 * GET /api/defindex/positions?publicKey=G...
 * Posiciones on-chain en todas las vaults (aunque no haya bóveda local en la app).
 */
export async function GET(req: Request) {
  const publicKey = new URL(req.url).searchParams.get('publicKey')?.trim() || ''
  if (!isValidStellarPublicKey(publicKey)) {
    return NextResponse.json({ error: 'publicKey inválida' }, { status: 400 })
  }

  const sdk = getDefindexSDK()
  const network = defindexNetwork()

  const positions = await Promise.all(
    DEFINDEX_STRATEGIES.map(async (s) => {
      let underlyingBalance = 0
      let dfTokens = 0
      try {
        const balance = await sdk.getVaultBalance(s.vaultAddress, publicKey, network)
        const raw = Number(balance.underlyingBalance?.[0] ?? 0)
        underlyingBalance = fromUnits(raw, s.planId)
        dfTokens = Number(balance.dfTokens) || 0
      } catch (e) {
        const detail = defindexErrorText(e)
        if (detail) console.warn('[defindex/positions]', s.id, detail)
      }
      return {
        planId: s.planId,
        strategyId: s.id,
        name: s.name,
        assetSymbol: s.assetSymbol,
        vaultAddress: s.vaultAddress,
        vaultKey: s.vaultKey,
        underlyingBalance,
        dfTokens,
      }
    }),
  )

  return NextResponse.json({
    publicKey,
    positions,
    withBalance: positions.filter((p) => p.underlyingBalance > 0),
  })
}
