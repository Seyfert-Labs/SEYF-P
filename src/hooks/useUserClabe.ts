"use client";

// CLABE de depósito única por usuario (Juno create-clabe), persistida en
// Supabase (con fallback local). Se crea automáticamente al primer acceso —
// el usuario nunca tiene que generar la manualmente.
import { useCallback, useEffect, useRef, useState } from "react";
import { junoService } from "@/services/junoService";
import { store } from "@/lib/store";

export function useUserClabe(address?: string) {
  const [clabe, setClabe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);

  const create = useCallback(async () => {
    if (!address || creating.current) return null;
    creating.current = true;
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
      creating.current = false;
    }
  }, [address]);

  // Al tener dirección: carga desde store y, si no existe, crea automáticamente.
  useEffect(() => {
    if (!address) {
      setClabe(null);
      return;
    }
    let active = true;
    (async () => {
      const stored = await store.getClabe(address);
      if (!active) return;
      if (stored) {
        setClabe(stored);
      } else {
        // Primera vez: crear en silencio, sin que el usuario lo vea.
        await create();
      }
    })();
    return () => {
      active = false;
    };
  }, [address, create]);

  return { clabe, loading, error, create };
}
