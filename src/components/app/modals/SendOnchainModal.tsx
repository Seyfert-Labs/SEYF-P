"use client";

/* SEYF — Envío de MXNB on-chain con gas patrocinado (account abstraction).
   Usa la smart wallet del usuario; no firma popups ni paga gas. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { explorerBase } from "@/lib/chain";
import { JunoService } from "@/services/junoService";

export function SendOnchainModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const wallet = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const addrValid = /^0x[a-fA-F0-9]{40}$/.test(to);
  const amountNum = Number(amount);
  const amountValid = amountNum > 0 && amountNum <= wallet.balance;

  const handleSend = async () => {
    if (!addrValid || !amountValid) return;
    setLoading(true);
    setError(null);
    try {
      const h = await wallet.sendMXNB(to, amount);
      setHash(h);
      // refresca saldo/historial tras unos segundos (confirmación on-chain)
      setTimeout(() => onSuccess?.(), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la transacción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Transferir MXNB</p>
        <p className="modal-sub">
          Envía MXNB on-chain desde tu cuenta inteligente. <b style={{ color: "var(--accent)" }}>Sin firmar ni pagar gas</b> — la red la patrocinamos.
        </p>

        {hash ? (
          <>
            <div className="alert alert-ok" style={{ marginTop: 6 }}>
              ✓ Enviaste {amount} MXNB sin pagar gas. La transacción se está confirmando.
            </div>
            <a className="btn btn-ghost" style={{ marginTop: 14 }} href={`${explorerBase}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
              <Icon name="arrowR" size={18} /> Ver en el explorador
            </a>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onClose}>Listo</button>
          </>
        ) : (
          <>
            <span className="field-label">Dirección destino (0x…)</span>
            <input
              className="input num-input"
              placeholder="0x0000000000000000000000000000000000000000"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
            />
            {to.length > 0 && !addrValid && (
              <div className="alert alert-error">Dirección inválida (debe ser 0x + 40 hex).</div>
            )}

            <span className="field-label">Monto (MXNB)</span>
            <input
              className="input num-input"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="modal-sub" style={{ margin: "8px 0 0" }}>
              Disponible: {JunoService.formatMXNB(wallet.balance)} MXNB
            </p>

            {!wallet.gaslessReady && (
              <div className="alert alert-info">Preparando tu cuenta inteligente… intenta en unos segundos.</div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleSend}
              disabled={loading || !wallet.gaslessReady || !addrValid || !amountValid}
            >
              {loading ? <span className="spin" /> : <Icon name="send" size={18} />}
              Enviar sin gas
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
