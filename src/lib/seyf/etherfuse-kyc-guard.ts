import { fetchEtherfuseKycStatus, type EtherfuseKycStatus } from '@/lib/etherfuse/kyc'
import { AppError } from '@/lib/seyf/api-error'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'

const APPROVED_KYC_STATUSES: ReadonlySet<EtherfuseKycStatus> = new Set([
  'approved',
  'approved_chain_deploying',
])

// En sandbox Etherfuse el KYC nunca pasa de "compliant" (normalizado a "proposed").
// En testnet permitimos "proposed" como equivalente a aprobado.
const TESTNET_APPROVED_KYC_STATUSES: ReadonlySet<EtherfuseKycStatus> = new Set([
  'approved',
  'approved_chain_deploying',
  'proposed',
])

export function isEtherfuseKycApprovedStatus(status: EtherfuseKycStatus): boolean {
  const set = isPublicStellarTestnet() ? TESTNET_APPROVED_KYC_STATUSES : APPROVED_KYC_STATUSES
  return set.has(status)
}

export type EtherfuseIdentityContext = {
  customerId: string
  publicKey: string
}

export type EtherfuseKycGateResult = {
  approved: boolean
  status: EtherfuseKycStatus | null
  reason: string | null
}

export async function getEtherfuseKycGateResult(
  identity: EtherfuseIdentityContext,
): Promise<EtherfuseKycGateResult> {
  const kyc = await fetchEtherfuseKycStatus(identity.customerId, identity.publicKey)
  if (!kyc.ok) {
    return {
      approved: false,
      status: null,
      reason:
        kyc.reason === 'not_found'
          ? 'No encontramos tu verificacion KYC. Completa el flujo en /identidad.'
          : 'No pudimos validar tu estado KYC en este momento. Intenta de nuevo.',
    }
  }
  const approved = isEtherfuseKycApprovedStatus(kyc.data.status)
  return {
    approved,
    status: kyc.data.status,
    reason: approved ? null : `Tu KYC esta en estado "${kyc.data.status}". Completa /identidad para continuar.`,
  }
}

export async function assertEtherfuseKycApproved(identity: EtherfuseIdentityContext): Promise<void> {
  const gate = await getEtherfuseKycGateResult(identity)
  if (gate.approved) return
  throw new AppError('validation_error', {
    statusCode: 403,
    retryable: false,
    message: gate.reason ?? 'KYC no aprobado. Completa /identidad para continuar.',
  })
}
