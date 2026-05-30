import { junoRequest } from '@/lib/juno/client';
import { ok, fail, badRequest } from '@/lib/juno/respond';
import type { WithdrawalParams } from '@/types/juno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/juno/withdrawal — retiro on-chain de MXNB a una dirección de wallet.
export async function POST(request: Request) {
  try {
    const { address, amount, asset, blockchain, compliance } =
      (await request.json()) as Partial<WithdrawalParams>;

    if (!address || !amount || !asset || !blockchain || compliance === undefined) {
      return badRequest(
        'Faltan parámetros requeridos (address, amount, asset, blockchain, compliance).',
      );
    }

    const { payload, idempotencyKey } = await junoRequest(
      'POST',
      '/mint_platform/v1/withdrawals',
      {
        body: {
          address,
          amount: String(amount),
          asset,
          blockchain,
          compliance: compliance || {},
        },
        idempotency: true,
      },
    );
    return ok(payload, { idempotency_key: idempotencyKey });
  } catch (error) {
    return fail(error);
  }
}
