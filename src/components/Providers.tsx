"use client";

/* Provee la wallet Stellar (Pollar: correo + código, sin seed phrase) a toda la
   app. SEYF es full Stellar: no hay Privy ni EVM. */
import PollarBridge from "./wallet/PollarBridge";
import SeyfPollarProvider from "./providers/SeyfPollarProvider";
import { StellarConnectProvider } from "./app/StellarConnectGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SeyfPollarProvider>
      <PollarBridge>
        <StellarConnectProvider>{children}</StellarConnectProvider>
      </PollarBridge>
    </SeyfPollarProvider>
  );
}
