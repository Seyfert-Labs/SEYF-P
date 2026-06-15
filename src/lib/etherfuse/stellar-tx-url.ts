export type StellarExplorerNetwork = "testnet" | "mainnet";

/**
 * Enlace a Stellar Expert.
 * Si `network` se omite, usa `NEXT_PUBLIC_STELLAR_NETWORK` (testnet por defecto).
 */
export function stellarTxExplorerUrl(
  signature: string | null | undefined,
  network?: StellarExplorerNetwork | null,
): string | null {
  const s = typeof signature === "string" ? signature.trim() : "";
  if (!s) return null;

  let isMain: boolean;
  if (network === "mainnet") isMain = true;
  else if (network === "testnet") isMain = false;
  else {
    const env =
      typeof process.env.NEXT_PUBLIC_STELLAR_NETWORK === "string"
        ? process.env.NEXT_PUBLIC_STELLAR_NETWORK.toLowerCase()
        : "";
    isMain = ["public", "mainnet"].includes(env);
  }

  const base = isMain
    ? "https://stellar.expert/explorer/public/tx/"
    : "https://stellar.expert/explorer/testnet/tx/";
  return `${base}${encodeURIComponent(s)}`;
}
