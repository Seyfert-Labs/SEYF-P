import { createPublicClient, http, parseAbiItem, type Address } from "viem";
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

// ABI mínimo de ERC-20 (saldo + transferencia).
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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

// ---------------- Historial on-chain (transferencias MXNB del usuario) ----------------

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export interface OnchainTransfer {
  hash: string;
  from: string;
  to: string;
  value: number; // unidades MXNB
  direction: "in" | "out";
  timestamp: number; // ms (0 si no se pudo leer)
  blockNumber: bigint;
}

/** Lee las transferencias de MXNB hacia/desde una dirección (recientes). */
export async function readMXNBTransfers(
  address: Address,
  lookback = 500000n,
): Promise<OnchainTransfer[]> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > lookback ? latest - lookback : 0n;

  async function fetchPair(fb: bigint) {
    const base = { address: MXNB_ADDRESS, event: transferEvent, fromBlock: fb, toBlock: "latest" as const };
    return Promise.all([
      publicClient.getLogs({ ...base, args: { to: address } }),
      publicClient.getLogs({ ...base, args: { from: address } }),
    ]);
  }

  let incoming, outgoing;
  try {
    [incoming, outgoing] = await fetchPair(fromBlock);
  } catch {
    // Rango grande rechazado por el RPC → ventana corta.
    const fb = latest > 9000n ? latest - 9000n : 0n;
    try {
      [incoming, outgoing] = await fetchPair(fb);
    } catch {
      return [];
    }
  }

  const tagged = [
    ...incoming.map((l) => ({ l, dir: "in" as const })),
    ...outgoing.map((l) => ({ l, dir: "out" as const })),
  ];

  // Timestamps por bloque (dedupe).
  const blockNums = [...new Set(tagged.map((t) => t.l.blockNumber))];
  const tsMap = new Map<bigint, number>();
  await Promise.all(
    blockNums.map(async (bn) => {
      try {
        const blk = await publicClient.getBlock({ blockNumber: bn });
        tsMap.set(bn, Number(blk.timestamp) * 1000);
      } catch {
        /* ignora */
      }
    }),
  );

  const seen = new Set<string>();
  const out: OnchainTransfer[] = [];
  for (const { l, dir } of tagged) {
    const key = `${l.transactionHash}-${dir}-${l.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      hash: l.transactionHash,
      from: l.args.from as string,
      to: l.args.to as string,
      value: Number(l.args.value) / 10 ** MXNB_DECIMALS,
      direction: dir,
      timestamp: tsMap.get(l.blockNumber) ?? 0,
      blockNumber: l.blockNumber,
    });
  }
  out.sort((a, b) => Number(b.blockNumber - a.blockNumber));
  return out;
}
