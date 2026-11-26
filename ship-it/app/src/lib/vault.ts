import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import deployment from "../../../deployments.json";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const EXPERT = "https://stellar.expert/explorer/testnet";
export const CONTRACT_ID: string = deployment.contractId;
export const DEPLOYMENT_LABEL: string = deployment.label;
export const PRIZE_STROOPS = BigInt(deployment.prizeStroops);

const server = new rpc.Server(RPC_URL);
const contract = new Contract(CONTRACT_ID);

// Fuente para simular vistas (no firma ni envía nada): la cuenta admin del deploy.
const VIEW_SOURCE: string = deployment.admin;

export function formatXlm(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("es-MX")}${frac ? "." + frac : ""} XLM`;
}

export async function readBalance(): Promise<bigint> {
  const tx = new TransactionBuilder(new Account(VIEW_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("balance"))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) {
    throw new Error("No se pudo leer el saldo de la bóveda.");
  }
  return BigInt(scValToNative(sim.result.retval));
}

/** Traduce errores del contrato/host a español claro. */
export function explainError(raw: string): string {
  if (/Error\(Contract, #1\)/.test(raw)) return "Código incorrecto. Revisa mayúsculas y espacios.";
  if (/Error\(Contract, #2\)/.test(raw))
    return "La bóveda no tiene 5555 XLM en este momento. Alguien ya reclamó; intenta de nuevo en unos minutos.";
  if (/Error\(Contract, #3\)/.test(raw)) return "Monto inválido.";
  if (/Account not found|account not found/i.test(raw))
    return "Tu cuenta no existe en testnet. Fondéala con friendbot (https://lab.stellar.org/account/fund) y vuelve a intentar.";
  if (/Error\(Auth/.test(raw)) return "La firma no fue válida para esta cuenta.";
  if (/user (declined|rejected)|rejected|denied|cancel/i.test(raw)) return "Cancelaste la firma en la wallet.";
  return raw.length > 300 ? raw.slice(0, 300) + "…" : raw;
}

/**
 * Arma el `claim`, lo simula (si falla, lanza el error del contrato) y
 * devuelve la transacción ensamblada lista para firmar.
 */
export async function prepareClaim(to: string, code: string): Promise<string> {
  let account;
  try {
    account = await server.getAccount(to);
  } catch (e) {
    throw new Error(explainError(String((e as Error)?.message ?? e)));
  }
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(
      contract.call("claim", new Address(to).toScVal(), nativeToScVal(code, { type: "string" })),
    )
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(explainError(sim.error));
  }
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new Error("El contrato necesita restaurarse (TTL vencido). Avísale al equipo.");
  }
  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Envía la transacción firmada y espera el resultado (sendTransaction regresa PENDING). */
export async function submit(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(explainError(JSON.stringify(sent.errorResult ?? sent)));
  }
  if (sent.status === "TRY_AGAIN_LATER") {
    throw new Error("La red está ocupada. Intenta de nuevo en unos segundos.");
  }
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
  if (final.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    throw new Error(`La transacción ${sent.hash} no se confirmó a tiempo. Revisa en stellar.expert.`);
  }
  throw new Error(`La transacción falló en la red (hash ${sent.hash}).`);
}
