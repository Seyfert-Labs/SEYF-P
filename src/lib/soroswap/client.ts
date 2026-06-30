import 'server-only'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'

// ============================================================
// Cliente server-side para la API de Soroswap (AMM Stellar/Soroban).
// La API key (`sk_...`) JAMÁS se expone al navegador — vive solo aquí, detrás de
// los route handlers /api/soroswap/*, igual que DEFINDEX_API_KEY / Bitso.
// Flujo: /quote (cotiza) → /quote/build (XDR sin firmar) → [firma Pollar] → /send.
// Docs: https://api.soroswap.finance/docs
// ============================================================

export const SOROSWAP_BASE_URL =
  process.env.SOROSWAP_BASE_URL?.replace(/\/$/, '') || 'https://api.soroswap.finance'

/** Red Soroswap alineada con la red de la wallet Pollar (testnet por defecto). */
export function soroswapNetwork(): 'testnet' | 'mainnet' {
  return isPublicStellarTestnet() ? 'testnet' : 'mainnet'
}

export class SoroswapApiError extends Error {
  status: number
  payload: unknown
  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'SoroswapApiError'
    this.status = status
    this.payload = payload
  }
}

function apiKey(): string {
  const key = process.env.SOROSWAP_API_KEY?.trim()
  if (!key) throw new SoroswapApiError('Falta SOROSWAP_API_KEY en el servidor.', 500, null)
  return key
}

async function soroswapRequest<T = unknown>(
  path: string,
  body: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const url = `${SOROSWAP_BASE_URL}${path}?network=${soroswapNetwork()}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    throw new SoroswapApiError(
      `No se pudo conectar con Soroswap (${e instanceof Error ? e.message : 'error de red'}).`,
      504,
      { cause: String(e) },
    )
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg =
      (raw?.message as string) ||
      (typeof raw?.error === 'string' ? (raw.error as string) : '') ||
      `Soroswap respondió HTTP ${res.status}`
    throw new SoroswapApiError(msg, res.status, raw)
  }
  return raw as T
}

export interface SoroswapQuoteInput {
  assetIn: string
  assetOut: string
  /** Monto en stroops (entero, 7 decimales). */
  amount: string
  tradeType?: 'EXACT_IN' | 'EXACT_OUT'
  slippageBps?: number
}

/** Cotización opaca de Soroswap; se reenvía tal cual a /quote/build. */
export type SoroswapQuote = Record<string, unknown> & { amountOut?: string | number }

// `sdex` se excluye a propósito: la wallet Pollar es una smart wallet (Soroban),
// y la doc oficial indica omitir sdex para smart wallets. Solo AMMs Soroban.
const DEFAULT_PROTOCOLS = ['soroswap', 'phoenix', 'aqua']

/** POST /quote — cotiza un swap. */
export function soroswapQuote(input: SoroswapQuoteInput): Promise<SoroswapQuote> {
  return soroswapRequest<SoroswapQuote>('/quote', {
    assetIn: input.assetIn,
    assetOut: input.assetOut,
    amount: input.amount,
    tradeType: input.tradeType ?? 'EXACT_IN',
    protocols: DEFAULT_PROTOCOLS,
    slippageBps: input.slippageBps ?? 50, // 50 bps = 0.5 %
    // Crea automáticamente el trustline del activo de salida si la wallet no lo tiene.
    gaslessTrustline: 'create',
  })
}

/** POST /quote/build — construye el XDR (sin firmar) a partir de una cotización. */
export function soroswapBuild(
  quote: SoroswapQuote,
  from: string,
  to?: string,
): Promise<{ xdr: string }> {
  return soroswapRequest<{ xdr: string }>('/quote/build', {
    quote,
    from,
    to: to ?? from,
  })
}

/** POST /send — reenvía a la red el XDR ya firmado por Pollar. */
export function soroswapSend(xdr: string): Promise<Record<string, unknown>> {
  return soroswapRequest<Record<string, unknown>>('/send', { xdr })
}
