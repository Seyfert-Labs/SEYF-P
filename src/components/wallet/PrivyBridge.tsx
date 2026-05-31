"use client";

/* Puente: traduce el estado de Privy (auth + wallet embebida + smart wallet)
   y el saldo MXNB on-chain al WalletContext que consume la app.
   Se monta SOLO dentro de PrivyProvider + SmartWalletsProvider. */
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { WalletCtx, type WalletState } from "./WalletContext";
import { store } from "@/lib/store";
import {
  readMXNBBalance,
  erc20Abi,
  MXNB_ADDRESS,
  MXNB_DECIMALS,
  activeChain,
} from "@/lib/chain";

export default function PrivyBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { client } = useSmartWallets();

  const embeddedAddress = user?.wallet?.address as Address | undefined;
  const smartAddress = client?.account?.address as Address | undefined;
  // La dirección efectiva (saldo, recepción) es la smart wallet si existe.
  const address = smartAddress ?? embeddedAddress;
  const gaslessReady = Boolean(client);

  const email =
    user?.email?.address ||
    (user?.google?.email as string | undefined) ||
    undefined;

  // Guarda/actualiza el perfil del usuario (smart wallet + wallet embebida + correo).
  useEffect(() => {
    if (!authenticated || !address) return;
    void store.upsertProfile({ wallet: address, embedded: embeddedAddress, email, did: user?.id });
  }, [authenticated, address, embeddedAddress, email, user?.id]);

  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      setBalance(await readMXNBBalance(address));
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Error leyendo saldo on-chain");
    } finally {
      setBalanceLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) {
      setBalance(0);
      return;
    }
    void refreshBalance();
    const id = setInterval(() => void refreshBalance(), 20000);
    return () => clearInterval(id);
  }, [address, refreshBalance]);

  // Transferencia de MXNB con gas patrocinado (vía smart wallet / paymaster).
  const sendMXNB = useCallback(
    async (to: string, amount: string): Promise<string> => {
      if (!client) throw new Error("La cuenta inteligente aún no está lista.");
      const value = parseUnits(amount, MXNB_DECIMALS);
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to as Address, value],
      });
      const result = await client.sendTransaction({
        chain: activeChain,
        to: MXNB_ADDRESS,
        data,
      });
      const hash = typeof result === "string" ? result : (result as { hash?: string })?.hash ?? "";
      setTimeout(() => void refreshBalance(), 4000);
      return hash;
    },
    [client, refreshBalance],
  );

  const value: WalletState = {
    enabled: true,
    ready,
    authenticated,
    address,
    smartAddress,
    gaslessReady,
    email,
    balance,
    balanceLoading,
    balanceError,
    login,
    logout,
    refreshBalance,
    sendMXNB,
  };

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
