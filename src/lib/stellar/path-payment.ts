import 'server-only'
import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'
import { toStroops, fromStroops } from '@/lib/soroswap/assets'

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

export function isSdexSwapPair(from: string, to: string): boolean {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  return (f === 'XLM' && t === 'USDC') || (f === 'USDC' && t === 'XLM')
}

export function isNoPathSoroswapError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('no path found') || m.includes('path not found') || m.includes('quote failed')
}

/** Cotiza XLM↔USDC vía SDEX (Horizon path payment). */
export async function quoteSdexPathPayment(
  from: SdexSwapCode,
  to: SdexSwapCode,
  amountHuman: number,
  slippageBps = 50,
): Promise<{ quote: SdexPathQuote; amountOut: number }> {
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

  const quote: SdexPathQuote = {
    _provider: 'sdex',
    from,
    to,
    amountIn: amount,
    amountOut: best.destination_amount,
    sendAsset: serializeAsset(sendAsset),
    destAsset: serializeAsset(destAsset),
    path,
    slippageBps,
  }

  return { quote, amountOut: fromStroops(best.destination_amount) }
}

function destMin(amountOut: string, slippageBps: number): string {
  const n = Number(amountOut)
  if (!Number.isFinite(n) || n <= 0) return amountOut
  const min = n * (1 - slippageBps / 10_000)
  return min.toFixed(7)
}

async function needsUsdcTrustline(publicKey: string): Promise<boolean> {
  if (await hasUsdcTrustline(publicKey)) return false
  return true
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

/** Construye XDR sin firmar para un path payment SDEX. */
export async function buildSdexPathPaymentXdr(
  publicKey: string,
  quote: SdexPathQuote,
): Promise<string> {
  const { passphrase } = networkConfig()
  const server = horizonServer()
  const account = await server.loadAccount(publicKey)

  const sendAsset = deserializeAsset(quote.sendAsset)
  const destAsset = deserializeAsset(quote.destAsset)
  const path = quote.path.map(deserializeAsset)

  const sendAmountFixed = (Number(quote.amountIn) / 1e7).toFixed(7)

  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })

  if (quote.to === 'USDC' && (await needsUsdcTrustline(publicKey))) {
    builder = builder.addOperation(
      Operation.changeTrust({ asset: usdcAsset() }),
    )
  }

  const tx = builder
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount: sendAmountFixed,
        destination: publicKey,
        destAsset,
        destMin: destMin(quote.amountOut, quote.slippageBps),
        path,
      }),
    )
    .setTimeout(120)
    .build()

  return tx.toXDR()
}

/** Envía un XDR firmado a Horizon (transacciones clásicas / SDEX). */
export async function submitSignedStellarXdr(signedXdr: string): Promise<string> {
  const { passphrase } = networkConfig()
  const server = horizonServer()
  const tx = new Transaction(signedXdr, passphrase)
  const result = await server.submitTransaction(tx)
  return result.hash
}

export function isSdexQuote(quote: Record<string, unknown>): quote is SdexPathQuote & Record<string, unknown> {
  return quote._provider === 'sdex'
}
