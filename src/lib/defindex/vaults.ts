// ============================================================
// Catálogo y configuración de las DeFindex vaults (Stellar/Soroban).
//
// MVP del hackathon PULSO: una sola vault de testnet a la que mapean todos los
// planes de riesgo de la app. El balance y el APY se leen reales on-chain vía
// DeFindex; la metadata cosmética (nombre, meta, color) sigue viviendo en
// `store` (Supabase/localStorage), igual que el fallback del riel EVM.
//
// Este módulo es isomórfico (cliente y servidor): solo lee envs públicas y
// expone helpers de unidades. La API key vive aparte, en client.ts (server).
// ============================================================

/** true si el riel Stellar/DeFindex está activado por env. */
export const STELLAR_VAULTS_ENABLED =
  (process.env.NEXT_PUBLIC_STELLAR_VAULTS || '').trim().toLowerCase() === 'true'

/** Dirección del contrato de la DeFindex vault (testnet). Sin valor → no onchain. */
export const DEFINDEX_VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS || ''
).trim()

/** Decimales del asset subyacente de la vault (USDC/EURC/XLM en Stellar = 7). */
export const DEFINDEX_ASSET_DECIMALS = Number(
  process.env.NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS || 7,
)

/** Símbolo del asset subyacente, solo para mostrar en la UI. */
export const DEFINDEX_ASSET_SYMBOL = (
  process.env.NEXT_PUBLIC_DEFINDEX_ASSET_SYMBOL || 'USDC'
).trim()

/** El riel Stellar está realmente operativo (activado + vault configurada). */
export const STELLAR_VAULTS_ONCHAIN =
  STELLAR_VAULTS_ENABLED && Boolean(DEFINDEX_VAULT_ADDRESS)

/**
 * Resuelve la vault que respalda un plan de riesgo. MVP: una sola vault para
 * todos los planes. Cuando haya varias, este es el punto único de mapeo.
 */
export function resolveVaultAddress(_planId?: string): string {
  return DEFINDEX_VAULT_ADDRESS
}

/** Convierte un monto humano (p.ej. 100.5) a la unidad mínima entera del asset. */
export function toUnits(amount: number): number {
  return Math.round(amount * 10 ** DEFINDEX_ASSET_DECIMALS)
}

/** Convierte una unidad mínima entera del asset a monto humano. */
export function fromUnits(raw: number): number {
  return raw / 10 ** DEFINDEX_ASSET_DECIMALS
}
