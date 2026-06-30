"use client";

/* Modal de envío a banco: redime el saldo → MXN vía SPEI a una CLABE registrada.
   (El envío on-chain a direcciones Arbitrum/ERC-20 se retiró de la app.) */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserBanks } from "@/hooks/useUserBanks";
import { useMonthlyLimits } from "@/hooks/useMonthlyLimits";
import { useJunoAction, junoActions } from "@/hooks/useJuno";
import { JunoService } from "@/services/junoService";
import { FMT } from "../data";
import { Portal } from "../Portal";
import { AddBankModal } from "./AddBankModal";
import type { UserBank } from "@/hooks/useUserBanks";
import { MoneyInput } from "../MoneyInput";

export function SendModal({
  onClose,
  onSuccess,
  maxAmount,
}: {
  onClose: () => void;
  onSuccess?: () => void;
  maxAmount?: number;
}) {
  const wallet = useWallet();
  const banks = useUserBanks(wallet.address);
  const limits = useMonthlyLimits(wallet.address);
  const redeem = useJunoAction((amount: number, id: string) => junoActions.redeem(amount, id));

  const [selected, setSelected] = useState<UserBank | null>(null);
  const [bankAmount, setBankAmount] = useState("");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [bankDone, setBankDone] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);

  const available = typeof maxAmount === "number" ? maxAmount : wallet.balance;
  const remainingWithdraw = limits.remaining("withdraw");

  const handleRedeem = async () => {
    const n = Number(bankAmount);
    if (!selected || n < 100) return;
    if (!limits.canDo("withdraw", n)) {
      setLimitError(`Límite mensual alcanzado. Disponible: $${FMT(remainingWithdraw, 2)}`);
      return;
    }
    setLimitError(null);
    const r = await redeem.run(n, selected.id);
    if (r) {
      await limits.record("withdraw", n);
      onSuccess?.();
      setBankDone(true);
    }
  };

  if (bankDone) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={32} />
            </span>
            <p className="modal-title" style={{ marginTop: 16, textAlign: "center" }}>Retiro en proceso</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              Enviamos <b style={{ color: "var(--txt)" }}>${bankAmount} MXN</b> por SPEI a{" "}
              <b style={{ color: "var(--txt)" }}>{selected?.tag}</b>. Se acredita en breve.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Enviar a banco</p>

        {banks.list.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 24 }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--surface-2)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Icon name="bank" size={24} />
            </span>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Sin cuentas registradas</p>
            <p className="modal-sub" style={{ margin: "6px 0 14px" }}>
              Agrega la CLABE de tu banco para enviar dinero vía SPEI.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddBank(true)}>
              <Icon name="plus" size={18} /> Agregar cuenta
            </button>
          </div>
        ) : (
          <>
            <span className="field-label">Cuenta destino</span>
            {banks.list.map((b) => (
              <button
                key={b.id}
                className={`bank-opt ${selected?.id === b.id ? "sel" : ""}`}
                onClick={() => setSelected(b)}
              >
                <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="bank" size={18} color="var(--accent)" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{b.tag}</p>
                  <p className="num" style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                    {JunoService.formatCLABE(b.clabe)}
                  </p>
                </div>
                {selected?.id === b.id && <Icon name="check" size={18} color="var(--accent)" />}
              </button>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setShowAddBank(true)}>
              <Icon name="plus" size={18} /> Agregar otra cuenta
            </button>

            <span className="field-label">Monto (mín. $100 MXN)</span>
            <MoneyInput
              className="input num-input"
              placeholder="100.00"
              value={bankAmount}
              onChange={(v) => { setBankAmount(v); setLimitError(null); }}
            />
            <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--txt-dim)" }}>
              Disponible: <b className="num" style={{ color: "var(--txt-muted)" }}>${FMT(available, 2)}</b>
              {" · "}Límite mensual: <b className="num" style={{ color: "var(--txt-muted)" }}>${FMT(remainingWithdraw, 2)}</b>
            </p>
            {limitError && <div className="alert alert-error">{limitError}</div>}
            {redeem.error && <div className="alert alert-error">{redeem.error}</div>}

            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleRedeem}
              disabled={redeem.loading || !selected || Number(bankAmount) < 100}
            >
              {redeem.loading ? <span className="spin" /> : <Icon name="send" size={18} />}
              Enviar {bankAmount ? `$${bankAmount} MXN` : ""}
            </button>
          </>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>

      {showAddBank && (
        <Portal>
          <AddBankModal
            onClose={() => setShowAddBank(false)}
            onAdded={() => { void banks.reload(); setShowAddBank(false); }}
          />
        </Portal>
      )}
    </div>
  );
}
