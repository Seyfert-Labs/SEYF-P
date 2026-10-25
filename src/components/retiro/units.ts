/**
 * Montos en unidades mínimas (strings de enteros, 7 decimales en Stellar).
 * Todo el cálculo va en BigInt: en la beta los montos son centavos y un
 * Number redondearía justo los dígitos que importan.
 */

export const DEFAULT_DECIMALS = 7

export function toBigInt(raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return BigInt(Math.trunc(raw))
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) return BigInt(raw.trim())
  return BigInt(0)
}

/** Unidades mínimas → texto legible. Al menos 2 decimales; más si el monto es chico. */
export function formatUnits(units: bigint, decimals = DEFAULT_DECIMALS, minFrac = 2): string {
  const neg = units < BigInt(0)
  const abs = neg ? -units : units
  const base = BigInt(10) ** BigInt(decimals)
  const int = abs / base
  let frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  if (frac.length < minFrac) frac = frac.padEnd(minFrac, '0')
  const intTxt = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}${intTxt}${frac ? `.${frac}` : ''}`
}

/** Texto del usuario ("1.25") → unidades mínimas. `null` si no es un monto válido. */
export function parseUnits(text: string, decimals = DEFAULT_DECIMALS): bigint | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return null
  const [i, f = ''] = t.split('.')
  if (f.length > decimals) return null
  return BigInt(i || '0') * BigInt(10) ** BigInt(decimals) + BigInt(f.padEnd(decimals, '0') || '0')
}

/** Unidades → Number, solo para la proyección ilustrativa (nunca para firmar). */
export function unitsToNumber(units: bigint, decimals = DEFAULT_DECIMALS): number {
  return Number(units) / 10 ** decimals
}

/**
 * Fórmula del contrato: A = V × apy_bps × días / (10 000 × 365).
 * Solo para la cotización "a escala"; el adelanto real lo cotiza el servidor.
 */
export function scaleAdvance(value: number, apyBps: number, days: number): number {
  return (value * apyBps * days) / (10_000 * 365)
}

/** Fecha de un timestamp del contrato (segundos o milisegundos). */
export function toDate(raw: unknown): Date | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n < 1e12 ? n * 1000 : n)
}

export function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}
