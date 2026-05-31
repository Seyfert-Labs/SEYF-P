"use client";

// CLABE de depósito única por usuario (Juno create-clabe), persistida en
// Supabase (con fallback local). En producción la relación user→CLABE permite
// que el webhook de Juno acredite los depósitos a la wallet correcta.
import { useCallback, useEffect, useState } from "react";
import { junoService } from "@/services/junoService";
import { store } from "@/lib/store";

export function useUserClabe(address?: string) {
  const [clabe, setClabe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) {
        setClabe(null);
        return;
      }
      const c = await store.getClabe(address);
      if (active) setClabe(c);
    })();
    return () => {
      active = false;
    };
  }, [address]);

  const create = useCallback(async () => {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const r = (await junoService.createUserClabe()) as { clabe?: string };
      const c = r?.clabe ?? null;
      if (c) {
        await store.setClabe(address, c);
        setClabe(c);
      }
      return c;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la CLABE");
      return null;
    } finally {
      setLoading(false);
    }
  }, [address]);

  return { clabe, loading, error, create };
}
