"use client";

/* SEYF — Retirar a tu banco: redime MXNB → MXN (SPEI) a una CLABE del usuario.
   Las cuentas destino son las que el propio usuario registra (no compartidas). */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useJunoAction, junoActions } from "@/hooks/useJuno";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserBanks, type UserBank } from "@/hooks/useUserBanks";
import { useMonthlyLimits } from "@/hooks/useMonthlyLimits";
import { JunoService } from "@/services/junoService";
import { FMT } from "../data";
import { MoneyInput } from "../MoneyInput";

export function RedeemModal({
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
  const register = useJunoAction(junoActions.registerBank);
  const redeem = useJunoAction((amount: number, id: string) => junoActions.redeem(amount, id));

  const [selected, setSelected] = useState<UserBank | null>(null);
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);

  const remainingWithdraw = limits.remaining("withdraw");

  // form de registro de banco
  const [tag, setTag] = useState("");
  const [legalName, setLegalName] = useState("");
  const [newClabe, setNewClabe] = useState("");
  const clabeValid = JunoService.validateCLABE(newClabe);

  const available = typeof maxAmount === "number" ? maxAmount : 0;

  const handleRegister = async () => {
    if (!tag || !legalName || !clabeValid) return;
    const r = (await register.run({
      tag,
      recipient_legal_name: legalName,
      clabe: newClabe,
      ownership: "THIRD_PARTY",
    })) as { id: string; tag: string; clabe: string; recipient_legal_name: string } | null;
    if (r?.id) {
      banks.add({ id: r.id, tag: r.tag, clabe: r.clabe, recipient_legal_name: r.recipient_legal_name });
      setSelected({ id: r.id, tag: r.tag, clabe: r.clabe, recipient_legal_name: r.recipient_legal_name });
      setTag(""); setLegalName(""); setNewClabe("");
      setAdding(false);
    }
  };

  const handleRedeem = async () => {
    const n = Number(amount);
    if (!selected || n < 100) return;
    // Límite mensual de retiro.
    if (!limits.canDo("withdraw", n)) {
      setLimitError(`Límite mensual de retiro alcanzado. Disponible este mes: $${FMT(remainingWithdraw, 2)} de $${FMT(limits.limit, 0)}.`);
      return;
    }
    setLimitError(null);
    const r = await redeem.run(n, selected.id);
    if (r) {
      await limits.record("withdraw", n);
      setDone(true);
      onSuccess?.();
    }
  };

  // ---- Pantalla: éxito ----
  if (done) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 24 }}>
          <div className="modal-grab" />
          <div style={{ fontSize: 52, margin: "6px 0 4px" }}>✓</div>
          <p className="modal-title" style={{ textAlign: "center" }}>Retiro en proceso</p>
          <p className="modal-sub" style={{ textAlign: "center" }}>
            Enviamos <b style={{ color: "var(--txt)" }}>${amount} MXN</b> por SPEI a {selected?.tag}. Se liquidará en breve.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  // ---- Pantalla: registrar cuenta ----
  if (adding) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title">Registrar cuenta destino</p>
          <p className="modal-sub">La cuenta CLABE (de cualquier banco) donde recibirás tus pesos por SPEI.</p>

          <span className="field-label">Alias</span>
          <input className="input" placeholder="Ej. Mi cuenta BBVA" value={tag} onChange={(e) => setTag(e.target.value)} />
          <span className="field-label">Nombre del titular</span>
          <input className="input" placeholder="Como aparece en el banco" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          <span className="field-label">CLABE (18 dígitos)</span>
          <input
            className="input num-input"
            inputMode="numeric"
            maxLength={18}
            placeholder="000000000000000000"
            value={newClabe}
            onChange={(e) => setNewClabe(e.target.value.replace(/\D/g, ""))}
          />
          {newClabe.length === 18 && !clabeValid && (
            <div className="alert alert-error">CLABE inválida (dígito verificador incorrecto).</div>
          )}
          {register.error && <div className="alert alert-error">{register.error}</div>}

          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={handleRegister} disabled={register.loading || !tag || !legalName || !clabeValid}>
            {register.loading ? <span className="spin" /> : <Icon name="check" size={18} />} Guardar cuenta
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAdding(false)}>Volver</button>
        </div>
      </div>
    );
  }

  // ---- Pantalla: principal ----
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Retirar a tu banco</p>
        <p className="modal-sub">
          Recibe tu dinero en tu banco por <b style={{ color: "var(--txt)" }}>SPEI</b>. Disponible:{" "}
          <b className="num" style={{ color: "var(--accent)" }}>{JunoService.formatMXNB(available)}</b>
        </p>

        {banks.list.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 24, marginTop: 6 }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--surface-2)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Icon name="card" size={24} />
            </span>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Aún no tienes cuentas</p>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--txt-muted)" }}>Registra la CLABE de tu banco para recibir tus retiros.</p>
            <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Registrar mi cuenta</button>
          </div>
        ) : (
          <>
            <span className="field-label">1 · Cuenta destino</span>
            {banks.list.map((b) => (
              <button key={b.id} className={`bank-opt ${selected?.id === b.id ? "sel" : ""}`} onClick={() => setSelected(b)}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="card" size={18} color="var(--accent)" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{b.tag}</p>
                  <p className="num" style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{JunoService.formatCLABE(b.clabe)}</p>
                </div>
                {selected?.id === b.id && <Icon name="check" size={18} color="var(--accent)" />}
              </button>
            ))}
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Registrar otra cuenta
            </button>

            <span className="field-label">2 · Monto a retirar (mín. $100 MXN)</span>
            <MoneyInput
              className="input num-input"
              placeholder="100.00"
              value={amount}
              onChange={setAmount}
            />
            <p style={{ margin: "8px 2px 0", fontSize: 12, color: "var(--txt-dim)" }}>
              Disponible este mes: <b className="num" style={{ color: "var(--txt-muted)" }}>${FMT(remainingWithdraw, 2)}</b> de ${FMT(limits.limit, 0)}.
            </p>
            {limitError && <div className="alert alert-error">{limitError}</div>}
            {redeem.error && <div className="alert alert-error">{redeem.error}</div>}

            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleRedeem}
              disabled={redeem.loading || !selected || Number(amount) < 100}
            >
              {redeem.loading ? <span className="spin" /> : <Icon name="recv" size={18} />}
              Retirar {amount ? `$${amount}` : ""} a MXN
            </button>
          </>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
