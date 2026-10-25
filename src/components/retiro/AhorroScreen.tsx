'use client'

/*
 * Mi ahorro: posición en el vault USDC (saldo y rendimiento observados en la
 * red), depositar, retirar y la proyección ilustrativa al retiro.
 */
import { useEffect, useMemo, useState } from 'react'
import { ProjectionCard } from '@/components/app/ProjectionCard'
import { Icon } from '@/components/app/ui'
import { buildSignSubmit } from './api'
import { BetaNote, ErrorBox, Row, TxList, useTxRunner } from './parts'
import ScaleQuote, { SCALE_APY_BPS } from './ScaleQuote'
import { DEFAULT_DECIMALS, formatDate, formatUnits, parseUnits, toBigInt, unitsToNumber } from './units'
import type { RetiroCtx } from './types'

/** Escala del precio por acción guardado: evita perder precisión al dividir. */
const PPS_SCALE = BigInt(10) ** BigInt(18)

type PpsSnapshot = { pps: string; t: number }

/**
 * Rendimiento observado: guardamos el precio por acción la primera vez que lo
 * vemos en este dispositivo y lo comparamos con el actual. Es dato de la red,
 * no una tasa supuesta; se aclara en pantalla desde cuándo se mide.
 */
function useObservedYield(publicKey: string, shares: bigint, value: bigint) {
  const [snap, setSnap] = useState<PpsSnapshot | null>(null)
  const key = `seyf-retiro-pps:${publicKey}`

  useEffect(() => {
    if (shares <= BigInt(0)) return
    const ppsNow = (value * PPS_SCALE) / shares
    try {
      const raw = localStorage.getItem(key)
      const prev = raw ? (JSON.parse(raw) as PpsSnapshot) : null
      if (prev?.pps && /^\d+$/.test(prev.pps)) {
        setSnap(prev)
      } else {
        const fresh = { pps: ppsNow.toString(), t: Date.now() }
        localStorage.setItem(key, JSON.stringify(fresh))
        setSnap(fresh)
      }
    } catch {
      /* sin localStorage no hay referencia; simplemente no se muestra */
    }
  }, [key, shares, value])

  if (!snap || shares <= BigInt(0)) return null
  const ppsNow = (value * PPS_SCALE) / shares
  const gain = (shares * (ppsNow - BigInt(snap.pps))) / PPS_SCALE
  return { gain, since: new Date(snap.t) }
}

export default function AhorroScreen({ ctx }: { ctx: RetiroCtx }) {
  const { publicKey, getClient, data } = ctx
  const { vault, account, advance } = data
  const tx = useTxRunner(data.refresh)
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')

  const decimals = Number(vault.data?.decimals ?? DEFAULT_DECIMALS) || DEFAULT_DECIMALS
  const shares = toBigInt(vault.data?.shares)
  const value = toBigInt(vault.data?.value)
  const walletUsdc = account.data?.exists ? parseUnits(account.data.usdc, 7) ?? BigInt(0) : BigInt(0)
  const hasTrustline = account.data?.exists === true && account.data.usdcTrustline
  const locked = advance.data?.position ? toBigInt(advance.data.position.shares) : BigInt(0)
  const observed = useObservedYield(publicKey, shares, value)

  const parsed = parseUnits(amount, decimals)
  // Retiro por monto: acciones = monto × acciones / valor, hacia abajo para no pasarse.
  const withdrawShares = useMemo(() => {
    if (!parsed || value <= BigInt(0)) return BigInt(0)
    const s = (parsed * shares) / value
    return s > shares ? shares : s
  }, [parsed, shares, value])

  const max = mode === 'deposit' ? walletUsdc : value
  const tooMuch = parsed !== null && parsed > max
  const canSubmit =
    !tx.busy && parsed !== null && parsed > BigInt(0) && !tooMuch && (mode === 'deposit' ? hasTrustline : withdrawShares > BigInt(0))

  const submit = () =>
    tx.run(mode === 'deposit' ? 'Depósito al vault' : 'Retiro del vault', async () => {
      if (!parsed) throw new Error('Monto inválido')
      const body =
        mode === 'deposit'
          ? { action: 'deposit' as const, address: publicKey, amount: parsed.toString() }
          : {
              action: 'withdraw' as const,
              address: publicKey,
              // Si pide todo el saldo, retira todas las acciones (sin residuo por redondeo).
              shares: (parsed === value ? shares : withdrawShares).toString(),
            }
      const hash = await buildSignSubmit(getClient(), publicKey, '/api/vault/build', body)
      setAmount('')
      return hash
    })

  return (
    <>
      <div className="card glow" style={{ marginTop: 6 }}>
        <div className="hero-bal">
          <div className="lbl">
            <Icon name="vault" size={16} color="var(--txt-muted)" />
            <p className="eyebrow">Tu ahorro en el vault USDC</p>
          </div>
          {vault.loading && !vault.data ? (
            <div className="skel" style={{ height: 44, width: '70%', marginTop: 12 }} />
          ) : vault.data ? (
            <p className="amount num" style={{ fontSize: 38 }}>
              {formatUnits(value, decimals)}
              <span className="cur">USDC</span>
            </p>
          ) : null}
        </div>
        <ErrorBox error={vault.error} />

        {vault.data && (
          <div style={{ marginTop: 10 }}>
            <Row label="Acciones del vault" value={formatUnits(shares, decimals, 0)} />
            {locked > BigInt(0) && (
              <Row label="Bloqueadas por tu adelanto" value={formatUnits(locked, decimals, 0)} hint="Siguen rindiendo; se liberan al repagar o liquidar" />
            )}
            {observed && (
              <Row
                label="Rendimiento observado"
                value={<span style={{ color: observed.gain >= BigInt(0) ? 'var(--accent)' : 'var(--neg)' }}>{observed.gain >= BigInt(0) ? '+' : ''}{formatUnits(observed.gain, decimals)} USDC</span>}
                hint={`De tus acciones actuales desde ${formatDate(observed.since)} (medido en este dispositivo)`}
              />
            )}
            <Row label="USDC en tu cuenta" value={account.data?.exists ? `${formatUnits(walletUsdc, 7)} USDC` : '—'} hint="Disponible para depositar" />
          </div>
        )}
      </div>

      <div className="sec-head">
        <h3>Mover mi ahorro</h3>
      </div>
      <div className="card">
        <div className="seg">
          <button className={mode === 'deposit' ? 'on' : ''} onClick={() => { setMode('deposit'); setAmount('') }}>Depositar</button>
          <button className={mode === 'withdraw' ? 'on' : ''} onClick={() => { setMode('withdraw'); setAmount('') }}>Retirar</button>
        </div>

        <span className="field-label">Monto en USDC</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input num-input"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            className="chip"
            style={{ flexShrink: 0 }}
            disabled={max <= BigInt(0)}
            onClick={() => setAmount(formatUnits(max, decimals, 0).replace(/,/g, ''))}
          >
            Todo
          </button>
        </div>
        <p style={{ margin: '8px 2px 0', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)' }}>
          {mode === 'deposit'
            ? `Disponible: ${formatUnits(walletUsdc, 7)} USDC`
            : `Disponible: ${formatUnits(value, decimals)} USDC${parsed ? ` · ${formatUnits(parsed === value ? shares : withdrawShares, decimals, 0)} acciones` : ''}`}
        </p>
        {tooMuch && <div className="alert alert-error">Es más de lo que tienes disponible.</div>}
        {mode === 'deposit' && account.data && !hasTrustline && (
          <div className="alert alert-info">
            Primero habilita USDC en tu cuenta.{' '}
            <button className="chip" style={{ marginLeft: 6 }} onClick={() => ctx.goTo('fondear')}>Ir a Fondear</button>
          </div>
        )}
        {mode === 'withdraw' && locked > BigInt(0) && (
          <div className="alert alert-info">Las acciones bloqueadas por tu adelanto no se pueden retirar hasta repagar o liquidar.</div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!canSubmit} onClick={() => void submit()}>
          {tx.busy ? <span className="spin" /> : mode === 'deposit' ? 'Depositar' : 'Retirar'}
        </button>
        <ErrorBox error={tx.error} />
        <TxList txs={tx.txs} />
        <BetaNote>Tú firmas cada operación con tu wallet; SEYF paga la comisión de red. El servidor nunca guarda tus fondos.</BetaNote>
      </div>

      <div className="sec-head">
        <h3>Proyección al retiro</h3>
      </div>
      <ProjectionCard current={unitsToNumber(value, decimals)} monthly={100} apy={SCALE_APY_BPS / 100} />
      <BetaNote>
        La proyección supone un {SCALE_APY_BPS / 100}% anual y aportes mensuales que tú eliges. Es ilustrativa: el
        rendimiento real del vault cambia y no está garantizado.
      </BetaNote>

      <ScaleQuote days={30} />
    </>
  )
}
