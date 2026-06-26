"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "../ui";

/* ── Colores de acento disponibles ── */
const ACCENT_COLORS = [
  { label: "Lima",    value: "#C8FF4D", soft: "rgba(200,255,77,0.14)",  on: "#0e1a00" },
  { label: "Cyan",    value: "#22D3EE", soft: "rgba(34,211,238,0.14)",   on: "#002a30" },
  { label: "Violeta", value: "#A78BFA", soft: "rgba(167,139,250,0.14)",  on: "#1a0040" },
  { label: "Naranja", value: "#FB923C", soft: "rgba(251,146,60,0.14)",   on: "#2a0e00" },
  { label: "Rosa",    value: "#F472B6", soft: "rgba(244,114,182,0.14)",  on: "#2a001a" },
];

const LS_KEY = "seyf_accent";

function loadAccent() {
  if (typeof window === "undefined") return ACCENT_COLORS[0];
  const saved = localStorage.getItem(LS_KEY);
  return ACCENT_COLORS.find((c) => c.value === saved) ?? ACCENT_COLORS[0];
}

function applyAccent(color: (typeof ACCENT_COLORS)[0]) {
  document.documentElement.style.setProperty("--accent", color.value);
  document.documentElement.style.setProperty("--accent-soft", color.soft);
  document.documentElement.style.setProperty("--on-accent", color.on);
  localStorage.setItem(LS_KEY, color.value);
}

/* ── Sub-vistas ── */
type View = "menu" | "reporte" | "estado" | "tema" | "promos";

export function MoreSheet({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("menu");
  const [accent, setAccent] = useState(() => loadAccent());

  /* Aplica el acento guardado al montar */
  useEffect(() => {
    applyAccent(loadAccent());
  }, []);

  const pickAccent = (c: (typeof ACCENT_COLORS)[0]) => {
    setAccent(c);
    applyAccent(c);
  };

  const back = () => setView("menu");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />

        {/* ────────── MENÚ PRINCIPAL ────────── */}
        {view === "menu" && (
          <>
            <p className="modal-title">Más opciones</p>
            <p className="modal-sub">Herramientas y configuración de tu cuenta</p>

            <div className="card" style={{ padding: "4px 0", marginTop: 8 }}>
              <MenuItem
                icon="doc"
                label="Generar reporte"
                sub="PDF o CSV de movimientos"
                onClick={() => setView("reporte")}
              />
              <MenuItem
                icon="chart"
                label="Estado de cuenta"
                sub="Resumen detallado del período"
                onClick={() => setView("estado")}
                divider
              />
              <MenuItem
                icon="gear"
                label="Tema"
                sub="Color de la aplicación"
                onClick={() => setView("tema")}
                divider
              />
              <MenuItem
                icon="gift"
                label="Promociones"
                sub="Ofertas y referidos activos"
                onClick={() => setView("promos")}
                divider
                last
              />
            </div>

            <button
              className="btn btn-ghost"
              style={{ width: "100%", marginTop: 16 }}
              onClick={onClose}
            >
              Cerrar
            </button>
          </>
        )}

        {/* ────────── GENERAR REPORTE ────────── */}
        {view === "reporte" && (
          <>
            <BackBar label="Generar reporte" onBack={back} />
            <p className="modal-sub">Descarga un resumen de tus movimientos en el formato que prefieras.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              <ReportOption
                icon="doc"
                label="Reporte mensual PDF"
                sub="Últimos 30 días · incluye desglose por categoría"
                badge="Próximamente"
              />
              <ReportOption
                icon="doc"
                label="Historial CSV completo"
                sub="Todos tus movimientos · compatible con Excel"
                badge="Próximamente"
              />
              <ReportOption
                icon="doc"
                label="Comprobante fiscal (CFDI)"
                sub="Requiere RFC registrado en tu perfil"
                badge="Próximamente"
              />
            </div>

            <div className="alert alert-info" style={{ marginTop: 18 }}>
              Los reportes estarán disponibles en la próxima actualización. Te notificaremos cuando estén listos.
            </div>
          </>
        )}

        {/* ────────── ESTADO DE CUENTA ────────── */}
        {view === "estado" && (
          <>
            <BackBar label="Estado de cuenta" onBack={back} />
            <p className="modal-sub">Período: Mayo 2026</p>

            <div className="card" style={{ padding: "6px 18px" }}>
              <EstadoRow label="Saldo inicial" value="$0.00" />
              <EstadoRow label="Total entradas" value="$0.00" />
              <EstadoRow label="Total salidas" value="$0.00" />
              <EstadoRow label="Comisiones" value="$0.00" />
              <EstadoRow label="Intereses generados" value="$0.00" accent />
              <EstadoRow label="Saldo final" value="$0.00" bold last />
            </div>

            <div className="alert alert-info" style={{ marginTop: 14 }}>
              El estado de cuenta detallado se generará automáticamente al cierre de cada mes.
            </div>

            <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled>
              <Icon name="doc" size={18} /> Descargar PDF
            </button>
          </>
        )}

        {/* ────────── TEMA ────────── */}
        {view === "tema" && (
          <>
            <BackBar label="Tema y color" onBack={back} />
            <p className="modal-sub">Personaliza el color de acento de la aplicación.</p>

            <p className="field-label">Color de acento</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ACCENT_COLORS.map((c) => {
                const active = accent.value === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => pickAccent(c)}
                    style={{
                      width: 52, height: 52, borderRadius: 16,
                      background: c.value, border: active ? `3px solid var(--txt)` : "3px solid transparent",
                      cursor: "pointer", position: "relative",
                      boxShadow: active ? `0 0 0 2px var(--surface), 0 0 0 4px ${c.value}` : "none",
                      transition: "box-shadow .18s, border .18s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title={c.label}
                    aria-label={c.label}
                  >
                    {active && <Icon name="check" size={20} color={c.on} stroke={2.5} />}
                  </button>
                );
              })}
            </div>

            <div className="card" style={{ marginTop: 18, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: accent.value, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="check" size={18} color={accent.on} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--txt)" }}>{accent.label} seleccionado</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>Se guarda automáticamente en este dispositivo</p>
              </div>
            </div>
          </>
        )}

        {/* ────────── PROMOCIONES ────────── */}
        {view === "promos" && (
          <>
            <BackBar label="Promociones" onBack={back} />
            <p className="modal-sub">Ofertas exclusivas y programa de referidos</p>

            <PromoCard
              icon="gift"
              title="Bono de bienvenida"
              desc="Invita a un amigo y ambos reciben $200 al primer depósito de $500 o más."
              cta="Compartir código"
              accent
            />
            <PromoCard
              icon="trend"
              title="Ahorro extra +2%"
              desc="Mantén más de $10,000 en tu bóveda por 90 días consecutivos y suma 2% APY adicional."
              cta="Activar"
            />
            <PromoCard
              icon="star"
              title="SEYF Black"
              desc="Sin comisiones en retiros internacionales y soporte prioritario 24/7. Disponible próximamente."
              cta="Notifícame"
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Componentes auxiliares ── */

function MenuItem({
  icon, label, sub, onClick, divider, last,
}: {
  icon: string; label: string; sub: string; onClick: () => void; divider?: boolean; last?: boolean;
}) {
  return (
    <div
      className="lrow"
      onClick={onClick}
      style={{ borderTop: divider ? "1px solid var(--line)" : undefined, cursor: "pointer", padding: "14px 18px" }}
    >
      <div className="ava" style={{ background: "var(--surface-2)" }}>
        <Icon name={icon} size={20} color="var(--accent)" />
      </div>
      <div className="mid">
        <p className="ti">{label}</p>
        <p className="su">{sub}</p>
      </div>
      <Icon name="chevR" size={16} color="var(--txt-dim)" />
    </div>
  );
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--txt-muted)", display: "flex" }}
        aria-label="Volver"
      >
        <Icon name="chevL" size={22} />
      </button>
      <p className="modal-title" style={{ margin: 0 }}>{label}</p>
    </div>
  );
}

function ReportOption({ icon, label, sub, badge }: { icon: string; label: string; sub: string; badge?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
      <div className="ava" style={{ background: "var(--surface-2)", flexShrink: 0 }}>
        <Icon name={icon} size={20} color="var(--accent)" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--txt)" }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{sub}</p>
      </div>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: ".04em",
          background: "var(--surface-3)", color: "var(--txt-muted)",
          borderRadius: 8, padding: "3px 8px", flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function EstadoRow({ label, value, accent, bold, last }: { label: string; value: string; accent?: boolean; bold?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 0", borderBottom: last ? "none" : "1px solid var(--line)",
    }}>
      <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: bold ? 800 : 700,
        color: accent ? "var(--accent)" : "var(--txt)",
        fontFamily: "var(--font-display, sans-serif)",
      }}>
        {value}
      </span>
    </div>
  );
}

function PromoCard({ icon, title, desc, cta, accent }: { icon: string; title: string; desc: string; cta: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: 18, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: accent ? "var(--accent-soft)" : "var(--surface-2)",
          color: accent ? "var(--accent)" : "var(--txt-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name={icon} size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "var(--txt)" }}>{title}</p>
          <p style={{ margin: "5px 0 10px", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.5 }}>{desc}</p>
          <button className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12, height: "auto" }}>
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
