'use client'

/*
 * /retiro — ahorro para el retiro en un vault USDC de DeFindex más un adelanto
 * de rendimiento opcional. Ruta aislada: solo Stellar (Pollar), sin Privy ni EVM.
 * El router es estado interno, igual que SeyfApp.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PollarClient } from '@pollar/core'
import { useSeyfStellarWallet } from '@/lib/seyf/use-seyf-stellar-wallet'
import { ensureSeyfSession, sep10DeviceNotEnrolled } from '@/lib/stellar/sep10-client'
import { peekSeyfAuthToken, seyfAuthAccount } from '@/lib/stellar/auth-token'
import { stellarWalletNetworkFromEnv } from '@/lib/stellar/network'
import { Icon } from '@/components/app/ui'
import { usdcIssuer } from './api'
import { useRetiroData } from './useRetiroData'
import EntrarScreen from './EntrarScreen'
import FondearScreen from './FondearScreen'
import AhorroScreen from './AhorroScreen'
import AdelantoScreen from './AdelantoScreen'
import type { RetiroCtx } from './types'

type Tab = 'fondear' | 'ahorro' | 'adelanto'

const TABS: { id: Tab; lb: string; ic: string }[] = [
  { id: 'fondear', lb: 'Fondear', ic: 'recv' },
  { id: 'ahorro', lb: 'Mi ahorro', ic: 'vault' },
  { id: 'adelanto', lb: 'Adelanto', ic: 'bolt' },
]

type SessionState = 'pending' | 'ok' | 'error'

/** Espera el token SEP-10 que abre SeyfAuthBridge; si no llega, deja reintentar. */
export function useSep10(publicKey: string | null, getClient: () => PollarClient) {
  // El estado va atado a la cuenta: si cambia la cuenta, vuelve a "pending" sin otro render.
  const [result, setResult] = useState<{ account: string; state: SessionState } | null>(null)
  const state: SessionState = result && result.account === publicKey ? result.state : 'pending'

  useEffect(() => {
    if (!publicKey) return
    let cancelled = false
    const started = Date.now()
    const tick = () => {
      if (cancelled) return
      if (peekSeyfAuthToken() && seyfAuthAccount() === publicKey) return setResult({ account: publicKey, state: 'ok' })
      // Tras 25 s se ofrece reintentar, pero se sigue esperando: confirmar la firma
      // en el diálogo de Pollar puede tardar más y el token llega después.
      // Si este navegador no es un dispositivo de la wallet, esperar no sirve: avisar ya.
      if (Date.now() - started > 25_000 || sep10DeviceNotEnrolled()) setResult({ account: publicKey, state: 'error' })
      setTimeout(tick, Date.now() - started > 25_000 ? 1_000 : 400)
    }
    const first = setTimeout(tick, 0)
    return () => {
      cancelled = true
      clearTimeout(first)
    }
  }, [publicKey])

  const retry = useCallback(async () => {
    if (!publicKey) return
    setResult({ account: publicKey, state: 'pending' })
    const token = await ensureSeyfSession(getClient(), publicKey)
    setResult({ account: publicKey, state: token ? 'ok' : 'error' })
  }, [publicKey, getClient])

  return { state, retry }
}

export default function RetiroApp() {
  const stellar = useSeyfStellarWallet()
  const publicKey = stellar.authenticated ? stellar.publicKey : null
  const network = stellarWalletNetworkFromEnv()
  const issuer = useMemo(() => usdcIssuer(network), [network])
  const sep10 = useSep10(publicKey, stellar.getClient)
  const [tab, setTab] = useState<Tab>('ahorro')

  if (!stellar.enabled) {
    return (
      <Shell>
        <div className="screen-pad" style={{ paddingTop: 40 }}>
          <div className="alert alert-error">
            Falta configurar Pollar (NEXT_PUBLIC_POLLAR_API_KEY). Sin wallet no se puede entrar.
          </div>
        </div>
      </Shell>
    )
  }

  if (!publicKey) {
    return (
      <Shell>
        <EntrarScreen stellar={stellar} network={network} />
      </Shell>
    )
  }

  return (
    <Shell>
      <Authed
        publicKey={publicKey}
        issuer={issuer}
        network={network}
        stellar={stellar}
        sep10={sep10}
        tab={tab}
        setTab={setTab}
      />
    </Shell>
  )
}

function Authed({
  publicKey,
  issuer,
  network,
  stellar,
  sep10,
  tab,
  setTab,
}: {
  publicKey: string
  issuer: string
  network: 'mainnet' | 'testnet'
  stellar: ReturnType<typeof useSeyfStellarWallet>
  sep10: ReturnType<typeof useSep10>
  tab: Tab
  setTab: (t: Tab) => void
}) {
  const data = useRetiroData(publicKey, issuer, sep10.state === 'ok')
  const ctx: RetiroCtx = {
    publicKey,
    network,
    usdcIssuer: issuer,
    getClient: stellar.getClient,
    data,
    goTo: setTab,
  }

  return (
    <>
      <div className="screen">
        <div className="safe-top" />
        <div className="app-head">
          <div>
            <p className="greet">Ahorro para el retiro{network === 'testnet' ? ' · testnet' : ''}</p>
            <p className="name brand">SEYF Retiro</p>
          </div>
          <button className="icon-btn" aria-label="Salir" onClick={() => void stellar.logout()}>
            <Icon name="logout" size={18} />
          </button>
        </div>

        <div className="screen-pad">
          {sep10.state === 'pending' && (
            <div className="alert alert-info" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="spin" /> Abriendo tu sesión segura…
            </div>
          )}
          {sep10.state === 'error' && (
            <div className="alert alert-error" style={{ marginTop: 0 }}>
              No se pudo abrir la sesión segura (SEP-10), así que no podemos leer ni firmar tu ahorro.
              <button className="btn btn-ghost" style={{ marginTop: 10, padding: 12, fontSize: 'var(--t-sm)' }} onClick={() => void sep10.retry()}>
                Reintentar
              </button>
            </div>
          )}

          <div className="screen-enter" key={tab}>
            {tab === 'fondear' && <FondearScreen ctx={ctx} />}
            {tab === 'ahorro' && <AhorroScreen ctx={ctx} />}
            {tab === 'adelanto' && <AdelantoScreen ctx={ctx} />}
          </div>
        </div>
        <div className="scroll-bottom" />
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.ic} size={24} stroke={tab === t.id ? 2.4 : 2} />
            <span className="lb">{t.lb}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="uto-root style-expresivo">{children}</div>
    </div>
  )
}
