"use client";

import { useCallback, useEffect, useState } from "react";
import { useReyfStellarWallet } from "@/lib/reyf/use-reyf-stellar-wallet";

const VERIFIED = new Set(["approved", "approved_chain_deploying", "proposed"]);

export const KYC_STATUS_UPDATED_EVENT = "reyf:kyc-status-updated";

/** Notifica a pantallas (inicio, perfil) que el KYC cambió sin recargar la app. */
export function notifyKycStatusUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(KYC_STATUS_UPDATED_EVENT));
  }
}

/**
 * Estado de verificación de identidad (KYC) del usuario, para gatear las
 * bóvedas que lo requieren. Degrada con gracia: si el servicio de identidad no
 * está configurado, no bloquea (verified=true).
 */
export function useKycStatus() {
  const stellar = useReyfStellarWallet();
  const [verified, setVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!stellar.enabled) {
      setVerified(true);
      setLoading(false);
      return;
    }
    if (!stellar.authenticated || !stellar.publicKey) {
      setVerified(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/reyf/kyc/status");
      const j = await r.json().catch(() => ({}));
      const status = j?.kyc?.status as string | undefined;
      setVerified(!!status && VERIFIED.has(status));
    } catch {
      setVerified(false);
    } finally {
      setLoading(false);
    }
  }, [stellar.enabled, stellar.authenticated, stellar.publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => void refresh();
    window.addEventListener(KYC_STATUS_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener(KYC_STATUS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refresh]);

  return { verified, loading, enabled: stellar.enabled, refresh };
}
