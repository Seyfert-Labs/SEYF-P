"use client";

// Cuentas bancarias (CLABE destino) registradas por CADA usuario.
// Persistidas en Supabase (con fallback local). Las cuentas se crean en Juno
// (register-bank) y aquí guardamos cuáles pertenecen a este usuario.
import { useCallback, useEffect, useState } from "react";
import { store, type StoreBank } from "@/lib/store";

export type UserBank = StoreBank;

export function useUserBanks(address?: string) {
  const [list, setList] = useState<UserBank[]>([]);

  const reload = useCallback(async () => {
    if (!address) {
      setList([]);
      return;
    }
    setList(await store.listBanks(address));
  }, [address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    (b: UserBank) => {
      if (!address) return;
      setList((prev) => [...prev.filter((x) => x.id !== b.id), b]);
      void store.addBank(address, b);
    },
    [address],
  );

  return { list, add, reload };
}
