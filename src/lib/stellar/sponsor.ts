/**
 * Patrocinio de reservas y fees (CAP-33 + fee-bump).
 *
 * En mainnet no hay Friendbot: una wallet recién creada no existe en el ledger,
 * no tiene reserva base ni XLM para fees, y por tanto no puede firmar NADA.
 * Pedirle al usuario que consiga XLM antes de ahorrar es el fin del onboarding.
 *
 * Aquí el negocio paga por él:
 *  - `beginSponsoringFutureReserves` … `endSponsoringFutureReserves` cubren la
 *    reserva base de la cuenta y la de cada trustline (el sponsor conserva el
 *    XLM: puede recuperarlo si la cuenta se revoca).
 *  - El fee-bump deja que el sponsor pague la comisión de una transacción ya
 *    firmada por el usuario, sin volver a pedirle firma.
 *
 * El sponsor solo firma lo que arma este módulo, y las rutas que lo exponen
 * exigen sesión SEP-10 + rate limit: una llave patrocinadora sin candado se
 * vacía en minutos. En la beta, además:
 *  - solo patrocina cuentas de `SEYF_BETA_ALLOWLIST` (sin la variable, solo en testnet);
 *  - el fee-bump solo cubre `invokeHostFunction` contra el contrato del adelanto,
 *    el vault USDC o el SAC de USDC, y el `changeTrust` de USDC;
 *  - el `resourceFee` de Soroban tiene tope (`STELLAR_SPONSOR_MAX_RESOURCE_FEE`).
 */

import 'server-only'
import {
  Address,
  Asset,
  BASE_FEE,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  NotFoundError,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'
import { DEFINDEX_USDC_ISSUER_TESTNET, strategyById } from '@/lib/defindex/catalog'
import {
  horizonUrl,
  stellarNetworkPassphrase,
  stellarWalletNetworkFromEnv,
} from '@/lib/stellar/network'
import { usdcIssuer, usdcSacContractId } from '@/lib/stellar/usdc'

/** Tope de fee de inclusión que el sponsor acepta pagar por operación (en stroops). */
const DEFAULT_MAX_FEE = '100000' // 0.01 XLM
/** Tope del resourceFee de Soroban que el sponsor acepta pagar (en stroops). */
const DEFAULT_MAX_RESOURCE_FEE = BigInt(5_000_000) // 0.5 XLM
/** Ventana para que el usuario firme lo que armamos. */
const TX_TIMEOUT_SEC = 180

export class SponsorNotConfiguredError extends Error {
  constructor() {
    super(
      'El patrocinio de reservas no está configurado. Define STELLAR_SPONSOR_SECRET ' +
        'con la llave secreta (S...) de una cuenta fondeada con XLM.',
    )
    this.name = 'SponsorNotConfiguredError'
  }
}

/** La cuenta o la transacción no entra en el patrocinio de la beta (→ 403). */
export class SponsorForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SponsorForbiddenError'
  }
}

/** La transacción no se puede patrocinar tal como viene (→ 400). */
export class SponsorRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SponsorRejectedError'
  }
}

function betaAllowlist(): Set<string> | null {
  const raw = process.env.SEYF_BETA_ALLOWLIST?.trim()
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  )
}

/**
 * Solo las cuentas de `SEYF_BETA_ALLOWLIST` reciben patrocinio. Sin la
 * variable, el patrocinio queda abierto únicamente en testnet.
 */
export function assertSponsorAllowed(account: string): void {
  const allow = betaAllowlist()
  if (allow ? allow.has(account) : stellarWalletNetworkFromEnv() === 'testnet') return
  throw new SponsorForbiddenError('Tu cuenta no está en la beta. Pide acceso al equipo de SEYF.')
}

let cachedKeypair: Keypair | null = null

export function sponsorKeypair(): Keypair {
  if (cachedKeypair) return cachedKeypair
  const secret = process.env.STELLAR_SPONSOR_SECRET?.trim()
  if (!secret) throw new SponsorNotConfiguredError()
  cachedKeypair = Keypair.fromSecret(secret)
  return cachedKeypair
}

export function isSponsorConfigured(): boolean {
  try {
    sponsorKeypair()
    return true
  } catch {
    return false
  }
}

function maxFee(): string {
  const raw = process.env.STELLAR_SPONSOR_MAX_FEE?.trim()
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : DEFAULT_MAX_FEE
}

function maxResourceFee(): bigint {
  const raw = process.env.STELLAR_SPONSOR_MAX_RESOURCE_FEE?.trim()
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : DEFAULT_MAX_RESOURCE_FEE
}

/** USDC aceptado en el patrocinio: el de la red activa y, en testnet, el de DeFindex. */
function allowedUsdcIssuers(): Set<string> {
  return new Set([usdcIssuer(), usdcIssuer(DEFINDEX_USDC_ISSUER_TESTNET)])
}

function isUsdc(asset: Asset): boolean {
  return (
    !asset.isNative() && asset.getCode() === 'USDC' && allowedUsdcIssuers().has(asset.getIssuer())
  )
}

/** Contratos Soroban que paga el sponsor: adelanto, vault USDC y SAC de USDC. */
function allowedContracts(): Set<string> {
  const ids = [
    process.env.NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT?.trim(),
    process.env.NEXT_PUBLIC_DEFINDEX_VAULT_USDC?.trim(),
    process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim(),
    strategyById('usdc')?.vaultAddress,
    usdcSacContractId(),
    usdcSacContractId(DEFINDEX_USDC_ISSUER_TESTNET),
  ]
  return new Set(ids.filter((id): id is string => Boolean(id)))
}

function server(): Horizon.Server {
  return new Horizon.Server(horizonUrl())
}

export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    await server().loadAccount(publicKey)
    return true
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (e instanceof NotFoundError || status === 404) return false
    throw e
  }
}

function assertAccount(publicKey: string): void {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error('Cuenta Stellar inválida.')
  }
}

export type SponsoredAccountCreation = { exists: true } | { exists: false; xdr: string }

/**
 * XDR (ya firmado por el sponsor) que crea la cuenta del usuario con reserva
 * patrocinada y saldo inicial 0. El usuario debe co-firmarlo: el
 * `endSponsoringFutureReserves` va a nombre de su cuenta.
 * Si la cuenta ya existe devuelve `{ exists: true }`.
 */
export async function buildSponsoredAccountCreation(
  newAccount: string,
): Promise<SponsoredAccountCreation> {
  assertAccount(newAccount)
  assertSponsorAllowed(newAccount)
  const sponsor = sponsorKeypair()
  const networkPassphrase = stellarNetworkPassphrase()

  // Pollar ya crea y fondea las wallets en mainnet: no hay nada que patrocinar.
  if (await accountExists(newAccount)) return { exists: true }

  const source = await server().loadAccount(sponsor.publicKey())
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: newAccount }))
    .addOperation(Operation.createAccount({ destination: newAccount, startingBalance: '0' }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: newAccount }))
    .setTimeout(TX_TIMEOUT_SEC)
    .build()

  tx.sign(sponsor)
  return { exists: false, xdr: tx.toXDR() }
}

/**
 * XDR (firmado por el sponsor) que abre una trustline con reserva patrocinada.
 * Sin esto cada asset nuevo le cuesta 0.5 XLM al usuario. En la beta solo USDC.
 */
export async function buildSponsoredTrustline(
  account: string,
  assetCode: string,
  assetIssuer: string,
): Promise<string> {
  assertAccount(account)
  if (!StrKey.isValidEd25519PublicKey(assetIssuer)) {
    throw new Error('Emisor del asset inválido.')
  }
  assertSponsorAllowed(account)
  if (!isUsdc(new Asset(assetCode, assetIssuer))) {
    throw new SponsorForbiddenError('En la beta solo se patrocina la trustline de USDC.')
  }
  const sponsor = sponsorKeypair()
  const networkPassphrase = stellarNetworkPassphrase()

  const source = await server().loadAccount(sponsor.publicKey())
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: account }))
    .addOperation(
      Operation.changeTrust({ asset: new Asset(assetCode, assetIssuer), source: account }),
    )
    .addOperation(Operation.endSponsoringFutureReserves({ source: account }))
    .setTimeout(TX_TIMEOUT_SEC)
    .build()

  tx.sign(sponsor)
  return tx.toXDR()
}

export type SponsoredSubmitResult = { hash: string; successful: boolean }

function contractOf(fn: xdr.HostFunction): string | null {
  if (fn.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) return null
  return Address.fromScAddress(fn.invokeContract().contractAddress()).toString()
}

function sorobanResourceFee(tx: Transaction): bigint {
  const ext = tx.toEnvelope().v1().tx().ext()
  return ext.switch() === 1 ? BigInt(ext.sorobanData().resourceFee().toString()) : BigInt(0)
}

/** Las únicas formas de transacción que paga el sponsor en la beta. */
function assertSponsorableOperations(tx: Transaction, account: string, sponsor: string): void {
  const ops = tx.operations
  if (ops.length === 0) throw new SponsorRejectedError('La transacción no tiene operaciones.')

  // Lo que arma este módulo (fuente = sponsor): cuenta o trustline USDC con reserva patrocinada.
  if (tx.source === sponsor) {
    const [begin, middle, end] = ops
    const ok =
      ops.length === 3 &&
      begin.type === 'beginSponsoringFutureReserves' &&
      begin.sponsoredId === account &&
      end.type === 'endSponsoringFutureReserves' &&
      end.source === account &&
      ((middle.type === 'createAccount' && middle.destination === account) ||
        (middle.type === 'changeTrust' &&
          middle.source === account &&
          middle.line instanceof Asset &&
          isUsdc(middle.line)))
    if (!ok) throw new SponsorForbiddenError('Esta transacción no se puede patrocinar.')
    return
  }

  const contracts = allowedContracts()
  for (const op of ops) {
    if (op.source && op.source !== account) {
      throw new SponsorForbiddenError('Esta transacción opera sobre otra cuenta.')
    }
    if (op.type === 'changeTrust' && op.line instanceof Asset && isUsdc(op.line)) continue
    if (op.type === 'invokeHostFunction') {
      const contract = contractOf(op.func)
      if (contract && contracts.has(contract)) continue
      throw new SponsorForbiddenError('El sponsor no paga llamadas a ese contrato.')
    }
    throw new SponsorForbiddenError(`El sponsor no paga operaciones ${op.type}.`)
  }
}

/**
 * Envuelve en fee-bump una transacción ya firmada por el usuario y la envía.
 * El sponsor paga la comisión; la transacción interna no se toca ni se vuelve
 * a firmar.
 *
 * Solo se paga lo que viene de la cuenta de la sesión SEP-10 (o lo que armó el
 * propio sponsor para ella), con las operaciones de `assertSponsorableOperations`
 * y un `resourceFee` bajo el tope. Sin esos filtros cualquiera usaría la llave
 * como gasolinera gratis.
 */
export async function submitFeeBumped(
  signedXdr: string,
  account: string,
): Promise<SponsoredSubmitResult> {
  const sponsor = sponsorKeypair()
  const networkPassphrase = stellarNetworkPassphrase()
  assertSponsorAllowed(account)

  // `new Transaction(...)` revienta con un fee-bump: fromXDR distingue los dos.
  let parsed: Transaction | FeeBumpTransaction
  try {
    parsed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
  } catch {
    throw new SponsorRejectedError('XDR inválido para esta red.')
  }
  if (parsed instanceof FeeBumpTransaction) {
    throw new SponsorRejectedError(
      'La transacción ya viene en fee-bump (¿patrocinio de Pollar encendido?). ' +
        'Envía la transacción interna firmada, sin envolver.',
    )
  }
  const inner = parsed

  if (inner.source !== account && inner.source !== sponsor.publicKey()) {
    throw new SponsorForbiddenError('Esta transacción no corresponde a tu cuenta.')
  }
  if (inner.signatures.length === 0) {
    throw new SponsorRejectedError('La transacción no viene firmada.')
  }
  assertSponsorableOperations(inner, account, sponsor.publicKey())

  const resourceFee = sorobanResourceFee(inner)
  const cap = maxResourceFee()
  if (resourceFee > cap) {
    throw new SponsorForbiddenError(
      `El resourceFee (${resourceFee} stroops) supera el tope del sponsor (${cap} stroops).`,
    )
  }

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    maxFee(),
    inner,
    networkPassphrase,
  )
  feeBump.sign(sponsor)

  const res = await server().submitTransaction(feeBump)
  return { hash: res.hash, successful: res.successful !== false }
}
