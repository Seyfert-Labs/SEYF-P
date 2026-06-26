'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePollar } from '@pollar/react'
import type { AuthState, WalletBalanceState } from '@pollar/core'
import { isValidStellarPublicKey, normalizeStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'

export type SeyfStellarSession = {
  stellarAddress: string
  publicKey: string
  contractId: string
  email?: string
}

/** Fase del enrolamiento silencioso (OTP por correo, manejado en nuestra UI). */
export type StellarEnrollPhase = 'idle' | 'sending' | 'code' | 'verifying' | 'connected' | 'error'

function mapBalances(state: WalletBalanceState) {
  if (state.step !== 'loaded') return { assetBalances: [] as { code?: string; balance?: string }[], xlmBalance: null as string | null }
  const rows = state.data.balances
  const assetBalances = rows.map((b) => ({
    code: b.type === 'native' ? 'XLM' : b.code,
    balance: (b.available || b.balance || '0').trim(),
  }))
  const native = rows.find((x) => x.type === 'native')
  return { assetBalances, xlmBalance: native ? (native.available || native.balance || '0').trim() : null }
}

/** Traduce el estado de auth de Pollar a nuestra fase de enrolamiento. */
function phaseFromAuth(step: AuthState['step']): StellarEnrollPhase {
  switch (step) {
    case 'authenticated':
      return 'connected'
    case 'entering_code':
      return 'code'
    case 'verifying_email_code':
      return 'verifying'
    case 'error':
      return 'error'
    case 'creating_session':
    case 'entering_email':
    case 'sending_email':
      return 'sending'
    default:
      return 'idle'
  }
}

/**
 * Wallet Stellar embebida (Pollar) manejada de forma headless: el enrolamiento
 * se conduce desde la UI de SEYF con el mismo correo de la sesión Privy, sin
 * abrir el modal de Pollar. El usuario solo captura una vez el código OTP que
 * recibe por correo; la sesión persiste después. Esta wallet es donde Etherfuse
 * acredita los bonos (detalle de implementación; nunca se expone al usuario).
 */
export function useSeyfStellarWallet() {
  const { isAuthenticated, walletAddress, walletBalance, refreshBalance, openLoginModal, logout, getClient } = usePollar()
  const refreshRef = useRef(refreshBalance)
  refreshRef.current = refreshBalance

  const [phase, setPhase] = useState<StellarEnrollPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  // Refleja el estado de auth de Pollar (driven por el cliente headless).
  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      const client = getClient()
      setPhase(phaseFromAuth(client.getAuthState().step))
      unsub = client.onAuthStateChange((s) => {
        setPhase(phaseFromAuth(s.step))
        if (s.step === 'error') setError(s.message ?? 'No se pudo verificar')
        else setError(null)
      })
    } catch {
      /* cliente no listo todavía */
    }
    return () => unsub?.()
  }, [getClient])

  const publicKey = useMemo(() => {
    if (!walletAddress) return null
    try {
      return normalizeStellarPublicKey(walletAddress)
    } catch {
      return isValidStellarPublicKey(walletAddress) ? walletAddress : null
    }
  }, [walletAddress])

  const { assetBalances, xlmBalance } = useMemo(() => mapBalances(walletBalance), [walletBalance])

  const cetesBalance = useMemo(() => {
    const row = assetBalances.find((b) => (b.code || '').toUpperCase().includes('CETES'))
    return row?.balance ?? null
  }, [assetBalances])

  const wallet: SeyfStellarSession | null = useMemo(() => {
    if (!isAuthenticated || !publicKey) return null
    return { stellarAddress: publicKey, publicKey, contractId: publicKey }
  }, [isAuthenticated, publicKey])

  /** Envía el código OTP al correo (mismo de Privy). Headless: no abre modal. */
  const sendCode = useCallback(async (email: string) => {
    setError(null)
    setPhase('sending')
    try {
      getClient().login({ provider: 'email', email })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el código')
      setPhase('error')
    }
  }, [getClient])

  /** Verifica el código OTP que el usuario capturó. */
  const verifyCode = useCallback(async (code: string) => {
    setError(null)
    setPhase('verifying')
    try {
      getClient().verifyEmailCode(code)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido')
      setPhase('error')
    }
  }, [getClient])

  const login = useCallback(() => openLoginModal(), [openLoginModal])

  return {
    ready: true,
    // Mismo fallback de llave que SeyfPollarProvider (publishable o api key).
    enabled: Boolean(
      (process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_POLLAR_API_KEY)?.trim(),
    ),
    authenticated: isAuthenticated,
    wallet,
    publicKey,
    assetBalances,
    xlmBalance,
    cetesBalance,
    // Enrolamiento silencioso (OTP en nuestra UI).
    phase,
    error,
    sendCode,
    verifyCode,
    // Fallback al modal de Pollar (no usado en el flujo nuevo).
    login,
    logout,
    refreshBalance: () => refreshRef.current?.(),
    getClient,
    etherfusePublicKeyHint: publicKey ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}` : null,
  }
}
