import { NextResponse } from 'next/server'
import { fetchEtherfuseKycStatus } from '@/lib/etherfuse/kyc'
import { getEtherfuseOnboardingSession } from '@/lib/etherfuse/onboarding-session'
import { getStoredKycSnapshot, upsertStoredKycSnapshot } from '@/lib/seyf/kyc-state-store'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'
import { toErrorResponse } from '@/lib/seyf/api-error'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const walletHint = url.searchParams.get('wallet') ?? undefined
    const session = await getEtherfuseOnboardingSession(walletHint)
    if (!session) {
      return NextResponse.json({ ok: true, kyc: null }, { headers: { 'Cache-Control': 'no-store' } })
    }

    let snapshot = await getStoredKycSnapshot(session.customerId, session.publicKey)
    try {
      const live = await fetchEtherfuseKycStatus(session.customerId, session.publicKey)
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
