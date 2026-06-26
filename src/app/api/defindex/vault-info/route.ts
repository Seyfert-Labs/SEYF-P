import { NextResponse } from 'next/server'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { resolveStrategy, resolveVaultAddress } from '@/lib/defindex/vaults'
import { isDefindexTransientError } from '@/lib/defindex/api-error'
import { toErrorResponse } from '@/lib/reyf/api-error'

/**
 * GET /api/defindex/vault-info?planId=conservador
 */
export async function GET(req: Request) {
  const planId = new URL(req.url).searchParams.get('planId')?.trim() || undefined
  const vaultAddress = resolveVaultAddress(planId)
  const strat = resolveStrategy(planId)

  if (!vaultAddress) {
    return NextResponse.json({ error: 'DeFindex vault no configurada' }, { status: 503 })
  }

  try {
    const sdk = getDefindexSDK()
    const info = await sdk.getVaultInfo(vaultAddress, defindexNetwork())
    return NextResponse.json({
      vaultAddress,
      planId: strat.planId,
      strategyId: strat.id,
      strategyName: strat.strategyName,
      assetSymbol: strat.assetSymbol,
      name: info.name,
      symbol: info.symbol,
      apy: info.apy,
      assets: info.assets,
      apyLoaded: typeof info.apy === 'number' && Number.isFinite(info.apy),
    })
  } catch (e) {
    if (isDefindexTransientError(e)) {
      return NextResponse.json({
        vaultAddress,
        planId: strat.planId,
        strategyId: strat.id,
        strategyName: strat.strategyName,
        assetSymbol: strat.assetSymbol,
        name: strat.name,
        symbol: 'DFXV',
        apy: null,
        apyLoaded: false,
        assets: [],
        degraded: true,
      })
    }
    return toErrorResponse(e, 'defindex/vault-info')
  }
}
