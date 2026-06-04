"use client";

/* SEYF — Modal de "Agregar": fondea la smart wallet del usuario con MXNB
   on-chain (Juno emite y envía a SU dirección). Loader corto + transacción
   pendiente en el historial (se confirma sola al llegar on-chain). */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService } from "@/services/junoService";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { useMonthlyLimits } from "@/hooks/useMonthlyLimits";
import { ClabeCard } from "../ClabeCard";
import { FMT } from "../data";

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
  const limits = useMonthlyLimits(wallet.address);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const remainingDeposit = limits.remaining("deposit");

  const fund = async () => {
    const n = Number(amount);
    if (!wallet.address || n <= 0) return;
    // Límite mensual de depósito.
    if (!limits.canDo("deposit", n)) {
      setError(`Límite mensual de depósito alcanzado. Disponible este mes: $${FMT(remainingDeposit, 2)} de $${FMT(limits.limit, 0)}.`);
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      await junoService.fundWallet(wallet.address, n);
      await limits.record("deposit", n);
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
            <p className="modal-title">Agregar dinero</p>
            <p className="modal-sub">
              Acreditamos el dinero directo a <b style={{ color: "var(--txt)" }}>tu cuenta</b> al instante.
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
            <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)" }}>
              Disponible este mes: <b className="num" style={{ color: "var(--txt-muted)" }}>${FMT(remainingDeposit, 2)}</b> de ${FMT(limits.limit, 0)}.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={fund}
              disabled={!amount || Number(amount) <= 0}
            >
              <Icon name="recv" size={18} /> Agregar {amount ? `$${amount}` : "dinero"}
            </button>

            <div className="divider" style={{ marginTop: 20 }} />
            <span className="field-label" style={{ marginTop: 0 }}>O recibe por SPEI a tu CLABE</span>
            <ClabeCard />
            <p className="modal-sub" style={{ marginTop: 10, marginBottom: 0 }}>
              Deposita por SPEI a esta CLABE y se acredita a tu cuenta automáticamente.
            </p>

            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>Cancelar</button>
          </>
        )}

        {status === "sending" && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div className="logo-mark brand" style={{ margin: "8px auto 18px", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon name="recv" size={26} />
            </div>
            <p className="modal-title" style={{ textAlign: "center" }}>Agregando dinero…</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>Estamos acreditando tu cuenta.</p>
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
