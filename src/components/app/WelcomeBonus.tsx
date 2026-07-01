"use client";

/* Bono de bienvenida: $300 MXN en CETES depositados a la bóveda del usuario
   vía Etherfuse onramp (MXN → CETES Stellar). Visible siempre en Perfil:
   - Si ya se reclamó: muestra badge "Bono activado"
   - Si no se ha reclamado y cumple requisitos: botón "Activar" */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useKycStatus } from "@/hooks/useKycStatus";
import { store } from "@/lib/store";
import { Portal } from "./Portal";

const BONUS_AMOUNT = 300;

type Status = "idle" | "quoting" | "ordering" | "processing" | "done" | "error";

export function WelcomeBonus() {
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  const kyc = useKycStatus();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const claimStarted = useRef(false);

  const address = wallet.address ?? stellar.publicKey ?? null;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) { setClaimed(null); return; }
      const done = await store.getBonus(address);
      if (active) setClaimed(done);
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
      setClaimed(true);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reclamar el bono");
      setStatus("error");
      claimStarted.current = false;
    }
  }, [address, stellar.publicKey]);

  const canClaim =
    wallet.enabled &&
    wallet.authenticated &&
    stellar.enabled &&
    stellar.authenticated &&
    !!stellar.publicKey &&
    kyc.enabled &&
    !kyc.loading &&
    kyc.verified &&
    claimed === false;

  const showClaimed = claimed === true;

  // No renderizar nada hasta saber el estado del bono
  if (claimed === null && !wallet.authenticated) return null;

  return (
    <>
      <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Bono de bienvenida</p>

      {showClaimed && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: "var(--accent-soft)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="check" size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>Bono activado</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
              $300 MXN en CETES se depositaron a tu bóveda de ahorro.
            </p>
          </div>
          <span className="pos-pill"><Icon name="leaf" size={12} /> CETES</span>
        </div>
      )}

      {canClaim && (
        <div className="card" style={{
          display: "flex", alignItems: "center", gap: 14,
          border: "1px solid var(--accent)", background: "var(--accent-soft)",
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: "var(--accent)", color: "var(--on-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="leaf" size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>
              Obtén $300 en tu bóveda de ahorro
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
              Sin costo. Se depositarán en CETES a tu ahorro.
            </p>
          </div>
          <button
            onClick={claim}
            disabled={status !== "idle"}
            style={{
              flexShrink: 0, padding: "9px 18px", borderRadius: 11,
              background: "var(--accent)", color: "var(--on-accent)",
              border: "none", fontWeight: 800, fontSize: 13,
              cursor: status === "idle" ? "pointer" : "default",
              opacity: status === "idle" ? 1 : 0.6,
            }}
          >
            Activar
          </button>
        </div>
      )}

      {!showClaimed && !canClaim && claimed === false && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, opacity: 0.7 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: "var(--surface-2)", border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="lock" size={20} color="var(--txt-muted)" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>$300 en CETES gratis</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
              Verifica tu identidad para activar tu bono de bienvenida.
            </p>
          </div>
        </div>
      )}

      {status !== "idle" && status !== "done" && (
        <Portal><div className="modal-overlay" onClick={() => status === "error" && setStatus("idle")}>
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
                      ? "Reservando tus CETES."
                      : "Tus CETES se están depositando en tu bóveda de ahorro."}
                </p>
                <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 4px" }}>
                  <span className="spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div style={{ fontSize: 44, margin: "6px 0 4px" }}>⚠️</div>
                <p className="modal-title" style={{ textAlign: "center" }}>No se pudo activar</p>
                <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>
                <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => { setStatus("idle"); claimStarted.current = false; }}>Cerrar</button>
              </>
            )}
          </div>
        </div></Portal>
      )}

      {status === "done" && (
        <Portal><div className="modal-overlay" onClick={() => setStatus("idle")}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 30 }}>
            <div className="modal-grab" />
            <div style={{ fontSize: 52, margin: "6px 0 4px" }}>🎉</div>
            <p className="modal-title" style={{ textAlign: "center" }}>¡Bono activado!</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              <b style={{ color: "var(--accent)" }}>$300 MXN</b> en CETES se depositarán a tu bóveda de ahorro. Aparecerán cuando Etherfuse confirme la operación.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setStatus("idle")}>Listo</button>
          </div>
        </div></Portal>
      )}
    </>
  );
}
