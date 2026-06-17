"use client";

/* Tarjeta de proyección — muestra el crecimiento según la estrategia del usuario.
   El gráfico es colapsable. Sin comparativa Afore. */
import React, { useRef, useState } from "react";
import { projectSavings, FMT, loadRiskProfile, planById } from "./data";
import { Icon } from "./ui";
import { MoneyInput } from "./MoneyInput";

/* ---- helpers ---- */
function defaultApy(): number {
  const id = loadRiskProfile();
  if (id) {
    try { return planById(id).apy; } catch {}
  }
  return 10.5;
}

function defaultPlanName(): string {
  const id = loadRiskProfile();
  if (id) {
    try { return planById(id).name; } catch {}
  }
  return "Tu estrategia";
}

/* ---- gráfico SVG ---- */
const W = 320, H = 120, PAD_T = 6, PAD_B = 22, PAD_X = 2;
const PLOT_H = H - PAD_T - PAD_B;
const PLOT_W = W - PAD_X * 2;

interface LineChartProps {
  current: number;
  monthly: number;
  apy: number;
  years: number;
}

function ProjectionLineChart({ current, monthly, apy, years }: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverYear, setHoverYear] = useState<number>(years);

  const pts = Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    value: projectSavings(current, monthly, apy, y),
  }));

  const maxVal = Math.max(...pts.map((p) => p.value)) * 1.08 || 1;

  const xOf = (y: number) => PAD_X + (y / years) * PLOT_W;
  const yOf = (v: number) => PAD_T + PLOT_H - (v / maxVal) * PLOT_H;

  const linePath = pts.map((p) => `${xOf(p.year)},${yOf(p.value)}`).join(" ");
  const fillPath = [
    ...pts.map((p) => `${xOf(p.year)},${yOf(p.value)}`),
    `${xOf(years)},${H - PAD_B}`,
    `${PAD_X},${H - PAD_B}`,
  ].join(" ");

  const hp = pts[Math.min(hoverYear, pts.length - 1)];
  const tipX = xOf(hp.year);
  const tipRight = tipX > PLOT_W * 0.6;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - PAD_X) / PLOT_W;
    setHoverYear(Math.max(0, Math.min(years, Math.round(ratio * years))));
  };

  return (
    <div style={{ position: "relative", touchAction: "none", userSelect: "none" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        onPointerMove={onPointer}
        onPointerLeave={() => setHoverYear(years)}
      >
        {/* Área sombreada */}
        <polygon points={fillPath} fill="var(--accent)" opacity={0.1} />

        {/* Línea principal */}
        <polyline points={linePath} fill="none" stroke="var(--accent)" strokeWidth={2.2} />

        {/* Scrubber */}
        <line
          x1={xOf(hp.year)} y1={PAD_T}
          x2={xOf(hp.year)} y2={H - PAD_B}
          stroke="var(--txt-dim)" strokeWidth={1} opacity={0.4}
        />

        {/* Punto interactivo */}
        <circle cx={xOf(hp.year)} cy={yOf(hp.value)} r={5} fill="var(--accent)" />
        <circle cx={xOf(hp.year)} cy={yOf(hp.value)} r={2.5} fill="var(--bg, #fff)" />

        {/* Etiquetas eje X */}
        <text x={PAD_X} y={H} fontSize={10} fill="var(--txt-dim)" textAnchor="start">0</text>
        <text x={W / 2} y={H} fontSize={10} fill="var(--txt-dim)" textAnchor="middle">{Math.round(years / 2)} años</text>
        <text x={W - PAD_X} y={H} fontSize={10} fill="var(--txt-dim)" textAnchor="end">{years} años</text>
      </svg>

      {/* Tooltip */}
      <div
        style={{
          position: "absolute",
          top: Math.max(4, (yOf(hp.value) - 52) / H * 100) + "%",
          ...(tipRight
            ? { right: `${(1 - tipX / W) * 100 + 2}%` }
            : { left: `${(tipX / W) * 100 + 2}%` }),
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          padding: "7px 11px",
          fontSize: 12,
          minWidth: 100,
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          pointerEvents: "none",
        }}
      >
        <p style={{ margin: "0 0 3px", fontWeight: 700, color: "var(--txt-muted)", fontSize: 11 }}>
          Año {hp.year}
        </p>
        <p className="num" style={{ margin: 0, fontWeight: 800, color: "var(--accent)", fontSize: 14 }}>
          ${FMT(hp.value, 0)}
        </p>
      </div>
    </div>
  );
}

/* ---- Tarjeta completa ---- */
interface ProjectionCardProps {
  current?: number;
  monthly?: number;
  apy?: number;
}

export function ProjectionCard({ current = 0, monthly: initialMonthly, apy: initialApy }: ProjectionCardProps) {
  const [horizon, setHorizon] = useState<10 | 20 | 30>(20);
  const [monthly, setMonthly] = useState(initialMonthly ?? 2000);
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  const apy = initialApy ?? defaultApy();
  const planName = defaultPlanName();
  const projected = projectSavings(current, monthly, apy, horizon);

  const commitMonthly = () => {
    const n = Number(draft);
    if (n > 0) setMonthly(n);
    setEditingMonthly(false);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>

      {/* ── Fila compacta — siempre visible, click para expandir ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px", width: "100%", textAlign: "left",
          background: "none", border: "none", cursor: "pointer",
        }}
      >
        <span style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: "var(--accent-soft)", color: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="trend" size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Tu proyección de retiro</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>
            <span className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>${FMT(projected, 0)}</span>
            {" "}en {horizon} años · {planName}
          </p>
        </div>
        <Icon name={open ? "chevD" : "chevR"} size={16} color="var(--txt-dim)" />
      </button>

      {/* ── Detalle expandido ── */}
      {open && (
        <div style={{ padding: "0 16px 18px", borderTop: "1px solid var(--line)" }}>

          {/* Número grande */}
          <p className="num" style={{ fontSize: 36, fontWeight: 700, color: "var(--accent)", margin: "14px 0 2px", lineHeight: 1 }}>
            ${FMT(projected, 0)}
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--txt-muted)" }}>
            en {horizon} años · {planName} · {FMT(apy, 1)}% anual
          </p>

          {/* Toggle horizonte */}
          <div className="seg">
            {([10, 20, 30] as const).map((y) => (
              <button key={y} className={horizon === y ? "on" : ""} onClick={() => setHorizon(y)}>
                {y} años
              </button>
            ))}
          </div>

          {/* Gráfico */}
          <div style={{ marginTop: 14 }}>
            <ProjectionLineChart current={current} monthly={monthly} apy={apy} years={horizon} />
          </div>

          {/* Mensualidad editable */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Aportando</span>
            {editingMonthly ? (
              <MoneyInput
                className="num-input"
                autoFocus
                value={draft}
                placeholder={String(monthly)}
                onChange={setDraft}
                onBlur={commitMonthly}
                onKeyDown={(e) => e.key === "Enter" && commitMonthly()}
                style={{ width: 100, padding: "4px 10px", fontSize: 14, margin: 0, border: "1px solid var(--accent)", borderRadius: 8, background: "var(--surface-2)", color: "var(--txt)", fontWeight: 800 }}
              />
            ) : (
              <button
                onClick={() => { setDraft(String(monthly)); setEditingMonthly(true); }}
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "4px 12px", fontSize: 14, fontWeight: 800, cursor: "pointer", color: "var(--txt)" }}
                className="num"
              >
                ${FMT(monthly, 0)}/mes
              </button>
            )}
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>al mes</span>
          </div>

          <p style={{ fontSize: 11, color: "var(--txt-dim)", margin: "12px 0 0", lineHeight: 1.5 }}>
            Rendimiento objetivo ({FMT(apy, 1)}% anual), no garantizado.
          </p>
        </div>
      )}
    </div>
  );
}
