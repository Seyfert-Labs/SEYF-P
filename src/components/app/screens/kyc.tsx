"use client";

/* Verificación de identidad (KYC). El usuario solo ve "verificar mi identidad":
   la wallet Stellar y el proveedor (Etherfuse/Pollar) son detalle interno y
   nunca se nombran en la UI. */
import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { Icon } from "../ui";
import { SubHeader } from "../shared";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useReyfStellarWallet } from "@/lib/reyf/use-reyf-stellar-wallet";
import { useEnsureCetesTrustline } from "@/lib/reyf/use-ensure-cetes-trustline";
import { normalizeDateOfBirthToIso } from "@/lib/reyf/normalize-date-of-birth";
import type { EtherfuseKycSnapshot } from "@/lib/etherfuse/kyc";

type Step = "connect" | "identity" | "documents" | "agreements" | "done";

// Etiquetas en español para el formulario de identidad (sin claves crudas).
const FIELDS: { key: keyof IdentityForm; label: string; placeholder?: string; half?: boolean }[] = [
  { key: "firstName", label: "Nombre(s)", half: true },
  { key: "lastName", label: "Apellidos", half: true },
  { key: "dateOfBirth", label: "Fecha de nacimiento", placeholder: "AAAA-MM-DD" },
  { key: "curp", label: "CURP", half: true },
  { key: "rfc", label: "RFC", half: true },
  { key: "phone", label: "Teléfono" },
  { key: "street", label: "Calle y número" },
  { key: "city", label: "Ciudad", half: true },
  { key: "state", label: "Estado", half: true },
  { key: "postalCode", label: "Código postal" },
];

interface IdentityForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  curp: string;
  rfc: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

/** Extrae un mensaje legible de la respuesta de error de /api/reyf/* .
   La API puede devolver `error` como objeto estructurado + `debug_message`. */
function readApiError(j: unknown, status: number): string {
  if (j && typeof j === "object") {
    const o = j as Record<string, unknown>;
    if (typeof o.debug_message === "string" && o.debug_message.trim()) return o.debug_message;
    const e = o.error;
    if (typeof e === "string" && e.trim()) return e;
    if (e && typeof e === "object") {
      const eo = e as Record<string, unknown>;
      const m = eo.message_es ?? eo.message;
      if (typeof m === "string" && m.trim()) return m;
    }
  }
  return `No se pudo procesar (HTTP ${status}).`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => (typeof r.result === "string" ? resolve(r.result) : reject());
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

export function ScreenKyc({ go }: { go: Go }) {
  const reyfWallet = useWallet();
  const stellar = useReyfStellarWallet();
  const { ensureTrustline } = useEnsureCetesTrustline();
  const email = reyfWallet.email || "";

  const [step, setStep] = useState<Step>("connect");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kyc, setKyc] = useState<EtherfuseKycSnapshot | null>(null);

  const [form, setForm] = useState<IdentityForm>({
    firstName: "", lastName: "", dateOfBirth: "", curp: "", rfc: "",
    phone: "", street: "", city: "", state: "", postalCode: "",
  });
  const [ineFront, setIneFront] = useState<File | null>(null);
  const [ineBack, setIneBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!stellar.publicKey) return;
    const r = await fetch("/api/reyf/kyc/status");
    const j = await r.json().catch(() => ({}));
    const snap = j.kyc;
    if (r.ok && snap?.status) {
      setKyc(snap as EtherfuseKycSnapshot);
      const done = snap.status === "approved" || snap.status === "approved_chain_deploying" || snap.status === "proposed";
      if (done) setStep("done");
    }
  }, [stellar.publicKey]);

  // Cuando la cuenta segura queda lista, avanza a datos personales.
  useEffect(() => {
    if (stellar.authenticated && stellar.publicKey) {
      void refreshStatus();
      if (step === "connect") setStep("identity");
    }
  }, [stellar.authenticated, stellar.publicKey, refreshStatus, step]);

  // En "done", asegura el riel de acreditación en segundo plano (sin UI).
  useEffect(() => {
    if (step === "done") void ensureTrustline();
  }, [step, ensureTrustline]);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      if (!email) throw new Error("No encontramos tu correo de acceso.");
      await stellar.sendCode(email);
    });

  const verifyCode = () =>
    run(async () => {
      if (code.trim().length < 4) throw new Error("Ingresa el código completo.");
      await stellar.verifyCode(code.trim());
    });

  const submitIdentity = (e: FormEvent) => {
    e.preventDefault();
    if (!stellar.publicKey) return;
    void run(async () => {
      const r = await fetch("/api/reyf/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: stellar.publicKey,
          identity: {
            name: { givenName: form.firstName, familyName: form.lastName },
            dateOfBirth: normalizeDateOfBirthToIso(form.dateOfBirth),
            email,
            phoneNumber: form.phone,
            address: {
              street: form.street, city: form.city, region: form.state,
              postalCode: form.postalCode, country: "MX",
            },
            idNumbers: [
              { type: "mx_curp", value: form.curp },
              { type: "mx_rfc", value: form.rfc },
            ],
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(readApiError(j, r.status));
      setStep("documents");
    });
  };

  const submitDocuments = (e: FormEvent) => {
    e.preventDefault();
    if (!ineFront || !ineBack || !selfie) {
      setErr("Sube tu identificación (frente y reverso) y una selfie.");
      return;
    }
    void run(async () => {
      const [front, back, face] = await Promise.all([
        fileToDataUrl(ineFront), fileToDataUrl(ineBack), fileToDataUrl(selfie),
      ]);
      const r = await fetch("/api/reyf/kyc/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: { idFront: { label: "id_front", image: front }, idBack: { label: "id_back", image: back } },
          selfie: { label: "selfie", image: face },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(readApiError(j, r.status));
      setStep("agreements");
    });
  };

  const submitAgreements = () =>
    run(async () => {
      const r = await fetch("/api/reyf/kyc/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(readApiError(j, r.status));
      await refreshStatus();
      setStep("done");
    });

  const kycOk =
    kyc?.status === "approved" ||
    kyc?.status === "approved_chain_deploying" ||
    kyc?.status === "proposed";

  const STEPS: Step[] = ["connect", "identity", "documents", "agreements"];
  const stepIdx = Math.max(0, STEPS.indexOf(step));

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Verificación de identidad" go={go} back="perfil" />
      <div className="screen-pad">
        {step !== "done" && (
          <>
            <p style={{ margin: "0 2px 8px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              Verificamos tu identidad una sola vez para habilitar todas tus bóvedas de ahorro y mantener tu dinero protegido.
            </p>
            <div style={{ display: "flex", gap: 6, margin: "0 2px 18px" }}>
              {STEPS.map((s, i) => (
                <span key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= stepIdx ? "var(--accent)" : "var(--line)" }} />
              ))}
            </div>
          </>
        )}

        {err && (
          <div className="card" style={{ borderColor: "var(--neg)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="info" size={18} color="var(--neg)" />
            <p style={{ margin: 0, color: "var(--neg)", fontSize: 13 }}>{err}</p>
          </div>
        )}

        {!stellar.enabled && step === "connect" && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)" }}>
            <Icon name="info" size={20} color="var(--txt-muted)" />
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
              La verificación se activa al configurar el servicio de identidad. Vuelve a intentarlo más tarde.
            </p>
          </div>
        )}

        {/* 1 · Cuenta segura (OTP por correo, sin nombrar al proveedor) */}
        {step === "connect" && stellar.enabled && (
          <div className="card" style={{ textAlign: "center", padding: 22 }}>
            <span style={{ width: 60, height: 60, borderRadius: 18, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="shield" size={30} />
            </span>
            {stellar.phase !== "code" && stellar.phase !== "verifying" ? (
              <>
                <p style={{ margin: "16px 0 6px", fontWeight: 800, fontSize: 17 }}>Empecemos tu verificación</p>
                <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
                  Te enviaremos un código a <b style={{ color: "var(--txt)" }}>{email || "tu correo"}</b> para confirmar que eres tú.
                </p>
                <button className="btn btn-primary" disabled={busy || !email} onClick={sendCode} style={{ width: "100%" }}>
                  {busy ? <span className="spin" /> : "Enviar código"}
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "16px 0 6px", fontWeight: 800, fontSize: 17 }}>Ingresa el código</p>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
                  Lo enviamos a <b style={{ color: "var(--txt)" }}>{email}</b>. Revisa tu correo.
                </p>
                <div className="card" style={{ margin: "0 0 14px", background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                  <Icon name="info" size={16} color="var(--accent)" />
                  <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45, textAlign: "left" }}>
                    Usa el código de <b style={{ color: "var(--txt)" }}>verificación de identidad</b> más reciente; es distinto al de inicio de sesión.
                  </p>
                </div>
                <input
                  className="input num-input"
                  inputMode="numeric"
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
                  style={{ textAlign: "center", letterSpacing: "0.3em", fontSize: 22 }}
                />
                <button className="btn btn-primary" disabled={busy || stellar.phase === "verifying"} onClick={verifyCode} style={{ width: "100%", marginTop: 14 }}>
                  {busy || stellar.phase === "verifying" ? <span className="spin" /> : "Verificar"}
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={sendCode} style={{ width: "100%", marginTop: 10 }}>
                  Reenviar código
                </button>
              </>
            )}
          </div>
        )}

        {/* 2 · Datos personales */}
        {step === "identity" && (
          <>
            <div className="card" style={{ marginBottom: 14, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="check" size={18} />
              </span>
              <p style={{ margin: 0, fontSize: 13, color: "var(--txt)", lineHeight: 1.4 }}>
                <b>Código verificado.</b> Ahora completa tus datos.
              </p>
            </div>
          <form onSubmit={submitIdentity} className="card" style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Tus datos</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {FIELDS.map((f) => (
                <label key={f.key} style={{ display: "grid", gap: 4, gridColumn: f.half ? "span 1" : "span 2" }}>
                  <span className="field-label">{f.label}</span>
                  <input
                    className="input"
                    required
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spin" /> : "Continuar"}
            </button>
          </form>
          </>
        )}

        {/* 3 · Documentos */}
        {step === "documents" && (
          <form onSubmit={submitDocuments} className="card" style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Identificación oficial</p>
            <p style={{ margin: "-6px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>Sube tu INE y una selfie. Solo nosotros las vemos.</p>
            <label className="field-label">Frente de tu identificación
              <input type="file" accept="image/jpeg,image/png" onChange={(e) => setIneFront(e.target.files?.[0] ?? null)} style={{ marginTop: 6 }} />
            </label>
            <label className="field-label">Reverso de tu identificación
              <input type="file" accept="image/jpeg,image/png" onChange={(e) => setIneBack(e.target.files?.[0] ?? null)} style={{ marginTop: 6 }} />
            </label>
            <label className="field-label">Selfie
              <input type="file" accept="image/jpeg,image/png" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} style={{ marginTop: 6 }} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spin" /> : "Subir documentos"}
            </button>
          </form>
        )}

        {/* 4 · Acuerdos */}
        {step === "agreements" && (
          <div className="card">
            <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 15 }}>Términos y privacidad</p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.55 }}>
              Al continuar aceptas los términos de uso y el aviso de privacidad de Reyf, y autorizas el tratamiento de tus datos para verificar tu identidad.
            </p>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitAgreements()} style={{ width: "100%" }}>
              {busy ? <span className="spin" /> : "Aceptar y finalizar"}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="card glow" style={{ textAlign: "center", padding: 24 }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={32} />
            </span>
            <p style={{ margin: "16px 0 6px", fontWeight: 800, fontSize: 18 }}>
              {kycOk ? "¡Identidad verificada!" : "Verificación enviada"}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.55 }}>
              {kycOk
                ? "Ya puedes abrir y fondear todas tus bóvedas de ahorro."
                : "Estamos revisando tus datos. Te avisaremos en cuanto quede lista; no necesitas hacer nada más."}
            </p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => go("bovedas")}>
              Ir a mis bóvedas
            </button>
            <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => go("perfil")}>
              Volver a mi perfil
            </button>
          </div>
        )}
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}
