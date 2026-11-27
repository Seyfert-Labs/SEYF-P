'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { WalletCtx, type WalletState } from './WalletContext'
import { useSeyfStellarWallet } from '@/lib/seyf/use-seyf-stellar-wallet'
import { store } from '@/lib/store'
import { syncRiskProfile } from '@/components/app/data'

const unsupported = async (): Promise<string> => {
  throw new Error('Operación EVM no disponible: SEYF opera exclusivamente en Stellar.')
}

export default function CrossmintBridge({ children }: { children: React.ReactNode }) {
  const stellar = useSeyfStellarWallet()
  const address = stellar.authenticated ? stellar.publicKey ?? undefined : undefined
  const authenticated = Boolean(address)
  const email = stellar.email

  const usdc = stellar.assetBalances.find((b) => (b.code || '').toUpperCase() === 'USDC')
  const balance = Number(usdc?.balance ?? 0) || 0

  useEffect(() => {
    if (!address) return
    void store.upsertProfile({ wallet: address, email })
    void syncRiskProfile(address)
  }, [address, email])

  const { refreshBalance: refreshStellar, logout: logoutStellar, login: loginStellar } = stellar
  const refreshBalance = useCallback(() => void refreshStellar(), [refreshStellar])
  const logout = useCallback(() => void logoutStellar(), [logoutStellar])
  const login = useCallback(() => void loginStellar(), [loginStellar])

  const value: WalletState = useMemo(
    () => ({
      enabled: stellar.enabled,
      ready: stellar.ready,
      authenticated,
      address,
      gaslessReady: authenticated,
      email,
      name: email?.split('@')[0],
      balance,
      balanceLoading: false,
      balanceError: null,
      login,
      logout,
      refreshBalance,
      sendMXNB: unsupported,
      sendTx: unsupported,
    }),
    [stellar.enabled, stellar.ready, authenticated, address, email, balance, login, logout, refreshBalance],
  )

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}
