import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptAllEtherfuseAgreements } from "@/lib/etherfuse/agreements";
import { generateOnboardingPresignedUrlResolving409 } from "@/lib/etherfuse/onboarding";
import { getEtherfuseOnboardingSession } from "@/lib/etherfuse/onboarding-session";
import { AppError, toErrorResponse } from "@/lib/seyf/api-error";
import { upsertStoredAgreementsAccepted } from "@/lib/seyf/agreements-state-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  customerInfo: z
    .object({
      phone: z.string().trim().min(5).optional(),
      email: z.string().trim().email().optional(),
      occupation: z.string().trim().min(2).optional(),
      additionalInfo: z
        .object({
          curp: z.string().trim().min(8).optional(),
          rfc: z.string().trim().min(8).optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * POST /api/seyf/kyc/agreements
 * Acepta acuerdos Etherfuse en orden (electronic-signature, terms, customer-agreement).
 */
export async function POST(req: Request) {
  try {
    const session = await getEtherfuseOnboardingSession();
    if (!session) {
      throw new AppError("validation_error", {
        statusCode: 401,
        retryable: false,
        message: "No hay sesión onboarding. Envía identidad primero.",
      });
    }

    const raw = (await req.json().catch(() => ({}))) as unknown;
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("validation_error", {
        statusCode: 400,
        retryable: false,
        message: `Invalid agreements payload: ${parsed.error.message}`,
      });
    }

    const resolved = await generateOnboardingPresignedUrlResolving409({
      customerId: session.customerId,
      bankAccountId: session.bankAccountId,
      publicKey: session.publicKey,
    });

    await acceptAllEtherfuseAgreements({
      presignedUrl: resolved.presignedUrl,
      customerInfo: parsed.data.customerInfo,
    });

    await upsertStoredAgreementsAccepted({
      customerId: session.customerId,
      walletPublicKey: session.publicKey,
    });

    return NextResponse.json(
      { ok: true, accepted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (process.env.NODE_ENV !== "production" && e instanceof Error) {
      const base = toErrorResponse(e, "kyc/agreements");
      const body = (await base.json()) as { error?: unknown };
      return NextResponse.json(
        {
          ...(typeof body === "object" && body ? body : {}),
          debug_message: e.message,
        },
        { status: base.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return toErrorResponse(e, "kyc/agreements");
  }
}
