import { NextResponse } from "next/server";
import { getClabe, addClabe } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet requerido" }, { status: 400 });
  return NextResponse.json({ clabe: await getClabe(wallet) });
}

export async function POST(request: Request) {
  const { wallet, clabe } = (await request.json()) as { wallet?: string; clabe?: string };
  if (!wallet || !clabe) return NextResponse.json({ error: "wallet y clabe requeridos" }, { status: 400 });
  await addClabe(wallet, clabe);
  return NextResponse.json({ ok: true });
}
