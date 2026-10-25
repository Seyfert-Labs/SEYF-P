'use client'

/* Piezas chicas compartidas por las pantallas de /retiro. */
import { useCallback, useState, type ReactNode } from 'react'
import { stellarTxExplorerUrl } from '@/lib/etherfuse/stellar-tx-url'
import { stellarWalletNetworkFromEnv } from '@/lib/stellar/network'
import { Icon } from '@/components/app/ui'

export type TxRecord = { label: string; hash: string }

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return <div className="alert alert-error">{error}</div>
}

export function TxList({ txs }: { txs: TxRecord[] }) {
  if (txs.length === 0) return null
  const network = stellarWalletNetworkFromEnv()
  return (
    <div className="alert alert-ok" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {txs.map((t) => (
        <a
          key={t.hash}
          href={stellarTxExplorerUrl(t.hash, network) ?? '#'}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <Icon name="check" size={16} />
          <span style={{ flex: 1, minWidth: 0 }}>
            {t.label} ·{' '}
            <span className="num" style={{ textDecoration: 'underline' }}>
              {t.hash.slice(0, 8)}…{t.hash.slice(-6)}
            </span>
          </span>
          <Icon name="arrowR" size={14} />
        </a>
      ))}
    </div>
  )
}

export function Row({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="lrow" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <div className="mid" style={{ flex: 1, minWidth: 0 }}>
        <p className="ti" style={{ margin: 0, fontSize: 'var(--t-xs)', color: 'var(--txt-muted)', fontWeight: 700 }}>{label}</p>
        {hint && <p className="su" style={{ margin: '2px 0 0', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)' }}>{hint}</p>}
      </div>
      <div className="num" style={{ fontWeight: 800, fontSize: 'var(--t-sm)', textAlign: 'right' }}>{value}</div>
    </div>
  )
}

export function BetaNote({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: '10px 2px 0', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)', lineHeight: 1.5 }}>{children}</p>
  )
}

/**
 * Ejecuta una acción que firma y envía, guardando el hash o el error.
 * Una sola acción a la vez por pantalla: evita firmar dos veces por doble clic.
 */
export function useTxRunner(onDone?: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txs, setTxs] = useState<TxRecord[]>([])

  const run = useCallback(
    async (label: string, fn: () => Promise<string | null>) => {
      if (busy) return
      setBusy(label)
      setError(null)
      try {
        const hash = await fn()
        if (hash) setTxs((prev) => [{ label, hash }, ...prev])
        onDone?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'La operación falló')
      } finally {
        setBusy(null)
      }
    },
    [busy, onDone],
  )

  return { busy, error, txs, run, setError }
}
