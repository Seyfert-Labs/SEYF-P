import { getSupabase } from "./server";

// Funciones de datos (server-side). Devuelven formas listas para el cliente.
// Cada escritura asegura primero que exista el perfil (FK).

export interface ProfileInput {
  wallet: string;
  embedded?: string | null;
  email?: string | null;
  did?: string | null;
}

export async function upsertProfile(p: ProfileInput) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("profiles").upsert(
    {
      wallet_address: p.wallet,
      embedded_wallet_address: p.embedded ?? null,
      email: p.email ?? null,
      privy_did: p.did ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address" },
  );
}

async function ensureProfile(wallet: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("profiles")
    .upsert({ wallet_address: wallet }, { onConflict: "wallet_address", ignoreDuplicates: true });
}

// ---------- CLABE de depósito ----------
export async function getClabe(wallet: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("deposit_clabes")
    .select("clabe")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.clabe ?? null;
}

export async function addClabe(wallet: string, clabe: string, type = "AUTO_PAYMENT") {
  const sb = getSupabase();
  if (!sb) return;
  await ensureProfile(wallet);
  await sb.from("deposit_clabes").upsert({ clabe, wallet_address: wallet, type }, { onConflict: "clabe" });
}

// ---------- Cuentas bancarias (retiro) ----------
export interface BankRow {
  id: string;
  tag: string;
  clabe: string;
  recipient_legal_name: string;
}

export async function listBanks(wallet: string): Promise<BankRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("bank_accounts")
    .select("id, tag, clabe, recipient_legal_name")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: true });
  return (data as BankRow[]) ?? [];
}

export async function addBank(wallet: string, b: BankRow) {
  const sb = getSupabase();
  if (!sb) return;
  await ensureProfile(wallet);
  await sb.from("bank_accounts").upsert(
    {
      id: b.id,
      wallet_address: wallet,
      tag: b.tag,
      clabe: b.clabe,
      recipient_legal_name: b.recipient_legal_name,
      ownership: "THIRD_PARTY",
    },
    { onConflict: "id" },
  );
}

export async function removeBank(wallet: string, id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("bank_accounts").delete().eq("wallet_address", wallet).eq("id", id);
}

// ---------- Bóvedas ----------
export interface VaultRow {
  id: string;
  nm: string;
  goal: number;
  bal: number;
  apy: number;
  color: string;
  createdAt: number;
}

export async function listVaults(wallet: string): Promise<VaultRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("vaults")
    .select("id, name, goal, balance, apy, color, created_at")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: true });
  return (
    (data ?? []).map((v) => ({
      id: v.id,
      nm: v.name,
      goal: Number(v.goal),
      bal: Number(v.balance),
      apy: Number(v.apy),
      color: v.color,
      createdAt: new Date(v.created_at).getTime(),
    })) ?? []
  );
}

export async function upsertVault(wallet: string, v: VaultRow) {
  const sb = getSupabase();
  if (!sb) return;
  await ensureProfile(wallet);
  await sb.from("vaults").upsert(
    {
      id: v.id,
      wallet_address: wallet,
      name: v.nm,
      goal: v.goal,
      balance: v.bal,
      apy: v.apy,
      color: v.color,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

export async function deleteVault(wallet: string, id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("vaults").delete().eq("wallet_address", wallet).eq("id", id);
}

// ---------- Bono de bienvenida ----------
export async function getBonusClaimed(wallet: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data } = await sb
    .from("bonus_claims")
    .select("wallet_address")
    .eq("wallet_address", wallet)
    .maybeSingle();
  return Boolean(data);
}

export async function setBonusClaimed(wallet: string, amount: number, txId?: string) {
  const sb = getSupabase();
  if (!sb) return;
  await ensureProfile(wallet);
  await sb
    .from("bonus_claims")
    .upsert({ wallet_address: wallet, amount, tx_id: txId ?? null }, { onConflict: "wallet_address" });
}

// ---------- Conversiones de divisas (FX vía Bitso) ----------
export interface ConversionRow {
  id: string;
  from: string;
  to: string;
  amountFrom: number;
  amountTo: number;
  oid?: string;
  createdAt: number;
}

export async function listConversions(wallet: string): Promise<ConversionRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("conversions")
    .select("id, from_code, to_code, amount_from, amount_to, oid, created_at")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    from: c.from_code,
    to: c.to_code,
    amountFrom: Number(c.amount_from),
    amountTo: Number(c.amount_to),
    oid: c.oid ?? undefined,
    createdAt: new Date(c.created_at).getTime(),
  }));
}

export async function addConversion(wallet: string, c: ConversionRow) {
  const sb = getSupabase();
  if (!sb) return;
  await ensureProfile(wallet);
  await sb.from("conversions").upsert(
    {
      id: c.id,
      wallet_address: wallet,
      from_code: c.from,
      to_code: c.to,
      amount_from: c.amountFrom,
      amount_to: c.amountTo,
      oid: c.oid ?? null,
      created_at: new Date(c.createdAt).toISOString(),
    },
    { onConflict: "id" },
  );
}

// ---------- Límites mensuales (depósito / retiro) ----------
export interface MonthlyUsage {
  deposit: number;
  withdraw: number;
}

export async function getMonthlyUsage(wallet: string, period: string): Promise<MonthlyUsage> {
  const sb = getSupabase();
  if (!sb) return { deposit: 0, withdraw: 0 };
  const { data } = await sb
    .from("monthly_limits")
    .select("deposit, withdraw")
    .eq("wallet_address", wallet)
    .eq("period", period)
    .maybeSingle();
  return { deposit: Number(data?.deposit ?? 0), withdraw: Number(data?.withdraw ?? 0) };
}

export async function addMonthlyUsage(
  wallet: string,
  period: string,
  kind: "deposit" | "withdraw",
  amount: number,
) {
  const sb = getSupabase();
  if (!sb) return;
  await ensureProfile(wallet);
  const cur = await getMonthlyUsage(wallet, period);
  const next = { deposit: cur.deposit, withdraw: cur.withdraw, [kind]: cur[kind] + amount };
  await sb.from("monthly_limits").upsert(
    { wallet_address: wallet, period, deposit: next.deposit, withdraw: next.withdraw, updated_at: new Date().toISOString() },
    { onConflict: "wallet_address,period" },
  );
}
