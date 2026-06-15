import { NextResponse } from 'next/server'
import { toErrorResponse } from '@/lib/reyf/api-error'
import { resolveEtherfuseRampContext } from '@/lib/reyf/etherfuse-ramp-context'
import { fetchEtherfuseKycStatus } from '@/lib/etherfuse/kyc'
import { etherfuseFetch, etherfuseReadBody } from '@/lib/etherfuse/client'
import { guardEtherfuseRampRoutes } from '@/lib/reyf/etherfuse-ramp-guard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type BankAccountRow = {
  bankAccountId?: string
  etherfuseDepositClabe?: string | null
  status?: string
  abbrClabe?: string
  label?: string | null
  compliant?: boolean
  deletedAt?: string | null
}
type BankAccountsList = { items?: BankAccountRow[] }

async function fetchBankAccountDepositClabe(
  customerId: string,
  bankAccountId: string,
): Promise<{
  etherfuseDepositClabe: string | null
  status: string | null
  abbrClabe: string | null
  bankAccountLabel: string | null
}> {
  const pickFromItems = (
    items: BankAccountRow[],
  ): {
    etherfuseDepositClabe: string | null
    status: string | null
    abbrClabe: string | null
    bankAccountLabel: string | null
  } => {
    const active = items.filter((b) => !b.deletedAt)
    const match = active.find((b) => b.bankAccountId === bankAccountId) ?? active[0]
    return {
      etherfuseDepositClabe: match?.etherfuseDepositClabe ?? null,
      status: match?.status ?? null,
      abbrClabe: typeof match?.abbrClabe === 'string' ? match.abbrClabe : null,
      bankAccountLabel: typeof match?.label === 'string' ? match.label : null,
    }
  }

  const res = await etherfuseFetch(
    `/ramp/customer/${encodeURIComponent(customerId)}/bank-accounts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize: 50, pageNumber: 0 }),
    },
  )
  const { json } = await etherfuseReadBody<BankAccountsList>(res)
  if (res.ok && json?.items?.length) {
    const fromCustomer = pickFromItems(json.items)
    if (fromCustomer.etherfuseDepositClabe || fromCustomer.status) {
      return fromCustomer
    }
  }

  // Sandbox: cuenta a nivel org — mismo fallback que activate-deposit-clabe
  try {
    const orgRes = await etherfuseFetch('/ramp/bank-accounts', { method: 'GET' })
    const { json: orgJson } = await etherfuseReadBody<BankAccountsList>(orgRes)
    if (orgRes.ok && orgJson?.items?.length) {
      return pickFromItems(orgJson.items)
    }
  } catch {
    /* ignore */
  }

  return { etherfuseDepositClabe: null, status: null, abbrClabe: null, bankAccountLabel: null }
}

/**
 * GET /api/reyf/etherfuse/deposit-info?wallet={publicKey}
 *
 * Retorna:
 *  - kycStatus: estado del KYC del usuario
 *  - kycReady: true si KYC está en estado usable (compliant/proposed/approved)
 *  - etherfuseDepositClabe: CLABE para depósito SPEI en Etherfuse (puede ser null si aún no activada)
 *  - abbrClabe: vista abreviada de la CLABE del cliente (si Etherfuse la envía)
 *  - bankAccountLabel: etiqueta interna de la cuenta en Etherfuse (opcional)
 *  - bankAccountStatus: estado de la cuenta bancaria en Etherfuse
 *  - hasContext: si se pudo resolver la sesión
 */
export async function GET(request: Request) {
  const denied = guardEtherfuseRampRoutes()
  if (denied) return denied
  try {
    const walletHint = new URL(request.url).searchParams.get('wallet') ?? null
    const ctx = await resolveEtherfuseRampContext({ walletPublicKeyHint: walletHint })

    if (!ctx) {
      return NextResponse.json(
        { ok: true, hasContext: false, kycReady: false, etherfuseDepositClabe: null },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const kyc = await fetchEtherfuseKycStatus(ctx.customerId, ctx.publicKey)
    const kycStatus = kyc.ok ? (kyc.data?.status ?? null) : null
    const kycStatusStr = kycStatus as string | null
    const kycReady =
      kycStatusStr === 'approved' ||
      kycStatusStr === 'approved_chain_deploying' ||
      kycStatusStr === 'proposed' ||
      kycStatusStr === 'compliant'

    let etherfuseDepositClabe: string | null = null
    let bankAccountStatus: string | null = null
    let abbrClabe: string | null = null
    let bankAccountLabel: string | null = null

    if (kycReady) {
      try {
        const ba = await fetchBankAccountDepositClabe(ctx.customerId, ctx.bankAccountId)
        etherfuseDepositClabe = ba.etherfuseDepositClabe
        bankAccountStatus = ba.status
        abbrClabe = ba.abbrClabe
        bankAccountLabel = ba.bankAccountLabel
      } catch {
        // No bloquear si falla — el usuario puede activar desde el botón
      }
    }

    return NextResponse.json(
      {
        ok: true,
        hasContext: true,
        customerId: ctx.customerId,
        kycStatus,
        kycReady,
        etherfuseDepositClabe,
        abbrClabe,
        bankAccountLabel,
        bankAccountStatus,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return toErrorResponse(e, 'etherfuse/deposit-info')
  }
}
