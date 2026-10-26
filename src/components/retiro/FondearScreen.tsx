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
import '@/components/app/app-v2.css'

/** Pasos 1·2·3 en horizontal: hecho (lima), actual (anillo) o pendiente. */
function Steps({ done }: { done: [boolean, boolean, boolean] }) {
  const labels = ['Tu cuenta', 'Habilitar USDC', 'Recibir']
  const current = done.findIndex((d) => !d)
  return (
    <div className="fund-steps">
      {labels.map((lb, i) => (
        <div key={lb} className={`fund-step${done[i] ? ' done' : i === current ? ' now' : ''}`}>
          <span className="dot">{done[i] ? <Icon name="check" size={15} /> : i + 1}</span>
          <span className="lb">{lb}</span>
        </div>
      ))}
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

  const ready = exists && Boolean(trust)
  const hasUsdc = usdc !== null && Number(usdc) > 0

  return (
    <>
      <div className="card" style={{ padding: '18px 14px' }}>
        <Steps done={[exists, Boolean(trust), hasUsdc]} />

        {account.loading && !account.data && (
          <p className="modal-sub" style={{ margin: '14px 0 0', textAlign: 'center' }}>Revisando tu cuenta…</p>
        )}
        {account.data && !ready && (
          <>
            <p className="modal-sub" style={{ margin: '16px 4px 0', textAlign: 'center' }}>
              {!exists
                ? 'Creamos tu cuenta en Stellar y la dejamos lista para recibir USDC. Es gratis: SEYF paga la reserva y la comisión.'
                : 'Un solo paso más: habilita USDC en tu cuenta. SEYF paga la reserva y la comisión.'}
            </p>
            <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={Boolean(tx.busy)} onClick={() => void activate()}>
              {tx.busy ? <span className="spin" /> : !exists ? 'Crear mi cuenta gratis' : 'Habilitar USDC'}
            </button>
          </>
        )}
        <ErrorBox error={account.error} />
        <ErrorBox error={tx.error} />
        <TxList txs={tx.txs} />
      </div>

      {hasUsdc && (
        <div className="fund-bal">
          <Icon name="check" size={20} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--t-xs)', color: 'var(--txt-muted)', fontWeight: 700 }}>Ya tienes en tu cuenta</p>
            <p className="num" style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 'var(--t-md)' }}>{usdc} USDC</p>
          </div>
          <button className="chip" style={{ background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' }} onClick={() => ctx.goTo('ahorro')}>
            Ahorrar <Icon name="arrowR" size={14} />
          </button>
        </div>
      )}

      <div className="fund-qr" style={{ opacity: ready || !account.data ? 1 : 0.55 }}>
        <p className="eyebrow" style={{ color: '#9db4ff' }}>Tu dirección para recibir USDC</p>
        <div style={{ marginTop: 14 }}>
          <AddressQr value={publicKey} size={176} />
        </div>
        <div className="addr num" title={publicKey}>
          {publicKey.slice(0, 6)}…{publicKey.slice(-6)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-primary" style={{ padding: 13, fontSize: 'var(--t-sm)' }} onClick={() => void copy()}>
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? '¡Copiada!' : 'Copiar dirección'}
          </button>
          <a
            className="btn btn-ghost"
            style={{ padding: 13, fontSize: 'var(--t-sm)', textDecoration: 'none', width: 'auto', flexShrink: 0 }}
            href={stellarAccountExplorerUrl(publicKey, network) ?? '#'}
            target="_blank"
            rel="noreferrer"
            aria-label="Ver en la red"
          >
            <Icon name="globe" size={16} />
          </a>
        </div>
      </div>

      <div className="fund-howto">
        <p className="eyebrow" style={{ marginBottom: 2 }}>Cómo enviarlo desde tu exchange</p>
        <div><span className="n">1</span><span>Elige <b>USDC</b> para retirar.</span></div>
        <div><span className="n">2</span><span>Como red, selecciona <b>Stellar</b>{network === 'testnet' ? ' (testnet)' : ''}.</span></div>
        <div><span className="n">3</span><span>Pega tu dirección y deja el <b>memo vacío</b>.</span></div>
      </div>
      <BetaNote>Envía solo USDC por la red Stellar: esta dirección es solo tuya.</BetaNote>
    </>
  )
}
