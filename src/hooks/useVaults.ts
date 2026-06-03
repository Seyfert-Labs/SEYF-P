"use client";

// Bóvedas de ahorro del usuario.
// - Si el contrato ReyfVaults está configurado (NEXT_PUBLIC_SEYF_VAULTS_ADDRESS),
//   las bóvedas son reales on-chain: se abren, abonan y retiran MXNB vía la
//   smart wallet (gas patrocinado) y el saldo se lee del contrato.
// - Si no, cae a la capa `store` (Supabase/localStorage). Degradación graceful.
import { useCallback, useEffect, useState } from "react";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { store, type StoreVault } from "@/lib/store";
import { useWallet } from "@/components/wallet/WalletContext";
import { planByApy } from "@/components/app/data";
import {
  VAULTS_ONCHAIN,
  SEYF_VAULTS_ADDRESS,
  reyfVaultsAbi,
  erc20Abi,
  MXNB_ADDRESS,
  MXNB_DECIMALS,
  readOnchainVaults,
  waitForTx,
} from "@/lib/chain";

export type UserVault = StoreVault;

const toUnits = (n: number) => parseUnits(n.toFixed(MXNB_DECIMALS), MXNB_DECIMALS);

export function useVaults(address?: string) {
  const wallet = useWallet();
  const onchain = VAULTS_ONCHAIN && Boolean(address);

  const [vaults, setVaults] = useState<UserVault[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!address) {
      setVaults([]);
      setReady(true);
      return;
    }
    if (onchain) {
      try {
        const list = await readOnchainVaults(address as Address);
        setVaults(
          list
            .map((v) => ({
              id: String(v.vaultId),
              nm: v.name,
              goal: v.goal,
              bal: v.balance,
              apy: v.apy,
              color: planByApy(v.apy).color,
              createdAt: v.createdAt,
            }))
            .sort((a, b) => a.createdAt - b.createdAt),
        );
      } catch {
        setVaults([]);
      }
      setReady(true);
      return;
    }
    // Sin contrato no hay saldo real: los planes/metas se guardan, pero el
    // balance siempre es 0 (no fabricamos saldos falsos).
    const list = await store.listVaults(address);
    setVaults(list.map((v) => ({ ...v, bal: 0 })).sort((a, b) => a.createdAt - b.createdAt));
    setReady(true);
  }, [address, onchain]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addVault = useCallback(
    async (v: { nm: string; goal: number; apy: number; color: string }): Promise<UserVault | undefined> => {
      if (!address) return;
      if (onchain) {
        setBusy(true);
        try {
          const data = encodeFunctionData({
            abi: reyfVaultsAbi,
            functionName: "openVault",
            args: [v.nm, toUnits(v.goal), Math.round(v.apy * 100)],
          });
          const hash = await wallet.sendTx(SEYF_VAULTS_ADDRESS as string, data);
          await waitForTx(hash as `0x${string}`);
          await reload();
        } finally {
          setBusy(false);
        }
        return;
      }
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
      void store.upsertVault(address, nuevo);
      return nuevo;
    },
    [address, onchain, wallet, reload],
  );

  const updateBalance = useCallback(
    async (id: string, delta: number) => {
      if (!address || delta === 0) return;
      // Sin contrato no se fondea: abonar/retirar solo existen on-chain.
      if (!onchain) return;
      setBusy(true);
      try {
        const vaultId = BigInt(id);
        const amount = toUnits(Math.abs(delta));
        if (delta > 0) {
          // Abonar: aprobar MXNB al contrato y depositar.
          const approve = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [SEYF_VAULTS_ADDRESS as Address, amount],
          });
          await waitForTx((await wallet.sendTx(MXNB_ADDRESS as string, approve)) as `0x${string}`);
          const deposit = encodeFunctionData({ abi: reyfVaultsAbi, functionName: "deposit", args: [vaultId, amount] });
          await waitForTx((await wallet.sendTx(SEYF_VAULTS_ADDRESS as string, deposit)) as `0x${string}`);
        } else {
          // Retirar.
          const withdraw = encodeFunctionData({ abi: reyfVaultsAbi, functionName: "withdraw", args: [vaultId, amount] });
          await waitForTx((await wallet.sendTx(SEYF_VAULTS_ADDRESS as string, withdraw)) as `0x${string}`);
        }
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [address, onchain, wallet, reload],
  );

  const removeVault = useCallback(
    async (id: string) => {
      if (!address) return;
      if (onchain) {
        setBusy(true);
        try {
          const data = encodeFunctionData({ abi: reyfVaultsAbi, functionName: "closeVault", args: [BigInt(id)] });
          await waitForTx((await wallet.sendTx(SEYF_VAULTS_ADDRESS as string, data)) as `0x${string}`);
          await reload();
        } finally {
          setBusy(false);
        }
        return;
      }
      setVaults((prev) => prev.filter((v) => v.id !== id));
      void store.deleteVault(address, id);
    },
    [address, onchain, wallet, reload],
  );

  const totalSaved = vaults.reduce((s, v) => s + v.bal, 0);

  return { vaults, ready, busy, onchain, addVault, updateBalance, removeVault, totalSaved };
}
