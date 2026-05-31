"use client";

/* SEYF — Modal de "Agregar": fondea la smart wallet del usuario con MXNB
   on-chain (Juno emite y envía a SU dirección). Loader corto + transacción
   pendiente en el historial (se confirma sola al llegar on-chain). */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService } from "@/services/junoService";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { ClabeCard } from "../ClabeCard";

type Status = "idle" | "sending" | "done" | "error";

export function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const wallet = useWallet();
  const pending = usePendingTxns(wallet.address);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const fund = async () => {
    const n = Number(amount);
    if (!wallet.address || n <= 0) return;
    setStatus("sending");
    setError(null);
    try {
      await junoService.fundWallet(wallet.address, n);
      pending.add("deposit", n); // aparece como "pendiente" en el historial
      onSuccess?.();
      setStatus("done");
      setTimeout(onClose, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar fondos");
      setStatus("error");
    }
  };

  return (
    <div className="modal-overlay" onClick={() => status !== "sending" && onClose()}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />

        {status === "idle" && (
          <>
            <p className="modal-title">Agregar MXNB</p>
            <p className="modal-sub">
              En testnet acreditamos MXNB directo a <b style={{ color: "var(--txt)" }}>tu wallet</b> en Arbitrum.
              No pagas gas ni firmas.
            </p>
            <span className="field-label">Monto a recibir (MXN)</span>
            <input
              className="input num-input"
              type="number"
              inputMode="decimal"
              placeholder="500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[100, 500, 1000].map((q) => (
                <button key={q} className="chip" onClick={() => setAmount(String(q))}>${q}</button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={fund}
              disabled={!amount || Number(amount) <= 0}
            >
              <Icon name="recv" size={18} /> Recibir {amount ? `$${amount}` : ""} MXNB
            </button>

            <div className="divider" style={{ marginTop: 20 }} />
            <span className="field-label" style={{ marginTop: 0 }}>O recibe por SPEI a tu CLABE</span>
            <ClabeCard />
            <p className="modal-sub" style={{ marginTop: 10, marginBottom: 0 }}>
              Deposita por SPEI a esta CLABE y Juno convierte el monto a MXNB. (En producción el webhook acredita a tu wallet automáticamente.)
            </p>

            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>Cancelar</button>
          </>
        )}

        {status === "sending" && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div className="logo-mark brand" style={{ margin: "8px auto 18px", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon name="recv" size={26} />
            </div>
            <p className="modal-title" style={{ textAlign: "center" }}>Enviando MXNB…</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>Juno está emitiendo a tu wallet.</p>
            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 4px" }}>
              <span className="spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
            </div>
          </div>
        )}

        {status === "done" && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div style={{ fontSize: 52, margin: "6px 0 4px" }}>✓</div>
            <p className="modal-title" style={{ textAlign: "center" }}>¡En camino!</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              Tu depósito aparece como <b style={{ color: "var(--accent-2)" }}>pendiente</b> y se confirmará en unos segundos.
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div style={{ fontSize: 44, margin: "6px 0 4px" }}>!</div>
            <p className="modal-title" style={{ textAlign: "center" }}>No se pudo agregar</p>
            <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setStatus("idle")}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  );
}
