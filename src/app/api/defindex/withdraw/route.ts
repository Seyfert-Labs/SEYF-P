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

function extractDefindexError(e: unknown): { message: string; code?: string } {
  let msg = ''
  if (e instanceof Error) {
    msg = e.message
  } else if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const raw = Array.isArray(obj.message) ? obj.message.join('; ') : (obj.message as string) ?? ''
    msg = raw || (obj.error as string) || JSON.stringify(e).slice(0, 200)
  } else {
    msg = String(e)
  }
  if (!msg) return { message: 'Error DeFindex desconocido' }

  const lower = msg.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('429')) {
    return { message: 'DeFindex: límite de solicitudes alcanzado. Espera unos segundos.', code: 'RATE_LIMIT' }
  }
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return { message: 'Saldo insuficiente para el retiro.', code: 'INSUFFICIENT_BALANCE' }
  }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnrefused')) {
    return { message: 'No se pudo contactar el servicio DeFindex. Intenta de nuevo.', code: 'NETWORK_ERROR' }
  }
  return { message: msg, code: undefined }
}

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
      return NextResponse.json({ error: 'DeFindex vault no configurada para este plan.' }, { status: 503 })
    }
    if (!isValidStellarPublicKey(caller)) {
      return NextResponse.json({ error: 'caller inválido' }, { status: 400 })
    }

    const sdk = getDefindexSDK()
    const network = defindexNetwork()
    console.info(`[defindex/withdraw] vault=${vaultAddress} caller=${caller.slice(0, 8)}… amount=${amount ?? 'shares:' + shares} net=${network}`)

    const res =
      shares != null
        ? await sdk.withdrawShares(vaultAddress, { caller, shares, slippageBps }, network)
        : await sdk.withdrawFromVault(
            vaultAddress,
            { caller, amounts: [toUnits(amount as number, planId)], slippageBps },
            network,
          )
    if (!res.xdr) {
      console.error('[defindex/withdraw] SDK devolvió sin XDR:', JSON.stringify(res).slice(0, 500))
      return NextResponse.json({ error: 'DeFindex no devolvió XDR de retiro. Intenta con un monto diferente.' }, { status: 502 })
    }
    return NextResponse.json({ xdr: res.xdr })
  } catch (e) {
    const { message, code } = extractDefindexError(e)
    console.error('[defindex/withdraw] ERROR:', e instanceof Error ? e.stack ?? e.message : e)
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
