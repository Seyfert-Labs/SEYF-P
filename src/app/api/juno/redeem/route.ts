import { junoRequest } from '@/lib/juno/client';
import { ok, fail, badRequest } from '@/lib/juno/respond';
import type { RedeemParams } from '@/types/juno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/juno/redeem — redime MXNB → MXN (transferencia SPEI a una cuenta registrada).
export async function POST(request: Request) {
  try {
    const { amount, destination_bank_account_id } =
      (await request.json()) as Partial<RedeemParams>;

    if (!amount || !destination_bank_account_id) {
      return badRequest(
        'Faltan parámetros requeridos (amount, destination_bank_account_id).',
      );
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 100) {
      return badRequest('El monto debe ser un número válido mayor o igual a 100 MXNB.');
    }

    const { payload, idempotencyKey } = await junoRequest(
      'POST',
      '/mint_platform/v1/redemptions',
      {
        body: {
          amount: numericAmount,
          destination_bank_account_id,
          asset: 'mxn',
        },
        idempotency: true,
      },
    );
    return ok(payload, { idempotency_key: idempotencyKey });
  } catch (error) {
    return fail(error);
  }
}
