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
import '@/components/app/app-v2.css'

/** Plazo de la beta si el contrato no manda sus parámetros. */
const MIN_DAYS = 1
const MAX_DAYS = 30

export default function AdelantoScreen({ ctx }: { ctx: RetiroCtx }) {
  const { data } = ctx
  const { advance, vault, account } = data
  const tx = useTxRunner(data.refresh)
  const decimals = Number(vault.data?.decimals ?? DEFAULT_DECIMALS) || DEFAULT_DECIMALS
  const position = advance.data?.position ?? null

  // Sin título propio: la pestaña, la pantalla o el modal que lo monta ya lo tienen.
  return (
    <>
      {advance.loading && !advance.data && <div className="card"><div className="skel" style={{ height: 80 }} /></div>}
      <ErrorBox error={advance.error} />

      {advance.data && !position && (
        <QuoteAndOpen
          ctx={ctx}
          decimals={decimals}
          treasury={advance.data.treasury !== undefined ? toBigInt(advance.data.treasury) : null}
          run={tx.run}
          busy={tx.busy}
        />
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

      <BetaNote>
        Beta en {ctx.network === 'mainnet' ? 'mainnet' : 'testnet'} con montos bajos y acceso por invitación. El contrato
        aún no está auditado. Tú firmas cada operación y SEYF paga la comisión de red.
      </BetaNote>
    </>
  )
}

function QuoteAndOpen({
  ctx,
  decimals,
  treasury,
  run,
  busy,
}: {
  ctx: RetiroCtx
  decimals: number
  treasury: bigint | null
  run: ReturnType<typeof useTxRunner>['run']
  busy: string | null
}) {
  const vault = ctx.data.vault
  const shares = toBigInt(vault.data?.shares)
  const params = ctx.data.advance.data?.params
  const minDays = params?.minTermDays || MIN_DAYS
  const maxDays = params?.maxTermDays || MAX_DAYS
  const [pickedDays, setDays] = useState(30)
  const days = Math.min(Math.max(pickedDays, minDays), maxDays)
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
  // Los adelantos salen de los fondos del contrato: si no alcanzan, la firma fallaría.
  const noFunds = treasury !== null && adv > treasury

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
        <p style={{ margin: 0, fontWeight: 800 }}>Primero empieza a ahorrar</p>
        <p className="modal-sub" style={{ margin: '6px 0 0' }}>
          El adelanto se calcula sobre lo que tu ahorro va a ganar. Abona a tu bóveda y vuelve aquí.
        </p>
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => ctx.goTo('ahorro')}>
          Ir a Mi ahorro
        </button>
        <ScaleQuote days={30} />
      </div>
    )
  }

  // Atajos de plazo dentro del rango del contrato; usan el mismo `setDays` que la barra.
  const presets = [7, 15, 30].filter((d) => d >= minDays && d <= maxDays)

  return (
    <div className="card adv-quote">
      {/* Monto grande al centro: lo que recibes hoy con el plazo elegido. */}
      <div className="aq-amt">
        <p className="aq-k">Recibes hoy</p>
        <div className="aq-v num">
          {quoting ? <span className="spin" /> : quote ? formatUnits(adv, decimals) : '—'}
          <span className="aq-cur">USDC</span>
        </div>
        <p className="aq-s">Lo que tu ahorro ganaría en {days} {days === 1 ? 'día' : 'días'}, cotizado en vivo</p>
      </div>

      <span className="field-label">Plazo: {days} {days === 1 ? 'día' : 'días'}</span>
      {presets.length > 0 && (
        <div className="aq-presets" role="group" aria-label="Plazos rápidos">
          {presets.map((d) => (
            <button key={d} type="button" className={d === days ? 'on' : undefined} onClick={() => setDays(d)}>
              {d} días
            </button>
          ))}
        </div>
      )}
      <input
        type="range"
        min={minDays}
        max={maxDays}
        step={1}
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 12 }}
        aria-label="Plazo del adelanto en días"
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)' }}>
        <span>{minDays} {minDays === 1 ? 'día' : 'días'}</span>
        <span>{maxDays} días</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <Row label="Ahorro que queda apartado" value={quote ? `${formatUnits(toBigInt(quote.value), decimals)} USDC` : '—'} hint="Sigue rindiendo mientras tanto" />
        <Row label="Tu capital" value="Intacto" hint="Lo recuperas completo al terminar" />
      </div>
      <ErrorBox error={quoteError} />
      {noFunds && (
        <div className="alert alert-info" style={{ marginTop: 12 }}>
          Por ahora no hay fondos suficientes para este adelanto. Prueba con un plazo más corto o vuelve más tarde.
        </div>
      )}

      <button className="btn btn-primary aq-cta" disabled={Boolean(busy) || quoting || !quote || adv <= BigInt(0) || noFunds} onClick={() => void open()}>
        {busy ? <span className="spin" /> : <><Icon name="bolt" size={18} /> Pedir adelanto</>}
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
  const atOpen = toBigInt(p.valueAtOpen)
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
        <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-3)', color: covered ? 'var(--accent)' : 'var(--txt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={covered ? 'check' : 'lock'} size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800 }}>{covered ? 'Tu adelanto ya está cubierto' : 'Adelanto activo'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--t-xs)', color: 'var(--txt-muted)' }}>
            Recibiste <b className="num" style={{ color: 'var(--accent)' }}>{formatUnits(adv, decimals)} USDC</b>
          </p>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', color: 'var(--txt-muted)', marginBottom: 8 }}>
          <span>Tu rendimiento ya cubrió</span>
          <span className="num" style={{ color: 'var(--txt)', fontWeight: 800 }}>{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
        </div>
        <div className="pbar"><span style={{ width: `${pct}%`, background: covered ? 'var(--accent)' : 'var(--accent-2)' }} /></div>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)' }}>
          {covered
            ? 'Ya puedes liberar tu ahorro. Si no lo haces tú, se libera solo en breve.'
            : <>Se libera solo alrededor del {formatDate(toDate(p.expectedUnlockAt))}{missing > BigInt(0) && <> · faltan {formatUnits(missing, decimals)} USDC de rendimiento</>}. La fecha depende del rendimiento real.</>}
        </p>
      </div>

      {covered ? (
        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={Boolean(busy)} onClick={() => void settle()}>
          {busy === 'Adelanto liquidado' ? <span className="spin" /> : 'Liberar mi ahorro'}
        </button>
      ) : (
        <>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} disabled={Boolean(busy) || !canRepay} onClick={() => void repay()}>
            {busy === 'Adelanto repagado' ? <span className="spin" /> : `Repagar ${formatUnits(adv, decimals)} USDC y liberar ya`}
          </button>
          <p style={{ margin: '8px 2px 0', fontSize: 'var(--t-xxs)', color: canRepay ? 'var(--txt-dim)' : 'var(--warning, #E8A838)' }}>
            {canRepay
              ? 'Opcional: si repagas, recuperas tu ahorro completo hoy.'
              : `Para repagar necesitas ${formatUnits(adv, decimals)} USDC en tu cuenta${walletUsdc !== null ? ` (tienes ${formatUnits(walletUsdc, 7)})` : ''}.`}
          </p>
        </>
      )}

      <details className="adv-details" style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--t-xs)', color: 'var(--txt-muted)', fontWeight: 700, padding: '6px 0' }}>Ver detalle</summary>
        <Row label="Valor de tu ahorro hoy" value={valueNow !== null ? `${formatUnits(valueNow, decimals)} USDC` : '—'} />
        <Row label="Valor para liberarlo" value={unlockValue !== null ? `${formatUnits(unlockValue, decimals)} USDC` : '—'} hint="Valor al pedirlo + adelanto" />
        <Row label="Valor al pedirlo" value={`${formatUnits(atOpen, decimals)} USDC`} />
        <Row label="Pedido el" value={<span style={{ fontSize: 'var(--t-xs)' }}>{formatDate(toDate(p.openedAt))}</span>} />
      </details>
    </div>
  )
}

