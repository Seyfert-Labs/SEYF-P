import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDefindexSDK, defindexNetwork } from '@/lib/defindex/client'
import { resolveVaultAddress, toUnits } from '@/lib/defindex/vaults'
import { isValidStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'

const bodySchema = z
  .object({
    caller: z.string().trim().min(56).max(56),
    amount: z.number().positive().optional(),
    shares: z.number().positive().optional(),
    slippageBps: z.number().int().min(0).max(10_000).optional(),
    planId: z.string().trim().optional(),
  })
  .refine((b) => b.amount != null || b.shares != null, {
    message: 'Indica amount o shares',
  })

/**
 * POST /api/defindex/withdraw { caller, amount? | shares?, planId? }
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { caller, amount, shares, slippageBps = 100, planId } = parsed.data
    const vaultAddress = resolveVaultAddress(planId)
    if (!vaultAddress) {
      return NextResponse.json({ error: 'DeFindex vault no configurada' }, { status: 503 })
    }
    if (!isValidStellarPublicKey(caller)) {
      return NextResponse.json({ error: 'caller inválido' }, { status: 400 })
    }

    const sdk = getDefindexSDK()
    const network = defindexNetwork()
    const res =
      shares != null
        ? await sdk.withdrawShares(vaultAddress, { caller, shares, slippageBps }, network)
        : await sdk.withdrawFromVault(
            vaultAddress,
            { caller, amounts: [toUnits(amount as number, planId)], slippageBps },
            network,
          )
    if (!res.xdr) {
      return NextResponse.json({ error: 'DeFindex no devolvió XDR de retiro' }, { status: 502 })
    }
    return NextResponse.json({ xdr: res.xdr })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error DeFindex'
    console.error('[defindex/withdraw]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
