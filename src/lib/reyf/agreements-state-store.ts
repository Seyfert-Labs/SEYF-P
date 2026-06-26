import { getKycAgreements, upsertKycAgreementsAccepted } from '@/lib/supabase/db'

// Aceptación de acuerdos del KYC, persistida en Supabase (tabla `kyc_agreements`).
// Antes vivía en Upstash Redis.

export async function getStoredAgreementsStatus(
  customerId: string,
  walletPublicKey: string,
): Promise<{ accepted: boolean; acceptedAt: string | null } | null> {
  try {
    return await getKycAgreements(customerId, walletPublicKey)
  } catch {
    return null
  }
}

export async function upsertStoredAgreementsAccepted(params: {
  customerId: string
  walletPublicKey: string
  acceptedAt?: string | null
}): Promise<void> {
  await upsertKycAgreementsAccepted(params)
}
