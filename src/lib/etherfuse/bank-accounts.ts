import { randomUUID } from 'crypto'
import { z } from 'zod'
import { AppError } from '@/lib/seyf/api-error'
import { etherfuseFetch, etherfuseReadBody, extractEtherfuseErrorMessage } from '@/lib/etherfuse/client'

const yyyymmdd = z
  .string()
  .regex(/^\d{8}$/, 'birthDate/incorporatedDate must use YYYYMMDD format')

const clabe = z
  .string()
  .regex(/^\d{18}$/, 'CLABE must contain exactly 18 digits')

const personalAccountSchema = z.object({
  transactionId: z.string().uuid().optional(),
  firstName: z.string().min(1),
  paternalLastName: z.string().min(1),
  maternalLastName: z.string().min(1),
  birthDate: yyyymmdd,
  birthCountryIsoCode: z.string().length(2).optional().default('MX'),
  curp: z.string().min(10),
  rfc: z.string().min(10),
  clabe,
})

const businessAccountSchema = z.object({
  transactionId: z.string().uuid().optional(),
  name: z.string().min(1),
  countryIsoCode: z.string().length(2).optional().default('MX'),
  incorporatedDate: yyyymmdd,
  rfc: z.string().min(10),
  clabe,
})

export type PersonalBankAccountRegistration = z.infer<typeof personalAccountSchema>
export type BusinessBankAccountRegistration = z.infer<typeof businessAccountSchema>
export type BankAccountRegistration =
  | { kind: 'personal'; account: PersonalBankAccountRegistration }
  | { kind: 'business'; account: BusinessBankAccountRegistration }

type EtherfuseBankAccountResponse = {
  bankAccountId: string
  customerId: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  abbrClabe?: string
  etherfuseDepositClabe?: string | null
  label?: string | null
  compliant?: boolean
  status?: 'pending' | 'awaitingDepositVerification' | 'active' | 'inactive'
}

export function normalizeBankAccountRegistration(input: BankAccountRegistration) {
  if (input.kind === 'personal') {
    const parsed = personalAccountSchema.parse(input.account)
    return {
      ...parsed,
      transactionId: parsed.transactionId ?? randomUUID(),
      birthCountryIsoCode: parsed.birthCountryIsoCode ?? 'MX',
    }
  }
  const parsed = businessAccountSchema.parse(input.account)
  return {
    ...parsed,
    transactionId: parsed.transactionId ?? randomUUID(),
    countryIsoCode: parsed.countryIsoCode ?? 'MX',
  }
}

export async function createCustomerBankAccount(
  customerId: string,
  input: {
    registration: BankAccountRegistration
    skipAutoApproval?: boolean
    label?: string | null
    bankAccountId?: string
  },
): Promise<EtherfuseBankAccountResponse> {
  const registration = normalizeBankAccountRegistration(input.registration)
  const res = await etherfuseFetch(
    `/ramp/customer/${encodeURIComponent(customerId)}/bank-account`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: registration,
        skipAutoApproval: input.skipAutoApproval ?? false,
        label: input.label ?? undefined,
        bankAccountId: input.bankAccountId ?? undefined,
      }),
      // Explicitly off by default for non-idempotent writes.
      retryable: false,
    },
  )

  const { json, text } = await etherfuseReadBody<EtherfuseBankAccountResponse | { error?: string }>(res)
  if (!res.ok) {
    const msg = extractEtherfuseErrorMessage(json, text, 500)
    throw new AppError('provider_unavailable', {
      statusCode: res.status === 400 ? 400 : 502,
      retryable: false,
      message: `Etherfuse create bank account failed (${res.status}): ${msg}`,
    })
  }
  if (!json || typeof json !== 'object' || !('bankAccountId' in json)) {
    throw new AppError('provider_unavailable', {
      statusCode: 502,
      retryable: false,
      message: `Etherfuse create bank account returned non-bank-account payload: ${text.slice(0, 500)}`,
    })
  }
  return json as EtherfuseBankAccountResponse
}

