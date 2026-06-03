"use client";

// Transacciones pendientes (optimistic UI): mientras la red confirma, el
// movimiento se muestra como "pendiente"; al detectar la transferencia on-chain
// equivalente, se retira (la fila confirmada on-chain ocupa su lugar).
// Persistido en localStorage por wallet + sincronizado entre componentes.
import { useCallback, useEffect, useState } from "react";

export interface PendingTxn {
  id: string;
  kind: "deposit" | "send";
  amount: number;
  createdAt: number;
}

const KEY = (a?: string) => `reyf_pending_${(a ?? "anon").toLowerCase()}`;
const EVT = "reyf:pending-changed";

function read(addr?: string): PendingTxn[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(addr)) || "[]") as PendingTxn[];
  } catch {
    return [];
  }
}
function write(addr: string | undefined, list: PendingTxn[]) {
  try {
    localStorage.setItem(KEY(addr), JSON.stringify(list));
  } catch {
    /* ignora */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

export function usePendingTxns(address?: string) {
  const [pending, setPending] = useState<PendingTxn[]>([]);

  useEffect(() => {
    const refresh = () => setPending(read(address));
    refresh();
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [address]);

  const add = useCallback(
    (kind: "deposit" | "send", amount: number) => {
      const list = read(address);
      list.push({ id: `p_${Date.now()}`, kind, amount, createdAt: Date.now() });
      write(address, list);
    },
    [address],
  );

  const remove = useCallback(
    (id: string) => write(address, read(address).filter((p) => p.id !== id)),
    [address],
  );

  // Retira pendientes ya reflejados on-chain (match por dirección + monto +
  // ventana de tiempo) o expirados (>10 min).
  const reconcile = useCallback(
    (onchain: { direction: "in" | "out"; value: number; timestamp: number }[]) => {
      const list = read(address);
      if (list.length === 0) return;
      const kept = list.filter((p) => {
        const dir = p.kind === "deposit" ? "in" : "out";
        const matched = onchain.some(
          (t) =>
            t.direction === dir &&
            Math.abs(t.value - p.amount) < 0.01 &&
            (t.timestamp === 0 || t.timestamp >= p.createdAt - 180000),
        );
        const expired = Date.now() - p.createdAt > 600000;
        return !matched && !expired;
      });
      if (kept.length !== list.length) write(address, kept);
    },
    [address],
  );

  return { pending, add, remove, reconcile };
}
