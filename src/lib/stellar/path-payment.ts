import 'server-only'
import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'
import { toStroops } from '@/lib/soroswap/assets'

/** USDC de Circle en Stellar testnet (activo clásico, liquidez en SDEX). */
export const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export type SdexSwapCode = 'XLM' | 'USDC'

export type SdexPathQuote = {
  _provider: 'sdex'
  from: SdexSwapCode
  to: SdexSwapCode
  amountIn: string
  amountOut: string
  sendAsset: 'native' | { code: string; issuer: string }
  destAsset: 'native' | { code: string; issuer: string }
  path: Array<'native' | { code: string; issuer: string }>
  slippageBps: number
}

function networkConfig() {
  if (isPublicStellarTestnet()) {
    return {
      passphrase: Networks.TESTNET,
      horizonUrl: 'https://horizon-testnet.stellar.org',
    }
  }
  return {
    passphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
  }
}

function horizonServer() {
  return new Horizon.Server(networkConfig().horizonUrl)
}

function usdcAsset(): Asset {
  const issuer =
    process.env.STELLAR_USDC_ISSUER?.trim() ||
    (isPublicStellarTestnet() ? USDC_ISSUER_TESTNET : '')
  if (!issuer) throw new Error('Falta STELLAR_USDC_ISSUER para mainnet')
  return new Asset('USDC', issuer)
}

function assetFromHorizon(
  rec: { asset_type: string; asset_code?: string; asset_issuer?: string },
): Asset {
  if (rec.asset_type === 'native') return Asset.native()
  if (!rec.asset_code || !rec.asset_issuer) throw new Error('Activo de ruta inválido')
  return new Asset(rec.asset_code, rec.asset_issuer)
}

function serializeAsset(asset: Asset): SdexPathQuote['sendAsset'] {
  if (asset.isNative()) return 'native'
  return { code: asset.getCode(), issuer: asset.getIssuer() }
}

function deserializeAsset(a: SdexPathQuote['sendAsset']): Asset {
  if (a === 'native') return Asset.native()
  return new Asset(a.code, a.issuer)
}

/** Horizon devuelve montos de path con 7 decimales implícitos (ej. 49498600 = 4.9498600 USDC). */
export function horizonAmountToHuman(raw: string | number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n >= 1_000_000) return n / 1e7
  return n
}

function destMinHuman(amountOut: string, slippageBps: number): string {
  const human = horizonAmountToHuman(amountOut)
  if (human <= 0) return '0.0000001'
  const min = human * (1 - slippageBps / 10_000)
  return Math.max(min, 0.0000001).toFixed(7)
}

export function isSdexSwapPair(from: string, to: string): boolean {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  return (f === 'XLM' && t === 'USDC') || (f === 'USDC' && t === 'XLM')
}

export function isNoPathSoroswapError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('no path found') || m.includes('path not found') || m.includes('quote failed')
}

async function fetchBestPath(
  from: SdexSwapCode,
  to: SdexSwapCode,
  amountHuman: number,
) {
  const server = horizonServer()
  const sendAsset = from === 'XLM' ? Asset.native() : usdcAsset()
  const destAsset = to === 'XLM' ? Asset.native() : usdcAsset()
  const amount = toStroops(amountHuman)
  const paths = await server.strictSendPaths(sendAsset, amount, [destAsset]).call()
  const best = paths.records?.[0]
  if (!best?.destination_amount) {
    throw new Error('No hay ruta SDEX para este par. Prueba con un monto menor.')
  }
  const path = (best.path ?? []).map((p) => serializeAsset(assetFromHorizon(p)))
  return { best, path, sendAsset, destAsset }
}

/** Cotiza XLM↔USDC vía SDEX (Horizon path payment). */
export async function quoteSdexPathPayment(
  from: SdexSwapCode,
  to: SdexSwapCode,
  amountHuman: number,
  slippageBps = 50,
): Promise<{ quote: SdexPathQuote; amountOut: number }> {
  const { best, path } = await fetchBestPath(from, to, amountHuman)

  const quote: SdexPathQuote = {
    _provider: 'sdex',
    from,
    to,
    amountIn: toStroops(amountHuman),
    amountOut: best.destination_amount,
    sendAsset: serializeAsset(from === 'XLM' ? Asset.native() : usdcAsset()),
    destAsset: serializeAsset(to === 'XLM' ? Asset.native() : usdcAsset()),
    path,
    slippageBps,
  }

  return { quote, amountOut: horizonAmountToHuman(best.destination_amount) }
}

export async function hasUsdcTrustline(publicKey: string): Promise<boolean> {
  const server = horizonServer()
  try {
    const account = await server.loadAccount(publicKey)
    const usdc = usdcAsset()
    const wantIssuer = usdc.getIssuer().toUpperCase()
    return account.balances.some(
      (b) =>
        'asset_code' in b &&
        'asset_issuer' in b &&
        String(b.asset_code).toUpperCase() === 'USDC' &&
        String(b.asset_issuer).toUpperCase() === wantIssuer,
    )
  } catch {
    return false
  }
}

/** Construye XDR sin firmar; re-cotiza la ruta al instante del build. */
export async function buildSdexPathPaymentXdr(
  publicKey: string,
  quote: SdexPathQuote,
): Promise<string> {
  const { passphrase } = networkConfig()
  const server = horizonServer()
  const account = await server.loadAccount(publicKey)

  const amountHuman = Number(quote.amountIn) / 1e7
  const { path } = await fetchBestPath(quote.from, quote.to, amountHuman)

  const sendAsset = deserializeAsset(quote.sendAsset)
  const destAsset = deserializeAsset(quote.destAsset)
  const sendAmountFixed = amountHuman.toFixed(7)
  const destMin = destMinHuman(quote.amountOut, quote.slippageBps)

  const opCount = quote.to === 'USDC' && !(await hasUsdcTrustline(publicKey)) ? 2 : 1
  const fee = String(Number(BASE_FEE) * Math.max(opCount, 1))

  let builder = new TransactionBuilder(account, {
    fee,
    networkPassphrase: passphrase,
  })

  if (quote.to === 'USDC' && !(await hasUsdcTrustline(publicKey))) {
    builder = builder.addOperation(Operation.changeTrust({ asset: usdcAsset() }))
  }

  const tx = builder
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount: sendAmountFixed,
        destination: publicKey,
        destAsset,
        destMin,
        path: path.map(deserializeAsset),
      }),
    )
    .setTimeout(120)
    .build()

  return tx.toXDR()
}

function horizonSubmitError(e: unknown): string {
  const err = e as {
    response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } }
    message?: string
  }
  const codes = err.response?.data?.extras?.result_codes
  const tx = codes?.transaction
  const op = codes?.operations?.join(', ')
  if (tx || op) {
    const map: Record<string, string> = {
      op_under_dest_min: 'El precio cambió demasiado rápido. Intenta de nuevo con un monto menor.',
      op_underfunded: 'Saldo insuficiente para completar el cambio.',
      op_no_trust: 'Tu cuenta no tiene trustline para USDC. Intenta de nuevo.',
      tx_insufficient_fee: 'Comisión de red insuficiente. Intenta de nuevo.',
    }
    const key = op?.split(', ')[0] ?? tx ?? ''
    if (map[key]) return map[key]
    return `Stellar rechazó la transacción (${[tx, op].filter(Boolean).join(' / ')}).`
  }
  return e instanceof Error ? e.message : 'No se pudo enviar la transacción'
}

/** Envía un XDR firmado a Horizon (transacciones clásicas / SDEX). */
export async function submitSignedStellarXdr(signedXdr: string): Promise<string> {
  const { passphrase } = networkConfig()
  const server = horizonServer()
  const tx = TransactionBuilder.fromXDR(signedXdr, passphrase)
  try {
    const result = await server.submitTransaction(tx)
    return result.hash
  } catch (e) {
    throw new Error(horizonSubmitError(e))
  }
}

export function isSdexQuote(quote: Record<string, unknown>): quote is SdexPathQuote & Record<string, unknown> {
  return quote._provider === 'sdex'
}

export function inferSwapProvider(
  provider: string | undefined,
  quote?: Record<string, unknown>,
): 'sdex' | 'soroswap' {
  if (provider === 'sdex' || provider === 'soroswap') return provider
  if (quote && isSdexQuote(quote)) return 'sdex'
  return 'soroswap'
}
