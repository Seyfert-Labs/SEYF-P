"use client";

import React, { useEffect, useState } from "react";

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Saldo que "crece al instante": parte de `base` y le suma el rendimiento por
 * segundo (`base * apy/100 / año`). Muestra el entero + centavos grandes y una
 * cola de micro-decimales que tiquea en vivo, para dar sensación de que tu
 * dinero crece en tiempo real (efecto tipo cronómetro de dinero).
 */
export function GrowingAmount({
  base,
  apy,
  size = 46,
  tail = 4,
  align = "center",
  prefix = "$",
}: {
  base: number;
  apy: number;
  /** Tamaño en px del dígito entero (el resto escala de forma proporcional). */
  size?: number;
  /** Cuántos micro-decimales tiquean tras los centavos. */
  tail?: number;
  align?: "center" | "left";
  prefix?: string;
}) {
  const live = base > 0 && apy > 0;
  // `grown` = rendimiento acumulado desde el último cambio de `base`. El setState
  // solo ocurre dentro del intervalo (nunca síncrono en el effect ni en render).
  const [grown, setGrown] = useState(0);

  useEffect(() => {
    if (!live) return;
    const start = Date.now();
    const perSec = (base * (apy / 100)) / SECONDS_PER_YEAR;
    const id = setInterval(() => {
      setGrown(((Date.now() - start) / 1000) * perSec);
    }, 80);
    return () => clearInterval(id);
  }, [base, apy, live]);

  const value = base + (live ? grown : 0);

  // Derivar entero/centavos/micro de un solo string para evitar desfases de redondeo.
  const full = Math.max(0, value).toFixed(2 + tail);
  const [ip, dp] = full.split(".");
  const whole = Number(ip).toLocaleString("es-MX");
  const cents = dp.slice(0, 2);
  const micro = dp.slice(2);

  return (
    <span
      className="num"
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "baseline",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      <span style={{ fontSize: size * 0.5, color: "var(--txt-muted)", fontWeight: 700, alignSelf: "flex-start", marginTop: size * 0.08 }}>
        {prefix}
      </span>
      <span style={{ fontSize: size, color: "var(--txt)" }}>{whole}</span>
      <span style={{ fontSize: size * 0.55, color: "var(--txt-muted)", fontWeight: 700 }}>.{cents}</span>
      {live && (
        <span style={{ fontSize: size * 0.34, color: "var(--accent)", fontWeight: 700, marginLeft: 1, fontVariantNumeric: "tabular-nums" }}>
          {micro}
        </span>
      )}
    </span>
  );
}

/** Línea de apoyo: cuánto rinde por día (y por año) a la tasa dada. */
export function YieldRate({ base, apy }: { base: number; apy: number }) {
  if (base <= 0 || apy <= 0) return null;
  const perDay = (base * (apy / 100)) / 365;
  const perYear = base * (apy / 100);
  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span style={{ fontSize: 12.5, color: "var(--txt-muted)" }}>
      Rinde <b className="num" style={{ color: "var(--accent)" }}>+${fmt(perDay)}</b> al día
      <span style={{ opacity: 0.6 }}> · ${fmt(perYear)} al año</span>
    </span>
  );
}
