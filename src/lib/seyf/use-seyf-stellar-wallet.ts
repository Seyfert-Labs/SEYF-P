'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePollar } from '@pollar/react'
import type { AuthState, WalletBalanceState } from '@pollar/core'
import { isValidStellarPublicKey, normalizeStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'
import { pollStellarBalance, STELLAR_BALANCE_CHANGED_EVT } from '@/lib/seyf/stellar-balance-refresh'

export type SeyfStellarSession = {
  stellarAddress: string
  publicKey: string
  contractId: string
  email?: string
}

/** Fase del enrolamiento silencioso (OTP por correo, manejado en nuestra UI). */
export type StellarEnrollPhase = 'idle' | 'sending' | 'code' | 'verifying' | 'connected' | 'error'

type BalanceRow = { code?: string; balance?: string }
type MappedBalances = { assetBalances: BalanceRow[]; xlmBalance: string | null }

function mapBalances(state: WalletBalanceState): MappedBalances {
  if (state.step !== 'loaded') {
    return { assetBalances: [] as BalanceRow[], xlmBalance: null }
  }
  const rows = state.data.balances
  const assetBalances = rows.map((b) => ({
    code: b.type === 'native' ? 'XLM' : b.code,
    balance: (b.available || b.balance || '0').trim(),
  }))
  const native = rows.find((x) => x.type === 'native')
  return {
    assetBalances,
    xlmBalance: native ? (native.available || native.balance || '0').trim() : null,
  }
}

/** Traduce mensajes de error de Pollar a español legible. */
function translatePollarError(state: AuthState): string {
  if (state.step !== 'error') return ''
  const msg = state.message ?? ''
  const code = (state as { errorCode?: string }).errorCode ?? ''
  const prev = (state as { previousStep?: string }).previousStep ?? ''

  if (code === 'SESSION_CREATE_FAILED' || prev === 'creating_session') {
    return 'No se pudo conectar con el servicio de verificación. Verifica tu conexión o intenta de nuevo en unos segundos.'
  }
  if (code === 'EMAIL_SEND_FAILED' || prev === 'sending_email') {
    return 'No se pudo enviar el código a tu correo. Verifica que el correo sea correcto e intenta de nuevo.'
  }
  if (code === 'EMAIL_CODE_INVALID') {
    return 'El código ingresado es incorrecto. Revisa tu correo e intenta de nuevo.'
  }
  if (code === 'EMAIL_CODE_EXPIRED') {
    return 'El código expiró. Solicita uno nuevo.'
  }
  if (msg.toLowerCase().includes('origin')) {
    return 'Este dominio no está autorizado. Contacta soporte.'
  }
  if (msg) return msg
  return 'No se pudo verificar. Intenta de nuevo.'
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
  const codeSentRef = useRef(false)

  // getClient de usePollar() cambia de identidad en cada render; lo leemos vía ref
  // para NO meterlo en las deps del effect de suscripción (evita re-suscripciones).
  const getClientRef = useRef(getClient)
  useEffect(() => {
    getClientRef.current = getClient
  })

  // Suscripción ÚNICA al estado de auth de Pollar. Antes dependía de `getClient`,
  // cuya identidad cambia por render → se re-suscribía en cada render, acumulando
  // listeners que disparaban todos a la vez (flood de "auth state → authenticated").
  // Ahora: una sola suscripción (con reintento hasta que el client esté listo) y
  // deduplicación por `step` para no reprocesar/loguear el mismo estado.
  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let lastStep: string | null = null

    const onState = (s: AuthState) => {
      if (lastStep === s.step && s.step !== 'error') return
      lastStep = s.step
      if (process.env.NODE_ENV === 'development') {
        console.info('[SEYF·OTP] auth state →', s.step)
      }
      setPhase(phaseFromAuth(s.step))
      if (s.step === 'entering_code') codeSentRef.current = true
      if (s.step === 'error') setError(translatePollarError(s))
      else setError(null)
    }

    const subscribe = () => {
      if (cancelled) return
      let client: ReturnType<typeof getClient> | null = null
      try {
        client = getClientRef.current()
      } catch {
        client = null
      }
      if (!client) {
        // El client aún no está listo — reintenta sin re-montar el effect.
        retry = setTimeout(subscribe, 400)
        return
      }
      const initial = client.getAuthState()
      lastStep = initial.step
      setPhase(phaseFromAuth(initial.step))
      if (initial.step === 'entering_code' || initial.step === 'verifying_email_code') {
        codeSentRef.current = true
      }
      unsub = client.onAuthStateChange(onState)
    }

    subscribe()
    return () => {
      cancelled = true
      if (retry) clearTimeout(retry)
      unsub?.()
    }
  }, [])

  const publicKey = useMemo(() => {
    if (!walletAddress) return null
    try {
      return normalizeStellarPublicKey(walletAddress)
    } catch {
      return isValidStellarPublicKey(walletAddress) ? walletAddress : null
    }
  }, [walletAddress])

  const lastBalancesRef = useRef<MappedBalances>({ assetBalances: [], xlmBalance: null })
  const mapped = useMemo(() => mapBalances(walletBalance), [walletBalance])

  useEffect(() => {
    if (walletBalance.step === 'loaded') {
      lastBalancesRef.current = mapped
    }
  }, [walletBalance.step, mapped])

  // Mientras recarga, conserva el último saldo válido (evita parpadeos y datos “pegados” en loading).
  const { assetBalances, xlmBalance } =
    walletBalance.step === 'loading' && lastBalancesRef.current.assetBalances.length > 0
      ? lastBalancesRef.current
      : mapped

  const refreshBalanceNow = useCallback(async () => {
    if (!publicKey) return
    await refreshRef.current?.(publicKey)
  }, [publicKey])

  const refreshBalanceAfterTx = useCallback(async () => {
    if (!publicKey) return
    await pollStellarBalance((pk) => refreshRef.current?.(pk), publicKey)
  }, [publicKey])

  // Polling en vivo mientras la wallet está conectada.
  useEffect(() => {
    if (!isAuthenticated || !publicKey) return
    void refreshBalanceNow()
    const id = setInterval(() => void refreshBalanceNow(), 20_000)
    return () => clearInterval(id)
  }, [isAuthenticated, publicKey, refreshBalanceNow])

  // Al volver a la pestaña / tras una tx, re-sincroniza.
  useEffect(() => {
    if (!isAuthenticated || !publicKey) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshBalanceNow()
    }
    const onBalanceEvent = () => void refreshBalanceNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(STELLAR_BALANCE_CHANGED_EVT, onBalanceEvent)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(STELLAR_BALANCE_CHANGED_EVT, onBalanceEvent)
    }
  }, [isAuthenticated, publicKey, refreshBalanceNow])

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
    codeSentRef.current = false
    try {
      const client = getClient()
      if (process.env.NODE_ENV === 'development') {
        console.info('[SEYF·OTP] sendCode →', email, '| auth step:', client.getAuthState().step)
      }
      client.login({ provider: 'email', email })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar el código'
      console.error('[SEYF·OTP] sendCode error síncrono:', e)
      setError(msg)
      setPhase('error')
    }
  }, [getClient])

  /** Verifica el código OTP que el usuario capturó. */
  const verifyCode = useCallback(async (code: string) => {
    setError(null)
    setPhase('verifying')
    try {
      const client = getClient()
      const currentStep = client.getAuthState().step
      if (process.env.NODE_ENV === 'development') {
        console.info('[SEYF·OTP] verifyCode → code length:', code.length, '| auth step:', currentStep)
      }
      if (currentStep !== 'entering_code' && currentStep !== 'error') {
        setError('El código aún no se ha enviado. Solicita uno nuevo.')
        setPhase('error')
        return
      }
      client.verifyEmailCode(code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Código inválido'
      console.error('[SEYF·OTP] verifyCode error:', e)
      setError(msg)
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
    codeSentOnce: codeSentRef.current,
    sendCode,
    verifyCode,
    // Fallback al modal de Pollar (no usado en el flujo nuevo).
    login,
    logout,
    refreshBalance: refreshBalanceNow,
    refreshBalanceAfterTx,
    getClient,
    etherfusePublicKeyHint: publicKey ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}` : null,
  }
}
