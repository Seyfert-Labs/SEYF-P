import { NextResponse } from "next/server";
import { getBonusClaimed, setBonusClaimed } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet requerido" }, { status: 400 });
  return NextResponse.json({ claimed: await getBonusClaimed(wallet) });
}

export async function POST(request: Request) {
  const { wallet, amount, txId } = (await request.json()) as {
    wallet?: string;
    amount?: number;
    txId?: string;
  };
  if (!wallet) return NextResponse.json({ error: "wallet requerido" }, { status: 400 });
  await setBonusClaimed(wallet, amount ?? 1500, txId);
  return NextResponse.json({ ok: true });
}
