import { bitsoRequest } from "@/lib/bitso/client";
import { BITSO_BOOKS, type BitsoRate } from "@/lib/bitso/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/bitso/rates — tasas FX reales de Bitso (ticker por book, público).
export async function GET() {
  try {
    const rates = await Promise.all(
      BITSO_BOOKS.map(async (book): Promise<BitsoRate | null> => {
        try {
          const t = await bitsoRequest<{ book: string; last: string; bid: string; ask: string }>(
            "GET",
            `/api/v3/ticker?book=${book}`,
          );
          return { book, last: Number(t.last), bid: Number(t.bid), ask: Number(t.ask) };
        } catch {
          return null;
        }
      }),
    );
    const map: Record<string, BitsoRate> = {};
    for (const r of rates) if (r) map[r.book] = r;
    return Response.json({ rates: map, source: "bitso", at: Date.now() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "error" }, { status: 502 });
  }
}
