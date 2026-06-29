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
    return { message: 'DeFindex: límite de solicitudes alcanzado. Espera unos segundos e intenta de nuevo.', code: 'RATE_LIMIT' }
  }
  if (lower.includes('insufficient') || lower.includes('balance')) {
    return { message: 'Saldo insuficiente para el depósito. Asegúrate de tener fondos disponibles.', code: 'INSUFFICIENT_BALANCE' }
  }
  if (lower.includes('trustline')) {
    return { message: 'Tu wallet no tiene la trustline del activo. Contacta soporte.', code: 'NO_TRUSTLINE' }
  }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnrefused')) {
    return { message: 'No se pudo contactar el servicio DeFindex. Intenta de nuevo.', code: 'NETWORK_ERROR' }
  }
  return { message: msg, code: undefined }
}

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
      return NextResponse.json({ error: 'DeFindex vault no configurada para este plan.' }, { status: 503 })
    }
    if (!isValidStellarPublicKey(caller)) {
      return NextResponse.json({ error: 'caller inválido' }, { status: 400 })
    }

    const network = defindexNetwork()
    const units = toUnits(amount, planId)
    console.info(`[defindex/deposit] vault=${vaultAddress} caller=${caller.slice(0, 8)}… amount=${amount} units=${units} invest=${invest} net=${network}`)

    const sdk = getDefindexSDK()
    const res = await sdk.depositToVault(
      vaultAddress,
      { caller, amounts: [units], invest, slippageBps },
      network,
    )
    if (!res.xdr) {
      console.error('[defindex/deposit] SDK devolvió sin XDR:', JSON.stringify(res).slice(0, 500))
      return NextResponse.json({ error: 'DeFindex no devolvió XDR de depósito. Intenta con un monto diferente.' }, { status: 502 })
    }
    return NextResponse.json({ xdr: res.xdr, vaultAddress, planId })
  } catch (e) {
    const { message, code } = extractDefindexError(e)
    console.error('[defindex/deposit] ERROR:', e instanceof Error ? e.stack ?? e.message : e)
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
