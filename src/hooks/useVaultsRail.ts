"use client";

// Riel de bóvedas. SEYF es full Stellar: las bóvedas son vaults de DeFindex
// (en mainnet, el vault USDC que también usa `seyf_advance`). El riel EVM
// (Arbitrum/SeyfVaults) ya no se usa.
import { useStellarVaults, MAX_VAULTS, type UserVault } from "@/hooks/useStellarVaults";

export const useVaultsRail = useStellarVaults;
export { MAX_VAULTS };
export const STELLAR_RAIL = true;
export type { UserVault };
