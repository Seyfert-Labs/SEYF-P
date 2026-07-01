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
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useStellarConnect } from "../StellarConnectGate";
import { sendStellarToSeyf, type SeyfPayAsset } from "@/lib/seyf/send-stellar";
import { stellarTxExplorerUrl } from "@/lib/etherfuse/stellar-tx-url";

type SendMode = "bank" | "seyf";

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
  const stellar = useSeyfStellarWallet();
  const { ensureConnected } = useStellarConnect();
  const banks = useUserBanks(wallet.address);
  const limits = useMonthlyLimits(wallet.address);
  const redeem = useJunoAction((amount: number, id: string) => junoActions.redeem(amount, id));

  const stellarEnabled = stellar.enabled;
  const [mode, setMode] = useState<SendMode>("bank");

  const [selected, setSelected] = useState<UserBank | null>(null);
  const [bankAmount, setBankAmount] = useState("");
  const [limitError, setLimitError] = useState<string | null>(null);
  const [bankDone, setBankDone] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);

  // --- Envío a cuenta SEYF (riel Stellar, firma Pollar) ---
  const [stAddr, setStAddr] = useState("");
  const [stAsset, setStAsset] = useState<SeyfPayAsset>("XLM");
  const [stAmount, setStAmount] = useState("");
  const [stStatus, setStStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [stError, setStError] = useState<string | null>(null);
  const [stTx, setStTx] = useState<string | null>(null);

  const available = typeof maxAmount === "number" ? maxAmount : wallet.balance;
  const remainingWithdraw = limits.remaining("withdraw");

  const stBalanceOf = (code: string) =>
    Number(stellar.assetBalances.find((b) => (b.code || "").toUpperCase() === code.toUpperCase())?.balance ?? 0);
  const stAvailable = stBalanceOf(stAsset);
  const stAmt = Number(stAmount) || 0;
  const stAddrValid = /^G[A-Z2-7]{55}$/.test(stAddr.trim());
  const stCanSend =
    stStatus !== "sending" && stAddrValid && stAmt > 0 && stAmt <= stAvailable + 1e-9;

  const handleStellarSend = async () => {
    if (!stAddrValid) { setStError("Ingresa una dirección Stellar válida (empieza con G)."); return; }
    if (stAmt <= 0) return;
    if (stAmt > stAvailable + 1e-9) {
      setStError(`Saldo insuficiente de ${stAsset}. Disponible: ${FMT(stAvailable, 7)}.`);
      return;
    }
    setStError(null);
    // Conecta/activa la wallet Stellar (Pollar) justo antes de firmar, si hace falta.
    if (!(await ensureConnected("enviar a una cuenta SEYF"))) return;
    setStStatus("sending");
    try {
      const res = await sendStellarToSeyf({
        to: stAddr.trim(),
        asset: stAsset,
        amount: stAmt,
        getClient: stellar.getClient,
      });
      setStTx(res.txHash);
      void stellar.refreshBalanceAfterTx();
      onSuccess?.();
      setStStatus("done");
    } catch (e) {
      setStError(e instanceof Error ? e.message : "No se pudo enviar.");
      setStStatus("error");
    }
  };

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

  if (stStatus === "done") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-2-soft)", color: "var(--accent-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={32} />
            </span>
            <p className="modal-title" style={{ marginTop: 16, textAlign: "center" }}>Enviado por Stellar</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              Enviaste <b className="num" style={{ color: "var(--txt)" }}>{FMT(stAmt, 7)} {stAsset}</b> a{" "}
              <b className="num" style={{ color: "var(--txt)" }}>{stAddr.slice(0, 6)}…{stAddr.slice(-6)}</b>.
            </p>
            {stTx && stellarTxExplorerUrl(stTx) && (
              <a href={stellarTxExplorerUrl(stTx)!} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, color: "var(--accent-2)", fontWeight: 700 }}>
                Ver en el explorador ↗
              </a>
            )}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Enviar</p>

        {/* Selector de riel: banco (SPEI) o cuenta SEYF (Stellar) */}
        {stellarEnabled && (
          <div style={{ display: "flex", gap: 6, padding: 4, background: "var(--surface-2)", borderRadius: 13, margin: "4px 0 16px" }}>
            {([["bank", "A banco", "bank"], ["seyf", "Cuenta SEYF", "globe"]] as const).map(([m, label, icon]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  fontWeight: 800, fontSize: 13,
                  background: mode === m ? "var(--surface-4, var(--bg))" : "transparent",
                  color: mode === m ? "var(--txt)" : "var(--txt-muted)",
                  boxShadow: mode === m ? "0 1px 6px -2px rgba(0,0,0,.5)" : "none",
                }}
              >
                <Icon name={icon} size={15} color={mode === m ? (m === "seyf" ? "var(--accent-2)" : "var(--accent)") : "var(--txt-muted)"} /> {label}
              </button>
            ))}
          </div>
        )}

        {mode === "seyf" ? (
          <>
            <span className="field-label">Dirección de la cuenta SEYF (Stellar)</span>
            <input
              className="input num"
              placeholder="G…"
              value={stAddr}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => { setStAddr(e.target.value.trim()); setStStatus("idle"); setStError(null); }}
              style={{ fontSize: 13 }}
            />
            {stAddr.length > 0 && !stAddrValid && (
              <p style={{ margin: "6px 2px 0", fontSize: 11.5, color: "var(--neg)" }}>Dirección Stellar inválida (56 caracteres, empieza con G).</p>
            )}

            <span className="field-label" style={{ marginTop: 14 }}>Activo</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(["XLM", "USDC"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => { setStAsset(a); setStStatus("idle"); setStError(null); }}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 11, fontWeight: 800, fontSize: 13, cursor: "pointer",
                    border: `1px solid ${stAsset === a ? "var(--accent-2)" : "var(--line)"}`,
                    background: stAsset === a ? "var(--accent-2-soft)" : "var(--surface-2)",
                    color: stAsset === a ? "var(--accent-2)" : "var(--txt-muted)",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>

            <span className="field-label" style={{ marginTop: 14 }}>Monto</span>
            <MoneyInput
              className="input num-input"
              placeholder="0.00"
              value={stAmount}
              onChange={(v) => { setStAmount(v); setStStatus("idle"); setStError(null); }}
            />
            <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--txt-dim)" }}>
              Disponible: <b className="num" style={{ color: "var(--txt-muted)" }}>{FMT(stAvailable, 7)} {stAsset}</b>
            </p>

            {stError && <div className="alert alert-error" style={{ marginTop: 10 }}>{stError}</div>}

            <button
              className="btn btn-violet"
              style={{ marginTop: 16 }}
              onClick={handleStellarSend}
              disabled={!stCanSend}
            >
              {stStatus === "sending" ? <span className="spin" /> : <><Icon name="send" size={18} /> Enviar {stAmt > 0 ? `${FMT(stAmt, 7)} ${stAsset}` : ""}</>}
            </button>
            <p style={{ margin: "10px 4px 0", fontSize: 11, color: "var(--txt-dim)", lineHeight: 1.5 }}>
              Transferencia instantánea entre cuentas SEYF por la red Stellar, firmada de forma segura con tu wallet.
            </p>

            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
          </>
        ) : banks.list.length === 0 ? (
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
