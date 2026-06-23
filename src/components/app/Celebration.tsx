"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";

// Paleta de confetti (acento de la marca + acentos cálidos/fríos de apoyo).
const COLORS = ["var(--accent)", "#F5A623", "#34C759", "#5B8DEF", "#FF6B6B"];

interface Piece {
  id: number;
  x: number;
  y: number;
  rot: number;
  color: string;
  size: number;
  delay: number;
  round: boolean;
}

// Pool de piezas precalculado a nivel módulo (una sola vez al importar), para
// no llamar Math.random durante el render del componente. La variación visual
// fija es imperceptible y mantiene el componente puro.
const POOL: Piece[] = Array.from({ length: 40 }, (_, i) => {
  const angle = (-90 + (Math.random() * 140 - 70)) * (Math.PI / 180);
  const dist = 90 + Math.random() * 170;
  return {
    id: i,
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    rot: Math.random() * 540 - 270,
    color: COLORS[i % COLORS.length],
    size: 7 + Math.random() * 6,
    delay: Math.random() * 0.08,
    round: Math.random() > 0.5,
  };
});

/**
 * Burst de confetti efímero para celebrar un depósito exitoso. Sin dependencias
 * extra: cada pieza es un motion.span que sale desde el origen con un arco
 * (gravedad) y se desvanece. Respeta prefers-reduced-motion (no renderiza nada).
 *
 * Pensado para vivir dentro de un contenedor `position: relative` (p. ej. la
 * hoja del modal). El origen es 50% horizontal y `originY` vertical.
 */
export function Celebration({
  count = 28,
  originY = "30%",
}: {
  count?: number;
  originY?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const pieces = POOL.slice(0, Math.min(count, POOL.length));

  return (
    <div
      aria-hidden
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none", zIndex: 5 }}
    >
      <div style={{ position: "absolute", left: "50%", top: originY }}>
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x: p.x,
              // Arco: sube, luego cae más abajo del destino (gravedad).
              y: [0, p.y * 0.55, p.y + 130],
              opacity: [1, 1, 0],
              rotate: p.rot,
              scale: [1, 1, 0.7],
            }}
            transition={{ duration: 1.15, delay: p.delay, ease: [0.2, 0.7, 0.3, 1], times: [0, 0.4, 1] }}
            style={{
              position: "absolute",
              width: p.size,
              height: p.size * (p.round ? 1 : 1.6),
              borderRadius: p.round ? "50%" : 2,
              background: p.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
