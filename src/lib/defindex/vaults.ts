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

// Mapa plan de riesgo → vault DeFindex. Hoy solo "Conservador" tiene ruta a una
// vault real (CETES, estrategia Blend). Los demás planes quedan BLOQUEADOS hasta
// que conectemos sus vaults (p.ej. T-Bills/índices) en Stellar. Para activar uno
// nuevo: agrega su entrada aquí (planId → dirección C...).
export const VAULT_BY_PLAN: Record<string, string> = DEFINDEX_VAULT_ADDRESS
  ? { conservador: DEFINDEX_VAULT_ADDRESS }
  : {}

/** Dirección de la vault que respalda un plan, o "" si el plan no tiene ruta aún. */
export function resolveVaultAddress(planId?: string): string {
  if (planId && VAULT_BY_PLAN[planId]) return VAULT_BY_PLAN[planId]
  return DEFINDEX_VAULT_ADDRESS
}

/**
 * ¿El plan está disponible para crear bóveda? En el riel EVM no se bloquea nada.
 * En el riel Stellar, solo los planes con vault mapeada (hoy "Conservador").
 */
export function isPlanUnlocked(planId: string): boolean {
  if (!STELLAR_VAULTS_ENABLED) return true
  return Boolean(VAULT_BY_PLAN[planId])
}

/** Convierte un monto humano (p.ej. 100.5) a la unidad mínima entera del asset. */
export function toUnits(amount: number): number {
  return Math.round(amount * 10 ** DEFINDEX_ASSET_DECIMALS)
}

/** Convierte una unidad mínima entera del asset a monto humano. */
export function fromUnits(raw: number): number {
  return raw / 10 ** DEFINDEX_ASSET_DECIMALS
}
