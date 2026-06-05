"use client";

/* Modal unificado de envío.
   Tab "A banco"  → redime MXNB → MXN vía SPEI a una CLABE registrada.
   Tab "ERC-20"   → transferencia on-chain de MXNB a cualquier dirección. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserBanks } from "@/hooks/useUserBanks";
import { useMonthlyLimits } from "@/hooks/useMonthlyLimits";
import { useJunoAction, junoActions } from "@/hooks/useJuno";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { JunoService } from "@/services/junoService";
import { FMT } from "../data";
import { explorerBase } from "@/lib/chain";
import { Portal } from "../Portal";
import { AddBankModal } from "./AddBankModal";
import type { UserBank } from "@/hooks/useUserBanks";

type Tab = "banco" | "erc20";

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
  const pending = usePendingTxns(wallet.address);
  const redeem = useJunoAction((amount: number, id: string) => junoActions.redeem(amount, id));

  const [tab, setTab] = useState<Tab>("banco");

  // ── A banco ──
  const [selected, setSelected] = useState<UserBank | null>(null);
  const [bankAmount, setBankAmount] = useState("");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [bankDone, setBankDone] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);

  // ── ERC-20 ──
  const [to, setTo] = useState("");
  const [erc20Amount, setErc20Amount] = useState("");
  const [erc20Loading, setErc20Loading] = useState(false);
  const [erc20Error, setErc20Error] = useState<string | null>(null);
  const [erc20Hash, setErc20Hash] = useState<string | null>(null);

  const available = typeof maxAmount === "number" ? maxAmount : wallet.balance;
  const remainingWithdraw = limits.remaining("withdraw");

  const addrValid = /^0x[a-fA-F0-9]{40}$/.test(to);
  const erc20Num = Number(erc20Amount);
  const erc20Valid = erc20Num > 0 && erc20Num <= available && addrValid;

  // ── handlers ──

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

  const handleErc20 = async () => {
    if (!erc20Valid) return;
    setErc20Loading(true);
    setErc20Error(null);
    try {
      const h = await wallet.sendMXNB(to, erc20Amount);
      setErc20Hash(h);
      pending.add("send", erc20Num);
      onSuccess?.();
      setTimeout(() => onSuccess?.(), 5000);
    } catch (e) {
      setErc20Error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setErc20Loading(false);
    }
  };

  // ── pantallas de éxito ──

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

  if (erc20Hash) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={32} />
            </span>
            <p className="modal-title" style={{ marginTop: 16, textAlign: "center" }}>Enviado</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              <b style={{ color: "var(--txt)" }}>${erc20Amount} MXN</b> en camino. Se confirma en la red en segundos.
            </p>
          </div>
          <a className="btn btn-ghost" style={{ marginTop: 8 }} href={`${explorerBase}/tx/${erc20Hash}`} target="_blank" rel="noopener noreferrer">
            <Icon name="arrowR" size={18} /> Ver en explorador
          </a>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Enviar</p>

        <div className="seg" style={{ marginBottom: 20 }}>
          <button className={tab === "banco" ? "on" : ""} onClick={() => setTab("banco")}>A banco</button>
          <button className={tab === "erc20" ? "on" : ""} onClick={() => setTab("erc20")}>ERC-20</button>
        </div>

        {/* ── Tab: A banco ── */}
        {tab === "banco" && (
          <>
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
                <input
                  className="input num-input"
                  type="number"
                  inputMode="decimal"
                  placeholder="100.00"
                  value={bankAmount}
                  onChange={(e) => { setBankAmount(e.target.value); setLimitError(null); }}
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
          </>
        )}

        {/* ── Tab: ERC-20 ── */}
        {tab === "erc20" && (
          <>
            <span className="field-label">Dirección destino (Arbitrum)</span>
            <input
              className="input num-input"
              placeholder="0x0000000000000000000000000000000000000000"
              value={to}
              onChange={(e) => { setTo(e.target.value.trim()); setErc20Error(null); }}
              style={{ fontSize: 13, letterSpacing: "0.02em" }}
            />
            {to.length > 0 && !addrValid && (
              <div className="alert alert-error">Dirección inválida — debe ser 0x seguido de 40 caracteres hex.</div>
            )}

            <span className="field-label">Monto (MXN)</span>
            <input
              className="input num-input"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={erc20Amount}
              onChange={(e) => { setErc20Amount(e.target.value); setErc20Error(null); }}
            />
            <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--txt-dim)" }}>
              Disponible: <b className="num" style={{ color: "var(--txt-muted)" }}>${FMT(available, 2)} MXN</b>
            </p>

            {!wallet.gaslessReady && (
              <div className="alert alert-info" style={{ marginTop: 12 }}>
                Preparando tu cuenta… intenta en unos segundos.
              </div>
            )}
            {erc20Error && <div className="alert alert-error">{erc20Error}</div>}

            <div className="card" style={{ marginTop: 14, background: "var(--accent-2-soft)", border: "none", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}><Icon name="info" size={16} color="var(--accent-2)" /></span>
              <p style={{ margin: 0, fontSize: "var(--t-xs)", color: "var(--txt-muted)", lineHeight: 1.55 }}>
                Envía <b style={{ color: "var(--txt)" }}>MXN (Arbitrum)</b> a cualquier dirección. El gas está cubierto por Reyf.
              </p>
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleErc20}
              disabled={erc20Loading || !wallet.gaslessReady || !erc20Valid}
            >
              {erc20Loading ? <span className="spin" /> : <Icon name="send" size={18} />}
              Enviar {erc20Amount && addrValid ? `$${erc20Amount} MXN` : ""}
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
