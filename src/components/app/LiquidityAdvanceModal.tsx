"use client";

/* SEYF — Adelanto de liquidez sobre rendimientos futuros.
   Recibes pesos hoy sin vender tus posiciones: tu capital sigue invertido
   y creciendo, y el adelanto se cubre con el rendimiento que generará. */
import React, { useState } from "react";
import { Icon } from "./ui";
import { FMT, liquidityAdvance, AFORE_LOAN_RATE } from "./data";

export function LiquidityAdvanceModal({
  saved,
  apy,
  onClose,
  onConfirm,
}: {
  saved: number;
  apy: number;
  onClose: () => void;
  onConfirm?: (amt: number) => void;
}) {
  const max = Math.floor(liquidityAdvance(saved, apy));
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState(false);
  const n = Number(amount);
  const valid = n > 0 && n <= max;

  if (max <= 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de liquidez
          </p>
          <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.55 }}>
            Aún no tienes ahorro invertido. Empieza a ahorrar en una bóveda y podrás
            adelantar tus rendimientos futuros sin vender tus posiciones.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={onClose}>Entendido</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <Icon name="check" size={32} />
            </span>
            <p style={{ margin: "16px 0 0", fontWeight: 800, fontSize: 20 }}>¡Adelanto listo!</p>
            <p className="num" style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 700, color: "var(--accent)" }}>${FMT(n, 2)}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              Tus pesos digitales ya están disponibles. Tu ahorro sigue invertido y creciendo.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de liquidez
        </p>
        <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Recibe pesos hoy sin vender tu ahorro. Lo cubrimos con el rendimiento que tu
          dinero generará el próximo año.
        </p>

        {/* Anti-préstamo: vs un crédito sobre pensión/nómina */}
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <p className="eyebrow">No es un préstamo</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--txt-muted)" }}>Préstamo sobre pensión</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--neg)" }}>{FMT(AFORE_LOAN_RATE, 0)}%<span style={{ fontSize: 11, fontWeight: 600 }}> + IVA</span></p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--txt-dim)" }}>interés anual · deuda</p>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--accent)" }}>Adelanto Reyf</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>0%<span style={{ fontSize: 11, fontWeight: 600 }}> interés</span></p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--txt-dim)" }}>es tu propio rendimiento</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="leaf" size={20} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>Disponible para adelantar</p>
            <p className="num" style={{ margin: "2px 0 0", fontWeight: 800, fontSize: 20, color: "var(--accent)" }}>${FMT(max, 2)}</p>
          </div>
          <button className="chip" onClick={() => setAmount(String(max))} style={{ cursor: "pointer" }}>Máx</button>
        </div>

        <span className="field-label">Monto (MXN)</span>
        <input
          className="input num-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {n > max && <p className="modal-sub" style={{ margin: "8px 0 0", color: "var(--neg)" }}>El máximo es ${FMT(max, 2)}.</p>}

        <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
          Sin penalización ni venta de posiciones · Se descuenta de tus rendimientos futuros.
        </p>

        <button
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={!valid}
          onClick={() => { onConfirm?.(n); setDone(true); }}
        >
          <Icon name="bolt" size={18} /> Recibir ${valid ? FMT(n, 2) : "0.00"}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
