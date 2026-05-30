import { junoRequest } from '@/lib/juno/client';
import { ok, fail } from '@/lib/juno/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/juno/account-details — CLABEs de depósito (AUTO_PAYMENT) de la cuenta.
export async function GET() {
  try {
    const { payload } = await junoRequest(
      'GET',
      '/spei/v1/clabes?clabe_type=AUTO_PAYMENT',
    );
    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
