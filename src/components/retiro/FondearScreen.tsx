'use client'

/*
 * Fondear: la cuenta (la crea Pollar o nuestro sponsor), la línea de USDC
 * patrocinada y la dirección G con QR para recibir USDC desde un exchange.
 */
import { useState } from 'react'
import { stellarAccountExplorerUrl } from '@/lib/etherfuse/stellar-tx-url'
import { Icon } from '@/components/app/ui'
import { sponsorCreateAccount, sponsorTrustline } from './api'
import AddressQr from './AddressQr'
import { BetaNote, ErrorBox, TxList, useTxRunner } from './parts'
import type { RetiroCtx } from './types'

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <span
        style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: done ? 'var(--accent)' : 'var(--surface-3)', color: done ? 'var(--on-accent)' : 'var(--txt-muted)',
          fontWeight: 800, fontSize: 13,
        }}
      >
        {done ? <Icon name="check" size={16} /> : n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 'var(--t-sm)' }}>{title}</p>
        {children}
      </div>
    </div>
  )
}

export default function FondearScreen({ ctx }: { ctx: RetiroCtx }) {
  const { publicKey, getClient, data, usdcIssuer, network } = ctx
  const account = data.account
  const tx = useTxRunner(data.refresh)
  const [copied, setCopied] = useState(false)

  const exists = account.data?.exists === true
  const trust = account.data?.exists === true && account.data.usdcTrustline
  const usdc = account.data?.exists === true ? account.data.usdc : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* el portapapeles puede estar bloqueado; la dirección sigue visible */
    }
  }

  const activate = () =>
    tx.run('Cuenta y línea de USDC', async () => {
      const client = getClient()
      let lastHash: string | null = null
      if (!exists) lastHash = await sponsorCreateAccount(client, publicKey)
      if (!trust) lastHash = await sponsorTrustline(client, publicKey, 'USDC', usdcIssuer)
      return lastHash
    })

  return (
    <>
      <div className="sec-head" style={{ marginTop: 6 }}>
        <h3>Fondea tu ahorro</h3>
      </div>

      <div className="card">
        <Step n={1} done={exists} title="Tu cuenta en Stellar">
          <p className="modal-sub" style={{ margin: '2px 0 0' }}>
            {account.loading && !account.data ? 'Revisando…' : exists ? 'Lista.' : 'Aún no existe en la red. La creamos sin costo para ti.'}
          </p>
        </Step>
        <Step n={2} done={Boolean(trust)} title="Habilitar USDC">
          <p className="modal-sub" style={{ margin: '2px 0 0' }}>
            {trust ? 'Tu cuenta ya puede recibir USDC.' : 'Una sola vez. SEYF paga la reserva y la comisión.'}
          </p>
        </Step>
        <Step n={3} done={usdc !== null && Number(usdc) > 0} title="Recibir USDC">
          <p className="modal-sub" style={{ margin: '2px 0 0' }}>
            {usdc !== null ? (
              <>
                En tu cuenta: <b className="num" style={{ color: 'var(--txt)' }}>{usdc} USDC</b>
              </>
            ) : (
              'Envía USDC por la red Stellar a tu dirección.'
            )}
          </p>
        </Step>

        {account.data && (!exists || !trust) && (
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={Boolean(tx.busy)} onClick={() => void activate()}>
            {tx.busy ? <span className="spin" /> : !exists ? 'Crear cuenta y habilitar USDC' : 'Habilitar USDC'}
          </button>
        )}
        <ErrorBox error={account.error} />
        <ErrorBox error={tx.error} />
        <TxList txs={tx.txs} />
      </div>

      <div className="sec-head">
        <h3>Tu dirección para recibir USDC</h3>
      </div>
      <div className="card" style={{ textAlign: 'center' }}>
        <AddressQr value={publicKey} />
        <p className="num" style={{ wordBreak: 'break-all', fontSize: 'var(--t-xs)', margin: '14px 0 0', color: 'var(--txt)' }}>
          {publicKey}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost" style={{ padding: 12, fontSize: 'var(--t-sm)' }} onClick={() => void copy()}>
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copiada' : 'Copiar'}
          </button>
          <a
            className="btn btn-ghost"
            style={{ padding: 12, fontSize: 'var(--t-sm)', textDecoration: 'none' }}
            href={stellarAccountExplorerUrl(publicKey, network) ?? '#'}
            target="_blank"
            rel="noreferrer"
          >
            Ver en la red <Icon name="arrowR" size={14} />
          </a>
        </div>
        <BetaNote>
          Envía solo USDC por la red Stellar{network === 'testnet' ? ' de pruebas (testnet)' : ''}. Si tu exchange pide
          memo, déjalo vacío: esta dirección es solo tuya.
        </BetaNote>
      </div>

      {usdc !== null && Number(usdc) > 0 && (
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => ctx.goTo('ahorro')}>
          Ahorrar mis USDC <Icon name="arrowR" size={18} />
        </button>
      )}
    </>
  )
}
