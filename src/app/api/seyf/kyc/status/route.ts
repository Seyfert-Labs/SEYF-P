import { NextResponse } from 'next/server'
import { fetchEtherfuseKycStatus } from '@/lib/etherfuse/kyc'
import {
  getEtherfuseOnboardingSession,
  saveEtherfuseOnboardingSession,
  type EtherfuseOnboardingSession,
} from '@/lib/etherfuse/onboarding-session'
import {
  findRampContextByWalletPublicKey,
  findRampContextFromOrgWallets,
} from '@/lib/etherfuse/customer-lookup'
import { getStoredKycSnapshot, upsertStoredKycSnapshot } from '@/lib/seyf/kyc-state-store'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'
import { toErrorResponse } from '@/lib/seyf/api-error'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Busca en la org de Etherfuse el customerId REAL asociado a la wallet.
 * Resuelve el caso en que la sesión local apunta a un customerId obsoleto (o el KYC
 * quedó aprobado bajo otro customerId por "already added user"): así el gate reconoce
 * un KYC ya aprobado en vez de re-mandar a verificar.
 */
async function resolveRealCustomerId(
  walletHint: string,
  fallbackBankAccountId: string,
): Promise<{ customerId: string; bankAccountId: string } | null> {
  try {
    const byOrg = await findRampContextFromOrgWallets(walletHint, { fallbackBankAccountId })
    if (byOrg) return byOrg
  } catch {
    // sigue con lookup directo
  }
  try {
    return await findRampContextByWalletPublicKey(walletHint, { fallbackBankAccountId })
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const walletHint = url.searchParams.get('wallet') ?? undefined
    let session = await getEtherfuseOnboardingSession(walletHint)

    // Sin sesión pero con wallet: intenta resolver el customerId real por lookup.
    if (!session && walletHint) {
      const real = await resolveRealCustomerId(walletHint, crypto.randomUUID())
      if (real) {
        session = { customerId: real.customerId, bankAccountId: real.bankAccountId, publicKey: walletHint }
        await saveEtherfuseOnboardingSession(session).catch(() => {})
      }
    }

    if (!session) {
      return NextResponse.json({ ok: true, kyc: null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    let snapshot = await getStoredKycSnapshot(session.customerId, session.publicKey)
    try {
      let live = await fetchEtherfuseKycStatus(session.customerId, session.publicKey)

      // customerId obsoleto (not_found): resuelve el real por lookup, persiste y reintenta.
      if (!live.ok && live.reason === 'not_found' && walletHint) {
        const real = await resolveRealCustomerId(walletHint, session.bankAccountId)
        if (real && real.customerId !== session.customerId) {
          session = { ...session, customerId: real.customerId, bankAccountId: real.bankAccountId } as EtherfuseOnboardingSession
          await saveEtherfuseOnboardingSession(session).catch(() => {})
          live = await fetchEtherfuseKycStatus(session.customerId, session.publicKey)
        }
      }

      if (live.ok) {
        snapshot = live.data
        await upsertStoredKycSnapshot({
          customerId: live.data.customerId,
          walletPublicKey: live.data.walletPublicKey,
          status: live.data.status,
          approvedAt: live.data.approvedAt,
          currentRejectionReason: live.data.currentRejectionReason,
        })
      } else if (live.reason === 'not_found') {
        // Testnet: si hay un snapshot persistido (soft-complete de una wallet validada en otra
        // org), lo conservamos para no re-bloquear el gate. Mainnet: not_found manda → null.
        if (!isPublicStellarTestnet()) snapshot = null
      }
    } catch {
      // keep fallback snapshot
    }

    return NextResponse.json(
      { ok: true, kyc: snapshot },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return toErrorResponse(e, 'kyc/status')
  }
}
