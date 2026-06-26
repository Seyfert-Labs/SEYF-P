/**
 * Sesión de onboarding Etherfuse persistida en Supabase (tabla
 * `onboarding_sessions`). Antes vivía en Upstash Redis.
 *
 * Mapea wallet Stellar → { customerId, bankAccountId } de Etherfuse.
 * Sin credenciales de Supabase: no-op (sesión solo vía cookie/API en dev).
 */

import {
  getOnboardingSession,
  upsertOnboardingSession,
  deleteOnboardingSession,
} from '@/lib/supabase/db'

export type StoredOnboardingSession = {
  customerId: string
  bankAccountId: string
  walletPublicKey: string
  updatedAt: string
}

export async function getStoredOnboardingSession(
  walletPublicKey: string,
): Promise<StoredOnboardingSession | null> {
  try {
    const row = await getOnboardingSession(walletPublicKey)
    if (!row || !row.customer_id || !row.bank_account_id) return null
    return {
      customerId: row.customer_id,
      bankAccountId: row.bank_account_id,
      walletPublicKey: row.wallet_public_key,
      updatedAt: row.updated_at,
    }
  } catch (e) {
    console.warn('[onboarding-store] Supabase get failed:', e)
    return null
  }
}

export async function saveStoredOnboardingSession(
  data: Omit<StoredOnboardingSession, 'updatedAt'>,
): Promise<void> {
  try {
    await upsertOnboardingSession({
      walletPublicKey: data.walletPublicKey,
      customerId: data.customerId,
      bankAccountId: data.bankAccountId,
    })
  } catch (e) {
    console.warn('[onboarding-store] Supabase set failed:', e)
  }
}

export async function clearStoredOnboardingSession(walletPublicKey: string): Promise<void> {
  try {
    await deleteOnboardingSession(walletPublicKey)
  } catch (e) {
    console.warn('[onboarding-store] Supabase del failed:', e)
  }
}
