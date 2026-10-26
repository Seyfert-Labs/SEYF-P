/**
 * SEP-10 Stellar Web Authentication (lado servidor).
 *
 * Reemplaza la confianza en el parámetro `?wallet=G...` por una prueba
 * criptográfica: el servidor emite un challenge, el usuario lo firma con su
 * llave (Pollar) y a cambio recibe un JWT propio cuyo `sub` es su cuenta
 * Stellar. A partir de ahí ninguna ruta tiene que creerle al cliente quién es.
 *
 * @see https://stellar.org/protocol/sep-10
 */

import 'server-only'
import {
  Account,
  BASE_FEE,
  Horizon,
  Keypair,
  NotFoundError,
  Operation,
  StrKey,
  TransactionBuilder,
  WebAuth,
  type Transaction,
} from '@stellar/stellar-sdk'
import { randomBytes } from 'node:crypto'
import { horizonUrl, stellarNetworkPassphrase } from '@/lib/stellar/network'
import { signSeyfJwt, verifySeyfJwt, type SeyfJwtPayload } from '@/lib/stellar/jwt'

/** Duración del challenge: el usuario tiene 5 min para firmarlo. */
const CHALLENGE_TIMEOUT_SEC = 300
/** Duración de la sesión emitida tras firmar (24 h por defecto). */
const DEFAULT_SESSION_TTL_SEC = 86_400

export type Sep10Config = {
  serverKeypair: Keypair
  homeDomain: string
  webAuthDomain: string
  jwtSecret: string
  sessionTtlSec: number
}

export class Sep10NotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `SEP-10 no está configurado. Faltan variables de entorno: ${missing.join(', ')}. ` +
        'Genera una llave con `node -e "console.log(require(\'@stellar/stellar-sdk\').Keypair.random().secret())"`.',
    )
    this.name = 'Sep10NotConfiguredError'
  }
}

function hostFromEnv(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) return null
  try {
    return new URL(site).host
  } catch {
    return null
  }
}

let cached: Sep10Config | null = null

/** Config de SEP-10. Lanza `Sep10NotConfiguredError` si falta algo esencial. */
export function sep10Config(): Sep10Config {
  if (cached) return cached

  const secret = process.env.SEP10_SERVER_SECRET?.trim()
  const jwtSecret = process.env.SEYF_AUTH_JWT_SECRET?.trim()
  const homeDomain = process.env.SEP10_HOME_DOMAIN?.trim() || hostFromEnv()

  const missing: string[] = []
  if (!secret) missing.push('SEP10_SERVER_SECRET')
  if (!jwtSecret) missing.push('SEYF_AUTH_JWT_SECRET')
  if (!homeDomain) missing.push('SEP10_HOME_DOMAIN (o NEXT_PUBLIC_SITE_URL)')
  if (missing.length > 0) throw new Sep10NotConfiguredError(missing)

  const ttl = Number(process.env.SEYF_AUTH_TTL_SEC?.trim() || DEFAULT_SESSION_TTL_SEC)

  cached = {
    serverKeypair: Keypair.fromSecret(secret!),
    homeDomain: homeDomain!,
    webAuthDomain: process.env.SEP10_WEB_AUTH_DOMAIN?.trim() || homeDomain!,
    jwtSecret: jwtSecret!,
    sessionTtlSec: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_SESSION_TTL_SEC,
  }
  return cached
}

export function isSep10Configured(): boolean {
  try {
    sep10Config()
    return true
  } catch {
    return false
  }
}

/** XDR del challenge para que la wallet lo firme (sin enviarlo a la red). */
export function buildSep10Challenge(account: string): { transaction: string; networkPassphrase: string } {
  if (!StrKey.isValidEd25519PublicKey(account)) {
    throw new Error('Cuenta Stellar inválida.')
  }
  const cfg = sep10Config()
  const networkPassphrase = stellarNetworkPassphrase()
  const transaction = WebAuth.buildChallengeTx(
    cfg.serverKeypair,
    account,
    cfg.homeDomain,
    CHALLENGE_TIMEOUT_SEC,
    networkPassphrase,
    cfg.webAuthDomain,
  )
  return { transaction, networkPassphrase }
}

/**
 * Verifica el challenge firmado y devuelve la cuenta que lo firmó.
 *
 * Si la cuenta todavía no existe en el ledger (caso normal en SEYF: la wallet
 * Pollar se crea antes de fondearse) SEP-10 manda verificar contra la master
 * key. Si ya existe, se exige el `med_threshold` real con los firmantes de la
 * cuenta — así una cuenta con multisig no se autentica con una firma suelta.
 */
export async function verifySep10Challenge(signedXdr: string): Promise<string> {
  const cfg = sep10Config()
  const networkPassphrase = stellarNetworkPassphrase()
  const serverAccountId = cfg.serverKeypair.publicKey()

  const { clientAccountID } = WebAuth.readChallengeTx(
    signedXdr,
    serverAccountId,
    networkPassphrase,
    cfg.homeDomain,
    cfg.webAuthDomain,
  )

  const server = new Horizon.Server(horizonUrl())
  let account: Horizon.AccountResponse | null = null
  try {
    account = await server.loadAccount(clientAccountID)
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (!(e instanceof NotFoundError) && status !== 404) throw e
  }

  if (!account) {
    WebAuth.verifyChallengeTxSigners(
      signedXdr,
      serverAccountId,
      networkPassphrase,
      [clientAccountID],
      cfg.homeDomain,
      cfg.webAuthDomain,
    )
    return clientAccountID
  }

  WebAuth.verifyChallengeTxThreshold(
    signedXdr,
    serverAccountId,
    networkPassphrase,
    account.thresholds.med_threshold,
    account.signers,
    cfg.homeDomain,
    cfg.webAuthDomain,
  )
  return clientAccountID
}

/*
 * Prueba de cuenta para wallets que solo firman transacciones de su propia cuenta
 * (Pollar con Turnkey rechaza un challenge SEP-10 estándar con SOURCE_MISMATCH,
 * porque ahí el origen es la cuenta del servidor). Misma idea que SEP-10 con el
 * origen invertido: la tx es de la cuenta del usuario, con secuencia 0 (ninguna
 * cuenta real la acepta, así que no se puede enviar a la red), el nonce y los
 * dominios en `manageData`, y la firma del servidor para verificarla sin estado.
 */

/** Challenge de prueba de cuenta: origen = la cuenta del usuario, secuencia 0. */
export function buildAccountProofChallenge(account: string): { transaction: string; networkPassphrase: string } {
  if (!StrKey.isValidEd25519PublicKey(account)) {
    throw new Error('Cuenta Stellar inválida.')
  }
  const cfg = sep10Config()
  const networkPassphrase = stellarNetworkPassphrase()
  const now = Math.floor(Date.now() / 1000)
  // "-1" → el builder la sube a secuencia 0, igual que el challenge SEP-10 estándar.
  const tx = new TransactionBuilder(new Account(account, '-1'), {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds: { minTime: now, maxTime: now + CHALLENGE_TIMEOUT_SEC },
  })
    .addOperation(
      Operation.manageData({
        name: `${cfg.homeDomain} auth`,
        value: randomBytes(48).toString('base64'),
        source: account,
      }),
    )
    .addOperation(Operation.manageData({ name: 'web_auth_domain', value: cfg.webAuthDomain, source: account }))
    .build()
  tx.sign(cfg.serverKeypair)
  return { transaction: tx.toXDR(), networkPassphrase }
}

function hasSignature(tx: Transaction, publicKey: string): boolean {
  const kp = Keypair.fromPublicKey(publicKey)
  const hash = tx.hash()
  return tx.signatures.some((s) => s.hint().equals(kp.signatureHint()) && kp.verify(hash, s.signature()))
}

/** Verifica la prueba de cuenta firmada y devuelve la cuenta. */
export async function verifyAccountProof(signedXdr: string): Promise<string> {
  const cfg = sep10Config()
  const networkPassphrase = stellarNetworkPassphrase()
  const parsed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase)
  if (!('sequence' in parsed)) throw new Error('No es una transacción simple.')
  const tx = parsed as Transaction
  const account = tx.source

  if (!StrKey.isValidEd25519PublicKey(account)) throw new Error('Origen inválido.')
  if (tx.sequence !== '0') throw new Error('La secuencia debe ser 0.')

  const now = Math.floor(Date.now() / 1000)
  const min = Number(tx.timeBounds?.minTime ?? 0)
  const max = Number(tx.timeBounds?.maxTime ?? 0)
  if (!max || max - min > CHALLENGE_TIMEOUT_SEC || now < min - 60 || now > max) {
    throw new Error('Challenge vencido o con tiempos inválidos.')
  }

  const [authOp, domainOp, ...rest] = tx.operations
  if (
    rest.length > 0 ||
    authOp?.type !== 'manageData' ||
    authOp.name !== `${cfg.homeDomain} auth` ||
    authOp.source !== account ||
    !authOp.value ||
    authOp.value.length !== 64 ||
    domainOp?.type !== 'manageData' ||
    domainOp.name !== 'web_auth_domain' ||
    domainOp.source !== account ||
    domainOp.value?.toString('utf8') !== cfg.webAuthDomain
  ) {
    throw new Error('Operaciones del challenge inválidas.')
  }

  // Lo emitió este servidor (nonce auténtico) y lo firmó la llave de la cuenta.
  if (!hasSignature(tx, cfg.serverKeypair.publicKey())) throw new Error('Falta la firma del servidor.')
  if (!hasSignature(tx, account)) throw new Error('Falta la firma de la cuenta.')

  // Cuenta multisig: una firma suelta de la master key no basta.
  const server = new Horizon.Server(horizonUrl())
  try {
    const acc = await server.loadAccount(account)
    const master = acc.signers.find((sg) => sg.key === account)
    if (!master || master.weight < Math.max(1, acc.thresholds.med_threshold)) {
      throw new Error('La llave de la cuenta no alcanza el umbral para autenticarse.')
    }
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (!(e instanceof NotFoundError) && status !== 404) throw e
  }
  return account
}

/** Emite la sesión SEYF para una cuenta ya verificada. */
export function issueSeyfSession(account: string): { token: string; expiresIn: number } {
  const cfg = sep10Config()
  return {
    token: signSeyfJwt({ sub: account, iss: cfg.homeDomain }, cfg.jwtSecret, cfg.sessionTtlSec),
    expiresIn: cfg.sessionTtlSec,
  }
}

/** Lee el `Authorization: Bearer` de la petición y devuelve el payload válido. */
export function readSeyfSession(request: Request): SeyfJwtPayload | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header?.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null
  try {
    return verifySeyfJwt(token, sep10Config().jwtSecret)
  } catch {
    return null
  }
}
