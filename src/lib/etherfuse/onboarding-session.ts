import { cookies } from 'next/headers'
import { z } from 'zod'
import { normalizeStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'
import {
  getStoredOnboardingSession,
  saveStoredOnboardingSession,
  clearStoredOnboardingSession,
} from '@/lib/seyf/onboarding-session-store'

/** Nombre httpOnly; mantenida como fallback de compatibilidad. */
const COOKIE_NAME = 'seyf_ef_onboarding'

const sessionSchema = z.object({
  customerId: z.string().uuid(),
  bankAccountId: z.string().uuid(),
  publicKey: z.string().min(1),
})

export type EtherfuseOnboardingSession = z.infer<typeof sessionSchema>

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90 // 90 días

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
  }
}

function parseCookieSession(raw: string): EtherfuseOnboardingSession | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    const out = sessionSchema.safeParse(parsed)
    if (!out.success) return null
    return { ...out.data, publicKey: normalizeStellarPublicKey(out.data.publicKey) }
  } catch {
    return null
  }
}

/**
 * Lee la sesión de onboarding:
 * 1. Supabase (`onboarding_sessions`) si se provee walletPublicKey
 * 2. Cookie httpOnly — fallback de compatibilidad
 */
export async function getEtherfuseOnboardingSession(
  walletPublicKey?: string,
): Promise<EtherfuseOnboardingSession | null> {
  if (walletPublicKey) {
    const pk = normalizeStellarPublicKey(walletPublicKey)
    const stored = await getStoredOnboardingSession(pk)
    if (stored) {
      return {
        customerId: stored.customerId,
        bankAccountId: stored.bankAccountId,
        publicKey: pk,
      }
    }
  }

  // Cookie fallback
  try {
    const jar = await cookies()
    const raw = jar.get(COOKIE_NAME)?.value
    if (!raw) return null
    return parseCookieSession(raw)
  } catch {
    return null
  }
}

/**
 * Guarda la sesión en Supabase (fuente de verdad) y en cookie (fallback).
 */
export async function saveEtherfuseOnboardingSession(
  data: EtherfuseOnboardingSession,
): Promise<void> {
  const normalized: EtherfuseOnboardingSession = {
    ...data,
    publicKey: normalizeStellarPublicKey(data.publicKey),
  }

  await saveStoredOnboardingSession({
    customerId: normalized.customerId,
    bankAccountId: normalized.bankAccountId,
    walletPublicKey: normalized.publicKey,
  })

  // Cookie — fallback
  try {
    const jar = await cookies()
    jar.set(COOKIE_NAME, JSON.stringify(normalized), cookieOptions())
  } catch {
    // En RSC sin response (e.g. middleware), ignorar
  }
}

/**
 * Borra la sesión de Supabase y la cookie.
 */
export async function clearEtherfuseOnboardingSession(
  walletPublicKey?: string,
): Promise<void> {
  if (walletPublicKey) {
    await clearStoredOnboardingSession(normalizeStellarPublicKey(walletPublicKey))
  }
  try {
    const jar = await cookies()
    jar.delete(COOKIE_NAME)
  } catch {
    // noop
  }
}

/**
 * Reutiliza customerId/bankAccountId si la sesión coincide con la misma wallet;
 * si cambia la clave pública, genera IDs nuevos (otro cliente lógico en Etherfuse).
 */
export function resolveOnboardingIds(
  existing: EtherfuseOnboardingSession | null,
  publicKey: string,
  freshIds: { customerId: string; bankAccountId: string },
): { customerId: string; bankAccountId: string } {
  const next = normalizeStellarPublicKey(publicKey)
  if (existing && normalizeStellarPublicKey(existing.publicKey) === next) {
    return { customerId: existing.customerId, bankAccountId: existing.bankAccountId }
  }
  return freshIds
}
