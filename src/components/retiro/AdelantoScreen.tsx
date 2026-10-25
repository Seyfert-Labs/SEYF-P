'use client'

/*
 * Adelanto de rendimiento: cotizar (1–30 días), pedir, ver el bloqueo, repagar
 * y liquidar. El adelanto sale de la tesorería del contrato, nunca del capital:
 * las acciones del vault quedan bloqueadas hasta repagar o hasta que el
 * rendimiento cubra el adelanto (`settle`, que puede llamar cualquiera).
 */
import { useEffect, useState } from 'react'
import { Icon } from '@/components/app/ui'
import { buildSignSubmit, getAdvanceQuote, type AdvanceQuote } from './api'
import { BetaNote, ErrorBox, Row, TxList, useTxRunner } from './parts'
import ScaleQuote from './ScaleQuote'
import { DEFAULT_DECIMALS, formatDate, formatUnits, parseUnits, toBigInt, toDate } from './units'
import type { RetiroCtx } from './types'

const MIN_DAYS = 1
const MAX_DAYS = 30

/** Saldo de la tesorería si la ruta lo manda como número/string o `{ balance }`. */
function treasuryUnits(raw: unknown): bigint | null {
  if (typeof raw === 'string' || typeof raw === 'number') return toBigInt(raw)
  if (raw && typeof raw === 'object' && 'balance' in raw) return toBigInt((raw as { balance: unknown }).balance)
  return null
}

export default function AdelantoScreen({ ctx }: { ctx: RetiroCtx }) {
  const { data } = ctx
  const { advance, vault, account } = data
  const tx = useTxRunner(data.refresh)
  const decimals = Number(vault.data?.decimals ?? DEFAULT_DECIMALS) || DEFAULT_DECIMALS
  const position = advance.data?.position ?? null

  return (
    <>
      <div className="sec-head" style={{ marginTop: 6 }}>
        <h3>Adelanto de rendimiento</h3>
      </div>

      {advance.loading && !advance.data && <div className="card"><div className="skel" style={{ height: 80 }} /></div>}
      <ErrorBox error={advance.error} />

      {advance.data && !position && (
        <QuoteAndOpen ctx={ctx} decimals={decimals} run={tx.run} busy={tx.busy} />
      )}

      {advance.data && position && (
        <OpenPosition
          ctx={ctx}
          decimals={decimals}
          walletUsdc={account.data?.exists ? parseUnits(account.data.usdc, 7) ?? BigInt(0) : null}
          run={tx.run}
          busy={tx.busy}
        />
      )}

      <ErrorBox error={tx.error} />
      <TxList txs={tx.txs} />

      {advance.data && treasuryUnits(advance.data.treasury) !== null && (
        <BetaNote>
          Tesorería del contrato disponible para adelantos: {formatUnits(treasuryUnits(advance.data.treasury) as bigint, decimals)} USDC.
        </BetaNote>
      )}
      <BetaNote>
        Beta en {ctx.network === 'mainnet' ? 'mainnet' : 'testnet'} con topes bajos y lista de permitidos. El contrato no
        está auditado. Firmas tú; SEYF paga la comisión de red.
      </BetaNote>
    </>
  )
}

function QuoteAndOpen({
  ctx,
  decimals,
  run,
  busy,
}: {
  ctx: RetiroCtx
  decimals: number
  run: ReturnType<typeof useTxRunner>['run']
  busy: string | null
}) {
  const vault = ctx.data.vault
  const shares = toBigInt(vault.data?.shares)
  const [days, setDays] = useState(30)
  const [quote, setQuote] = useState<AdvanceQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)

  // Cotiza en el servidor (lee el valor real de las acciones) al cambiar el plazo.
  useEffect(() => {
    if (shares <= BigInt(0)) return
    let cancelled = false
    const t = setTimeout(() => {
      setQuoting(true)
      setQuoteError(null)
      getAdvanceQuote(ctx.publicKey, shares.toString(), days)
        .then((q) => !cancelled && setQuote(q))
        .catch((e: unknown) => {
          if (cancelled) return
          setQuote(null)
          setQuoteError(e instanceof Error ? e.message : 'No se pudo cotizar')
        })
        .finally(() => !cancelled && setQuoting(false))
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [ctx.publicKey, shares, days])

  const adv = quote ? toBigInt(quote.advance) : BigInt(0)

  const open = () =>
    run('Adelanto recibido', async () => {
      if (!quote) throw new Error('Cotiza antes de pedir el adelanto')
      return buildSignSubmit(ctx.getClient(), ctx.publicKey, '/api/advance/build', {
        action: 'open',
        address: ctx.publicKey,
        shares: shares.toString(),
        termDays: days,
        // Lo cotizado es el mínimo: si el contrato fuera a pagar menos, la transacción falla.
        minAdvance: quote.advance,
      })
    })

  if (!vault.data) return <ErrorBox error={vault.error ?? 'Sin datos de tu ahorro todavía.'} />

  if (shares <= BigInt(0)) {
    return (
      <div className="card">
        <p style={{ margin: 0, fontWeight: 800 }}>Primero ahorra en el vault</p>
        <p className="modal-sub" style={{ margin: '6px 0 0' }}>
          El adelanto se calcula sobre tu ahorro: necesitas acciones del vault para pedirlo.
        </p>
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => ctx.goTo('ahorro')}>
          Ir a Mi ahorro
        </button>
        <ScaleQuote days={30} />
      </div>
    )
  }

  return (
    <div className="card">
      <p className="modal-sub" style={{ margin: 0 }}>
        Recibe hoy parte del rendimiento futuro de tu ahorro. Tu capital no se toca, pero tus acciones quedan
        bloqueadas hasta que repagues o hasta que el rendimiento cubra el adelanto.
      </p>

      <span className="field-label">Plazo: {days} {days === 1 ? 'día' : 'días'}</span>
      <input
        type="range"
        min={MIN_DAYS}
        max={MAX_DAYS}
        step={1}
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
        aria-label="Plazo del adelanto en días"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)' }}>
        <span>{MIN_DAYS} día</span>
        <span>{MAX_DAYS} días</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <Row label="Ahorro que se bloquea" value={quote ? `${formatUnits(toBigInt(quote.value), decimals)} USDC` : '—'} hint={`${formatUnits(shares, decimals, 0)} acciones del vault`} />
        <Row
          label="Adelanto que recibes"
          value={quoting ? <span className="spin" /> : quote ? <span style={{ color: 'var(--accent)' }}>{formatUnits(adv, decimals)} USDC</span> : '—'}
          hint="Monto real de la beta, cotizado por el contrato"
        />
      </div>
      <ErrorBox error={quoteError} />

      <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={Boolean(busy) || quoting || !quote || adv <= BigInt(0)} onClick={() => void open()}>
        {busy ? <span className="spin" /> : 'Pedir adelanto'}
      </button>

      <ScaleQuote days={days} />
    </div>
  )
}

function OpenPosition({
  ctx,
  decimals,
  walletUsdc,
  run,
  busy,
}: {
  ctx: RetiroCtx
  decimals: number
  walletUsdc: bigint | null
  run: ReturnType<typeof useTxRunner>['run']
  busy: string | null
}) {
  const advance = ctx.data.advance
  const p = advance.data?.position
  if (!p) return null
  const status = advance.data?.unlockStatus ?? null
  const adv = toBigInt(p.advance)
  const atOpen = toBigInt(p.value_at_open)
  const valueNow = status ? toBigInt(status.valueNow) : null
  const unlockValue = status ? toBigInt(status.unlockValue) : null
  const covered = Boolean(status?.covered)

  // Avance del rendimiento hacia el valor de desbloqueo (V_open → V_open + A).
  let pct = 0
  if (valueNow !== null && unlockValue !== null && unlockValue > atOpen) {
    const num = valueNow - atOpen
    pct = num <= BigInt(0) ? 0 : Number((num * BigInt(10_000)) / (unlockValue - atOpen)) / 100
    if (pct > 100) pct = 100
  }
  if (covered) pct = 100
  const missing = valueNow !== null && unlockValue !== null && unlockValue > valueNow ? unlockValue - valueNow : BigInt(0)
  const canRepay = walletUsdc === null || walletUsdc >= adv

  const repay = () =>
    run('Adelanto repagado', () =>
      buildSignSubmit(ctx.getClient(), ctx.publicKey, '/api/advance/build', { action: 'repay', address: ctx.publicKey }),
    )
  const settle = () =>
    run('Adelanto liquidado', () =>
      buildSignSubmit(ctx.getClient(), ctx.publicKey, '/api/advance/build', { action: 'settle', address: ctx.publicKey }),
    )

  return (
    <div className="card glow">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-2-soft)', color: '#c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800 }}>{covered ? 'Listo para liberar' : 'Ahorro bloqueado'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--t-xs)', color: 'var(--txt-muted)' }}>
            Adelanto de <b className="num" style={{ color: 'var(--accent)' }}>{formatUnits(adv, decimals)} USDC</b>
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)', marginBottom: 6 }}>
          <span>Rendimiento que cubre el adelanto</span>
          <span className="num">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
        </div>
        <div className="pbar"><span style={{ width: `${pct}%`, background: covered ? 'var(--accent)' : 'var(--accent-2)' }} /></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Row label="Valor actual" value={valueNow !== null ? `${formatUnits(valueNow, decimals)} USDC` : '—'} />
        <Row label="Valor de desbloqueo" value={unlockValue !== null ? `${formatUnits(unlockValue, decimals)} USDC` : '—'} hint="Valor al abrir + adelanto" />
        {!covered && missing > BigInt(0) && <Row label="Falta de rendimiento" value={`${formatUnits(missing, decimals)} USDC`} />}
        <Row label="Valor al abrir" value={`${formatUnits(atOpen, decimals)} USDC`} hint={`${formatUnits(toBigInt(p.shares), decimals, 0)} acciones bloqueadas`} />
        <Row label="Abierto" value={<span style={{ fontSize: 'var(--t-xs)' }}>{formatDate(toDate(p.opened_at))}</span>} />
        <Row label="Desbloqueo estimado" value={<span style={{ fontSize: 'var(--t-xs)' }}>{formatDate(toDate(p.expected_unlock_at))}</span>} hint="Depende del rendimiento real" />
      </div>

      <span className="field-label">Repagar y desbloquear todo</span>
      <p className="modal-sub" style={{ margin: 0 }}>
        Devuelves {formatUnits(adv, decimals)} USDC y recuperas todas tus acciones.
        {walletUsdc !== null && ` Tienes ${formatUnits(walletUsdc, 7)} USDC en tu cuenta.`}
      </p>
      {!canRepay && <div className="alert alert-info">Te faltan USDC en tu cuenta para repagar el adelanto completo.</div>}
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={Boolean(busy) || !canRepay} onClick={() => void repay()}>
        {busy === 'Adelanto repagado' ? <span className="spin" /> : 'Repagar'}
      </button>

      <span className="field-label">Liquidar</span>
      <p className="modal-sub" style={{ margin: 0 }}>
        Cuando el rendimiento cubre el adelanto, el contrato retira solo las acciones que valen{' '}
        {formatUnits(adv, decimals)} USDC hacia la tesorería y te devuelve el resto. Un proceso automático lo hace
        solo; también puedes hacerlo tú.
      </p>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={Boolean(busy) || !covered} onClick={() => void settle()}>
        {busy === 'Adelanto liquidado' ? <span className="spin" /> : covered ? 'Liquidar ahora' : 'Liquidar (aún no cubierto)'}
      </button>
    </div>
  )
}

