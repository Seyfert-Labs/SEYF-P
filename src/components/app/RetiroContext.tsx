"use client";

/* Estado on-chain del ahorro para el retiro, compartido por toda la app:
   sesión SEP-10, cuenta Stellar, posición en el vault USDC (Meru) y adelanto
   de `seyf_advance`. Es la misma infraestructura de /retiro (verificada en
   mainnet), montada una sola vez dentro del shell de la app. */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { stellarWalletNetworkFromEnv } from "@/lib/stellar/network";
import { usdcIssuer } from "@/components/retiro/api";
import { useRetiroData } from "@/components/retiro/useRetiroData";
import { useSep10 } from "@/components/retiro/RetiroApp";
import type { RetiroCtx } from "@/components/retiro/types";

type Sep10 = ReturnType<typeof useSep10>;
type AppRetiro = { ctx: RetiroCtx; sep10: Sep10 } | null;

const Ctx = createContext<AppRetiro>(null);

/** `null` si no hay sesión de Pollar todavía. */
export const useAppRetiro = () => useContext(Ctx);

/** Igual que `useAppRetiro`, con `goTo` propio de la pantalla que lo usa. */
export function useRetiroCtx(goTo: RetiroCtx["goTo"]): RetiroCtx | null {
  const app = useAppRetiro();
  return useMemo(() => (app ? { ...app.ctx, goTo } : null), [app, goTo]);
}

export function RetiroProvider({ children }: { children: ReactNode }) {
  const stellar = useSeyfStellarWallet();
  const publicKey = stellar.authenticated ? stellar.publicKey : null;
  return publicKey ? (
    <Authed publicKey={publicKey} getClient={stellar.getClient}>
      {children}
    </Authed>
  ) : (
    <Ctx.Provider value={null}>{children}</Ctx.Provider>
  );
}

function Authed({
  publicKey,
  getClient,
  children,
}: {
  publicKey: string;
  getClient: RetiroCtx["getClient"];
  children: ReactNode;
}) {
  const network = stellarWalletNetworkFromEnv();
  const issuer = usdcIssuer(network);
  const sep10 = useSep10(publicKey, getClient);
  const data = useRetiroData(publicKey, issuer, sep10.state === "ok");

  const value = useMemo<AppRetiro>(
    () => ({
      ctx: { publicKey, network, usdcIssuer: issuer, getClient, data, goTo: () => {} },
      sep10,
    }),
    [publicKey, network, issuer, getClient, data, sep10],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
