import { NextResponse } from 'next/server'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { DEFINDEX_VAULT_ADDRESS } from '@/lib/defindex/vaults'
import { toErrorResponse } from '@/lib/reyf/api-error'

/**
 * GET /api/defindex/vault-info
 * Devuelve metadata + APY de la DeFindex vault configurada (lectura, sin firmar).
 */
export async function GET() {
  try {
    if (!DEFINDEX_VAULT_ADDRESS) {
      return NextResponse.json({ error: 'DeFindex vault no configurada' }, { status: 503 })
    }
    const sdk = getDefindexSDK()
    const network = defindexNetwork()
    const info = await sdk.getVaultInfo(DEFINDEX_VAULT_ADDRESS, network)
    return NextResponse.json({
      vaultAddress: DEFINDEX_VAULT_ADDRESS,
      name: info.name,
      symbol: info.symbol,
      apy: info.apy,
      assets: info.assets,
    })
  } catch (e) {
    return toErrorResponse(e, 'defindex/vault-info')
  }
}
