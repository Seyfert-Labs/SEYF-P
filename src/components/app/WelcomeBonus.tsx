"use client";

/* Bono de bienvenida: $300 MXN en CETES depositados a la bóveda del usuario
   nuevo vía Etherfuse onramp (MXN → CETES Stellar). El bono se activa una sola
   vez; si el usuario ya lo reclamó queda oculto permanentemente. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useKycStatus } from "@/hooks/useKycStatus";
import { store } from "@/lib/store";
import { Portal } from "./Portal";

const BONUS_AMOUNT = 300;
const DISMISS_KEY = "seyf_bonus_dismissed";

type Status = "idle" | "quoting" | "ordering" | "processing" | "done" | "slow" | "error";

export function WelcomeBonus() {
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  const kyc = useKycStatus();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });
  const claimStarted = useRef(false);

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  const address = wallet.address ?? stellar.publicKey ?? null;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) return;
      const claimed = await store.getBonus(address);
      if (active) setAlreadyClaimed(claimed);
    })();
    return () => { active = false; };
  }, [address]);

  const claim = useCallback(async () => {
    if (!address || !stellar.publicKey || claimStarted.current) return;
    claimStarted.current = true;
    setStatus("quoting");
    setError(null);

    try {
      const quoteRes = await fetch("/api/seyf/etherfuse/quote/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAmount: String(BONUS_AMOUNT),
          wallet: stellar.publicKey,
        }),
      });
      const quoteData = await quoteRes.json();
      if (!quoteRes.ok) {
        throw new Error(quoteData?.error?.message_es ?? quoteData?.error ?? "No se pudo cotizar el bono");
      }
      const quoteId = quoteData?.quote?.quoteId ?? quoteData?.quote?.quote_id;
      if (!quoteId) throw new Error("Etherfuse no devolvió quoteId");

      setStatus("ordering");

      const orderRes = await fetch("/api/seyf/etherfuse/order/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, wallet: stellar.publicKey }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        const msg = orderData?.error?.message_es ?? orderData?.error ?? "No se pudo crear la orden";
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      await store.setBonus(address, BONUS_AMOUNT, orderData?.orderId);
      setAlreadyClaimed(true);
      setStatus("processing");

      // Etherfuse procesa la orden en segundo plano (fiat simulado en sandbox,
      // SPEI real en prod). Mostramos "procesando" con timeout.
      setTimeout(() => setStatus((s) => (s === "processing" ? "done" : s)), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reclamar el bono");
      setStatus("error");
      claimStarted.current = false;
    }
  }, [address, stellar.publicKey]);

  // Solo mostrar si: autenticado, wallet Stellar activa, KYC aprobado, no reclamó antes.
  const showBanner =
    wallet.enabled &&
    wallet.authenticated &&
    stellar.enabled &&
    stellar.authenticated &&
    !!stellar.publicKey &&
    kyc.enabled &&
    !kyc.loading &&
    kyc.verified &&
    !alreadyClaimed &&
    !dismissed &&
    status === "idle";

  return (
    <>
      {showBanner && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginTop: 14, padding: "12px 14px",
          background: "var(--accent-soft)", borderRadius: 14,
          border: "1px solid var(--accent)",
        }}>
          <span style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "var(--accent)", color: "var(--on-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="leaf" size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--txt)", lineHeight: 1.3 }}>
              Obtén $300 en tu bóveda
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
              Sin costo. Se acreditarán en CETES a tu ahorro.
            </p>
          </div>
          <button
            onClick={claim}
            style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 11,
              background: "var(--accent)", color: "var(--on-accent)",
              border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}
          >
            Activar
          </button>
          <button
            onClick={dismiss}
            aria-label="En otro momento"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 18, lineHeight: 1, color: "var(--txt-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      )}

      {status !== "idle" && (
        <Portal><div className="modal-overlay" onClick={() => (status === "done" || status === "error" || status === "slow") && setStatus("idle")}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 30 }}>
            <div className="modal-grab" />

            {(status === "quoting" || status === "ordering" || status === "processing") && (
              <>
                <div className="logo-mark brand" style={{ margin: "8px auto 18px", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon name="leaf" size={26} />
                </div>
                <p className="modal-title" style={{ textAlign: "center" }}>
                  {status === "quoting" ? "Preparando tu bono…" : status === "ordering" ? "Creando orden…" : "Procesando tu bono"}
                </p>
                <p className="modal-sub" style={{ textAlign: "center" }}>
                  {status === "quoting"
                    ? "Cotizando $300 MXN en CETES para tu bóveda."
                    : status === "ordering"
                      ? "Estamos reservando tu bono."
                      : "Tus CETES se están depositando en tu bóveda de ahorro. Puede tomar unos minutos."}
                </p>
                <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 4px" }}>
                  <span className="spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
                </div>
              </>
            )}

            {status === "done" && (
              <>
                <div style={{ fontSize: 52, margin: "6px 0 4px" }}>🎉</div>
                <p className="modal-title" style={{ textAlign: "center" }}>
                  ¡Bono activado!
                </p>
                <p className="modal-sub" style={{ textAlign: "center" }}>
                  <b style={{ color: "var(--accent)" }}>$300 MXN</b> en CETES se están depositando a tu bóveda de ahorro. Aparecerán en tu saldo de bóveda una vez que Etherfuse confirme la operación.
                </p>
                <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setStatus("idle")}>Listo</button>
              </>
            )}

            {status === "error" && (
              <>
                <div style={{ fontSize: 44, margin: "6px 0 4px" }}>⚠️</div>
                <p className="modal-title" style={{ textAlign: "center" }}>No se pudo activar el bono</p>
                <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>
                <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => { setStatus("idle"); claimStarted.current = false; }}>Cerrar</button>
              </>
            )}
          </div>
        </div></Portal>
      )}
    </>
  );
}
