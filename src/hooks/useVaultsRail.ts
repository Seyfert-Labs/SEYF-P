"use client";

// Selector de riel de bóvedas. `NEXT_PUBLIC_STELLAR_VAULTS=true` activa el riel
// Stellar/DeFindex; en otro caso se usa el riel EVM (Arbitrum/ReyfVaults) intacto.
//
// La env es una constante de build, así que la implementación se fija al cargar
// el módulo: cada render llama UN solo hook con identidad estable → cumple las
// reglas de hooks de React sin condicionales en el cuerpo del componente.
import { STELLAR_VAULTS_ENABLED } from "@/lib/defindex/vaults";
import { useVaults as useEvmVaults, MAX_VAULTS as EVM_MAX, type UserVault } from "@/hooks/useVaults";
import { useStellarVaults, MAX_VAULTS as STELLAR_MAX } from "@/hooks/useStellarVaults";

export const useVaultsRail = STELLAR_VAULTS_ENABLED ? useStellarVaults : useEvmVaults;
export const MAX_VAULTS = STELLAR_VAULTS_ENABLED ? STELLAR_MAX : EVM_MAX;
export const STELLAR_RAIL = STELLAR_VAULTS_ENABLED;
export type { UserVault };
