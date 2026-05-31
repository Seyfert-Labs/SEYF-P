import { NextResponse } from "next/server";
import { upsertProfile } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/db/profile — crea/actualiza el perfil del usuario.
export async function POST(request: Request) {
  try {
    const { wallet, embedded, email, did } = (await request.json()) as {
      wallet?: string;
      embedded?: string;
      email?: string;
      did?: string;
    };
    if (!wallet) return NextResponse.json({ error: "wallet requerido" }, { status: 400 });
    await upsertProfile({ wallet, embedded, email, did });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
