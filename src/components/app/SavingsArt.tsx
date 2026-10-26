"use client";

/* Ilustraciones animadas del ahorro: la alcancía (monedas que entran y
   rendimiento que "brota") y la caja fuerte con dial de cada bóveda.
   SVG + keyframes CSS (app-v2.css): sin JS por frame y respetan
   prefers-reduced-motion. Son decorativas: aria-hidden. */
import React, { useId } from "react";

/** Alcancía violeta: caen monedas por la ranura y salen moneditas de rendimiento.
    `live` = hay ahorro rindiendo (muestra las monedas "+"). */
export function PiggyBank({ size = 140, live = true }: { size?: number; live?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="piggy" viewBox="0 0 200 170" width={size} height={size * 0.85} aria-hidden>
      <defs>
        <linearGradient id={`pb-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B79BFF" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#5B32C9" />
        </linearGradient>
        <radialGradient id={`pc-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#F1FFC4" />
          <stop offset="0.5" stopColor="#C8FF4D" />
          <stop offset="1" stopColor="#8DBB1F" />
        </radialGradient>
      </defs>

      {/* monedas que caen a la ranura */}
      {[0, 1, 2].map((i) => (
        <g key={i} className={`pig-drop d${i}`}>
          <ellipse cx={99 + (i - 1) * 3} cy="20" rx="11" ry="11" fill={`url(#pc-${id})`} stroke="#6E9A12" strokeWidth="1.5" />
          <text x={99 + (i - 1) * 3} y="24.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#3D5508">$</text>
        </g>
      ))}

      <g className="pig-body">
        {/* sombra */}
        <ellipse cx="100" cy="158" rx="58" ry="6" fill="rgba(0,0,0,.35)" />
        {/* patas */}
        <rect x="58" y="128" width="16" height="24" rx="7" fill="#6A3FDB" />
        <rect x="80" y="132" width="16" height="22" rx="7" fill="#5B32C9" />
        <rect x="112" y="132" width="16" height="22" rx="7" fill="#5B32C9" />
        <rect x="132" y="128" width="16" height="24" rx="7" fill="#6A3FDB" />
        {/* cola */}
        <path d="M40 98c-12-2-14-14-5-16 7-1 7 9 0 9" fill="none" stroke="#8B5CF6" strokeWidth="5" strokeLinecap="round" />
        {/* cuerpo */}
        <ellipse cx="100" cy="100" rx="64" ry="46" fill={`url(#pb-${id})`} />
        {/* oreja */}
        <path d="M128 60l14-18 6 26z" fill="#7A4DEB" />
        <path d="M132 60l9-11 3 15z" fill="#C4B5FD" opacity=".6" />
        {/* hocico */}
        <ellipse cx="162" cy="104" rx="14" ry="12" fill="#A88BFA" />
        <ellipse cx="157.5" cy="104" rx="2.4" ry="3.4" fill="#4C2AA8" />
        <ellipse cx="166.5" cy="104" rx="2.4" ry="3.4" fill="#4C2AA8" />
        {/* ojo + brillo */}
        <circle className="pig-eye" cx="140" cy="86" r="4.2" fill="#1B0F3D" />
        <circle cx="141.4" cy="84.6" r="1.3" fill="#fff" />
        {/* ranura */}
        <rect x="86" y="55" width="28" height="6" rx="3" fill="#2A1566" />
        {/* brillo del cuerpo */}
        <ellipse cx="78" cy="80" rx="22" ry="10" fill="#fff" opacity=".18" transform="rotate(-18 78 80)" />
        {/* SEYF en la panza */}
        <circle cx="96" cy="108" r="13" fill="#C8FF4D" opacity=".95" />
        <text x="96" y="113" textAnchor="middle" fontSize="14" fontWeight="900" fill="#2A3D06">$</text>
      </g>

      {/* rendimiento: moneditas que brotan */}
      {live &&
        [0, 1, 2].map((i) => (
          <g key={i} className={`pig-yield y${i}`}>
            <circle cx={60 + i * 34} cy="64" r="7" fill={`url(#pc-${id})`} />
            <text x={60 + i * 34} y="67.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#3D5508">+</text>
          </g>
        ))}
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
