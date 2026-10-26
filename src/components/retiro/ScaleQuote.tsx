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
    <div className="scale-quote">
      <div className="sq-head">
        <p className="eyebrow">Ejemplo a escala</p>
        <span className="sq-badge">Ilustrativo</span>
      </div>
      <div className="sq-flow">
        <div>
          <p className="sq-k">Si tuvieras ahorrado</p>
          <p className="sq-v num">{SCALE_VALUE_USDC.toLocaleString('es-MX')} <small>USDC</small></p>
        </div>
        <span className="sq-arrow" aria-hidden>→</span>
        <div style={{ textAlign: 'right' }}>
          <p className="sq-k">Recibirías hoy</p>
          <p className="sq-v num" style={{ color: 'var(--accent)' }}>
            {advance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>USDC</small>
          </p>
        </div>
      </div>
      <p className="sq-note">
        A {days} {days === 1 ? 'día' : 'días'} y {SCALE_APY_BPS / 100}% anual, con la fórmula del contrato
        (A = V × tasa × días / 365). No es una oferta ni tu monto: en la beta los montos reales son de centavos.
      </p>
    </div>
  )
}
