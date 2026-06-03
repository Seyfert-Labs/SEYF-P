"use client";

// Capa de almacenamiento del cliente. Si NEXT_PUBLIC_USE_SUPABASE === "true"
// usa los route handlers /api/db/* (Supabase, persistente); si no, cae a
// localStorage (modo demo, no se conserva al limpiar cookies).

const USE_DB = process.env.NEXT_PUBLIC_USE_SUPABASE === "true";

export interface StoreVault {
  id: string;
  nm: string;
  goal: number;
  bal: number;
  apy: number;
  color: string;
  createdAt: number;
}
export interface StoreBank {
  id: string;
  tag: string;
  clabe: string;
  recipient_legal_name: string;
}

const key = (ns: string, addr?: string) => `reyf_${ns}_${(addr ?? "anon").toLowerCase()}`;

const LS = {
  get<T>(k: string, def: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : def;
    } catch {
      return def;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* ignora */
    }
  },
  getStr(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setStr(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignora */
    }
  },
};

async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return (await r.json()) as T;
}
async function jpost(url: string, body: unknown) {
  await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function jdel(url: string) {
  await fetch(url, { method: "DELETE" });
}

export const store = {
  enabled: USE_DB,

  async upsertProfile(p: { wallet: string; embedded?: string; email?: string; did?: string }) {
    if (!USE_DB) return;
    await jpost("/api/db/profile", p);
  },

  // ---- CLABE ----
  async getClabe(wallet: string): Promise<string | null> {
    if (USE_DB) return (await jget<{ clabe: string | null }>(`/api/db/clabe?wallet=${wallet}`)).clabe;
    return LS.getStr(key("clabe", wallet));
  },
  async setClabe(wallet: string, clabe: string) {
    if (USE_DB) return void (await jpost("/api/db/clabe", { wallet, clabe }));
    LS.setStr(key("clabe", wallet), clabe);
  },

  // ---- Bancos (retiro) ----
  async listBanks(wallet: string): Promise<StoreBank[]> {
    if (USE_DB) return (await jget<{ banks: StoreBank[] }>(`/api/db/banks?wallet=${wallet}`)).banks ?? [];
    return LS.get<StoreBank[]>(key("banks", wallet), []);
  },
  async addBank(wallet: string, bank: StoreBank) {
    if (USE_DB) return void (await jpost("/api/db/banks", { wallet, bank }));
    const list = LS.get<StoreBank[]>(key("banks", wallet), []);
    LS.set(key("banks", wallet), [...list.filter((b) => b.id !== bank.id), bank]);
  },

  // ---- Bóvedas ----
  async listVaults(wallet: string): Promise<StoreVault[]> {
    if (USE_DB) return (await jget<{ vaults: StoreVault[] }>(`/api/db/vaults?wallet=${wallet}`)).vaults ?? [];
    return LS.get<StoreVault[]>(key("vaults", wallet), []);
  },
  async upsertVault(wallet: string, vault: StoreVault) {
    if (USE_DB) return void (await jpost("/api/db/vaults", { wallet, vault }));
    const list = LS.get<StoreVault[]>(key("vaults", wallet), []);
    LS.set(key("vaults", wallet), [...list.filter((v) => v.id !== vault.id), vault]);
  },
  async deleteVault(wallet: string, id: string) {
    if (USE_DB) return void (await jdel(`/api/db/vaults?wallet=${wallet}&id=${id}`));
    const list = LS.get<StoreVault[]>(key("vaults", wallet), []);
    LS.set(key("vaults", wallet), list.filter((v) => v.id !== id));
  },

  // ---- Bono ----
  async getBonus(wallet: string): Promise<boolean> {
    if (USE_DB) return Boolean((await jget<{ claimed: boolean }>(`/api/db/bonus?wallet=${wallet}`)).claimed);
    return Boolean(LS.getStr(key("bonus", wallet)));
  },
  async setBonus(wallet: string, amount: number, txId?: string) {
    if (USE_DB) return void (await jpost("/api/db/bonus", { wallet, amount, txId }));
    LS.setStr(key("bonus", wallet), "1");
  },
};
