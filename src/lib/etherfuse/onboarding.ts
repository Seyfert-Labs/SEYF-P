import {
  findRampContextByWalletPublicKey,
  findRampContextFromOrgWallets,
} from "./customer-lookup";
import { etherfuseFetch, etherfuseReadBody } from "./client";
import {
  getEtherfuseDefaultBlockchain,
  type EtherfuseBlockchain,
} from "./integration-model";

export type GenerateOnboardingUrlParams = {
  customerId: string;
  bankAccountId: string;
  publicKey: string;
  blockchain?: EtherfuseBlockchain;
  accountType?: string;
};

type OnboardingUrlResponse = {
  presigned_url?: string;
  error?: string;
};

/**
 * Crea el cliente en Etherfuse (si no existe) y devuelve la URL de onboarding (hosted o inicio de flujo programático).
 * La URL expira en ~15 minutos.
 *
 * @see https://docs.etherfuse.com/api-reference/onboarding/generate-onboarding-url
 */
export async function generateOnboardingPresignedUrl(
  params: GenerateOnboardingUrlParams,
): Promise<{ presignedUrl: string }> {
  const blockchain = params.blockchain ?? getEtherfuseDefaultBlockchain();
  let res: Response;
  try {
    res = await etherfuseFetch("/ramp/onboarding-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: params.customerId,
        bankAccountId: params.bankAccountId,
        publicKey: params.publicKey,
        blockchain,
        accountType: params.accountType ?? 'personal',
      }),
    });
  } catch (err) {
    /**
     * `etherfuseFetch` lanza `AppError` en `!res.ok` antes de leer el body. Re-envolvemos con
     * el prefijo "onboarding-url" y el mensaje del proveedor para que
     * `generateOnboardingPresignedUrlResolving409` reconozca el conflicto de wallet ya
     * vinculada y resuelva customerId/bankAccountId por lookup en la API.
     */
    const providerMsg =
      err instanceof Error ? err.message : String(err);
    throw new Error(`Etherfuse onboarding-url failed: ${providerMsg}`);
  }

  const { json: raw, text } = await etherfuseReadBody<OnboardingUrlResponse>(res);
  if (!raw || typeof raw !== "object") {
    throw new Error(
      `Etherfuse onboarding-url: respuesta no JSON (${res.status}): ${text.slice(0, 500)}`,
    );
  }
  const presignedUrl = raw.presigned_url;
  if (!presignedUrl || typeof presignedUrl !== "string") {
    throw new Error(
      "Respuesta onboarding-url sin presigned_url: " + text.slice(0, 500),
    );
  }
  return { presignedUrl };
}

function isWalletAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  /**
   * `etherfuseFetch` mapea todo 4xx a statusCode 400 y pierde el "409" original del texto,
   * así que clasificamos por CONTENIDO del mensaje del proveedor, no por código.
   * Un error de onboarding-url que menciona wallet/usuario ya registrado es un conflicto
   * idempotente resoluble por lookup de customerId/bankAccountId.
   */
  if (m.includes("onboarding-url") || m.includes("onboarding url")) {
    if (
      m.includes("already") ||
      m.includes("registered") ||
      m.includes("exist") ||
      m.includes("duplicate") ||
      m.includes("wallet") ||
      m.includes("added user")
    ) {
      return true;
    }
  }
  /** Compatibilidad: si algún caller aún incluye el código HTTP en el mensaje. */
  return (
    message.includes("409") &&
    (m.includes("already") ||
      m.includes("registered") ||
      m.includes("exist") ||
      m.includes("duplicate") ||
      m.includes("wallet"))
  );
}

/**
 * Igual que {@link generateOnboardingPresignedUrl}, pero ante 409 por wallet ya existente
 * resuelve customerId / bankAccountId en la API y reintenta una vez.
 * Devuelve los IDs que aplicaron al request exitoso (para persistir en sesión).
 */
export async function generateOnboardingPresignedUrlResolving409(
  params: GenerateOnboardingUrlParams,
): Promise<{
  presignedUrl: string;
  customerId: string;
  bankAccountId: string;
}> {
  try {
    const { presignedUrl } = await generateOnboardingPresignedUrl(params);
    return {
      presignedUrl,
      customerId: params.customerId,
      bankAccountId: params.bankAccountId,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!isWalletAlreadyRegisteredError(message)) throw e;
    let ctx = await findRampContextByWalletPublicKey(params.publicKey, {
      fallbackBankAccountId: params.bankAccountId,
    });
    if (!ctx) {
      ctx = await findRampContextFromOrgWallets(params.publicKey, {
        fallbackBankAccountId: params.bankAccountId,
      });
    }
    if (!ctx) throw e;
    const { presignedUrl } = await generateOnboardingPresignedUrl({
      ...params,
      customerId: ctx.customerId,
      bankAccountId: ctx.bankAccountId,
    });
    return {
      presignedUrl,
      customerId: ctx.customerId,
      bankAccountId: ctx.bankAccountId,
    };
  }
}
