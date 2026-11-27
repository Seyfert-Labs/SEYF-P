"use client";

import CrossmintBridge from "./wallet/CrossmintBridge";
import SeyfCrossmintProvider from "./providers/SeyfCrossmintProvider";
import { StellarConnectProvider } from "./app/StellarConnectGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SeyfCrossmintProvider>
      <CrossmintBridge>
        <StellarConnectProvider>{children}</StellarConnectProvider>
      </CrossmintBridge>
    </SeyfCrossmintProvider>
  );
}
