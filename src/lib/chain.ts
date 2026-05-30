import { createPublicClient, http, type Address } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";

// ============================================================
// Configuración de red y del token MXNB (ERC-20) en Arbitrum.
// MXNB tiene 6 decimales. Direcciones oficiales (proxy):
//   - Arbitrum One:     0xF197FFC28c23E0309B5559e7a166f2c6164C80aA
//   - Arbitrum Sepolia: 0x82B9e52b26A2954E113F94Ff26647754d5a4247D
// Fuente: https://docs.bitso.com/juno/docs/mxnb-on-arbitrum
// ============================================================

const NETWORK = (process.env.NEXT_PUBLIC_CHAIN ?? "arbitrum-sepolia").toLowerCase();
export const IS_TESTNET = NETWORK !== "arbitrum" && NETWORK !== "arbitrum-one";

export const activeChain = IS_TESTNET ? arbitrumSepolia : arbitrum;

const DEFAULT_MXNB: Record<string, Address> = {
  testnet: "0x82B9e52b26A2954E113F94Ff26647754d5a4247D",
  mainnet: "0xF197FFC28c23E0309B5559e7a166f2c6164C80aA",
};

export const MXNB_ADDRESS = (process.env.NEXT_PUBLIC_MXNB_ADDRESS ||
  (IS_TESTNET ? DEFAULT_MXNB.testnet : DEFAULT_MXNB.mainnet)) as Address;

export const MXNB_DECIMALS = 6;

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC || undefined),
});

// ABI mínimo de ERC-20 para leer saldo.
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Lee el saldo de MXNB (en unidades, ya convertido por decimales) de una dirección. */
export async function readMXNBBalance(address: Address): Promise<number> {
  const raw = (await publicClient.readContract({
    address: MXNB_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
  return Number(raw) / 10 ** MXNB_DECIMALS;
}

export const explorerBase = IS_TESTNET
  ? "https://sepolia.arbiscan.io"
  : "https://arbiscan.io";
