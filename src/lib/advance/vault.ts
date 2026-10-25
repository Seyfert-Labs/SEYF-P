import 'server-only'

/**
 * Vault USDC de DeFindex leído y armado directo por RPC (sin la API de DeFindex).
 * Interfaz en `paltalabs/defindex`, `apps/contracts/vault/src/lib.rs`: las
 * acciones del vault son su propio token SEP-41.
 */

import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { USDC_DECIMALS, vaultContractId, withSlippage } from '@/lib/advance/config'
import { AdvanceError, buildInvokeXdr, readContract, type ContractErrorMessages } from '@/lib/advance/soroban'

export type VaultPosition = {
  shares: string
  value: string
  asset: 'USDC'
  decimals: number
}

const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' })
const i128Vec = (ns: bigint[]) => xdr.ScVal.scvVec(ns.map(i128))

/** Errores del vault: no tenemos su tabla, así que solo se da contexto. */
const vaultErrors: ContractErrorMessages = (code, contractId) =>
  contractId === vaultContractId() || contractId === ''
    ? `El vault rechazó la operación (código ${code}).`
    : undefined

/** Valor en USDC (unidades mínimas) de `shares` acciones del vault. */
export async function vaultValueOf(caller: string, shares: bigint): Promise<bigint> {
  if (shares <= 0n) return 0n
  const amounts = await readContract<bigint[]>(
    caller,
    vaultContractId(),
    'get_asset_amounts_per_shares',
    [i128(shares)],
    vaultErrors,
  )
  return amounts.reduce((sum, a) => sum + BigInt(a), 0n)
}

export async function vaultPosition(address: string): Promise<VaultPosition> {
  const vault = vaultContractId()
  const shares = BigInt(
    await readContract<bigint>(address, vault, 'balance', [new Address(address).toScVal()], vaultErrors),
  )
  const value = await vaultValueOf(address, shares)
  return { shares: shares.toString(), value: value.toString(), asset: 'USDC', decimals: USDC_DECIMALS }
}

/** `deposit(amounts_desired, amounts_min, from, invest=true)`. */
export function buildVaultDeposit(address: string, amount: bigint): Promise<string> {
  return buildInvokeXdr(
    address,
    vaultContractId(),
    'deposit',
    [i128Vec([amount]), i128Vec([withSlippage(amount)]), new Address(address).toScVal(), xdr.ScVal.scvBool(true)],
    vaultErrors,
  )
}

/** `withdraw(withdraw_shares, min_amounts_out, from)`, con el mínimo según el valor actual. */
export async function buildVaultWithdraw(address: string, shares: bigint): Promise<string> {
  const amounts = await readContract<bigint[]>(
    address,
    vaultContractId(),
    'get_asset_amounts_per_shares',
    [i128(shares)],
    vaultErrors,
  )
  if (amounts.length === 0) throw new AdvanceError(502, 'El vault no reportó activos.')
  return buildInvokeXdr(
    address,
    vaultContractId(),
    'withdraw',
    [i128(shares), i128Vec(amounts.map((a) => withSlippage(BigInt(a)))), new Address(address).toScVal()],
    vaultErrors,
  )
}
