"use client";

/* Negocios dados de alta por el usuario. MVP: localStorage por wallet.
   Mismo espíritu que useVaults — luego se conecta a Supabase vía /api/db. */
import { useCallback, useEffect, useState } from "react";

export interface Business {
  id: string;
  name: string;
  product: string;     // producto principal (1 solo)
  unit: string;
  price: number;
  location: string;
  createdAt: number;
}

const key = (addr?: string) => `seyf_business_${(addr ?? "anon").toLowerCase()}`;

async function read(addr?: string): Promise<Business[]> {
  try {
    const v = localStorage.getItem(key(addr));
    return v ? (JSON.parse(v) as Business[]) : [];
  } catch {
    return [];
  }
}

export function useBusinesses(address?: string) {
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const reload = useCallback(async () => {
    setBusinesses(await read(address));
  }, [address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addBusiness = useCallback(
    (b: Omit<Business, "id" | "createdAt">) => {
      const item: Business = { ...b, id: `bz_${Date.now()}`, createdAt: Date.now() };
      setBusinesses((prev) => {
        const next = [...prev, item];
        try {
          localStorage.setItem(key(address), JSON.stringify(next));
        } catch {
          /* ignora */
        }
        return next;
      });
      return item;
    },
    [address]
  );

  const removeBusiness = useCallback(
    (id: string) => {
      setBusinesses((prev) => {
        const next = prev.filter((b) => b.id !== id);
        try {
          localStorage.setItem(key(address), JSON.stringify(next));
        } catch {
          /* ignora */
        }
        return next;
      });
    },
    [address]
  );

  return { businesses, addBusiness, removeBusiness };
}
