/**
 * Contratos del flujo /retiro: vault USDC de DeFindex y `seyf_advance`.
 * Solo direcciones públicas: se leen de env y no hay valores por defecto.
 */

import { StrKey } from '@stellar/stellar-sdk'

/** USDC en Stellar (SAC de Circle) y las acciones del vault usan 7 decimales. */
export const USDC_DECIMALS = 7

/** Tolerancia de los mínimos (`amounts_min`, `min_amounts_out`, `min_advance`): 0.5 %. */
export const SLIPPAGE_BPS = 50n

export class ConfigError extends Error {}

function contractFromEnv(names: string[], label: string): string {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (!value) continue
    if (!StrKey.isValidContract(value)) {
      throw new ConfigError(`${label} mal configurado: ${name} no es una dirección de contrato (C…).`)
    }
    return value
  }
  throw new ConfigError(`${label} no configurado: falta ${names.join(' o ')}.`)
}

export function vaultContractId(): string {
  return contractFromEnv(
    ['NEXT_PUBLIC_DEFINDEX_VAULT_USDC', 'NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS'],
    'Vault USDC',
  )
}

export function advanceContractId(): string {
  return contractFromEnv(['NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT'], 'Contrato de adelanto')
}

/** `amount` menos la tolerancia, redondeado hacia abajo. */
export function withSlippage(amount: bigint): bigint {
  return (amount * (10_000n - SLIPPAGE_BPS)) / 10_000n
}
