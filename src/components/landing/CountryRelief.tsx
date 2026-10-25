"use client";

/* SEYF — país en relieve faux-3D (SVG, sin WebGL).
   Técnica del mapa de LATAM de baf-website: la silueta real se apila en capas
   desplazadas hacia el sur para dar grosor, la cara superior lleva la bandera
   recortada a la forma del país + una capa de luz, bisel en el borde y sombra
   de contacto. La capital lleva un pin con pulso. La inclinación al mouse la
   controla la tarjeta vía --rx / --ry. */
import React from "react";
import { COUNTRY_SHAPES } from "./countries.data";

export type CountryCode = keyof typeof COUNTRY_SHAPES;

const DEPTH = 46;
const LAYERS = 12;
const EX = 0.28; // dirección de la extrusión: sur + leve este
const EY = 0.96;

const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/* Bandera dibujada en el cuadro 1000×1000; se recorta a la silueta. */
const FLAGS: Record<CountryCode, React.ReactNode> = {
  mx: (
    <>
      <rect width="334" height="1000" fill="#0a7a43" />
      <rect x="333" width="334" height="1000" fill="#f2f0ea" />
      <rect x="666" width="334" height="1000" fill="#d01530" />
      <circle cx="500" cy="500" r="70" fill="#8a5a2e" opacity=".9" />
    </>
  ),
  us: (
    <>
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} y={(i * 1000) / 13} width="1000" height={1000 / 13 + 1} fill={i % 2 ? "#f2f0ea" : "#c0283a"} />
      ))}
      <rect width="460" height={(1000 / 13) * 7} fill="#2c2e6e" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={40 + (i % 6) * 76} cy={45 + Math.floor(i / 6) * 100} r="13" fill="#fff" />
      ))}
    </>
  ),
  br: (
    <>
      <rect width="1000" height="1000" fill="#139447" />
      <path d="M500 140 L900 500 L500 860 L100 500 Z" fill="#fedf00" />
      <circle cx="500" cy="500" r="190" fill="#1e3f97" />
      <path d="M320 470 Q500 420 680 540" stroke="#fff" strokeWidth="26" fill="none" />
    </>
  ),
  ar: (
    <>
      <rect width="1000" height="1000" fill="#74acdf" />
      <rect y="333" width="1000" height="334" fill="#f4f4f4" />
      <circle cx="500" cy="500" r="70" fill="#f6b40e" />
    </>
  ),
  co: (
    <>
      <rect width="1000" height="500" fill="#fcd116" />
      <rect y="500" width="1000" height="250" fill="#003893" />
      <rect y="750" width="1000" height="250" fill="#ce1126" />
    </>
  ),
  eu: (
    <>
      <rect width="1000" height="1000" fill="#103a9c" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <circle key={i} cx={(560 + 250 * Math.sin(a)).toFixed(1)} cy={(560 - 250 * Math.cos(a)).toFixed(1)} r="26" fill="#ffcc00" />;
      })}
    </>
  ),
  kr: (
    <>
      <rect width="1000" height="1000" fill="#f4f4f4" />
      <path d="M300 500 a200 200 0 0 1 400 0 a100 100 0 0 1 -200 0 a100 100 0 0 0 -200 0z" fill="#cd2e3a" />
      <path d="M300 500 a200 200 0 0 0 400 0 a100 100 0 0 0 -200 0 a100 100 0 0 1 -200 0z" fill="#0047a0" />
      <g fill="#111">
        <rect x="90" y="170" width="150" height="22" transform="rotate(-34 165 180)" />
        <rect x="90" y="215" width="150" height="22" transform="rotate(-34 165 225)" />
        <rect x="760" y="770" width="150" height="22" transform="rotate(-34 835 780)" />
        <rect x="760" y="815" width="150" height="22" transform="rotate(-34 835 825)" />
      </g>
    </>
  ),
};

export function CountryRelief({ code, wall, accent }: { code: CountryCode; wall: string; accent: string }) {
  const { d, cap } = COUNTRY_SHAPES[code];
  const deep = rgb(wall).map((v) => v * 0.35);
  const top = rgb(wall);
  const layers = Array.from({ length: LAYERS }, (_, i) => {
    const f = 1 - i / (LAYERS - 1); // 1 = más profunda
    return { x: DEPTH * f * EX, y: DEPTH * f * EY, fill: hex(lerp(top, deep, f)) };
  });
  const id = `cr-${code}`;
  return (
    <div className="relief">
      <div className="relief-tilt">
        <svg viewBox="-20 -20 1060 1080" aria-hidden className="relief-svg">
          <defs>
            <clipPath id={`${id}-clip`}><path d={d} /></clipPath>
            <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".38" />
              <stop offset=".45" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".42" />
            </linearGradient>
            <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" /></filter>
          </defs>

          {/* sombra de contacto */}
          <path d={d} transform={`translate(${DEPTH * EX + 10} ${DEPTH * EY + 22})`} fill="#000" opacity=".55" filter={`url(#${id}-shadow)`} />
          {/* paredes de la extrusión */}
          {layers.map((l, i) => (
            <path key={i} d={d} transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)})`} fill={l.fill} />
          ))}
          {/* cara superior: bandera recortada + luz */}
          <g clipPath={`url(#${id}-clip)`}>
            {FLAGS[code]}
            <rect width="1000" height="1000" fill={`url(#${id}-light)`} />
          </g>
          {/* bisel */}
          <path d={d} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />

          {/* pin de la capital */}
          <g transform={`translate(${cap[0]} ${cap[1]})`}>
            <circle className="relief-pulse" r="30" fill="none" stroke={accent} strokeWidth="5" />
            <line x1="0" y1="0" x2="0" y2="-70" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <circle cy="-78" r="20" fill={accent} stroke="#08080D" strokeWidth="6" />
            <ellipse rx="16" ry="7" fill="#000" opacity=".5" />
          </g>
        </svg>
      </div>
    </div>
  );
}
