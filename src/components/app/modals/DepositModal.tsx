"use client";

/* UTONOMA — Modal de depósito: genera CLABE y simula un depósito SPEI (issuance MXNB).
   Conecta los botones "Agregar" / "Recibir" con la API de Juno. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useAccountClabes, useJunoAction, junoActions } from "@/hooks/useJuno";
import { JunoService } from "@/services/junoService";

export function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { clabes, loading: loadingClabes, refresh: refreshClabes } = useAccountClabes();
  const createClabe = useJunoAction(junoActions.createClabe);
  const deposit = useJunoAction(junoActions.mockDeposit);

  const [amount, setAmount] = useState("");
  const [sender, setSender] = useState("");
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);

  const clabe = clabes[0]?.clabe ?? createClabe.result?.clabe ?? "";

  const handleCreateClabe = async () => {
    const r = await createClabe.run();
    if (r) void refreshClabes();
  };

  const handleCopy = async () => {
    if (!clabe) return;
    try {
      await navigator.clipboard.writeText(clabe);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  const handleDeposit = async () => {
    if (!clabe || !amount || Number(amount) <= 0 || !sender) return;
    const r = await deposit.run({
      amount,
      receiver_clabe: clabe,
      receiver_name: "Diego Robles",
      sender_name: sender,
    });
    if (r) {
      setDone(true);
      onSuccess?.();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Agregar pesos digitales</p>
        <p className="modal-sub">
          Deposita por SPEI a tu CLABE y recibirás MXNB al instante. En entorno de
          pruebas puedes simular el depósito.
        </p>

        {/* CLABE */}
        <span className="field-label">Tu CLABE de depósito</span>
        {loadingClabes ? (
          <div className="skel" style={{ height: 56 }} />
        ) : clabe ? (
          <div className="clabe-box">
            <span className="clabe-val">{JunoService.formatCLABE(clabe)}</span>
            <button className="icon-btn" onClick={handleCopy} aria-label="Copiar CLABE">
              <Icon name={copied ? "check" : "copy"} size={18} color={copied ? "var(--accent)" : "var(--txt)"} />
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={handleCreateClabe} disabled={createClabe.loading}>
            {createClabe.loading ? <span className="spin" /> : <Icon name="plus" size={18} />}
            Generar mi CLABE
          </button>
        )}
        {createClabe.error && <div className="alert alert-error">{createClabe.error}</div>}

        {/* Simular depósito SPEI */}
        {clabe && !done && (
          <>
            <span className="field-label">Monto a depositar (MXN)</span>
            <input
              className="input num-input"
              type="number"
              inputMode="decimal"
              placeholder="1,000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="field-label">Nombre del remitente</span>
            <input
              className="input"
              type="text"
              placeholder="Quién envía el depósito"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
            {deposit.error && <div className="alert alert-error">{deposit.error}</div>}
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={handleDeposit}
              disabled={deposit.loading || !amount || Number(amount) <= 0 || !sender}
            >
              {deposit.loading ? <span className="spin" /> : <Icon name="recv" size={18} />}
              Simular depósito SPEI
            </button>
            <p className="modal-sub" style={{ marginTop: 12, marginBottom: 0 }}>
              * Solo disponible en entorno stage/test de Juno.
            </p>
          </>
        )}

        {done && (
          <div className="alert alert-ok" style={{ marginTop: 18 }}>
            ✓ Depósito simulado por ${amount} MXN. Tu balance MXNB se actualizará en unos
            segundos cuando Juno confirme la emisión.
          </div>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>
          {done ? "Listo" : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
