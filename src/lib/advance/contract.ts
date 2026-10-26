import 'server-only'

/**
 * Lecturas y XDR del contrato `seyf_advance` (soroban/seyf_advance).
 * El contrato bloquea acciones del vault, paga el adelanto desde su tesorería y
 * las libera con `repay` o con `settle` cuando el rendimiento cubre el adelanto.
 */

import { Address, nativeToScVal } from '@stellar/stellar-sdk'
import { advanceContractId, withSlippage } from '@/lib/advance/config'
import { buildInvokeXdr, readContract, type ContractErrorMessages } from '@/lib/advance/soroban'

/** `seyf_advance::Error`, con el código de `error.rs`. */
const ADVANCE_ERRORS: Record<number, string> = {
  1: 'Los adelantos están en pausa.',
  2: 'Tu cuenta aún no está habilitada para adelantos.',
  3: 'Ya tienes un adelanto activo.',
  4: 'No tienes un adelanto activo.',
  5: 'El rendimiento todavía no cubre el adelanto.',
  6: 'El plazo está fuera del rango permitido.',
  7: 'Indica cuántas acciones quieres bloquear.',
  8: 'El adelanto supera el máximo sobre el valor de tu ahorro.',
  9: 'El adelanto supera el tope por usuario.',
  10: 'Se alcanzó el tope total de adelantos.',
  11: 'La tesorería no tiene fondos suficientes para este adelanto.',
  12: 'El adelanto quedó por debajo del mínimo aceptado.',
  14: 'Monto inválido.',
  16: 'El vault reportó un valor inválido.',
  17: 'El monto es demasiado grande.',
}

const advanceErrors: ContractErrorMessages = (code, contractId) =>
  contractId === advanceContractId() || contractId === '' ? ADVANCE_ERRORS[code] : undefined

const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' })
const u32 = (n: number) => nativeToScVal(n, { type: 'u32' })
const addr = (a: string) => new Address(a).toScVal()

type RawPosition = {
  shares: bigint
  value_at_open: bigint
  advance: bigint
  opened_at: bigint
  expected_unlock_at: bigint
}

type RawParams = {
  apy_bps: number
  max_advance_bps: number
  min_term_days: number
  max_term_days: number
  per_user_cap: bigint
  global_cap: bigint
  allowlist_on: boolean
}

/** Montos en strings de unidades mínimas; fechas en segundos Unix. */
export type AdvancePosition = {
  shares: string
  valueAtOpen: string
  advance: string
  openedAt: number
  expectedUnlockAt: number
}

export type AdvanceParams = {
  apyBps: number
  maxAdvanceBps: number
  minTermDays: number
  maxTermDays: number
  perUserCap: string
  globalCap: string
  allowlistOn: boolean
}

export type UnlockStatus = { valueNow: string; unlockValue: string; covered: boolean }

export async function quoteAdvance(
  caller: string,
  shares: bigint,
  termDays: number,
): Promise<{ value: string; advance: string }> {
  const [value, advance] = await readContract<[bigint, bigint]>(
    caller,
    advanceContractId(),
    'quote',
    [i128(shares), u32(termDays)],
    advanceErrors,
  )
  return { value: value.toString(), advance: advance.toString() }
}

export async function advancePosition(address: string): Promise<{
  position: AdvancePosition | null
  unlockStatus: UnlockStatus
  params: AdvanceParams
  treasury: string
}> {
  const contract = advanceContractId()
  const [raw, params, treasury] = await Promise.all([
    readContract<RawPosition | null>(address, contract, 'position', [addr(address)], advanceErrors),
    readContract<RawParams>(address, contract, 'params', [], advanceErrors),
    readContract<bigint>(address, contract, 'treasury', [], advanceErrors),
  ])

  let unlockStatus: UnlockStatus = { valueNow: '0', unlockValue: '0', covered: false }
  if (raw) {
    const [valueNow, unlockValue] = await readContract<[bigint, bigint]>(
      address,
      contract,
      'unlock_status',
      [addr(address)],
      advanceErrors,
    )
    unlockStatus = {
      valueNow: valueNow.toString(),
      unlockValue: unlockValue.toString(),
      covered: valueNow >= unlockValue,
    }
  }

  return {
    position: raw
      ? {
          shares: raw.shares.toString(),
          valueAtOpen: raw.value_at_open.toString(),
          advance: raw.advance.toString(),
          openedAt: Number(raw.opened_at),
          expectedUnlockAt: Number(raw.expected_unlock_at),
        }
      : null,
    unlockStatus,
    params: {
      apyBps: params.apy_bps,
      maxAdvanceBps: params.max_advance_bps,
      minTermDays: params.min_term_days,
      maxTermDays: params.max_term_days,
      perUserCap: params.per_user_cap.toString(),
      globalCap: params.global_cap.toString(),
      allowlistOn: params.allowlist_on,
    },
    treasury: treasury.toString(),
  }
}

/**
 * `open_advance(user, shares, term_days, min_advance)`. Sin `minAdvance`, se
 * cotiza y se acepta hasta 0.5 % menos por si cambia el valor de la acción.
 */
export async function buildOpenAdvance(
  address: string,
  shares: bigint,
  termDays: number,
  minAdvance?: bigint,
): Promise<string> {
  const min = minAdvance ?? withSlippage(BigInt((await quoteAdvance(address, shares, termDays)).advance))
  return buildInvokeXdr(
    address,
    advanceContractId(),
    'open_advance',
    [addr(address), i128(shares), u32(termDays), i128(min)],
    advanceErrors,
  )
}

/** `repay(user)` o `settle(user)` con el propio usuario como fuente. */
export function buildCloseAdvance(address: string, action: 'repay' | 'settle'): Promise<string> {
  return buildInvokeXdr(address, advanceContractId(), action, [addr(address)], advanceErrors)
}
