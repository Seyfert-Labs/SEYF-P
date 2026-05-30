"use client";

/* UTONOMA — Modal de redención: registra cuenta bancaria y redime MXNB → MXN (SPEI).
   Conecta los botones "Enviar" / "Retirar" con la API de Juno. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useBankAccounts, useJunoAction, junoActions } from "@/hooks/useJuno";
import { JunoService } from "@/services/junoService";
import type { BankAccount } from "@/types/juno";

export function RedeemModal({
  onClose,
  onSuccess,
  maxAmount,
}: {
  onClose: () => void;
  onSuccess?: () => void;
  maxAmount?: number;
}) {
  const { bankAccounts, loading: loadingBanks, refresh: refreshBanks } = useBankAccounts();
  const register = useJunoAction(junoActions.registerBank);
  const redeem = useJunoAction(
    (amount: number, id: string) => junoActions.redeem(amount, id),
  );

  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  // form de registro de banco
  const [tag, setTag] = useState("");
  const [legalName, setLegalName] = useState("");
  const [newClabe, setNewClabe] = useState("");

  const clabeValid = JunoService.validateCLABE(newClabe);

  const handleRegister = async () => {
    if (!tag || !legalName || !clabeValid) return;
    const r = await register.run({
      tag,
      recipient_legal_name: legalName,
      clabe: newClabe,
      ownership: "THIRD_PARTY",
    });
    if (r) {
      setAdding(false);
      setTag(""); setLegalName(""); setNewClabe("");
      void refreshBanks();
    }
  };

  const handleRedeem = async () => {
    if (!selected || Number(amount) < 100) return;
    const r = await redeem.run(Number(amount), selected.id);
    if (r) {
      setDone(true);
      onSuccess?.();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Enviar a tu banco</p>
        <p className="modal-sub">
          Redime tus MXNB a pesos y recíbelos por SPEI en una cuenta CLABE registrada.
        </p>

        {done ? (
          <div className="alert alert-ok" style={{ marginTop: 6 }}>
            ✓ Redención de ${amount} MXN enviada a {selected?.tag}. La transferencia SPEI se
            liquidará en breve.
          </div>
        ) : adding ? (
          <>
            <span className="field-label">Alias de la cuenta</span>
            <input className="input" placeholder="Ej. Mi cuenta BBVA" value={tag} onChange={(e) => setTag(e.target.value)} />
            <span className="field-label">Nombre legal del titular</span>
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
              <div className="alert alert-error">La CLABE no es válida (dígito verificador incorrecto).</div>
            )}
            {register.error && <div className="alert alert-error">{register.error}</div>}
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={handleRegister} disabled={register.loading || !tag || !legalName || !clabeValid}>
              {register.loading ? <span className="spin" /> : <Icon name="check" size={18} />}
              Registrar cuenta
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAdding(false)}>Volver</button>
          </>
        ) : (
          <>
            <span className="field-label">Cuenta destino</span>
            {loadingBanks ? (
              <div className="skel" style={{ height: 56 }} />
            ) : bankAccounts.length === 0 ? (
              <p className="modal-sub" style={{ margin: "4px 0 0" }}>Aún no tienes cuentas registradas.</p>
            ) : (
              bankAccounts.map((b) => (
                <button
                  key={b.id}
                  className={`bank-opt ${selected?.id === b.id ? "sel" : ""}`}
                  onClick={() => setSelected(b)}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="card" size={18} color="var(--accent)" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{b.tag}</p>
                    <p className="num" style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                      {JunoService.formatCLABE(b.clabe)}
                    </p>
                  </div>
                  {selected?.id === b.id && <Icon name="check" size={18} color="var(--accent)" />}
                </button>
              ))
            )}

            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Registrar nueva cuenta
            </button>

            <span className="field-label">Monto a redimir (mín. 100 MXNB)</span>
            <input
              className="input num-input"
              type="number"
              inputMode="decimal"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {typeof maxAmount === "number" && (
              <p className="modal-sub" style={{ margin: "8px 0 0" }}>
                Disponible: {JunoService.formatMXNB(maxAmount)} MXNB
              </p>
            )}
            {redeem.error && <div className="alert alert-error">{redeem.error}</div>}
            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={handleRedeem}
              disabled={redeem.loading || !selected || Number(amount) < 100}
            >
              {redeem.loading ? <span className="spin" /> : <Icon name="send" size={18} />}
              Redimir a MXN
            </button>
          </>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onClose}>
          {done ? "Listo" : "Cerrar"}
        </button>
      </div>
    </div>
  );
}
