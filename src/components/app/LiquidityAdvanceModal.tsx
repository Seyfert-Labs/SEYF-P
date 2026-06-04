"use client";

/* SEYF — Adelanto de liquidez sobre rendimientos futuros.
   Recibes pesos hoy sin vender tus posiciones: tu capital sigue invertido
   y creciendo, y el adelanto se cubre con el rendimiento que generará. */
import React, { useState } from "react";
import { Icon } from "./ui";
import { FMT, liquidityAdvance, AFORE_LOAN_RATE } from "./data";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserBanks, type UserBank } from "@/hooks/useUserBanks";
import { Portal } from "./Portal";
import { AddBankModal } from "./modals/AddBankModal";

function maskClabe(clabe: string) {
  return `${clabe.slice(0, 6)} •••• •••• ${clabe.slice(-4)}`;
}

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
  const wallet = useWallet();
  const { list: banks, reload: reloadBanks } = useUserBanks(wallet.address);
  const max = Math.floor(liquidityAdvance(saved, apy));
  const [amount, setAmount] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [step, setStep] = useState<"amount" | "confirm" | "done">("amount");
  const [showAddBank, setShowAddBank] = useState(false);

  const n = Number(amount);
  const selectedBank: UserBank | null = banks.find((b) => b.id === selectedBankId) ?? banks[0] ?? null;
  const activeBank = selectedBank;

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

  if (step === "done") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <span style={{
              width: 64, height: 64, borderRadius: 999,
              background: "var(--accent-soft)", color: "var(--accent)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
            }}>
              <Icon name="check" size={32} />
            </span>
            <p style={{ margin: "16px 0 0", fontWeight: 800, fontSize: 20 }}>¡Adelanto solicitado!</p>
            <p className="num" style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 700, color: "var(--accent)" }}>
              ${FMT(n, 2)}
            </p>
            {activeBank && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>
                Llegará a <b style={{ color: "var(--txt)" }}>{activeBank.tag}</b> ({maskClabe(activeBank.clabe)})
                en <b style={{ color: "var(--txt)" }}>máximo 24 horas hábiles</b>.
              </p>
            )}
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              Tu ahorro sigue invertido y creciendo.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title">Confirmar adelanto</p>

          {/* Resumen */}
          <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Recibes</span>
              <span className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>
                ${FMT(n, 2)} MXN
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Interés</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>0% — es tu rendimiento</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Plazo estimado</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>12 meses</span>
            </div>
          </div>

          {/* Cuenta destino */}
          <p className="eyebrow" style={{ margin: "18px 0 10px" }}>Cuenta de destino (SPEI)</p>
          {banks.length > 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {banks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBankId(b.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                    background: (activeBank?.id === b.id) ? "var(--accent-soft)" : "var(--surface-2)",
                    border: `1px solid ${(activeBank?.id === b.id) ? "var(--accent)" : "var(--line)"}`,
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{b.tag}</p>
                    <p className="num" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                      {maskClabe(b.clabe)}
                    </p>
                  </div>
                  {activeBank?.id === b.id && <Icon name="check" size={16} color="var(--accent)" />}
                </button>
              ))}
            </div>
          ) : activeBank ? (
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "var(--surface-2)", border: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="bank" size={20} color="var(--accent)" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{activeBank.tag}</p>
                <p className="num" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                  {maskClabe(activeBank.clabe)}
                </p>
              </div>
            </div>
          ) : null}

          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            El dinero llegará vía SPEI en máximo 24 horas hábiles. Sin penalización ni venta de posiciones.
          </p>

          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            disabled={!activeBank}
            onClick={() => { onConfirm?.(n); setStep("done"); }}
          >
            <Icon name="bolt" size={18} /> Confirmar adelanto
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setStep("amount")}>
            Atrás
          </button>
        </div>
      </div>
    );
  }

  /* ── Paso 1: monto ── */
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

        {/* Anti-préstamo */}
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <p className="eyebrow">No es un préstamo</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--txt-muted)" }}>Préstamo sobre pensión</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--neg)" }}>
                {FMT(AFORE_LOAN_RATE, 0)}%<span style={{ fontSize: 11, fontWeight: 600 }}> + IVA</span>
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--txt-dim)" }}>interés anual · deuda</p>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--accent)" }}>Adelanto Reyf</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>
                0%<span style={{ fontSize: 11, fontWeight: 600 }}> interés</span>
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--txt-dim)" }}>es tu propio rendimiento</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="leaf" size={20} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>Disponible para adelantar</p>
            <p className="num" style={{ margin: "2px 0 0", fontWeight: 800, fontSize: 20, color: "var(--accent)" }}>
              ${FMT(max, 2)}
            </p>
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
        {n > max && (
          <p className="modal-sub" style={{ margin: "8px 0 0", color: "var(--neg)" }}>
            El máximo es ${FMT(max, 2)}.
          </p>
        )}

        {/* Cuenta bancaria */}
        <p className="eyebrow" style={{ margin: "18px 0 10px" }}>Cuenta de destino (SPEI)</p>
        {banks.length === 0 ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "var(--surface-2)", border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="bank" size={20} color="var(--txt-muted)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Sin cuenta registrada</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                Agrega tu CLABE para recibir el dinero vía SPEI.
              </p>
            </div>
            <button className="chip" style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setShowAddBank(true)}>
              Agregar
            </button>
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "var(--accent-soft)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="bank" size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{banks[0].tag}</p>
              <p className="num" style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                {maskClabe(banks[0].clabe)}
              </p>
            </div>
            <button
              style={{ background: "none", border: "none", fontSize: 13, color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
              onClick={() => setShowAddBank(true)}
            >
              Cambiar
            </button>
          </div>
        )}

        <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
          Sin penalización ni venta de posiciones · Se descuenta de tus rendimientos futuros.
        </p>

        <button
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={!(n > 0 && n <= max && banks.length > 0)}
          onClick={() => setStep("confirm")}
        >
          <Icon name="bolt" size={18} /> Continuar
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>

      {showAddBank && (
        <Portal>
          <AddBankModal
            onClose={() => setShowAddBank(false)}
            onAdded={() => { void reloadBanks(); setShowAddBank(false); }}
          />
        </Portal>
      )}
    </div>
  );
}
