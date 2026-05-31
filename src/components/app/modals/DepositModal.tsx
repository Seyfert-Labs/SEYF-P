"use client";

/* SEYF — Modal de "Agregar": fondea la smart wallet del usuario con MXNB
   on-chain (Juno emite y envía a SU dirección). Confirmación + loader +
   reflejo automático en el balance. */
import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService, JunoService } from "@/services/junoService";

type Status = "idle" | "funding" | "validating" | "done" | "slow" | "error";

export function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const before = useRef(0);

  useEffect(() => {
    if (status !== "validating") return;
    const poll = setInterval(() => wallet.refreshBalance(), 4000);
    const giveUp = setTimeout(() => setStatus((s) => (s === "validating" ? "slow" : s)), 75000);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [status, wallet]);

  useEffect(() => {
    if ((status === "validating" || status === "slow") && wallet.balance > before.current) {
      setStatus("done");
      onSuccess?.();
    }
  }, [status, wallet.balance, onSuccess]);

  const fund = async () => {
    if (!wallet.address || Number(amount) <= 0) return;
    before.current = wallet.balance;
    setStatus("funding");
    setError(null);
    try {
      await junoService.fundWallet(wallet.address, Number(amount));
      setStatus("validating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar fondos");
      setStatus("error");
    }
  };

  const processing = status === "funding" || status === "validating";

  return (
    <div className="modal-overlay" onClick={() => !processing && onClose()}>
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
            <p className="modal-sub" style={{ marginTop: 14, marginBottom: 0 }}>
              💡 En producción esto sería un depósito <b>SPEI</b> a tu CLABE, que Juno convierte a MXNB y envía a tu wallet.
            </p>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>Cancelar</button>
          </>
        )}

        {processing && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div className="logo-mark brand" style={{ margin: "8px auto 18px", background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon name="recv" size={26} />
            </div>
            <p className="modal-title" style={{ textAlign: "center" }}>
              {status === "funding" ? "Enviando MXNB…" : "Validando depósito…"}
            </p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              {status === "funding"
                ? "Juno está emitiendo y enviando a tu wallet."
                : "Confirmando la transacción en Arbitrum. Unos segundos."}
            </p>
            <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 4px" }}>
              <span className="spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
            </div>
          </div>
        )}

        {(status === "done" || status === "slow") && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div style={{ fontSize: 52, margin: "6px 0 4px" }}>✅</div>
            <p className="modal-title" style={{ textAlign: "center" }}>
              {status === "done" ? "¡Fondos agregados!" : "Tu depósito va en camino"}
            </p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              {status === "done" ? (
                <>Saldo actual: <b className="num" style={{ color: "var(--txt)" }}>{JunoService.formatMXNB(wallet.balance)}</b>.</>
              ) : (
                <>La red está tardando un poco; tus MXNB aparecerán pronto. Puedes cerrar.</>
              )}
            </p>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <div style={{ fontSize: 44, margin: "6px 0 4px" }}>⚠️</div>
            <p className="modal-title" style={{ textAlign: "center" }}>No se pudo agregar</p>
            <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setStatus("idle")}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  );
}
