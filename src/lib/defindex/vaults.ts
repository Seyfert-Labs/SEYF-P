// Configuración del riel Stellar/DeFindex (isomórfico cliente/servidor).

import {
  DEFINDEX_STRATEGIES,
  resolveStrategy,
  strategyByPlanId,
  type DefindexStrategyConfig,
} from '@/lib/defindex/catalog'

export { DEFINDEX_STRATEGIES, resolveStrategy, strategyByPlanId }
export type { DefindexStrategyConfig }

export const STELLAR_VAULTS_ENABLED =
  (process.env.NEXT_PUBLIC_STELLAR_VAULTS || '').trim().toLowerCase() === 'true'

/** Vault por defecto (XLM, primera del catálogo) — compat con env legacy. */
export const DEFINDEX_VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
  DEFINDEX_STRATEGIES[0]?.vaultAddress ||
  ''
)

/** planId → dirección de vault DeFindex. */
export const VAULT_BY_PLAN: Record<string, string> = Object.fromEntries(
  DEFINDEX_STRATEGIES.map((s) => [s.planId, s.vaultAddress]),
)

export const STELLAR_VAULTS_ONCHAIN =
  STELLAR_VAULTS_ENABLED && DEFINDEX_STRATEGIES.length > 0

export const DEFINDEX_INVEST_ON_DEPOSIT =
  (process.env.NEXT_PUBLIC_DEFINDEX_INVEST_ON_DEPOSIT || '').trim().toLowerCase() === 'true'

export function resolveVaultAddress(planId?: string): string {
  const strat = strategyByPlanId(planId)
  if (strat) return strat.vaultAddress
  return DEFINDEX_VAULT_ADDRESS
}

/** En riel Stellar, los 3 planes con vault DeFindex están desbloqueados. */
export function isPlanUnlocked(planId: string): boolean {
  if (!STELLAR_VAULTS_ENABLED) return true
  return Boolean(VAULT_BY_PLAN[planId])
}

export function assetSymbolForPlan(planId?: string): string {
  return resolveStrategy(planId).assetSymbol
}

export function assetDecimalsForPlan(planId?: string): number {
  return resolveStrategy(planId).decimals
}

/** @deprecated Usa assetSymbolForPlan(planId) en multi-vault. */
export const DEFINDEX_ASSET_SYMBOL = resolveStrategy('conservador').assetSymbol

/** @deprecated Usa assetDecimalsForPlan(planId). */
export const DEFINDEX_ASSET_DECIMALS = resolveStrategy('conservador').decimals

export function toUnits(amount: number, planId?: string): number {
  const d = assetDecimalsForPlan(planId)
  return Math.round(amount * 10 ** d)
}

export function fromUnits(raw: number, planId?: string): number {
  const d = assetDecimalsForPlan(planId)
  return raw / 10 ** d
}
