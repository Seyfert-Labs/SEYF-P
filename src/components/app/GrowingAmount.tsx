"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * Ancla de crecimiento por `id`, a nivel de módulo: sobrevive a cambios de
 * pantalla (el router es por estado, sin recargar) para que el contador NO se
 * reinicie al navegar. Se reancla solo si cambia el `base` (abono/retiro).
 */
const growStore = new Map<string, { start: number; base: number; last: number }>();

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
  id = "",
  countUpOnMount = false,
  anchorMs,
  color,
}: {
  base: number;
  apy: number;
  /** Tamaño en px del dígito entero (el resto escala de forma proporcional). */
  size?: number;
  /** Cuántos micro-decimales tiquean tras los centavos. */
  tail?: number;
  align?: "center" | "left";
  prefix?: string;
  /** Color del dígito entero y los micro-decimales. Default: blanco + lima.
      Pásalo (p. ej. violeta) para marcar un saldo en bóveda. */
  color?: string;
  /** Clave estable para persistir el crecimiento entre navegaciones (p. ej. el id de la bóveda). */
  id?: string;
  /** Si true, al montar hace count-up desde 0 hasta `base` (sorpresa al abrir). */
  countUpOnMount?: boolean;
  /**
   * Timestamp (ms) al que se ancla el crecimiento — normalmente el `updatedAt`
   * persistido del saldo. Hace que el "money timer" PERSISTA entre recargas:
   * el valor se deriva como base + base·(apy)·(now - anchorMs). Sin esto, el
   * timer reinicia desde el montaje en cada carga.
   */
  anchorMs?: number;
}) {
  const live = base > 0 && apy > 0;
  const reduced = useReducedMotion();

  // Count-up: `base` se anima (roll-up) cuando cambia por un abono/retiro, y
  // opcionalmente desde 0 al montar. El tick en vivo (`grown`) se suma encima.
  const [baseAnim, setBaseAnim] = useState(() => (countUpOnMount && !reduced ? 0 : base));
  const prevBase = useRef<number>(countUpOnMount ? 0 : base);
  useEffect(() => {
    const from = prevBase.current;
    prevBase.current = base;
    if (reduced || from === base) {
      setBaseAnim(base);
      return;
    }
    // Duración proporcional al salto relativo, acotada para que se sienta ágil.
    const jump = Math.abs(base - from) / Math.max(base, from, 1);
    const controls = animate(from, base, {
      duration: Math.min(1.2, 0.45 + jump * 0.9),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setBaseAnim(v),
    });
    return () => controls.stop();
  }, [base, reduced]);
  // Inicializa con lo ya acumulado (si el id coincide y el base no cambió) para no
  // reiniciar a cero al volver a montar. El setState solo ocurre dentro del intervalo.
  const [grown, setGrown] = useState(() => {
    const e = growStore.get(id);
    if (e && e.base === base) return e.last;
    // Siembra desde el ancla persistida para no parpadear en 0 antes del primer tick.
    if (anchorMs != null && live) {
      const perSec = (base * (apy / 100)) / SECONDS_PER_YEAR;
      return Math.max(0, ((Date.now() - anchorMs) / 1000) * perSec);
    }
    return 0;
  });

  useEffect(() => {
    if (!live) return;
    const perSec = (base * (apy / 100)) / SECONDS_PER_YEAR;
    // Reancla si cambió el base o si llegó un nuevo ancla persistido (updatedAt).
    let e = growStore.get(id);
    if (!e || e.base !== base || (anchorMs != null && e.start !== anchorMs)) {
      e = { start: anchorMs ?? Date.now(), base, last: 0 };
      growStore.set(id, e);
    }
    const start = e.start;
    const iv = setInterval(() => {
      const g = ((Date.now() - start) / 1000) * perSec;
      growStore.set(id, { start, base, last: g });
      setGrown(g);
    }, 80);
    return () => clearInterval(iv);
  }, [base, apy, live, id, anchorMs]);

  const value = baseAnim + (live ? grown : 0);

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
      <span style={{ fontSize: size, color: color ?? "var(--txt)" }}>{whole}</span>
      <span style={{ fontSize: size * 0.55, color: "var(--txt-muted)", fontWeight: 700 }}>.{cents}</span>
      {live && (
        <span style={{ fontSize: size * 0.34, color: color ?? "var(--accent)", fontWeight: 700, marginLeft: 1, fontVariantNumeric: "tabular-nums" }}>
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
