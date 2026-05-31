"use client";

// Bóvedas de ahorro del usuario, persistidas en localStorage (por wallet).
// (Tracker personal de metas; un vault on-chain real sería el siguiente paso.)
import { useCallback, useEffect, useState } from "react";

export interface UserVault {
  id: string;
  nm: string;
  goal: number;
  bal: number;
  apy: number;
  color: string;
  createdAt: number;
}

const KEY = (addr?: string) => `seyf_vaults_${(addr ?? "anon").toLowerCase()}`;

export function useVaults(address?: string) {
  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [ready, setReady] = useState(false);

  // Carga inicial.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY(address));
      setVaults(raw ? (JSON.parse(raw) as UserVault[]) : []);
    } catch {
      setVaults([]);
    }
    setReady(true);
  }, [address]);

  const persist = useCallback(
    (next: UserVault[]) => {
      setVaults(next);
      try {
        localStorage.setItem(KEY(address), JSON.stringify(next));
      } catch {
        /* ignora */
      }
    },
    [address],
  );

  const addVault = useCallback(
    (v: { nm: string; goal: number; apy: number; color: string }) => {
      const nuevo: UserVault = {
        id: `v_${Date.now()}`,
        nm: v.nm,
        goal: v.goal,
        bal: 0,
        apy: v.apy,
        color: v.color,
        createdAt: Date.now(),
      };
      persist([...vaults, nuevo]);
      return nuevo;
    },
    [vaults, persist],
  );

  const updateBalance = useCallback(
    (id: string, delta: number) => {
      persist(
        vaults.map((v) =>
          v.id === id ? { ...v, bal: Math.max(0, Math.min(v.goal, v.bal + delta)) } : v,
        ),
      );
    },
    [vaults, persist],
  );

  const removeVault = useCallback(
    (id: string) => persist(vaults.filter((v) => v.id !== id)),
    [vaults, persist],
  );

  const totalSaved = vaults.reduce((s, v) => s + v.bal, 0);

  return { vaults, ready, addVault, updateBalance, removeVault, totalSaved };
}
