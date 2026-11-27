'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWallet, useCrossmintAuth } from '@crossmint/client-sdk-react-ui'
import { isValidStellarPublicKey, normalizeStellarPublicKey } from '@/lib/etherfuse/stellar-public-key'
import { pollStellarBalance, STELLAR_BALANCE_CHANGED_EVT } from '@/lib/seyf/stellar-balance-refresh'
import { createCrossmintStellarClient, type CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'

let lastAutoRefreshAt = 0
let lastLoadedBalances: { publicKey: string; data: MappedBalances } | null = null

export type SeyfStellarSession = {
  stellarAddress: string
  publicKey: string
  contractId: string
  email?: string
}

export type StellarEnrollPhase = 'idle' | 'sending' | 'code' | 'verifying' | 'connected' | 'error'

type BalanceRow = { code?: string; balance?: string }
type MappedBalances = { assetBalances: BalanceRow[]; xlmBalance: string | null }

export function useSeyfStellarWallet() {
  const { wallet: cmWallet, status: walletStatus } = useWallet()
  const { status: authStatus, user, login: cmLogin, logout: cmLogout } = useCrossmintAuth()

  const isAuthenticated = authStatus === 'logged-in' && Boolean(cmWallet?.address)
  const walletAddress = cmWallet?.address ?? null

  const [assetBalances, setAssetBalances] = useState<BalanceRow[]>([])
  const [xlmBalance, setXlmBalance] = useState<string | null>(null)
  const [balancesLoaded, setBalancesLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const publicKey = useMemo(() => {
    if (!walletAddress) return null
    try {
      return normalizeStellarPublicKey(walletAddress)
    } catch {
      return isValidStellarPublicKey(walletAddress) ? walletAddress : null
    }
  }, [walletAddress])

  const clientRef = useRef<CrossmintStellarClient | null>(null)
  useEffect(() => {
    if (cmWallet && isValidStellarPublicKey(cmWallet.address)) {
      clientRef.current = createCrossmintStellarClient(cmWallet)
    } else {
      clientRef.current = null
    }
  }, [cmWallet])

  const getClient = useCallback((): CrossmintStellarClient => {
    if (!clientRef.current) {
      throw new Error('Tu wallet Stellar (Crossmint) aún no está lista.')
    }
    return clientRef.current
  }, [])

  const refreshBalanceNow = useCallback(async () => {
    if (!cmWallet || !publicKey) return
    try {
      const res = await cmWallet.balances(['xlm', 'usdc', 'cetes'])
      const rows: BalanceRow[] = []
      if (res.nativeToken) {
        rows.push({ code: 'XLM', balance: res.nativeToken.amount ?? '0' })
      }
      if (res.usdc) {
        rows.push({ code: 'USDC', balance: res.usdc.amount ?? '0' })
      }
      for (const t of res.tokens ?? []) {
        const sym = (t.symbol || '').toUpperCase()
        if (sym && sym !== 'XLM' && sym !== 'USDC') {
          rows.push({ code: sym, balance: t.amount ?? '0' })
        }
      }
      const nativeBal = res.nativeToken?.amount ?? '0'
      const mapped: MappedBalances = { assetBalances: rows, xlmBalance: nativeBal }
      lastLoadedBalances = { publicKey, data: mapped }
      setAssetBalances(rows)
      setXlmBalance(nativeBal)
      setBalancesLoaded(true)
    } catch {
      const cached = lastLoadedBalances?.publicKey === publicKey ? lastLoadedBalances.data : null
      if (cached) {
        setAssetBalances(cached.assetBalances)
        setXlmBalance(cached.xlmBalance)
        setBalancesLoaded(true)
      }
    }
  }, [cmWallet, publicKey])

  const refreshBalanceAfterTx = useCallback(async () => {
    if (!publicKey) return
    await pollStellarBalance(() => refreshBalanceNow(), publicKey)
  }, [publicKey, refreshBalanceNow])

  const refreshBalanceShared = useCallback(async () => {
    if (Date.now() - lastAutoRefreshAt < 5_000) return
    lastAutoRefreshAt = Date.now()
    await refreshBalanceNow()
  }, [refreshBalanceNow])

  useEffect(() => {
    if (!isAuthenticated || !publicKey) return
    void refreshBalanceShared()
    const id = setInterval(() => void refreshBalanceShared(), 20_000)
    return () => clearInterval(id)
  }, [isAuthenticated, publicKey, refreshBalanceShared])

  useEffect(() => {
    if (!isAuthenticated || !publicKey) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshBalanceShared()
    }
    const onBalanceEvent = () => void refreshBalanceNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(STELLAR_BALANCE_CHANGED_EVT, onBalanceEvent)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(STELLAR_BALANCE_CHANGED_EVT, onBalanceEvent)
    }
  }, [isAuthenticated, publicKey, refreshBalanceNow, refreshBalanceShared])

  const cetesBalance = useMemo(() => {
    const row = assetBalances.find((b) => (b.code || '').toUpperCase().includes('CETES'))
    return row?.balance ?? null
  }, [assetBalances])

  const email = user?.email ?? undefined

  const wallet: SeyfStellarSession | null = useMemo(() => {
    if (!isAuthenticated || !publicKey) return null
    return { stellarAddress: publicKey, publicKey, contractId: publicKey, email }
  }, [isAuthenticated, publicKey, email])

  const phase = useMemo((): StellarEnrollPhase => {
    if (isAuthenticated && publicKey) return 'connected'
    if (walletStatus === 'in-progress' || authStatus === 'in-progress') return 'verifying'
    if (error) return 'error'
    return 'idle'
  }, [isAuthenticated, publicKey, walletStatus, authStatus, error])

  const login = useCallback(async () => {
    setError(null)
    try {
      await cmLogin()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión con Crossmint.')
    }
  }, [cmLogin])

  const logout = useCallback(async () => {
    lastLoadedBalances = null
    setAssetBalances([])
    setXlmBalance(null)
    setBalancesLoaded(false)
    await cmLogout()
  }, [cmLogout])

  // Compatibilidad con el flujo previo de OTP en pantallas legacy mientras se simplifican
  const sendCode = useCallback(async (_email?: string) => {
    void _email
    await login()
  }, [login])

  const verifyCode = useCallback(async (_code?: string) => {
    void _code
    setNotice(null)
  }, [])

  return {
    ready: authStatus !== 'initializing',
    enabled: Boolean(process.env.NEXT_PUBLIC_CROSSMINT_API_KEY?.trim()),
    authenticated: isAuthenticated,
    wallet,
    publicKey,
    email,
    assetBalances,
    balancesLoaded,
    xlmBalance,
    cetesBalance,
    phase,
    error,
    notice,
    codeSentOnce: false,
    sendCode,
    verifyCode,
    login,
    logout,
    refreshBalance: refreshBalanceNow,
    refreshBalanceAfterTx,
    getClient,
    etherfusePublicKeyHint: publicKey ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}` : null,
  }
}
