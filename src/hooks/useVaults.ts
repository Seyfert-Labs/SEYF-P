"use client";

// Bóvedas de ahorro del usuario (persistidas en Supabase, con fallback local).
import { useCallback, useEffect, useRef, useState } from "react";
import { store, type StoreVault } from "@/lib/store";

export type UserVault = StoreVault;

export function useVaults(address?: string) {
  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [ready, setReady] = useState(false);
  const vaultsRef = useRef<UserVault[]>([]);
  useEffect(() => {
    vaultsRef.current = vaults;
  }, [vaults]);

  const reload = useCallback(async () => {
    if (!address) {
      setVaults([]);
      setReady(true);
      return;
    }
    const list = await store.listVaults(address);
    setVaults(list.sort((a, b) => a.createdAt - b.createdAt));
    setReady(true);
  }, [address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addVault = useCallback(
    (v: { nm: string; goal: number; apy: number; color: string }) => {
      if (!address) return;
      const nuevo: UserVault = {
        id: `v_${Date.now()}`,
        nm: v.nm,
        goal: v.goal,
        bal: 0,
        apy: v.apy,
        color: v.color,
        createdAt: Date.now(),
      };
      setVaults((prev) => [...prev, nuevo]);
      void store.upsertVault(address, nuevo);
      return nuevo;
    },
    [address],
  );

  const updateBalance = useCallback(
    (id: string, delta: number) => {
      if (!address) return;
      const cur = vaultsRef.current.find((v) => v.id === id);
      if (!cur) return;
      const updated: UserVault = { ...cur, bal: Math.max(0, Math.min(cur.goal, cur.bal + delta)) };
      setVaults((prev) => prev.map((v) => (v.id === id ? updated : v)));
      void store.upsertVault(address, updated);
    },
    [address],
  );

  const removeVault = useCallback(
    (id: string) => {
      if (!address) return;
      setVaults((prev) => prev.filter((v) => v.id !== id));
      void store.deleteVault(address, id);
    },
    [address],
  );

  const totalSaved = vaults.reduce((s, v) => s + v.bal, 0);

  return { vaults, ready, addVault, updateBalance, removeVault, totalSaved };
}
