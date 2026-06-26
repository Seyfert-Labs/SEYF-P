import { NextResponse } from 'next/server'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { DEFINDEX_STRATEGIES } from '@/lib/defindex/catalog'
import { toErrorResponse } from '@/lib/seyf/api-error'

/**
 * GET /api/defindex/strategies
 * Catálogo de estrategias DeFindex con APY en vivo (sin fallback estático).
 */
export async function GET() {
  try {
    const sdk = getDefindexSDK()
    const network = defindexNetwork()

    const strategies = await Promise.all(
      DEFINDEX_STRATEGIES.map(async (s) => {
        let apy: number | null = null
        try {
          const info = await sdk.getVaultInfo(s.vaultAddress, network)
          if (typeof info.apy === 'number' && Number.isFinite(info.apy)) {
            apy = info.apy
          }
        } catch {
          /* apy queda null hasta que DeFindex responda */
        }
        return {
          ...s,
          apy,
          apyLoaded: apy !== null,
          unlocked: true,
        }
      }),
    )

    return NextResponse.json({ strategies })
  } catch (e) {
    return toErrorResponse(e, 'defindex/strategies')
  }
}
