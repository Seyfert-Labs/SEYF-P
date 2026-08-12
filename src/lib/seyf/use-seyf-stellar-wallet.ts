'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePollar } from '@pollar/react'
import type { AuthState, WalletBalanceState } from '@pollar/core'
import { isValidStellarPublicKey, normalizeStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'
import { pollStellarBalance, STELLAR_BALANCE_CHANGED_EVT } from '@/lib/seyf/stellar-balance-refresh'
import { installPollarOtpErrorShim } from '@/lib/pollar/otp-error-shim'

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

/**
 * Traduce mensajes de error de Pollar a español legible. Nunca devuelve el
 * `message` crudo del SDK: son cadenas fijas en inglés ("Invalid code — try
 * again") que no queremos enseñarle al usuario.
 */
function translatePollarError(state: AuthState): string {
  if (state.step !== 'error') return ''
  const msg = state.message ?? ''

  if (msg.toLowerCase().includes('origin')) {
    return 'Este dominio no está autorizado. Contacta soporte.'
  }

  switch (state.errorCode) {
    case 'SESSION_CREATE_FAILED':
      return 'No se pudo conectar con el servicio de verificación. Verifica tu conexión o intenta de nuevo en unos segundos.'
    case 'EMAIL_SEND_FAILED':
      return 'No se pudo enviar el código a tu correo. Verifica que el correo sea correcto e intenta de nuevo.'
    case 'EMAIL_CODE_INVALID':
      return 'El código es incorrecto. Usa el más reciente que te llegó por correo e inténtalo de nuevo.'
    case 'EMAIL_CODE_EXPIRED':
      return 'El código expiró. Solicita uno nuevo.'
    case 'EMAIL_VERIFY_FAILED':
      return 'No pudimos verificar el código. Solicita uno nuevo e inténtalo otra vez.'
    case 'AUTH_FAILED':
      return 'No pudimos completar la verificación. Intenta de nuevo.'
    case 'WALLET_CONNECT_FAILED':
    case 'WALLET_AUTH_FAILED':
      return 'No pudimos conectar tu cuenta segura. Intenta de nuevo.'
    default:
      break
  }

  if (state.previousStep === 'creating_session') {
    return 'No se pudo conectar con el servicio de verificación. Verifica tu conexión o intenta de nuevo en unos segundos.'
  }
  if (state.previousStep === 'sending_email') {
    return 'No se pudo enviar el código a tu correo. Verifica que el correo sea correcto e intenta de nuevo.'
  }
  return 'No se pudo verificar. Intenta de nuevo.'
}

/**
 * ¿El SDK acepta un nuevo `verifyEmailCode()` desde este estado? Replica el
 * guard interno de @pollar/core: sin `clientSessionId` (o con un errorCode que
 * no sea de código inválido/expirado) la llamada LANZA `PollarFlowError` y deja
 * al usuario atorado. Preferimos reiniciar el flujo antes que llamar en falso.
 */
function canRetryVerify(state: AuthState): boolean {
  if (state.step === 'entering_code') return true
  if (state.step !== 'error') return false
  return (
    Boolean(state.clientSessionId) &&
    (state.errorCode === 'EMAIL_CODE_INVALID' || state.errorCode === 'EMAIL_CODE_EXPIRED')
  )
}

/** Correo asociado al estado de auth, si el paso lo lleva. */
function emailFromAuth(state: AuthState): string | null {
  if (
    state.step === 'sending_email' ||
    state.step === 'entering_code' ||
    state.step === 'verifying_email_code' ||
    state.step === 'error'
  ) {
    return state.email?.trim() || null
  }
  return null
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
  // Aviso informativo (no es error): p.ej. "te enviamos un código nuevo".
  const [notice, setNotice] = useState<string | null>(null)
  // Es estado (no ref) porque la UI decide con él si muestra el campo del
  // código: leerlo desde un ref durante el render da valores viejos.
  const [codeSentOnce, setCodeSentOnce] = useState(false)
  // Último correo usado en el enrolamiento: nos deja reiniciar el flujo cuando
  // el SDK pierde la sesión de verificación y ya no acepta reintentos.
  const emailRef = useRef<string | null>(null)

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
      const mail = emailFromAuth(s)
      if (mail) emailRef.current = mail
      setPhase(phaseFromAuth(s.step))
      if (s.step === 'entering_code') setCodeSentOnce(true)
      if (s.step === 'authenticated') setNotice(null)
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
      // Corrige la clasificación de errores del OTP en el SDK (ver el shim).
      installPollarOtpErrorShim(client)
      const initial = client.getAuthState()
      lastStep = initial.step
      setPhase(phaseFromAuth(initial.step))
      if (initial.step === 'entering_code' || initial.step === 'verifying_email_code') {
        setCodeSentOnce(true)
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

  /**
   * Arranca una sesión de verificación nueva y manda otro código. `login()`
   * aborta el flujo anterior por dentro, así que sirve tanto para el primer
   * envío como para recuperarse de un estado de error sin salida.
   */
  const startEmailFlow = useCallback((email: string, info?: string) => {
    setError(null)
    setNotice(info ?? null)
    setPhase('sending')
    // OJO: `codeSentOnce` NO se reinicia aquí. Marca "ya se envió un código
    // alguna vez" y es lo que decide si la UI muestra el campo del código; si lo
    // borráramos en cada reenvío, la pantalla saltaría a "Enviar código" a media
    // reenvío y el usuario perdería el contexto.
    emailRef.current = email
    try {
      const client = getClient()
      if (process.env.NODE_ENV === 'development') {
        console.info('[SEYF·OTP] login email →', email, '| auth step:', client.getAuthState().step)
      }
      client.login({ provider: 'email', email })
      return true
    } catch (e) {
      console.error('[SEYF·OTP] error al iniciar el flujo de correo:', e)
      setNotice(null)
      setError('No pudimos enviarte el código. Revisa tu conexión e intenta de nuevo.')
      setPhase('error')
      return false
    }
  }, [getClient])

  /** Envía el código OTP al correo (mismo de Privy). Headless: no abre modal. */
  const sendCode = useCallback(async (email: string) => {
    startEmailFlow(email)
  }, [startEmailFlow])

  /**
   * Verifica el código OTP que el usuario capturó.
   *
   * El SDK de Pollar solo acepta `verifyEmailCode()` desde `entering_code` (o
   * desde un error de código inválido/expirado que conserve el clientSessionId);
   * en cualquier otro estado LANZA `PollarFlowError` y el usuario se queda sin
   * salida hasta recargar. Cuando ya no se puede reintentar, reiniciamos el
   * flujo y mandamos un código nuevo en vez de llamar en falso.
   */
  const verifyCode = useCallback(async (code: string) => {
    let client: ReturnType<typeof getClient>
    try {
      client = getClient()
    } catch (e) {
      console.error('[SEYF·OTP] cliente Pollar no disponible:', e)
      setError('El servicio de verificación no está listo. Recarga la página e intenta de nuevo.')
      setPhase('error')
      return
    }

    const state = client.getAuthState()
    if (process.env.NODE_ENV === 'development') {
      console.info('[SEYF·OTP] verifyCode → code length:', code.length, '| auth step:', state.step)
    }

    if (state.step === 'authenticated') {
      setPhase('connected')
      return
    }

    if (!canRetryVerify(state)) {
      // La sesión de verificación ya no sirve: pedimos un código nuevo.
      const mail = emailFromAuth(state) || emailRef.current
      if (mail) {
        startEmailFlow(mail, 'Tu código anterior ya no era válido. Te enviamos uno nuevo a tu correo.')
      } else {
        setError('Solicita un código nuevo para continuar.')
        setPhase('error')
      }
      return
    }

    setError(null)
    setNotice(null)
    setPhase('verifying')
    try {
      client.verifyEmailCode(code)
    } catch (e) {
      // Red de seguridad: si el guard del SDK cambia, no dejamos al usuario atorado.
      console.error('[SEYF·OTP] verifyCode error:', e)
      const mail = emailRef.current
      if (mail) {
        startEmailFlow(mail, 'Tu código anterior ya no era válido. Te enviamos uno nuevo a tu correo.')
      } else {
        setError('No pudimos verificar el código. Solicita uno nuevo.')
        setPhase('error')
      }
    }
  }, [getClient, startEmailFlow])

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
    notice,
    codeSentOnce,
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
