"use client";

/* SEYF — Envío de MXNB on-chain con gas patrocinado (account abstraction).
   Usa la smart wallet del usuario; no firma popups ni paga gas. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { explorerBase } from "@/lib/chain";
import { JunoService } from "@/services/junoService";
import { usePendingTxns } from "@/hooks/usePendingTxns";

export function SendOnchainModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const wallet = useWallet();
  const pending = usePendingTxns(wallet.address);
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
      pending.add("send", Number(amount)); // aparece como "pendiente" en el historial
      onSuccess?.();
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
        <p className="modal-title">Enviar a otra cuenta</p>
        <p className="modal-sub">
          Transferencia <b style={{ color: "var(--txt)" }}>instantánea entre cuentas Seyf</b>. Ingresa la cuenta del destinatario.
        </p>

        {hash ? (
          <>
            <div className="alert alert-ok" style={{ marginTop: 6 }}>
              ✓ Enviaste ${amount} MXN. Tu transferencia se está confirmando.
            </div>
            <a className="btn btn-ghost" style={{ marginTop: 14 }} href={`${explorerBase}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
              <Icon name="arrowR" size={18} /> Ver en el explorador
            </a>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onClose}>Listo</button>
          </>
        ) : (
          <>
            <span className="field-label">Cuenta Seyf del destinatario</span>
            <input
              className="input num-input"
              placeholder="0x0000000000000000000000000000000000000000"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
            />
            {to.length > 0 && !addrValid && (
              <div className="alert alert-error">Dirección inválida (debe ser 0x + 40 hex).</div>
            )}

            <span className="field-label">Monto (MXN)</span>
            <input
              className="input num-input"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="modal-sub" style={{ margin: "8px 0 0" }}>
              Disponible: ${JunoService.formatMXNB(wallet.balance)} MXN
            </p>

            {!wallet.gaslessReady && (
              <div className="alert alert-info">Preparando tu cuenta… intenta en unos segundos.</div>
            )}
            {error && <div className="alert alert-error">{error}</div>}

            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleSend}
              disabled={loading || !wallet.gaslessReady || !addrValid || !amountValid}
            >
              {loading ? <span className="spin" /> : <Icon name="send" size={18} />}
              Enviar
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
