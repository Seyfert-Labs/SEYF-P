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

// ABI mínimo de ERC-20 (saldo + transferencia + aprobación para las bóvedas).
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
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
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

// ============================================================
// Bóvedas on-chain (contrato SeyfVaults). Si NEXT_PUBLIC_SEYF_VAULTS_ADDRESS
// está presente, las bóvedas son reales on-chain; si no, la app usa la capa
// `store` (Supabase/localStorage) como degradación graceful.
// ============================================================

export const SEYF_VAULTS_ADDRESS = (process.env.NEXT_PUBLIC_SEYF_VAULTS_ADDRESS || "") as Address | "";
export const VAULTS_ONCHAIN = Boolean(SEYF_VAULTS_ADDRESS);

export const seyfVaultsAbi = [
  {
    type: "function",
    name: "openVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "goal", type: "uint256" },
      { name: "apyBps", type: "uint16" },
    ],
    outputs: [{ name: "vaultId", type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vaultId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vaultId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeVault",
    stateMutability: "nonpayable",
    inputs: [{ name: "vaultId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getVaults",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "name", type: "string" },
          { name: "goal", type: "uint256" },
          { name: "balance", type: "uint256" },
          { name: "apyBps", type: "uint16" },
          { name: "createdAt", type: "uint64" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;

export interface OnchainVault {
  vaultId: number;
  name: string;
  goal: number;    // unidades MXNB
  balance: number; // unidades MXNB
  apy: number;     // porcentaje (apyBps / 100)
  createdAt: number; // ms
}

/** Lee las bóvedas on-chain del dueño (filtra las cerradas). */
export async function readOnchainVaults(owner: Address): Promise<OnchainVault[]> {
  if (!SEYF_VAULTS_ADDRESS) return [];
  const raw = (await publicClient.readContract({
    address: SEYF_VAULTS_ADDRESS,
    abi: seyfVaultsAbi,
    functionName: "getVaults",
    args: [owner],
  })) as readonly {
    name: string; goal: bigint; balance: bigint; apyBps: number; createdAt: bigint; exists: boolean;
  }[];
  const result: OnchainVault[] = [];
  raw.forEach((v, i) => {
    if (!v.exists) return;
    result.push({
      vaultId: i,
      name: v.name,
      goal: Number(v.goal) / 10 ** MXNB_DECIMALS,
      balance: Number(v.balance) / 10 ** MXNB_DECIMALS,
      apy: v.apyBps / 100,
      createdAt: Number(v.createdAt) * 1000,
    });
  });
  return result;
}

/** Espera a que una transacción se confirme on-chain. */
export async function waitForTx(hash: `0x${string}`) {
  try {
    await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
  } catch {
    /* si expira, el polling de saldo/bóvedas terminará reflejando el estado */
  }
}

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

/**
 * Lee las transferencias de MXNB hacia/desde una dirección.
 * Pagina hacia atrás en tramos de bloques (reduciendo el tramo si el RPC
 * rechaza el rango) hasta juntar suficientes movimientos, alcanzar el límite
 * de lookback o quedarse sin bloques. Así se ven también las transacciones
 * más viejas sin depender de un único rango grande.
 */
export async function readMXNBTransfers(
  address: Address,
  { maxLookback = 2_000_000n, targetCount = 25, maxRequests = 40 } = {},
): Promise<OnchainTransfer[]> {
  const latest = await publicClient.getBlockNumber();
  const floor = latest > maxLookback ? latest - maxLookback : 0n;

  // Movimientos crudos (ya extraídos de los logs tipados de viem).
  const raw: { hash: string; from: string; to: string; value: bigint; dir: "in" | "out"; blockNumber: bigint; logIndex: number }[] = [];
  let chunk = 100_000n;
  let to = latest;
  let requests = 0;

  while (to >= floor && requests < maxRequests && raw.length < targetCount) {
    const tentativeFrom = to > chunk ? to - chunk + 1n : 0n;
    const fromBlock = tentativeFrom < floor ? floor : tentativeFrom;
    const base = { address: MXNB_ADDRESS, event: transferEvent, fromBlock, toBlock: to };
    try {
      const [inc, out] = await Promise.all([
        publicClient.getLogs({ ...base, args: { to: address } }),
        publicClient.getLogs({ ...base, args: { from: address } }),
      ]);
      requests += 2;
      for (const l of inc) {
        raw.push({ hash: l.transactionHash ?? "", from: l.args.from ?? "", to: l.args.to ?? "", value: l.args.value ?? 0n, dir: "in", blockNumber: l.blockNumber ?? 0n, logIndex: l.logIndex ?? 0 });
      }
      for (const l of out) {
        raw.push({ hash: l.transactionHash ?? "", from: l.args.from ?? "", to: l.args.to ?? "", value: l.args.value ?? 0n, dir: "out", blockNumber: l.blockNumber ?? 0n, logIndex: l.logIndex ?? 0 });
      }
      if (fromBlock === 0n) break;
      to = fromBlock - 1n;
    } catch {
      requests += 1;
      // Rango rechazado por el RPC → reduce el tramo y reintenta el mismo `to`.
      if (chunk > 2_000n) {
        chunk = chunk / 2n;
        continue;
      }
      // Ni con tramo chico: avanza para no quedarse atorado.
      if (fromBlock === 0n) break;
      to = fromBlock - 1n;
    }
  }

  // Timestamps por bloque (dedupe).
  const blockNums = [...new Set(raw.map((t) => t.blockNumber))];
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
  const result: OnchainTransfer[] = [];
  for (const t of raw) {
    const key = `${t.hash}-${t.dir}-${t.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      hash: t.hash,
      from: t.from,
      to: t.to,
      value: Number(t.value) / 10 ** MXNB_DECIMALS,
      direction: t.dir,
      timestamp: tsMap.get(t.blockNumber) ?? 0,
      blockNumber: t.blockNumber,
    });
  }
  result.sort((a, b) => Number(b.blockNumber - a.blockNumber));
  return result;
}
