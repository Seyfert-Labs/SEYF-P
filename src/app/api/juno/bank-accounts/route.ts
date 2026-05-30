import { junoRequest } from '@/lib/juno/client';
import { ok, fail } from '@/lib/juno/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/juno/bank-accounts — cuentas bancarias registradas para redención.
export async function GET() {
  try {
    const { payload } = await junoRequest('GET', '/mint_platform/v1/accounts/banks');
    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
