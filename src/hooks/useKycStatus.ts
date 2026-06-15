"use client";

import { useEffect, useState } from "react";
import { useReyfStellarWallet } from "@/lib/reyf/use-reyf-stellar-wallet";

const VERIFIED = new Set(["approved", "approved_chain_deploying", "proposed"]);

/**
 * Estado de verificación de identidad (KYC) del usuario, para gatear las
 * bóvedas que lo requieren. Degrada con gracia: si el servicio de identidad no
 * está configurado, no bloquea (verified=true).
 */
export function useKycStatus() {
  const stellar = useReyfStellarWallet();
  const [verified, setVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    // Sin servicio de identidad: no gatear.
    if (!stellar.enabled) {
      setVerified(true);
      setLoading(false);
      return;
    }
    // Aún sin cuenta verificada conectada.
    if (!stellar.authenticated || !stellar.publicKey) {
      setVerified(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch("/api/reyf/kyc/status")
      .then((r) => r.json().catch(() => ({})))
      .then((j) => {
        if (cancelled) return;
        const status = j?.kyc?.status as string | undefined;
        setVerified(!!status && VERIFIED.has(status));
      })
      .catch(() => !cancelled && setVerified(false))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [stellar.enabled, stellar.authenticated, stellar.publicKey]);

  return { verified, loading, enabled: stellar.enabled };
}
