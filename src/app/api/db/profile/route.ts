import { NextResponse } from "next/server";
import { getProfile, upsertProfile } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet requerido" }, { status: 400 });
  const profile = await getProfile(wallet);
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  try {
    const { wallet, embedded, email, did, riskProfile, fullName, phone } = (await request.json()) as {
      wallet?: string;
      embedded?: string;
      email?: string;
      did?: string;
      riskProfile?: string;
      fullName?: string;
      phone?: string;
    };
    if (!wallet) return NextResponse.json({ error: "wallet requerido" }, { status: 400 });
    await upsertProfile({ wallet, embedded, email, did, riskProfile, fullName, phone });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
