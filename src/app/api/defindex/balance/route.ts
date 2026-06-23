import { NextResponse } from 'next/server'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { DEFINDEX_VAULT_ADDRESS, fromUnits } from '@/lib/defindex/vaults'
import { isValidStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'
import { toErrorResponse } from '@/lib/reyf/api-error'

/**
 * GET /api/defindex/balance?publicKey=G...
 * Saldo del usuario en la vault: shares (dfTokens) + valor en asset subyacente.
 */
export async function GET(req: Request) {
  try {
    if (!DEFINDEX_VAULT_ADDRESS) {
      return NextResponse.json({ error: 'DeFindex vault no configurada' }, { status: 503 })
    }
    const publicKey = new URL(req.url).searchParams.get('publicKey')?.trim() || ''
    if (!isValidStellarPublicKey(publicKey)) {
      return NextResponse.json({ error: 'publicKey inválida' }, { status: 400 })
    }
    const sdk = getDefindexSDK()
    const balance = await sdk.getVaultBalance(DEFINDEX_VAULT_ADDRESS, publicKey, defindexNetwork())
    // La API devuelve los montos como string; forzamos número. underlyingBalance
    // es un arreglo (vault multi-asset); el MVP usa la 1.ª posición.
    const underlyingRaw = Number(balance.underlyingBalance?.[0] ?? 0)
    return NextResponse.json({
      dfTokens: Number(balance.dfTokens),
      underlyingBalance: fromUnits(underlyingRaw),
      underlyingRaw,
    })
  } catch (e) {
    return toErrorResponse(e, 'defindex/balance')
  }
}
