import { etherfuseFetch, etherfuseReadBody } from "@/lib/etherfuse/client";
import { AppError } from "@/lib/seyf/api-error";

export type EtherfuseWallet = {
  walletId: string;
  customerId: string;
  publicKey: string;
  blockchain: string;
  kycStatus?: string;
  claimedOwnership?: boolean;
};

/**
 * POST /ramp/wallet
 * Registra una wallet a nivel organización partner.
 * Es idempotente según docs (si ya existe, devuelve el registro actual).
 */
export async function registerOrganizationWallet(params: {
  publicKey: string;
  blockchain?: "stellar" | "solana" | "base" | "polygon" | "monad";
  claimOwnership?: boolean;
}): Promise<EtherfuseWallet> {
  let res: Response;
  try {
    res = await etherfuseFetch("/ramp/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: params.publicKey,
        blockchain: params.blockchain ?? "stellar",
        claimOwnership: params.claimOwnership ?? true,
      }),
      retryable: false,
    });
  } catch (err) {
    /**
     * `etherfuseFetch` lanza `AppError` en cualquier `!res.ok` ANTES de que podamos leer el
     * body, así que re-envolvemos con el prefijo "register wallet" y el mensaje del proveedor.
     * Esto permite que `isRecoverableRegisterWalletConflict` / `isWalletClaimedByAnotherOrg`
     * clasifiquen correctamente el conflicto idempotente same-org (recuperable, p. ej.
     * "You have already added user with this address") vs. el cross-org (no recuperable).
     */
    const providerMsg =
      err instanceof AppError || err instanceof Error ? err.message : String(err);
    throw new Error(`Etherfuse register wallet failed: ${providerMsg}`);
  }
  const { json, text } = await etherfuseReadBody<EtherfuseWallet | { error?: string }>(res);
  if (!json || typeof json !== "object" || !("walletId" in json)) {
    throw new Error(`Etherfuse register wallet returned invalid payload: ${text.slice(0, 500)}`);
  }
  return json as EtherfuseWallet;
}

/**
 * `POST /ramp/wallet` devuelve 409 / "already …" cuando la wallet YA está en NUESTRA org
 * (reintento idempotente, p. ej. tras borrar CLABE). Ese caso es recuperable: el KYC continúa.
 *
 * El caso **cross-org** ("claimed by another organization") NO es recuperable: la wallet
 * pertenece a otra organización de Etherfuse y nada del flujo va a funcionar. Lo maneja
 * `mapKycProviderSetupError` con un mensaje claro (revisar API key/entorno).
 */
export function isRecoverableRegisterWalletConflict(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.toLowerCase();
  if (!m.includes("register wallet")) return false;
  // Cross-org: NO recuperable, aunque Etherfuse lo devuelva como 409.
  if (
    m.includes("claimed by another organization") ||
    m.includes("registered to a different organization") ||
    m.includes("claimed by a different organization") ||
    m.includes("registered to another organization") ||
    m.includes("cannot claim a wallet")
  ) {
    return false;
  }
  // Mismo-org / reintento idempotente: la wallet ya está en NUESTRA org.
  // "You have already added user with this address, see org: <uuid>" es el texto que
  // Etherfuse devuelve cuando la wallet/usuario ya fue registrado antes en esta org —
  // re-enviar KYC debe continuar, no bloquear.
  return (
    msg.includes("(409)") ||
    m.includes("already added") ||
    m.includes("already added user") ||
    m.includes("already exists") ||
    m.includes("already registered") ||
    m.includes("duplicate")
  );
}
