"use client";

// Límite mensual de depósito y retiro (20,000 MXN cada uno) por usuario.
// Acumula el monto usado por periodo (YYYY-MM) vía la capa `store`
// (Supabase si NEXT_PUBLIC_USE_SUPABASE, si no localStorage). Se reinicia
// automáticamente al cambiar de mes (el periodo es la clave).
import { useCallback, useEffect, useState } from "react";
import { store } from "@/lib/store";

export const MONTHLY_LIMIT = 20000;

type Kind = "deposit" | "withdraw";

/** Periodo actual en formato 'YYYY-MM' (UTC). */
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export function useMonthlyLimits(address?: string) {
  const [usage, setUsage] = useState<{ deposit: number; withdraw: number }>({ deposit: 0, withdraw: 0 });

  const reload = useCallback(async () => {
    if (!address) {
      setUsage({ deposit: 0, withdraw: 0 });
      return;
    }
    setUsage(await store.getMonthlyUsage(address, currentPeriod()));
  }, [address]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remaining = useCallback((kind: Kind) => Math.max(0, MONTHLY_LIMIT - usage[kind]), [usage]);

  const canDo = useCallback(
    (kind: Kind, amount: number) => amount > 0 && amount <= remaining(kind) + 1e-9,
    [remaining],
  );

  const record = useCallback(
    async (kind: Kind, amount: number) => {
      if (!address || amount <= 0) return;
      await store.addMonthlyUsage(address, currentPeriod(), kind, amount);
      setUsage((prev) => ({ ...prev, [kind]: prev[kind] + amount }));
    },
    [address],
  );

  return { usage, limit: MONTHLY_LIMIT, remaining, canDo, record, reload };
}
