import { junoRequest } from '@/lib/juno/client';
import { ok, fail, badRequest } from '@/lib/juno/respond';
import type { MockDepositParams } from '@/types/juno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/juno/mock-deposit — simula un depósito SPEI (SOLO entorno stage/test).
// Dispara la emisión (issuance) de MXNB hacia la CLABE indicada.
export async function POST(request: Request) {
  try {
    const { amount, receiver_clabe, receiver_name, sender_name } =
      (await request.json()) as Partial<MockDepositParams>;

    if (!amount || !receiver_clabe || !receiver_name || !sender_name) {
      return badRequest(
        'Faltan parámetros requeridos (amount, receiver_clabe, receiver_name, sender_name).',
      );
    }

    const { payload } = await junoRequest('POST', '/spei/test/deposits', {
      body: {
        amount: String(amount),
        receiver_clabe,
        receiver_name,
        sender_name,
      },
    });
    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
