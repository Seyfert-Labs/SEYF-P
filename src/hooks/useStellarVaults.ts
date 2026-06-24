"use client";

// Bóvedas de rendimiento en Stellar/Soroban respaldadas por DeFindex.
//
// Espejo de `useVaults` (riel EVM): expone la MISMA superficie pública para que
// las pantallas (invest.tsx) cambien de riel con `NEXT_PUBLIC_STELLAR_VAULTS`.
// Diferencias internas:
//  - La firma usa la wallet embebida Stellar (Pollar) en vez de Privy.
//  - El balance y el APY se leen reales on-chain vía DeFindex (route handlers
//    /api/defindex/*, que guardan la API key server-side).
//  - La metadata cosmética (nombre, meta, color) vive en `store`, igual que el
//    fallback del riel EVM.
//
// MVP: una sola DeFindex vault respalda al usuario. El saldo on-chain se
// atribuye a la primera bóveda; las demás son "cubetas" de planeación (bal 0),
// como ya ocurre en EVM sin contrato.
import { useCallback, useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import { store, type StoreVault } from "@/lib/store";
import { planByApy } from "@/components/app/data";
import {
  STELLAR_VAULTS_ONCHAIN,
  DEFINDEX_ASSET_DECIMALS,
} from "@/lib/defindex/vaults";
import type { VaultLimits } from "@/lib/chain";

export type UserVault = StoreVault;

export const MAX_VAULTS = 5;

async function postJson(url: string, body: unknown): Promise<{ xdr?: string; error?: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export function useStellarVaults(address?: string) {
  const { isAuthenticated, walletAddress, getClient, refreshBalance } = usePollar();
  // Identidad para la metadata = wallet de la app (Privy). La wallet Stellar
  // (Pollar) solo se necesita para LEER el saldo on-chain y para FIRMAR
  // depósitos/retiros — no para crear la bóveda. Así "Crear bóveda" funciona
  // aunque el usuario aún no haya enrolado Pollar (se le pedirá al abonar).
  const metaKey = address;
  const publicKey = isAuthenticated ? walletAddress : undefined;
  const onchain = STELLAR_VAULTS_ONCHAIN && Boolean(publicKey);

  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const limits: VaultLimits | null = null; // sin beta cap en el riel Stellar (MVP)

  const reload = useCallback(async () => {
    if (!metaKey) {
      setVaults([]);
      setReady(true);
      return;
    }
    const meta = (await store.listVaults(metaKey)).sort((a, b) => a.createdAt - b.createdAt);

    if (!onchain) {
      setVaults(meta.map((v) => ({ ...v, bal: 0 })));
      setReady(true);
      return;
    }

    // Saldo y APY reales de la DeFindex vault.
    let onchainBalance = 0;
    let vaultApy: number | null = null;
    try {
      const [balRes, infoRes] = await Promise.all([
        fetch(`/api/defindex/balance?publicKey=${publicKey}`).then((r) => r.json()),
        fetch(`/api/defindex/vault-info`).then((r) => r.json()),
      ]);
      onchainBalance = Number(balRes?.underlyingBalance) || 0;
      vaultApy = typeof infoRes?.apy === "number" ? infoRes.apy : null;
    } catch {
      /* si falla la lectura, mostramos metadata con saldo 0 */
    }

    setVaults(
      meta.map((v, i) => ({
        ...v,
        // El saldo on-chain se atribuye a la primera bóveda (posición única).
        bal: i === 0 ? onchainBalance : 0,
        apy: vaultApy ?? v.apy,
      })),
    );
    setReady(true);
  }, [metaKey, publicKey, onchain]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Firma el XDR con Pollar (sin re-simular) y lo envía. Devuelve el hash. */
  const signAndSubmit = useCallback(
    async (xdr: string): Promise<string> => {
      const client = getClient();
      await client.signAndSubmitTx(xdr);
      const state = client.getTransactionState();
      if (state?.step === "error") {
        const detail = state.details ? `: ${state.details}` : "";
        throw new Error(`La transacción Stellar no se completó${detail}`);
      }
      return state?.step === "success" ? state.hash : "";
    },
    [getClient],
  );

  const addVault = useCallback(
    async (v: { nm: string; goal: number; apy: number; color: string }): Promise<UserVault | undefined> => {
      if (!metaKey) return;
      if (vaults.length >= MAX_VAULTS) return undefined;
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
      await store.upsertVault(metaKey, nuevo);
      return nuevo;
    },
    [metaKey, vaults.length],
  );

  const updateBalance = useCallback(
    async (_id: string, delta: number): Promise<string | undefined> => {
      if (delta === 0) return;
      // Depositar/retirar SÍ requiere la wallet Stellar (Pollar) para firmar.
      if (!publicKey) throw new Error("Conecta tu wallet Stellar (Pollar) para abonar o retirar");
      if (!onchain) return;
      setBusy(true);
      try {
        const url = delta > 0 ? "/api/defindex/deposit" : "/api/defindex/withdraw";
        const data = await postJson(url, { caller: publicKey, amount: Math.abs(delta) });
        if (!data.xdr) throw new Error("No se pudo construir la transacción DeFindex");
        const hash = await signAndSubmit(data.xdr);
        await refreshBalance(publicKey);
        await reload();
        return hash;
      } finally {
        setBusy(false);
      }
    },
    [publicKey, onchain, signAndSubmit, refreshBalance, reload],
  );

  const removeVault = useCallback(
    async (id: string) => {
      if (!metaKey) return;
      setVaults((prev) => prev.filter((v) => v.id !== id));
      await store.deleteVault(metaKey, id);
    },
    [metaKey],
  );

  const ensureVault = useCallback(
    async (planId: string): Promise<UserVault | undefined> => {
      if (vaults.length > 0) return vaults[0];
      const plan = planByApy(8);
      return addVault({ nm: plan.name, goal: 0, apy: plan.apy, color: plan.color });
    },
    [vaults, addVault],
  );

  const totalSaved = vaults.reduce((s, v) => s + v.bal, 0);

  return {
    vaults,
    ready,
    busy,
    onchain,
    limits,
    assetDecimals: DEFINDEX_ASSET_DECIMALS,
    addVault,
    ensureVault,
    updateBalance,
    removeVault,
    totalSaved,
  };
}
