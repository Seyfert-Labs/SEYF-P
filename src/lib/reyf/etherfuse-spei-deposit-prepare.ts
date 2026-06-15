import { acceptAllEtherfuseAgreements } from "@/lib/etherfuse/agreements";
import { extractOrderIdFromCreateOrderResponse } from "@/lib/etherfuse/order-create-response";
import { generateOnboardingPresignedUrlResolving409 } from "@/lib/etherfuse/onboarding";
import {
  createMxOnrampOrderStellarResilient,
  createMxOnrampQuote,
  fetchRampableAssetsForWallet,
  pickOnrampTargetIdentifier,
} from "@/lib/etherfuse/ramp-api";
import { quoteIdFromEtherfusePayload } from "@/lib/etherfuse/quote-id";
import { resolveMvpPartnerCryptoWalletId } from "@/lib/etherfuse/partner-accounts";
import {
  isRecoverableRegisterWalletConflict,
  registerOrganizationWallet,
} from "@/lib/etherfuse/wallets";
import {
  fetchOrderDetails,
  fetchOrgOrdersAllPages,
  findPendingOnrampOrderForAmount,
  pickRampOrderTransactionDetails,
} from "@/lib/etherfuse/orders-api";
import { AppError } from "@/lib/reyf/api-error";
import { upsertStoredAgreementsAccepted } from "@/lib/reyf/agreements-state-store";
import { assertEtherfuseKycApproved } from "@/lib/reyf/etherfuse-kyc-guard";
import type { EtherfuseRampContext } from "@/lib/reyf/etherfuse-ramp-context";
import { resolveEffectiveBankAccountIdForOnramp } from "@/lib/reyf/etherfuse-readiness";
import { saveStoredOnboardingSession } from "@/lib/reyf/onboarding-session-store";
import { acquireOnrampLock, releaseOnrampLock } from "@/lib/reyf/redis-guards";

async function ensureAgreementsForWallet(ctx: {
  customerId: string;
  bankAccountId: string;
  publicKey: string;
}): Promise<void> {
  const resolved = await generateOnboardingPresignedUrlResolving409({
    customerId: ctx.customerId,
    bankAccountId: ctx.bankAccountId,
    publicKey: ctx.publicKey,
  });
  await acceptAllEtherfuseAgreements({
    presignedUrl: resolved.presignedUrl,
  });
  await upsertStoredAgreementsAccepted({
    customerId: resolved.customerId,
    walletPublicKey: ctx.publicKey,
  });
}

export type SpeiDepositPrepareConflict = { ok: false; conflict: true };

export type SpeiDepositPrepareOk = {
  ok: true;
  quote: unknown;
  order: unknown;
  orderId: string | null;
  targetAssetUsed: string;
  contextSource: EtherfuseRampContext["source"];
};

export type SpeiDepositPrepareResult = SpeiDepositPrepareOk | SpeiDepositPrepareConflict;

function orderLikeCreateResponseFromGetDetail(detail: unknown): unknown | null {
  const d = pickRampOrderTransactionDetails(detail);
  if (!d.orderId?.trim() || !d.depositClabe?.trim()) return null;
  const fiat = d.amountInFiat?.trim() ?? "";
  return {
    onramp: {
      orderId: d.orderId,
      depositClabe: d.depositClabe,
      ...(fiat ? { depositAmount: fiat } : {}),
    },
  };
}

function parseAmountMxn(sourceAmount: string): number {
  return Number.parseFloat(String(sourceAmount).replace(/,/g, "").trim());
}

function isPendingOnrampOrderExistsMessage(msg: string): boolean {
  const lm = msg.toLowerCase();
  return (
    lm.includes("pending onramp order already exists") ||
    lm.includes("already exists for this bank account and amount")
  );
}

/**
 * Cotización + orden onramp en el mismo proceso servidor (mismo customer, mismo quoteId).
 * Así se evita desalinear contexto entre dos requests del cliente (causaba 400 en order/onramp).
 */
export async function prepareSpeiDepositQuoteAndOrder(params: {
  ctx: EtherfuseRampContext;
  sourceAmount: string;
  targetAsset: string | null;
}): Promise<SpeiDepositPrepareResult> {
  const { ctx, sourceAmount, targetAsset } = params;

  await assertEtherfuseKycApproved({
    customerId: ctx.customerId,
    publicKey: ctx.publicKey,
  });

  const { assets } = await fetchRampableAssetsForWallet({
    walletPublicKey: ctx.publicKey,
  });
  const target = pickOnrampTargetIdentifier(assets, targetAsset);
  if (!target) {
    throw new AppError("validation_error", {
      statusCode: 422,
      messageEs:
        "No hay activo destino. Deja vacío el campo «Activo» avanzado o revisa CETES en Etherfuse.",
    });
  }

  const quote = await createMxOnrampQuote({
    customerId: ctx.customerId,
    sourceAmount,
    targetAssetIdentifier: target,
  });
  const quoteId = quoteIdFromEtherfusePayload(quote);
  if (!quoteId) {
    throw new AppError("validation_error", {
      messageEs: "Etherfuse no devolvió quoteId en la cotización. Intenta de nuevo.",
    });
  }

  const locked = await acquireOnrampLock(ctx.customerId);
  if (!locked) return { ok: false, conflict: true };

  try {
    let bankAccountId = ctx.bankAccountId;
    const effectiveBank = await resolveEffectiveBankAccountIdForOnramp({
      customerId: ctx.customerId,
      preferredBankAccountId: ctx.bankAccountId,
    });
    if (effectiveBank !== ctx.bankAccountId) {
      bankAccountId = effectiveBank;
      await saveStoredOnboardingSession({
        customerId: ctx.customerId,
        bankAccountId,
        walletPublicKey: ctx.publicKey,
      });
    }

    try {
      await registerOrganizationWallet({
        publicKey: ctx.publicKey,
        blockchain: "stellar",
        claimOwnership: true,
      });
    } catch (e) {
      if (!isRecoverableRegisterWalletConflict(e)) throw e;
    }

    const buildOrder = async () => {
      const cryptoWalletId = await resolveMvpPartnerCryptoWalletId(ctx.publicKey);
      return createMxOnrampOrderStellarResilient({
        bankAccountId,
        quoteId,
        publicKey: ctx.publicKey,
        cryptoWalletId,
      });
    };

    let order: unknown;
    try {
      order = await buildOrder();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const lm = msg.toLowerCase();
      if (lm.includes("terms and conditions")) {
        await ensureAgreementsForWallet({
          customerId: ctx.customerId,
          bankAccountId,
          publicKey: ctx.publicKey,
        });
        order = await buildOrder();
      } else if (msg.includes("(409)") || isPendingOnrampOrderExistsMessage(msg)) {
        const amountMxn = parseAmountMxn(sourceAmount);
        if (!Number.isFinite(amountMxn)) throw e;
        const orders = await fetchOrgOrdersAllPages();
        const pendingId = findPendingOnrampOrderForAmount(
          orders,
          bankAccountId,
          amountMxn,
        );
        if (pendingId) {
          const detail = await fetchOrderDetails(pendingId);
          const wrapped = orderLikeCreateResponseFromGetDetail(detail);
          if (wrapped) {
            order = wrapped;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    const orderId = extractOrderIdFromCreateOrderResponse(order);
    return {
      ok: true,
      quote,
      order,
      orderId,
      targetAssetUsed: target,
      contextSource: ctx.source,
    };
  } finally {
    await releaseOnrampLock(ctx.customerId);
  }
}
