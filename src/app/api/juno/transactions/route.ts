import { junoRequest } from '@/lib/juno/client';
import { ok, fail } from '@/lib/juno/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/juno/transactions?limit=&offset=&status=&type=
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams({
      limit: searchParams.get('limit') ?? '50',
      offset: searchParams.get('offset') ?? '0',
    });
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const path = `/mint_platform/v1/transactions?${params.toString()}`;
    const { payload } = await junoRequest('GET', path);
    return ok(payload, { query_params: Object.fromEntries(params) });
  } catch (error) {
    return fail(error);
  }
}
