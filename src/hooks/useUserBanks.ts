"use client";

// Cuentas bancarias (CLABE destino) registradas por CADA usuario.
// Las cuentas se crean en Juno (register-bank, a nivel negocio), pero aquí
// guardamos cuáles pertenecen a este usuario para mostrar solo las suyas.
// (En producción esta relación user→cuenta vive en tu base de datos.)
import { useCallback, useEffect, useState } from "react";

export interface UserBank {
  id: string;
  tag: string;
  clabe: string;
  recipient_legal_name: string;
}

const KEY = (a?: string) => `seyf_banks_${(a ?? "anon").toLowerCase()}`;

export function useUserBanks(address?: string) {
  const [list, setList] = useState<UserBank[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setList(JSON.parse(localStorage.getItem(KEY(address)) || "[]") as UserBank[]);
    } catch {
      setList([]);
    }
  }, [address]);

  const persist = useCallback(
    (next: UserBank[]) => {
      setList(next);
      try {
        localStorage.setItem(KEY(address), JSON.stringify(next));
      } catch {
        /* ignora */
      }
    },
    [address],
  );

  const add = useCallback(
    (b: UserBank) => {
      setList((prev) => {
        const next = [...prev.filter((x) => x.id !== b.id), b];
        try {
          localStorage.setItem(KEY(address), JSON.stringify(next));
        } catch {
          /* ignora */
        }
        return next;
      });
    },
    [address],
  );

  const remove = useCallback(
    (id: string) => persist(list.filter((b) => b.id !== id)),
    [list, persist],
  );

  return { list, add, remove };
}
