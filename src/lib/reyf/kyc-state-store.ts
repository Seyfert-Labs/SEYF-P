import type { EtherfuseKycSnapshot, EtherfuseKycStatus } from '@/lib/etherfuse/kyc'
import {
  getKycState,
  upsertKycState,
  listKycStates,
  type KycStateRow,
} from '@/lib/supabase/db'

// Estado de KYC persistido en Supabase (tabla `kyc_state`). Antes vivía en
// Upstash Redis; ahora todo el dato del usuario persiste en Supabase.

function rowToSnapshot(row: KycStateRow): EtherfuseKycSnapshot {
  return {
    customerId: row.customer_id,
    walletPublicKey: row.wallet_public_key,
    status: row.status as EtherfuseKycStatus,
    approvedAt: row.approved_at,
    currentRejectionReason: row.current_rejection_reason,
    verifiedProfile: null,
    documentsCount: 0,
    selfiesCount: 0,
  }
}

export async function getStoredKycSnapshot(
  customerId: string,
  walletPublicKey: string,
): Promise<EtherfuseKycSnapshot | null> {
  try {
    const row = await getKycState(customerId, walletPublicKey)
    return row ? rowToSnapshot(row) : null
  } catch {
    return null
  }
}

export async function upsertStoredKycSnapshot(params: {
  customerId: string
  walletPublicKey: string
  status: EtherfuseKycStatus
  approvedAt?: string | null
  currentRejectionReason?: string | null
  eventId?: string | null
  eventTimestamp?: string | null
}): Promise<{ updated: boolean }> {
  const existing = await getKycState(params.customerId, params.walletPublicKey)

  const eventId = params.eventId ?? null
  const hasExplicitTimestamp = Boolean(params.eventTimestamp)
  const incomingTs = hasExplicitTimestamp
    ? new Date(params.eventTimestamp as string).getTime()
    : Date.now()

  if (existing) {
    const samePayload =
      existing.status === params.status &&
      existing.approved_at === (params.approvedAt ?? null) &&
      existing.current_rejection_reason === (params.currentRejectionReason ?? null)
    if (!eventId && samePayload) return { updated: false }
    if (eventId && existing.last_event_id === eventId) return { updated: false }

    const currentTs = new Date(existing.updated_at).getTime()
    if (Number.isFinite(currentTs) && Number.isFinite(incomingTs) && incomingTs < currentTs) {
      return { updated: false }
    }
    const effectiveTs =
      hasExplicitTimestamp && Number.isFinite(incomingTs) ? incomingTs : currentTs || Date.now()
    await upsertKycState({
      customer_id: params.customerId,
      wallet_public_key: params.walletPublicKey,
      status: params.status,
      approved_at: params.approvedAt ?? null,
      current_rejection_reason: params.currentRejectionReason ?? null,
      last_event_id: eventId,
      updated_at: new Date(effectiveTs).toISOString(),
    })
    return { updated: true }
  }

  await upsertKycState({
    customer_id: params.customerId,
    wallet_public_key: params.walletPublicKey,
    status: params.status,
    approved_at: params.approvedAt ?? null,
    current_rejection_reason: params.currentRejectionReason ?? null,
    last_event_id: eventId,
    updated_at: new Date(incomingTs).toISOString(),
  })
  return { updated: true }
}

export async function listStoredKycRows(limit = 200): Promise<
  Array<{
    customerId: string
    walletPublicKey: string
    status: EtherfuseKycStatus
    approvedAt: string | null
    currentRejectionReason: string | null
    updatedAt: string
  }>
> {
  try {
    const rows = await listKycStates(limit)
    return rows.map((row) => ({
      customerId: row.customer_id,
      walletPublicKey: row.wallet_public_key,
      status: row.status as EtherfuseKycStatus,
      approvedAt: row.approved_at,
      currentRejectionReason: row.current_rejection_reason,
      updatedAt: row.updated_at,
    }))
  } catch {
    return []
  }
}
