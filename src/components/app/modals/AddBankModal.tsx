"use client";

/* Modal para registrar una CLABE bancaria personal.
   Llama a /api/juno/register-bank y persiste en el store local/Supabase. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserBanks } from "@/hooks/useUserBanks";
import { FMT } from "../data";

type Status = "idle" | "sending" | "done" | "error";

function validateClabe(clabe: string): string | null {
  const digits = clabe.replace(/\s/g, "");
  if (!/^\d{18}$/.test(digits)) return "La CLABE debe tener exactamente 18 dígitos numéricos.";
  return null;
}

function maskClabe(clabe: string) {
  return `${clabe.slice(0, 6)} •••• •••• ${clabe.slice(-4)}`;
}

export function AddBankModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded?: () => void;
}) {
  const wallet = useWallet();
  const { add } = useUserBanks(wallet.address);

  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [clabe, setClabe] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const clabeErr = clabe.length > 0 ? validateClabe(clabe) : null;
  const canSubmit =
    tag.trim().length > 0 &&
    name.trim().length > 0 &&
    validateClabe(clabe) === null &&
    status === "idle";

  const submit = async () => {
    if (!wallet.address || !canSubmit) return;
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/juno/register-bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tag: tag.trim(),
          recipient_legal_name: name.trim(),
          clabe: clabe.replace(/\s/g, ""),
          ownership: "THIRD_PARTY",
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "No se pudo registrar la cuenta. Intenta de nuevo.");
        setStatus("error");
        return;
      }

      add({
        id: data.id ?? `bank-${Date.now()}`,
        tag: tag.trim(),
        clabe: clabe.replace(/\s/g, ""),
        recipient_legal_name: name.trim(),
      });

      setStatus("done");
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{
              width: 64, height: 64, borderRadius: 999,
              background: "var(--accent-soft)", color: "var(--accent)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="check" size={32} />
            </span>
            <p style={{ margin: "16px 0 0", fontWeight: 800, fontSize: 20 }}>Cuenta registrada</p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--txt)" }}>{tag}</b> · {maskClabe(clabe.replace(/\s/g, ""))}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>
              Ya puedes recibir adelantos de liquidez en esta cuenta.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={() => { onAdded?.(); onClose(); }}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={status === "sending" ? undefined : onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Agregar cuenta bancaria</p>
        <p className="modal-sub" style={{ marginTop: 4, lineHeight: 1.5 }}>
          Esta cuenta recibirá tus adelantos de liquidez vía SPEI.
        </p>

        <div className="card" style={{ marginTop: 14, background: "var(--accent-2-soft)", border: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="info" size={18} color="var(--accent-2)" />
          <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
            Registra la CLABE de tu cuenta en cualquier banco mexicano (BBVA, Nu, Santander, etc.).
          </p>
        </div>

        <span className="field-label" style={{ marginTop: 16 }}>Nombre de la cuenta</span>
        <input
          className="input"
          placeholder="Ej. Mi BBVA, Nu principal…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          disabled={status === "sending"}
          maxLength={40}
        />

        <span className="field-label">Nombre completo del titular</span>
        <input
          className="input"
          placeholder="Como aparece en tu banco"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={status === "sending"}
          maxLength={80}
        />

        <span className="field-label">CLABE interbancaria (18 dígitos)</span>
        <input
          className="input num-input"
          placeholder="000000000000000000"
          value={clabe}
          inputMode="numeric"
          onChange={(e) => setClabe(e.target.value.replace(/[^\d]/g, "").slice(0, 18))}
          disabled={status === "sending"}
          style={{ letterSpacing: "0.06em" }}
        />
        {clabeErr && (
          <p style={{ margin: "6px 2px 0", fontSize: 12, color: "var(--neg)" }}>{clabeErr}</p>
        )}
        {clabe.length === 18 && !clabeErr && (
          <p style={{ margin: "6px 2px 0", fontSize: 12, color: "var(--accent)" }}>
            <Icon name="check" size={12} /> {maskClabe(clabe)}
          </p>
        )}

        {error && (
          <div className="card" style={{ marginTop: 12, background: "rgba(217,79,61,.08)", border: "1px solid var(--neg)" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--neg)" }}>{error}</p>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ marginTop: 20 }}
          disabled={!canSubmit}
          onClick={submit}
        >
          {status === "sending" ? <span className="spin" /> : <><Icon name="check" size={18} /> Registrar cuenta</>}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose} disabled={status === "sending"}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
