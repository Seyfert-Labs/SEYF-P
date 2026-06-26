import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { resolveVaultAddress, toUnits } from '@/lib/defindex/vaults'
import { isValidStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'

const bodySchema = z.object({
  caller: z.string().trim().min(56).max(56),
  amount: z.number().positive(),
  slippageBps: z.number().int().min(0).max(10_000).optional(),
  invest: z.boolean().optional(),
  planId: z.string().trim().optional(),
})

/**
 * POST /api/defindex/deposit { caller, amount, planId?, slippageBps?, invest? }
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const investEnv = (process.env.DEFINDEX_INVEST_ON_DEPOSIT || '').trim().toLowerCase() === 'true'
    const { caller, amount, slippageBps = 100, invest = investEnv, planId } = parsed.data
    const vaultAddress = resolveVaultAddress(planId)
    if (!vaultAddress) {
      return NextResponse.json({ error: 'DeFindex vault no configurada' }, { status: 503 })
    }
    if (!isValidStellarPublicKey(caller)) {
      return NextResponse.json({ error: 'caller inválido' }, { status: 400 })
    }

    const sdk = getDefindexSDK()
    const res = await sdk.depositToVault(
      vaultAddress,
      { caller, amounts: [toUnits(amount, planId)], invest, slippageBps },
      defindexNetwork(),
    )
    if (!res.xdr) {
      return NextResponse.json({ error: 'DeFindex no devolvió XDR de depósito' }, { status: 502 })
    }
    return NextResponse.json({ xdr: res.xdr, vaultAddress, planId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error DeFindex'
    console.error('[defindex/deposit]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
