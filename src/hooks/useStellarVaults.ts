"use client";

import { useCallback, useEffect, useState } from "react";
import { usePollar } from "@pollar/react";
import { store, type StoreVault } from "@/lib/store";
import { planById } from "@/components/app/data";
import {
  DEFINDEX_STRATEGIES as DEFINDEX_STRATEGIES_LIST,
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
import { pollStellarBalance } from "@/lib/seyf/stellar-balance-refresh";
import { fundStellarWallet } from "@/lib/seyf/use-ensure-stellar-funding";
import type { VaultLimits } from "@/lib/chain";
import { buildSignSubmit, getVaultPosition } from "@/components/retiro/api";
import { useAppRetiro } from "@/components/app/RetiroContext";

/**
 * Vault USDC de mainnet (Meru): el mismo que usa `seyf_advance`. Se lee y se
 * mueve por /api/vault/* (XDR del servidor → firma Pollar → fee-bump del
 * sponsor), el camino verificado en mainnet. Las demás estrategias (solo
 * testnet) siguen por la API de DeFindex.
 */
const ADVANCE_VAULT = (
  process.env.NEXT_PUBLIC_DEFINDEX_VAULT_USDC?.trim() ||
  process.env.NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS?.trim() ||
  ""
).toUpperCase();

const USDC_UNITS = 10 ** 7;

function isAdvanceVaultPlan(planId?: string): boolean {
  const addr = strategyByPlanId(planId)?.vaultAddress?.toUpperCase();
  return Boolean(ADVANCE_VAULT && addr && addr === ADVANCE_VAULT);
}

/** Monto decimal → unidades mínimas (7 decimales), sin pasar por float al firmar. */
function toUnitsStr(amount: number): string {
  const [i, f = ""] = Math.abs(amount).toFixed(7).split(".");
  return (BigInt(i) * BigInt(USDC_UNITS) + BigInt(f.padEnd(7, "0"))).toString();
}

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
  const { isAuthenticated, wallet, refreshWalletBalance: refreshBalance, getClient } = usePollar();
  const walletAddress = wallet?.address;
  const metaKey = address;
  const publicKey = isAuthenticated ? walletAddress : undefined;
  const onchain = STELLAR_VAULTS_ONCHAIN && Boolean(publicKey);
  // Sin sesión SEP-10 no se puede leer ni la metadata (/api/db) ni el vault.
  const sessionOk = useAppRetiro()?.sep10.state === "ok";

  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const limits = null as VaultLimits | null;

  const reload = useCallback(async () => {
    if (!metaKey) {
      setVaults([]);
      setReady(true);
      return;
    }
    // Sin sesión SEP-10 no hay metadata (/api/db responde 401), pero el saldo del
    // vault USDC es público on-chain: se muestra igual, sin guardar nada.
    const raw = sessionOk ? (await store.listVaults(metaKey)).sort((a, b) => a.createdAt - b.createdAt) : [];
    let meta = raw.map(normalizeVaultMeta);

    // Ahorro en el vault USDC sin bóveda guardada (otro dispositivo, o depositado
    // desde /retiro): se muestra como "Ahorro para el retiro" en vez de ocultarlo.
    const advStrategy = DEFINDEX_STRATEGIES_LIST.find((s) => isAdvanceVaultPlan(s.planId));
    if (onchain && publicKey && advStrategy && !meta.some((v) => v.planId === advStrategy.planId)) {
      try {
        const pos = await getVaultPosition(publicKey);
        if (Number(pos.value) > 0) {
          const synth = normalizeVaultMeta({
            id: `v_${Date.now()}`,
            nm: "Ahorro para el retiro",
            goal: 0,
            bal: Number(pos.value) / USDC_UNITS,
            apy: 0,
            color: advStrategy.color,
            planId: advStrategy.planId,
            strategyId: advStrategy.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          meta = [...meta, synth];
          if (sessionOk) void store.upsertVault(metaKey, synth);
        }
      } catch {
        /* sin posición legible no inventamos bóveda */
      }
    }

    // Persistir planId/strategyId inferidos en bóvedas antiguas.
    await Promise.all(
      meta.map(async (v, i) => {
        // La bóveda sintetizada arriba no tiene par en `raw` (ya se guardó aparte).
        const prev = raw[i];
        if (sessionOk && prev && (prev.planId !== v.planId || prev.strategyId !== v.strategyId)) {
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
        if (isAdvanceVaultPlan(planId)) {
          try {
            const pos = await getVaultPosition(publicKey!);
            const bal = Number(pos.value) / USDC_UNITS;
            onchainBalCache.set(cacheKey, { bal, ts: Date.now() });
            let updatedAt = v.updatedAt ?? Date.now();
            if (sessionOk && metaKey && bal !== v.bal) {
              updatedAt = Date.now();
              void store.upsertVault(metaKey, { ...v, bal, updatedAt });
            }
            return { ...v, bal, updatedAt };
          } catch {
            return { ...v, bal: lastKnown };
          }
        }
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
            if (sessionOk && metaKey && (bal !== v.bal || apy !== v.apy)) {
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
  }, [metaKey, publicKey, onchain, sessionOk]);

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
      // Un plan = una posición on-chain: dos bóvedas del mismo plan mostrarían el saldo doble.
      const same = vaults.find((x) => inferPlanIdForVault(x) === v.planId);
      if (same) return same;
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
      // Si la bóveda no volvió del store (p. ej. Supabase no la guardó), no caer a
      // "conservador" (DeFindex API, solo testnet): usar el vault USDC si existe.
      const advPlanId = DEFINDEX_STRATEGIES_LIST.find((s) => isAdvanceVaultPlan(s.planId))?.planId;
      const planId = vault ? inferPlanIdForVault(vault) : (advPlanId ?? "conservador");

      setBusy(true);
      try {
        if (isAdvanceVaultPlan(planId)) {
          let body:
            | { action: "deposit"; address: string; amount: string }
            | { action: "withdraw"; address: string; shares: string };
          if (delta > 0) {
            body = { action: "deposit", address: publicKey, amount: toUnitsStr(delta) };
          } else {
            // Retiro por monto → acciones, hacia abajo; si pide todo, todas las acciones.
            const pos = await getVaultPosition(publicKey);
            const shares = BigInt(pos.shares || "0");
            const value = BigInt(pos.value || "0");
            const want = BigInt(toUnitsStr(delta));
            if (value <= BigInt(0) || shares <= BigInt(0)) throw new Error("No tienes saldo en esta bóveda.");
            const s = want >= value ? shares : (want * shares) / value;
            body = { action: "withdraw", address: publicKey, shares: s.toString() };
          }
          const hash = await buildSignSubmit(getClient(), publicKey, "/api/vault/build", body);
          onchainBalCache.delete(`${publicKey}:${planId}`);
          if (metaKey && vault) {
            const nextBal = Math.max(0, vault.bal + delta);
            const patched = { ...vault, bal: nextBal, updatedAt: Date.now() };
            setVaults((prev) => prev.map((x) => (x.id === id ? patched : x)));
            await store.upsertVault(metaKey, patched);
          }
          // El ledger tarda unos segundos: releer después, sin bloquear el modal.
          setTimeout(() => void reload(), 5_000);
          void refreshBalance();
          return hash;
        }

        // En testnet la wallet Pollar necesita XLM para pagar las fees de la firma.
        // Idempotente: si ya tiene saldo, no vuelve a fondear. Si el fondeo falla
        // (p. ej. friendbot rate-limited con muchas cuentas nuevas), abortamos con
        // un mensaje claro en vez de dejar que DeFindex falle con "no fondos".
        const funding = await fundStellarWallet(publicKey);
        if (!funding.ok) {
          throw new Error(
            `No pudimos fondear tu wallet con XLM de prueba (${funding.error}). Espera unos segundos e intenta de nuevo.`,
          );
        }

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

        // Reconciliación en segundo plano: pollStellarBalance recorre ~32 s de reintentos.
        // NO debe bloquear el éxito del modal — el tx ya está on-chain y el saldo optimista
        // ya se reflejó. Corre aparte y refresca cuando la red propague.
        void (async () => {
          try {
            await pollStellarBalance(refreshBalance, publicKey);
            await reload();
          } catch {
            // el saldo optimista ya está; el poll de fondo reintenta solo
          }
        })();

        return hash;
      } finally {
        setBusy(false);
      }
    },
    [publicKey, onchain, vaults, signAndSubmit, refreshBalance, reload, metaKey, getClient],
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
    reload,
    totalSaved,
    /** Hay sesión SEP-10: se puede leer y guardar la metadata de las bóvedas. */
    sessionOk,
  };
}
