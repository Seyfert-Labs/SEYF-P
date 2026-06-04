"use client";

/* SEYF — Cuestionario de perfil de riesgo.
   Dos modos:
   - OnboardingQuiz: pantalla completa estilo Typeform (para el onboarding).
   - RiskQuizBanner + RiskQuizModal: banner en home + modal (para usuarios ya activos). */
import React, { useState } from "react";
import { Icon } from "./ui";
import {
  RISK_QUESTIONS,
  recommendPlan,
  saveRiskProfile,
  projectSavings,
  FMT,
  type VaultPlan,
} from "./data";
import { useWallet } from "@/components/wallet/WalletContext";
import type { Go } from "./nav";
import { Portal } from "./Portal";

/* ------------------------------------------------------------------ */
/* ONBOARDING — pantalla completa (Typeform-style)                      */
/* ------------------------------------------------------------------ */

interface OnboardingQuizProps {
  /** Llamado cuando el usuario termina el quiz y acepta su perfil */
  onDone: () => void;
}

export function OnboardingQuiz({ onDone }: OnboardingQuizProps) {
  const { address } = useWallet();
  const total = RISK_QUESTIONS.length;
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  const done = step >= total;
  const sum = scores.reduce((s, x) => s + x, 0);
  const plan = done ? recommendPlan(sum) : null;

  React.useEffect(() => {
    if (plan) saveRiskProfile(plan.id, address);
  }, [plan, address]);

  const pick = (score: number) => {
    setScores((prev) => [...prev.slice(0, step), score]);
    setStep((s) => s + 1);
  };

  if (done && plan) {
    return <QuizResultFull plan={plan} onDone={onDone} />;
  }

  const q = RISK_QUESTIONS[step];
  const pct = Math.round((step / total) * 100);

  return (
    <div className="onb screen-enter" style={{ justifyContent: "flex-start", paddingTop: 0 }}>
      {/* Barra de progreso */}
      <div style={{ width: "100%", paddingTop: 16, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {step > 0 && (
            <button
              className="icon-btn"
              onClick={() => setStep((s) => s - 1)}
              aria-label="Atrás"
              style={{ width: 32, height: 32, flexShrink: 0 }}
            >
              <Icon name="chevL" size={18} />
            </button>
          )}
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
            <div
              style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 999, transition: "width .3s ease" }}
            />
          </div>
          <span style={{ fontSize: 12, color: "var(--txt-muted)", fontWeight: 700, flexShrink: 0 }}>
            {step + 1} / {total}
          </span>
        </div>
      </div>

      {/* Pregunta */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>
        {step === 0 && (
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--txt-muted)", fontWeight: 600 }}>
            5 preguntas · ~30 segundos
          </p>
        )}
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 40 }}>{q.emoji}</span>
          <h2 style={{ margin: "14px 0 0", fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>{q.q}</h2>
        </div>

        {/* Opciones */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {q.options.map((o, i) => (
            <button
              key={i}
              onClick={() => pick(o.score)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 18px", borderRadius: 16, cursor: "pointer",
                border: "1px solid var(--line)", background: "var(--surface-2)",
                textAlign: "left", width: "100%", transition: "background .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{o.label}</p>
                {o.sub && <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{o.sub}</p>}
              </div>
              <Icon name="chevR" size={16} color="var(--txt-dim)" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuizResultFull({ plan, onDone }: { plan: VaultPlan; onDone: () => void }) {
  const projection = projectSavings(0, 2000, plan.apy, 20);
  return (
    <div className="onb screen-enter" style={{ justifyContent: "flex-start", paddingTop: 24 }}>
      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: ".06em", textTransform: "uppercase" }}>
        Tu perfil de retiro
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <span style={{ fontSize: 52 }}>{plan.emoji}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{plan.name}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--txt-muted)" }}>{plan.tagline}</p>
        </div>
      </div>

      {/* APY destacado */}
      <div className="card" style={{ background: "var(--accent-soft)", border: "none", marginBottom: 14 }}>
        <p className="eyebrow" style={{ color: "var(--accent)" }}>Rendimiento estimado</p>
        <p className="num" style={{ fontSize: 38, fontWeight: 700, color: "var(--accent)", margin: "8px 0 4px" }}>
          {FMT(plan.apy, 1)}%
          <span style={{ fontSize: 16, fontWeight: 600 }}> anual</span>
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
          Ahorrando <b className="num" style={{ color: "var(--txt)" }}>$2,000</b>/mes,
          en 20 años tendrías <b className="num" style={{ color: "var(--accent)" }}>${FMT(projection, 0)}</b>.
        </p>
      </div>

      {/* Composición */}
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 14 }}>Tu mezcla de instrumentos</p>
        {plan.blend
          ? <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.55 }}>{plan.blend}</p>
          : <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.55 }}>{plan.structured}</p>}
        <div className="divider" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--txt-muted)" }}>
          <Icon name="globe" size={14} color="var(--accent)" />
          Instrumentos soberanos: CETES, Treasuries, Tesouro, KTB
        </div>
      </div>

      <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
        <button className="btn btn-primary" onClick={onDone}>
          <Icon name="check" size={18} /> Crear mi cuenta con este perfil
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--txt-dim)", margin: 0 }}>
          Puedes cambiar tu perfil en cualquier momento desde Configuración.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HOME — banner + modal (para usuarios activos sin perfil asignado)    */
/* ------------------------------------------------------------------ */

export function RiskQuizBanner({ go }: { go: Go }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="card glow"
        onClick={() => setOpen(true)}
        style={{ marginTop: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
      >
        <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>🎯</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Descubre tu perfil de ahorrador</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.4 }}>
            Responde <b style={{ color: "var(--accent)" }}>5 preguntas</b> y te decimos qué estrategia te conviene.
          </p>
          <span className="pos-pill" style={{ marginTop: 10 }}>Hacer cuestionario →</span>
        </div>
      </div>
      {open && <Portal><RiskQuizModal go={go} onClose={() => setOpen(false)} /></Portal>}
    </>
  );
}

function RiskQuizModal({ go, onClose }: { go: Go; onClose: () => void }) {
  const { address } = useWallet();
  const total = RISK_QUESTIONS.length;
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  const done = step >= total;
  const sum = scores.reduce((s, x) => s + x, 0);
  const plan = done ? recommendPlan(sum) : null;

  React.useEffect(() => {
    if (plan) saveRiskProfile(plan.id, address);
  }, [plan, address]);

  const pick = (score: number) => {
    setScores((prev) => [...prev.slice(0, step), score]);
    setStep((s) => s + 1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        {!done ? (
          <QuizStep step={step} total={total} onPick={pick} onBack={step > 0 ? () => setStep(step - 1) : undefined} />
        ) : (
          <QuizResult plan={plan!} onPick={() => { onClose(); go("bovedas"); }} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function QuizStep({ step, total, onPick, onBack }: { step: number; total: number; onPick: (s: number) => void; onBack?: () => void }) {
  const question = RISK_QUESTIONS[step];
  const pct = Math.round((step / total) * 100);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Atrás" style={{ width: 32, height: 32 }}>
            <Icon name="chevL" size={18} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ height: 6, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", transition: "width .25s" }} />
          </div>
        </div>
        <span style={{ fontSize: 12, color: "var(--txt-muted)", fontWeight: 700 }}>{step + 1}/{total}</span>
      </div>

      <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{question.emoji}</span> {question.q}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {question.options.map((o, i) => (
          <button
            key={i}
            className="card"
            onClick={() => onPick(o.score)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, textAlign: "left", cursor: "pointer", border: "1px solid var(--line)", background: "var(--surface-2)" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{o.label}</p>
              {o.sub && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{o.sub}</p>}
            </div>
            <Icon name="chevR" size={16} color="var(--txt-dim)" />
          </button>
        ))}
      </div>
    </>
  );
}

function QuizResult({ plan, onPick, onClose }: { plan: VaultPlan; onPick: () => void; onClose: () => void }) {
  const projection = projectSavings(0, 1000, plan.apy, 20);
  return (
    <>
      <p className="eyebrow" style={{ textAlign: "center", color: "var(--accent)" }}>Tu perfil de ahorrador</p>
      <div style={{ textAlign: "center", margin: "10px 0 4px" }}>
        <span style={{ fontSize: 48 }}>{plan.emoji}</span>
        <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 24 }}>{plan.name}</p>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--txt-muted)" }}>{plan.tagline}</p>
      </div>

      <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none", textAlign: "center" }}>
        <p className="eyebrow" style={{ color: "var(--accent)" }}>Rendimiento estimado</p>
        <p className="num" style={{ fontSize: 34, fontWeight: 700, color: "var(--accent)", margin: "8px 0 0" }}>{FMT(plan.apy, 1)}%<span style={{ fontSize: 16, fontWeight: 600 }}> anual</span></p>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
          Ahorrando <b className="num" style={{ color: "var(--txt)" }}>$1,000</b>/mes, en 20 años tendrías <b className="num" style={{ color: "var(--accent)" }}>${FMT(projection, 0)}</b>.
        </p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.55 }}>{plan.structured}</p>
        {plan.blend && (
          <>
            <div className="divider" />
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--txt-muted)", fontSize: 12 }}>
              <Icon name="globe" size={15} color="var(--accent)" /> {plan.blend}
            </div>
          </>
        )}
      </div>

      <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onPick}>
        <Icon name="vault" size={18} /> Abrir mi bóveda {plan.name}
      </button>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Ahora no</button>
    </>
  );
}
