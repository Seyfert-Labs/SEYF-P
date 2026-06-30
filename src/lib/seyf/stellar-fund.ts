import { Horizon, NotFoundError } from '@stellar/stellar-sdk'

/**
 * Fondeo de la wallet Pollar en testnet vía Friendbot.
 *
 * En testnet la wallet (keypair) existe en Pollar pero NO existe on-chain hasta
 * que recibe su primer fondeo. Sin XLM no puede pagar las fees de las firmas
 * (trustline, depósito/retiro a bóvedas DeFindex). Friendbot crea la cuenta con
 * 10,000 XLM — el monto estándar de la red de pruebas de Stellar.
 *
 * En mainnet Friendbot no existe: el fondeo es responsabilidad del usuario/negocio.
 */

type StellarNetwork = 'testnet' | 'mainnet'

/** Reserva base + colchón para fees: por debajo de esto la cuenta no puede firmar. */
const MIN_XLM = 1

function resolveNetwork(): { horizonUrl: string; network: StellarNetwork; friendbotUrl: string | null } {
  const env = (
    process.env.NEXT_PUBLIC_POLLAR_STELLAR_NETWORK ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    'testnet'
  )
    .trim()
    .toLowerCase()

  if (env === 'mainnet' || env === 'public') {
    return {
      horizonUrl: 'https://horizon.stellar.org',
      network: 'mainnet',
      friendbotUrl: null,
    }
  }
  return {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    network: 'testnet',
    // Friendbot oficial de testnet (override por env para entornos custom).
    friendbotUrl: process.env.STELLAR_FRIENDBOT_URL?.trim() || 'https://friendbot.stellar.org',
  }
}

/** Saldo XLM nativo de la cuenta. `null` si la cuenta no existe on-chain todavía. */
export async function getAccountXlm(publicKey: string): Promise<number | null> {
  const { horizonUrl } = resolveNetwork()
  const server = new Horizon.Server(horizonUrl)
  try {
    const account = await server.loadAccount(publicKey)
    const native = account.balances.find((b) => b.asset_type === 'native')
    return native ? Number(native.balance) : 0
  } catch (e) {
    // 404 de Horizon = cuenta aún no creada en el ledger.
    if (e instanceof NotFoundError) return null
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw e
  }
}

export type FundResult = {
  network: StellarNetwork
  /** true si Friendbot fondeó la cuenta en esta llamada. */
  funded: boolean
  /** true si la cuenta ya tenía XLM suficiente (no se volvió a fondear). */
  alreadyFunded: boolean
  /** Saldo XLM tras la operación (best-effort). */
  xlm: number | null
  message: string
}

/**
 * Garantiza que la wallet Pollar tenga XLM para pagar fees.
 * - Cuenta inexistente en testnet → Friendbot la crea con 10,000 XLM.
 * - Cuenta ya fondeada → no hace nada (idempotente).
 * - Mainnet → no aplica (Friendbot no existe).
 */
export async function ensureFunded(publicKey: string): Promise<FundResult> {
  const { network, friendbotUrl } = resolveNetwork()

  const current = await getAccountXlm(publicKey)
  if (current != null && current >= MIN_XLM) {
    return {
      network,
      funded: false,
      alreadyFunded: true,
      xlm: current,
      message: 'La wallet ya tiene XLM para fees.',
    }
  }

  if (network === 'mainnet' || !friendbotUrl) {
    return {
      network,
      funded: false,
      alreadyFunded: false,
      xlm: current,
      message: 'Friendbot no está disponible en mainnet; la wallet debe fondearse con XLM real.',
    }
  }

  // Friendbot crea la cuenta (si no existe) con 10,000 XLM. Si ya existe pero con
  // saldo bajo, devuelve op_already_exists — lo tratamos como no-fatal.
  const res = await fetch(`${friendbotUrl}/?addr=${encodeURIComponent(publicKey)}`, {
    method: 'GET',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Cuenta ya existente: Friendbot no puede re-crearla, pero no es un fallo real.
    if (/op_already_exists|already.*funded|exists/i.test(body)) {
      const xlm = await getAccountXlm(publicKey).catch(() => current)
      return {
        network,
        funded: false,
        alreadyFunded: true,
        xlm,
        message: 'La cuenta ya existe on-chain.',
      }
    }
    throw new Error(`Friendbot respondió ${res.status}: ${body.slice(0, 200)}`)
  }

  const xlm = await getAccountXlm(publicKey).catch(() => null)
  return {
    network,
    funded: true,
    alreadyFunded: false,
    xlm,
    message: 'Wallet fondeada con 10,000 XLM de testnet.',
  }
}
