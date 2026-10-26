"use client";

/* Monedas-esfera para elegir dónde rinde el ahorro (en vez de un swap):
   CETES = bandera de México, USDC = dólar digital, XLM = estrella de Stellar.
   Tocar una moneda la trae al frente con un giro; la acción la decide quien
   la usa (`onPick`), así que no cambia la lógica de crear bóvedas. */
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { FMT } from "./data";
import type { RiskLevel } from "./data";

type CoinKind = "mx" | "usdc" | "xlm" | "other";

/** Moneda por activo: id de la estrategia o símbolo del activo. */
export function coinKind(s: { id?: string; assetSymbol?: string }): CoinKind {
  const k = `${s.id ?? ""} ${s.assetSymbol ?? ""}`.toLowerCase();
  if (k.includes("cetes")) return "mx";
  if (k.includes("usdc")) return "usdc";
  if (k.includes("xlm")) return "xlm";
  return "other";
}

/** Colores de la tarjeta de bóveda (gradiente) por moneda. */
export const COIN_GRADIENT: Record<CoinKind, [string, string]> = {
  mx: ["#0f7a49", "#063d26"],
  usdc: ["#3d6df2", "#1b2f86"],
  xlm: ["#7a4df0", "#2f1a73"],
  other: ["#4a4560", "#1f1b2e"],
};

function Face({ kind, label }: { kind: CoinKind; label?: string }) {
  if (kind === "mx") {
    return (
      <svg viewBox="0 0 36 36" preserveAspectRatio="xMidYMid slice">
        <rect width="12" height="36" x="0" fill="#0a7a43" />
        <rect width="12" height="36" x="12" fill="#f6f6f2" />
        <rect width="12" height="36" x="24" fill="#d0122f" />
        <circle cx="18" cy="18" r="3.6" fill="#8a5a2b" />
        <path d="M15.6 19.4c1.4 1 3.4 1 4.8 0" stroke="#2f7d32" strokeWidth=".9" fill="none" />
      </svg>
    );
  }
  if (kind === "usdc") {
    return (
      <svg viewBox="0 0 36 36">
        <rect width="36" height="36" fill="#2775CA" />
        <circle cx="18" cy="18" r="11.5" fill="none" stroke="#fff" strokeWidth="1.6" opacity=".9" />
        <text x="18" y="23.6" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff" fontFamily="system-ui">$</text>
      </svg>
    );
  }
  if (kind === "xlm") {
    return (
      <svg viewBox="0 0 36 36">
        <rect width="36" height="36" fill="#14111f" />
        <path d="M18 8.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L18 22.1 12.6 25l1.2-6-4.5-4.2 6.1-.7z" fill="#C8FF4D" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 36">
      <rect width="36" height="36" fill="#3a3550" />
      <text x="18" y="22" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="system-ui">{(label ?? "").slice(0, 4)}</text>
    </svg>
  );
}

export function CoinSphere({ kind, size = 72, label }: { kind: CoinKind; size?: number; label?: string }) {
  return (
    <span className="coin" style={{ width: size, height: size, display: "inline-block" }} aria-hidden>
      <Face kind={kind} label={label} />
    </span>
  );
}

export type BondOption = {
  id: string;
  planId: string;
  name: string;
  exposure: string;
  risk: RiskLevel;
  apy: number | null;
  apyTarget?: number;
  assetSymbol?: string;
  horizon?: string;
};

function apyText(o: BondOption): { text: string; est: boolean } {
  if (o.apy != null && Number.isFinite(o.apy)) return { text: `${FMT(o.apy, 1)}%`, est: false };
  if (o.apyTarget != null && Number.isFinite(o.apyTarget)) return { text: `${FMT(o.apyTarget, 1)}%`, est: true };
  return { text: "—", est: false };
}

/** Racimo de monedas: la elegida al centro y grande; las demás detrás. */
export function BondPicker({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: BondOption[];
  value: string;
  onChange: (planId: string) => void;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const sel = options.find((o) => o.planId === value) ?? options[0];
  if (!sel) return null;
  // la elegida va en medio; el resto alrededor
  const others = options.filter((o) => o.planId !== sel.planId);
  const ordered = [others[0], sel, ...others.slice(1)].filter(Boolean) as BondOption[];
  const big = compact ? 96 : 116;
  const apy = apyText(sel);

  return (
    <div className="bond-picker">
      <div className="bond-cluster" style={{ height: big + 30 }} role="radiogroup" aria-label="Elige dónde rinde">
        {ordered.map((o) => {
          const on = o.planId === sel.planId;
          return (
            <motion.button
              key={o.planId}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.name}
              onClick={() => onChange(o.planId)}
              animate={{ scale: on ? 1 : 0.62, opacity: on ? 1 : 0.7, zIndex: on ? 2 : 1, filter: on ? "blur(0px)" : "blur(0.6px)" }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              style={{ position: "relative" }}
            >
              <motion.span
                key={on ? `on-${o.planId}` : o.planId}
                style={{ display: "inline-block" }}
                initial={on && !reduced ? { rotateY: -180 } : false}
                animate={{ rotateY: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <CoinSphere kind={coinKind(o)} size={big} label={o.assetSymbol} />
              </motion.span>
            </motion.button>
          );
        })}
      </div>
      <div className="bond-info">
        <p className="bi-nm">{sel.name}</p>
        <p className="bi-ex">{sel.exposure}</p>
      </div>
      <div className="bond-stats">
        <div>
          <div className="k">Rinde</div>
          <div className="v num" style={{ color: "var(--accent)" }}>{apy.text}</div>
        </div>
        <div>
          <div className="k">Riesgo</div>
          <div className="v">{sel.risk}</div>
        </div>
        <div>
          <div className="k">Moneda</div>
          <div className="v">{sel.assetSymbol ?? "—"}</div>
        </div>
      </div>
      <p className="bond-hint">{apy.est ? "Tasa anual estimada; cambia con el mercado." : "Tasa anual actual; cambia con el mercado."}{options.length > 1 && " Toca una moneda para cambiar."}</p>
    </div>
  );
}
