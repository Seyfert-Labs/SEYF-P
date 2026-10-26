"use client";

/* Ilustraciones animadas del ahorro: barras de crecimiento y la caja
   fuerte con dial de cada bóveda.
   SVG + keyframes CSS (app-v2.css): sin JS por frame y respetan
   prefers-reduced-motion. Son decorativas: aria-hidden. */
import React, { useId } from "react";

/** Barras de crecimiento: columnas sólidas que suben una tras otra y una
    línea que se dibuja encima. `live` = hay ahorro rindiendo (la última
    barra va en lima y late el punto final). */
export function GrowthBars({ size = 120, live = true }: { size?: number; live?: boolean }) {
  const bars = [30, 44, 58, 76, 98];
  return (
    <svg className={`growth${live ? " live" : ""}`} viewBox="0 0 132 120" width={size} height={size * (120 / 132)} aria-hidden>
      <line x1="4" y1="114" x2="128" y2="114" stroke="#2a2638" strokeWidth="2" strokeLinecap="round" />
      {bars.map((h, i) => (
        <rect
          key={i}
          className={`gb b${i}`}
          x={8 + i * 24}
          y={110 - h}
          width="16"
          height={h}
          rx="5"
          fill={i === bars.length - 1 ? (live ? "#C8FF4D" : "#3a3550") : i >= 3 ? "#4a4560" : "#2f2b40"}
        />
      ))}
      <path className="gb-line" d="M16 72 L40 58 L64 46 L88 28 L112 8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      <circle className="gb-dot" cx="112" cy="8" r="4.5" fill="#fff" />
    </svg>
  );
}

/** Caja fuerte con dial que gira despacio; `color` = color del activo. */
export function VaultDial({ color = "#8B5CF6", size = 48, spin = true }: { color?: string; size?: number; spin?: boolean }) {
  return (
    <span className="vault-dial" style={{ width: size, height: size, "--vc": color } as React.CSSProperties} aria-hidden>
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <rect x="3" y="3" width="42" height="42" rx="12" strokeWidth="1.5" style={{ fill: "color-mix(in srgb, var(--vc) 22%, #120f20)", stroke: "color-mix(in srgb, var(--vc) 55%, transparent)" }} />
        {/* bisagras */}
        <rect x="6.5" y="13" width="3" height="6" rx="1.5" opacity=".7" style={{ fill: "var(--vc)" }} />
        <rect x="6.5" y="29" width="3" height="6" rx="1.5" opacity=".7" style={{ fill: "var(--vc)" }} />
        <circle cx="25" cy="24" r="13" fill="none" strokeWidth="2" opacity=".55" style={{ stroke: "var(--vc)" }} />
        <g className={spin ? "vd-wheel" : undefined}>
          <circle cx="25" cy="24" r="8.5" strokeWidth="2" style={{ fill: "color-mix(in srgb, var(--vc) 35%, #120f20)", stroke: "var(--vc)" }} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <rect key={a} x="24.2" y="13.5" width="1.6" height="4" rx=".8" transform={`rotate(${a} 25 24)`} style={{ fill: "var(--vc)" }} />
          ))}
          <path d="M25 18.5v11M19.5 24h11" strokeWidth="2.2" strokeLinecap="round" style={{ stroke: "var(--vc)" }} />
        </g>
        <circle cx="25" cy="24" r="2.2" fill="#fff" />
      </svg>
    </span>
  );
}

/** Rayo dentro de una moneda (adelanto): late y suelta chispas. */
export function AdvanceBolt({ size = 96 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="adv-bolt" viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={`ab-${id}`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#F1FFC4" />
          <stop offset="0.5" stopColor="#C8FF4D" />
          <stop offset="1" stopColor="#7FA915" />
        </radialGradient>
      </defs>
      <circle className="ab-ring" cx="50" cy="50" r="44" fill="none" stroke="#C8FF4D" strokeWidth="2" opacity=".35" />
      <g className="ab-coin">
        <circle cx="50" cy="50" r="34" fill={`url(#ab-${id})`} />
        <circle cx="50" cy="50" r="27" fill="none" stroke="#6E9A12" strokeWidth="2" opacity=".6" />
        <path d="M54 26L37 53h11l-4 21 18-29H51z" fill="#2A3D06" />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} className={`ab-spark s${i}`} cx={22 + i * 28} cy={18 + (i % 2) * 6} r="3" fill="#C8FF4D" />
      ))}
    </svg>
  );
}
