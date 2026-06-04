import { getSupabase } from "./server";

// Funciones de datos (server-side). Devuelven formas listas para el cliente.
// Cada escritura asegura primero que exista el perfil (FK).

export interface ProfileInput {
  wallet: string;
  embedded?: string | null;
  email?: string | null;
  did?: string | null;
  riskProfile?: string | null;
  fullName?: string | null;
  phone?: string | null;
}

export interface ProfileRow {
  wallet_address: string;
  embedded_wallet_address: string | null;
  email: string | null;
  privy_did: string | null;
  risk_profile: string | null;
  full_name: string | null;
  phone: string | null;
}

export async function getProfile(wallet: string): Promise<ProfileRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("profiles")
    .select("wallet_address, embedded_wallet_address, email, privy_did, risk_profile, full_name, phone")
    .eq("wallet_address", wallet)
    .maybeSingle();
  return (data as ProfileRow) ?? null;
}

export async function upsertProfile(p: ProfileInput) {
  const sb = getSupabase();
  if (!sb) return;
  // Solo incluye campos explícitamente pasados para no sobreescribir con null.
  const patch: Record<string, unknown> = {
    wallet_address: p.wallet,
    updated_at: new Date().toISOString(),
  };
  if (p.embedded !== undefined) patch.embedded_wallet_address = p.embedded ?? null;
  if (p.email !== undefined) patch.email = p.email ?? null;
  if (p.did !== undefined) patch.privy_did = p.did ?? null;
  if (p.riskProfile !== undefined) patch.risk_profile = p.riskProfile ?? null;
  if (p.fullName !== undefined) patch.full_name = p.fullName ?? null;
  if (p.phone !== undefined) patch.phone = p.phone ?? null;

  await sb.from("profiles").upsert(patch, { onConflict: "wallet_address" });
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

// ---------- Conversión orquestada: idempotencia + reconciliación ----------

export interface ConversionRecord extends ConversionRow {
  status: "pending" | "completed";
  kind?: "forward" | "inverse";
}

export async function getConversion(id: string): Promise<ConversionRecord | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("conversions")
    .select("id, from_code, to_code, amount_from, amount_to, oid, status, kind, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    from: data.from_code,
    to: data.to_code,
    amountFrom: Number(data.amount_from),
    amountTo: Number(data.amount_to),
    oid: data.oid ?? undefined,
    status: data.status,
    kind: data.kind ?? undefined,
    createdAt: new Date(data.created_at).getTime(),
  };
}

// Reserva la fila idempotente. Devuelve la existente si la `id` ya se usó (un
// reintento NO coloca otra orden); si no, inserta una fila 'pending'.
export async function beginConversion(
  wallet: string,
  c: { id: string; from: string; to: string; kind: "forward" | "inverse" },
): Promise<{ created: boolean; existing?: ConversionRecord }> {
  const sb = getSupabase();
  if (!sb) return { created: true }; // sin DB: el cliente lleva el ledger local
  await ensureProfile(wallet);
  const existing = await getConversion(c.id);
  if (existing) return { created: false, existing };
  const { error } = await sb.from("conversions").insert({
    id: c.id,
    wallet_address: wallet,
    from_code: c.from,
    to_code: c.to,
    amount_from: 0,
    amount_to: 0,
    status: "pending",
    kind: c.kind,
  });
  // Carrera: otro request insertó la misma `id` entre el select y el insert.
  if (error) {
    const again = await getConversion(c.id);
    if (again) return { created: false, existing: again };
    throw error;
  }
  return { created: true };
}

export async function completeConversion(
  id: string,
  d: { amountFrom: number; amountTo: number; oid?: string },
) {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("conversions")
    .update({ amount_from: d.amountFrom, amount_to: d.amountTo, oid: d.oid ?? null, status: "completed" })
    .eq("id", id);
}

// Libera la reserva si la orden falló (para no dejar filas pending colgadas).
export async function abortConversion(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("conversions").delete().eq("id", id).eq("status", "pending");
}

// Agregado del ledger por activo (todos los usuarios, solo filas liquidadas):
// suma el destino y resta el origen de cada conversión no-MXN. Es el lado
// "ledger" del invariante de reconciliación vs el pool real de Bitso.
export async function sumLedgerByAsset(): Promise<Record<string, number>> {
  const sb = getSupabase();
  if (!sb) return {};
  const acc: Record<string, number> = {};
  const { data } = await sb
    .from("conversions")
    .select("from_code, to_code, amount_from, amount_to")
    .eq("status", "completed");
  for (const c of data ?? []) {
    if (c.to_code !== "MXN") acc[c.to_code] = (acc[c.to_code] || 0) + Number(c.amount_to);
    if (c.from_code !== "MXN") acc[c.from_code] = (acc[c.from_code] || 0) - Number(c.amount_from);
  }
  return acc;
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
