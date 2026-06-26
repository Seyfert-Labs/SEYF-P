"use client";

/* SEYF — Ticker de bonos soberanos por país (onboarding). Marquee continuo con
   banderas emoji + rendimiento. El desplazamiento se anima con motion (no CSS
   global) para que funcione aunque el CSS no recargue. Cifras ilustrativas. */
import React from "react";
import { motion, useReducedMotion } from "motion/react";

interface Bond {
  flag: string;   // emoji bandera
  name: string;   // instrumento
  country: string;
  yield: string;  // rendimiento anual
}

const BONDS: Bond[] = [
  { flag: "🇲🇽", name: "CETES",    country: "México",    yield: "10.8%" },
  { flag: "🇧🇷", name: "Tesouro",  country: "Brasil",    yield: "11.2%" },
  { flag: "🇦🇷", name: "Lecap",    country: "Argentina", yield: "14.5%" },
  { flag: "🇨🇴", name: "TES",      country: "Colombia",  yield: "9.6%" },
  { flag: "🇺🇸", name: "T-Bills",  country: "EE.UU.",    yield: "5.2%" },
  { flag: "🇪🇺", name: "Bonos UE", country: "Europa",    yield: "3.4%" },
  { flag: "🇰🇷", name: "KTB",      country: "Corea",     yield: "3.6%" },
];

function Card({ b }: { b: Bond }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 11, flexShrink: 0,
        background: "var(--surface)", border: "1px solid var(--line)",
        borderRadius: 16, padding: "12px 15px",
      }}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>{b.flag}</span>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>{b.name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{b.country}</p>
      </div>
      <span className="num" style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", marginLeft: 4 }}>{b.yield}</span>
    </div>
  );
}

export function CurrencyTicker() {
  const reduced = useReducedMotion();
  // Pista duplicada → animar de 0% a -50% recorre exactamente un set = loop continuo.
  const loop = [...BONDS, ...BONDS];
  const fade = "linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)";
  return (
    <div style={{ overflow: "hidden", WebkitMaskImage: fade, maskImage: fade }}>
      <motion.div
        style={{ display: "flex", gap: 10, width: "max-content" }}
        animate={reduced ? undefined : { x: ["0%", "-50%"] }}
        transition={reduced ? undefined : { duration: 28, ease: "linear", repeat: Infinity }}
      >
        {loop.map((b, i) => (
          <Card key={i} b={b} />
        ))}
      </motion.div>
    </div>
  );
}
