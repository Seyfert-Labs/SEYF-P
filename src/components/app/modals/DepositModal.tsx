"use client";

/* Modal de recepción de fondos.
   Único método: SPEI (CLABE). El bloque "Simular depósito" solo aparece fuera de producción. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useKycStatus } from "@/hooks/useKycStatus";
import { ClabeCard } from "../ClabeCard";
import { StellarAccountCard } from "../StellarAccountCard";
import { MoneyInput } from "../MoneyInput";

const IS_DEV = process.env.NODE_ENV !== "production";

export function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const stellar = useSeyfStellarWallet();
  const kyc = useKycStatus();
  const pk = stellar.publicKey ?? null;

  // Dev-only
  const [devAmt, setDevAmt] = useState("");
  const [devStatus, setDevStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [devError, setDevError] = useState<string | null>(null);

  // Simula un depósito MXN → CETES vía el onramp de Etherfuse (no MXNB de Juno).
  const simulateDeposit = async () => {
    const n = Number(devAmt);
    if (n <= 0) return;
    if (!pk) {
      setDevError("Activa tu Cuenta Digital Stellar arriba para simular el depósito.");
      setDevStatus("error");
      return;
    }
    setDevStatus("sending");
    setDevError(null);
    try {
      // Onramp real de Etherfuse SOLO si el KYC está verificado (si no, el endpoint
      // responde 403 "No encontramos tu verificación KYC"). Sin KYC → simulación pura.
      if (kyc.verified) {
        const quoteRes = await fetch("/api/seyf/etherfuse/quote/onramp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceAmount: String(n), wallet: pk }),
        });
        const quoteData = await quoteRes.json().catch(() => ({}));
        if (!quoteRes.ok) {
          throw new Error(quoteData?.error?.message_es ?? quoteData?.error ?? "No se pudo cotizar el depósito");
        }
        const quoteId = quoteData?.quote?.quoteId ?? quoteData?.quote?.quote_id;
        if (!quoteId) throw new Error("Etherfuse no devolvió quoteId");

        const orderRes = await fetch("/api/seyf/etherfuse/order/onramp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId, wallet: pk }),
        });
        const orderData = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok) {
          const msg = orderData?.error?.message_es ?? orderData?.error ?? "No se pudo crear la orden";
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
      }

      onSuccess?.();
      setDevStatus("done");
      setTimeout(onClose, 1500);
    } catch (e) {
      setDevError(e instanceof Error ? e.message : "Error al simular depósito");
      setDevStatus("error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Agregar dinero</p>

        {/* ── SPEI (CLABE) — único método de depósito ── */}
        <ClabeCard />
        <p className="modal-sub" style={{ marginTop: 12, marginBottom: 0 }}>
          Transfiere desde cualquier banco mexicano. El dinero se acredita automáticamente.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <span className="chip"><Icon name="clock" size={12} /> ~15 minutos</span>
          <span className="chip"><Icon name="info" size={12} /> Mínimo $500 MXN</span>
        </div>

        {/* ── Cuenta digital Stellar (recibir activos on-chain) ── */}
        <StellarAccountCard />

        {/* ── Dev: simular depósito ── */}
        {IS_DEV && (
          <>
            <div className="divider" style={{ marginTop: 22 }} />
            <p className="eyebrow" style={{ marginBottom: 4 }}>Dev · Simular depósito (Etherfuse)</p>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--txt-dim)", lineHeight: 1.45 }}>
              Corre el onramp de Etherfuse: MXN → compra de CETES a tu cuenta.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <MoneyInput
                className="input num-input"
                placeholder="500.00"
                value={devAmt}
                onChange={(v) => { setDevAmt(v); setDevStatus("idle"); setDevError(null); }}
                style={{ flex: 1, margin: 0 }}
                disabled={devStatus === "sending"}
              />
              <button
                className="btn btn-ghost"
                style={{ flex: "none", width: "auto", padding: "0 20px", margin: 0 }}
                disabled={!devAmt || Number(devAmt) <= 0 || devStatus === "sending"}
                onClick={simulateDeposit}
              >
                {devStatus === "sending" ? <span className="spin" /> : "Simular"}
              </button>
            </div>
            {devStatus === "done" && (
              <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--accent)", fontWeight: 700 }}>
                ✓ Depósito simulado
              </p>
            )}
            {devError && (
              <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--neg)" }}>{devError}</p>
            )}
          </>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
