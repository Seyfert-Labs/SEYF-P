"use client";

import { useCallback, useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import { store, type StoreVault } from "@/lib/store";
import { planById } from "@/components/app/data";
import {
  inferPlanIdForVault,
  inferStrategyForVault,
  strategyByPlanId,
} from "@/lib/defindex/catalog";
import {
  STELLAR_VAULTS_ONCHAIN,
  DEFINDEX_INVEST_ON_DEPOSIT,
  assetDecimalsForPlan,
  assetSymbolForPlan,
} from "@/lib/defindex/vaults";
import { signAndSubmitDefindexXdr } from "@/lib/defindex/sign-and-submit";
import type { VaultLimits } from "@/lib/chain";

export type UserVault = StoreVault;

export const MAX_VAULTS = 5;

// Último saldo on-chain conocido por (publicKey, planId), a nivel de módulo para
// compartirse entre instancias del hook (lista y detalle son instancias distintas).
// Si /api/defindex/balance viene rate-limited (sin underlyingBalance), conservamos
// este valor en vez de colapsar a 0 — eso hacía que el saldo "desapareciera" de la
// lista de bóvedas y del ahorro total aunque el detalle sí lo mostrara.
// `ts` permite un TTL corto: dentro de la ventana no re-consultamos el RPC (que
// rate-limitea agresivamente en testnet); fuera de ella, refrescamos.
const onchainBalCache = new Map<string, { bal: number; ts: number }>();
const BAL_TTL_MS = 20_000;

async function postJson(url: string, body: unknown): Promise<{ xdr?: string; error?: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

function normalizeVaultMeta(v: StoreVault): StoreVault {
  const planId = inferPlanIdForVault(v);
  const strategy = strategyByPlanId(planId)!;
  return {
    ...v,
    planId,
    strategyId: strategy.id,
  };
}

export function useStellarVaults(address?: string) {
  const { isAuthenticated, walletAddress, refreshBalance, getClient } = usePollar();
  const metaKey = address;
  const publicKey = isAuthenticated ? walletAddress : undefined;
  const onchain = STELLAR_VAULTS_ONCHAIN && Boolean(publicKey);

  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const limits: VaultLimits | null = null;

  const reload = useCallback(async () => {
    if (!metaKey) {
      setVaults([]);
      setReady(true);
      return;
    }
    const raw = (await store.listVaults(metaKey)).sort((a, b) => a.createdAt - b.createdAt);
    const meta = raw.map(normalizeVaultMeta);

    // Persistir planId/strategyId inferidos en bóvedas antiguas.
    await Promise.all(
      meta.map(async (v, i) => {
        const prev = raw[i];
        if (prev.planId !== v.planId || prev.strategyId !== v.strategyId) {
          await store.upsertVault(metaKey, v);
        }
      }),
    );

    if (!onchain) {
      // Sin Pollar: mostrar saldo persistido en Supabase (ancla del money timer).
      setVaults(meta);
      setReady(true);
      return;
    }

    const enriched = await Promise.all(
      meta.map(async (v) => {
        const planId = v.planId!;
        const cacheKey = `${publicKey}:${planId}`;
        const cached = onchainBalCache.get(cacheKey);
        // Cache reciente → reusa sin pegarle al RPC (evita el rate-limit en cascada).
        if (cached && Date.now() - cached.ts < BAL_TTL_MS) {
          return { ...v, bal: cached.bal };
        }
        // Punto de partida: último saldo conocido (cache) o el persistido en store.
        const lastKnown = cached?.bal ?? (v.bal || 0);
        try {
          const [balRes, infoRes] = await Promise.all([
            fetch(`/api/defindex/balance?publicKey=${publicKey}&planId=${planId}`).then((r) => r.json()),
            fetch(`/api/defindex/vault-info?planId=${planId}`).then((r) => r.json()),
          ]);
          const apy =
            typeof infoRes?.apy === "number" && Number.isFinite(infoRes.apy) ? infoRes.apy : v.apy;
          // Solo confiamos en el saldo si el endpoint devolvió un número (no rate-limited).
          const raw = balRes?.underlyingBalance;
          const hasBal = raw != null && Number.isFinite(Number(raw));
          const bal = hasBal ? Number(raw) : lastKnown;
          let updatedAt = v.updatedAt ?? Date.now();
          if (hasBal) {
            onchainBalCache.set(cacheKey, { bal, ts: Date.now() });
            if (metaKey && (bal !== v.bal || apy !== v.apy)) {
              updatedAt = Date.now();
              void store.upsertVault(metaKey, { ...v, bal, apy, updatedAt });
            }
          }
          return { ...v, bal, apy, updatedAt };
        } catch {
          return { ...v, bal: lastKnown };
        }
      }),
    );

    setVaults(enriched);
    setReady(true);
  }, [metaKey, publicKey, onchain]);

  useEffect(() => {
    // reload() es async: el setState ocurre tras los awaits, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const signAndSubmit = useCallback(
    async (xdr: string): Promise<string> => signAndSubmitDefindexXdr(xdr, getClient),
    [getClient],
  );

  const addVault = useCallback(
    async (v: {
      nm: string;
      goal: number;
      apy: number;
      color: string;
      planId?: string;
      strategyId?: string;
    }): Promise<UserVault | undefined> => {
      if (!metaKey) return;
      if (vaults.length >= MAX_VAULTS) return undefined;
      const base = normalizeVaultMeta({
        id: `v_${Date.now()}`,
        nm: v.nm,
        goal: v.goal,
        bal: 0,
        apy: v.apy,
        color: v.color,
        planId: v.planId,
        strategyId: v.strategyId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setVaults((prev) => [...prev, base]);
      await store.upsertVault(metaKey, base);
      return base;
    },
    [metaKey, vaults.length],
  );

  const updateBalance = useCallback(
    async (id: string, delta: number): Promise<string | undefined> => {
      if (delta === 0) return;
      if (!publicKey) throw new Error("Conecta tu wallet Stellar (Pollar) para abonar o retirar");
      if (!onchain) return;

      const vault = vaults.find((x) => x.id === id);
      const planId = vault ? inferPlanIdForVault(vault) : "conservador";

      setBusy(true);
      try {
        const url = delta > 0 ? "/api/defindex/deposit" : "/api/defindex/withdraw";
        const body =
          delta > 0
            ? { caller: publicKey, amount: Math.abs(delta), invest: DEFINDEX_INVEST_ON_DEPOSIT, planId }
            : { caller: publicKey, amount: Math.abs(delta), planId };
        const data = await postJson(url, body);
        if (!data.xdr) {
          const reason = typeof data.error === "string" ? data.error : "No se pudo construir la transacción DeFindex";
          throw new Error(reason);
        }
        const hash = await signAndSubmit(data.xdr);
        onchainBalCache.delete(`${publicKey}:${planId}`);

        // Persistir de inmediato en Supabase (suma/resta) y reanclar el money timer.
        if (metaKey && vault) {
          const nextBal = Math.max(0, vault.bal + delta);
          const now = Date.now();
          const patched = { ...vault, bal: nextBal, updatedAt: now };
          setVaults((prev) => prev.map((x) => (x.id === id ? patched : x)));
          await store.upsertVault(metaKey, patched);
          onchainBalCache.set(`${publicKey}:${planId}`, { bal: nextBal, ts: now });
        }

        await refreshBalance(publicKey);
        await reload();
        return hash;
      } finally {
        setBusy(false);
      }
    },
    [publicKey, onchain, vaults, signAndSubmit, refreshBalance, reload, metaKey],
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
      const strat = inferStrategyForVault({ planId });
      return addVault({
        nm: strat.name,
        goal: 0,
        apy: 0,
        color: strat.color,
        planId: strat.planId,
        strategyId: strat.id,
      });
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
    assetDecimals: assetDecimalsForPlan(),
    assetSymbolForPlan,
    inferStrategyForVault,
    addVault,
    ensureVault,
    updateBalance,
    removeVault,
    totalSaved,
  };
}
