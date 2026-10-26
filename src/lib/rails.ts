import { stellarWalletNetworkFromEnv } from "@/lib/stellar/network";

/** SEYF corre en mainnet de Stellar (no testnet). */
export const IS_MAINNET = stellarWalletNetworkFromEnv() === "mainnet";

/**
 * Rampa MXN por SPEI (CLABE de depósito, cuentas bancarias, bono de bienvenida,
 * envío a banco). Aún no está en mainnet: se muestra como "próximamente".
 */
export const SPEI_ENABLED = process.env.NEXT_PUBLIC_SPEI_ENABLED === "true";
