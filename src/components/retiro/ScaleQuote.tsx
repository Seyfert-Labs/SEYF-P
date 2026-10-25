'use client'

import { scaleAdvance } from './units'

/** Supuestos de la cotización a escala. No vienen de la red: son un ejemplo. */
export const SCALE_VALUE_USDC = 10_000
export const SCALE_APY_BPS = 400

/**
 * Cotización "a escala": la misma fórmula del contrato con un ahorro de 10 000
 * USDC al 4%. Ilustrativa: en la beta los montos reales son centavos.
 */
export default function ScaleQuote({ days }: { days: number }) {
  const advance = scaleAdvance(SCALE_VALUE_USDC, SCALE_APY_BPS, days)
  return (
    <div className="tile" style={{ marginTop: 14, borderStyle: 'dashed' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <p className="eyebrow">Cotización a escala</p>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--txt-dim)', border: '1px solid var(--line)', borderRadius: 999, padding: '2px 7px' }}>
          Ilustrativa
        </span>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 'var(--t-sm)', lineHeight: 1.5 }}>
        Con <b className="num">{SCALE_VALUE_USDC.toLocaleString('es-MX')} USDC</b> a <b className="num">{days} {days === 1 ? 'día' : 'días'}</b> al{' '}
        <b className="num">{SCALE_APY_BPS / 100}%</b> anual, el adelanto sería de{' '}
        <b className="num" style={{ color: 'var(--accent)' }}>{advance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</b>.
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 'var(--t-xxs)', color: 'var(--txt-dim)', lineHeight: 1.5 }}>
        Ejemplo con la fórmula del contrato (A = V × tasa × días / 365). No es una oferta ni tu monto: en la beta los
        montos reales son de centavos.
      </p>
    </div>
  )
}
