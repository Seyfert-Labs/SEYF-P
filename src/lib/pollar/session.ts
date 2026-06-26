'use client'

/** Lee la sesión Pollar persistida en localStorage (mismo key que @pollar/core). */
const STORAGE_KEY = 'pollar:session'

type PollarStoredSession = {
  token?: { accessToken?: string }
  wallet?: { publicKey?: string | null }
  data?: { providers?: { wallet?: { address?: string } } }
}

function readSession(): PollarStoredSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PollarStoredSession
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function readPollarAccessToken(): string | null {
  const token = readSession()?.token?.accessToken?.trim()
  return token || null
}

export function readPollarPublicKey(): string | null {
  const session = readSession()
  const pk =
    session?.wallet?.publicKey?.trim() || session?.data?.providers?.wallet?.address?.trim()
  return pk || null
}
