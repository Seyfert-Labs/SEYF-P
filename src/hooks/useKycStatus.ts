"use client";

import { useCallback, useEffect, useState } from "react";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";

const VERIFIED = new Set(["approved", "approved_chain_deploying", "proposed"]);

export const KYC_STATUS_UPDATED_EVENT = "seyf:kyc-status-updated";

const doneKey = (pk?: string | null) => `seyf_kyc_done_${pk || "anon"}`;

/** ¿El usuario ya completó el flujo de verificación en este dispositivo? */
function readKycDoneLocal(pk?: string | null): boolean {
  if (typeof window === "undefined" || !pk) return false;
  try {
    return window.localStorage.getItem(doneKey(pk)) === "1";
  } catch {
    return false;
  }
}

/**
 * Marca el KYC como completado localmente al terminar el flujo. Etherfuse (testnet)
 * puede tardar en pasar a "approved/proposed"; sin esto el banner "Verifica tu cuenta"
 * seguía apareciendo en Inicio aunque el usuario ya hubiera terminado.
 */
export function markKycCompletedLocally(pk?: string | null) {
  if (typeof window !== "undefined" && pk) {
    try {
      window.localStorage.setItem(doneKey(pk), "1");
    } catch {
      /* ignora */
    }
  }
  notifyKycStatusUpdated();
}

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
  const stellar = useSeyfStellarWallet();
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

    // Si el usuario ya completó el flujo localmente, lo damos por verificado de
    // inmediato (el estado real de Etherfuse puede tardar en propagarse).
    const localDone = readKycDoneLocal(stellar.publicKey);
    if (localDone) {
      setVerified(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const qs = stellar.publicKey ? `?wallet=${encodeURIComponent(stellar.publicKey)}` : "";
      const r = await fetch(`/api/seyf/kyc/status${qs}`);
      const j = await r.json().catch(() => ({}));
      const status = j?.kyc?.status as string | undefined;
      setVerified((!!status && VERIFIED.has(status)) || readKycDoneLocal(stellar.publicKey));
    } catch {
      setVerified(readKycDoneLocal(stellar.publicKey));
    } finally {
      setLoading(false);
    }
  }, [stellar.enabled, stellar.authenticated, stellar.publicKey]);

  useEffect(() => {
    // refresh() es async: el setState ocurre tras los awaits / en cortocircuitos, no síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
