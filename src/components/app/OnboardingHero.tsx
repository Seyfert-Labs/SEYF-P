"use client";

/* SEYF — Hero animado del onboarding: dinero creciendo en vivo, gráfica que
   crece y un adelanto de rendimiento animado. Pura ilustración (sin datos
   reales) para que la primera pantalla "venda" el producto de un vistazo. */
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { GrowingAmount } from "./GrowingAmount";
import { Icon } from "./ui";

const EASE = [0.22, 1, 0.36, 1] as const;

// Alturas (%) de las barras: tendencia ascendente para sensación de crecimiento.
const BARS = [34, 44, 40, 54, 50, 64, 72, 68, 82, 90, 86, 98];

export function OnboardingHero() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="card glow"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{ position: "relative", overflow: "hidden", padding: 20 }}
    >
      {/* Glow ambiental */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "radial-gradient(120% 80% at 90% -10%, var(--accent-2-soft), transparent 60%), radial-gradient(90% 60% at -10% 110%, var(--accent-soft), transparent 55%)",
        }}
      />

      {/* Encabezado: etiqueta + APY */}
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="eyebrow">Tu ahorro creciendo</span>
        <span className="pos-pill"><Icon name="leaf" size={12} /> 12% anual</span>
      </div>

      {/* Dinero creciendo en vivo (tiquea segundo a segundo) */}
      <div style={{ position: "relative", marginTop: 10 }}>
        <GrowingAmount base={48250} apy={12} size={42} align="left" tail={5} id="onb-hero" />
      </div>

      {/* Gráfica de barras que "crecen" al montar, con línea de tendencia encima */}
      <div style={{ position: "relative", height: 70, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: "100%" }}>
          {BARS.map((h, i) => {
            const last = i === BARS.length - 1;
            return (
              <motion.div
                key={i}
                initial={reduced ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={reduced ? { duration: 0 } : { duration: 0.6, delay: 0.25 + i * 0.05, ease: EASE }}
                style={{
                  flex: 1, height: `${h}%`, transformOrigin: "bottom",
                  borderRadius: "5px 5px 2px 2px",
                  background: last
                    ? "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent))"
                    : "var(--surface-3)",
                  boxShadow: last ? "0 0 18px -4px var(--accent-soft)" : "none",
                }}
              />
            );
          })}
        </div>
        {/* Línea de tendencia que se dibuja sobre las barras */}
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          <motion.path
            d="M2 34 L11 28 L20 30 L29 22 L38 24 L47 16 L56 11 L65 13 L74 7 L83 4 L92 5 L98 1"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 1.1, delay: 0.5, ease: "easeInOut" }}
          />
        </svg>
      </div>

      {/* Adelanto de rendimiento — chip animado (icono pulsa, flecha avanza) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.5, ease: EASE }}
        style={{
          position: "relative", marginTop: 16, display: "flex", alignItems: "center", gap: 11,
          background: "var(--accent-2-soft)", border: "1px solid rgba(139,92,246,.28)",
          borderRadius: 14, padding: "10px 12px",
        }}
      >
        <motion.span
          animate={reduced ? undefined : { scale: [1, 1.12, 1], boxShadow: ["0 0 0 0 rgba(139,92,246,0)", "0 0 0 6px rgba(139,92,246,.12)", "0 0 0 0 rgba(139,92,246,0)"] }}
          transition={reduced ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent-2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Icon name="bolt" size={16} />
        </motion.span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "#c4b5fd" }}>Adelanta tu rendimiento</p>
          <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--txt-muted)" }}>
            Recibe hasta <b className="num" style={{ color: "var(--txt)" }}>+$2,400</b> hoy
          </p>
        </div>
        <motion.span
          animate={reduced ? undefined : { x: [0, 4, 0] }}
          transition={reduced ? undefined : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon name="arrowR" size={16} color="#c4b5fd" />
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
