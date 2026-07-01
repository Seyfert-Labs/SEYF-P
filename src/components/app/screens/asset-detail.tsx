"use client";

/* Detalle de un activo on-chain de la wallet Stellar: saldo, valor en MXN, precio
   real y una gráfica simple del precio (7 días). */
import React, { useEffect, useState } from "react";
import type { Go } from "../nav";
import { SubHeader } from "../shared";
import { FMT } from "../data";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { StellarAssetAvatar, stellarAssetName } from "./core";

type AssetCtx = { code: string; bal: number };

/** Color de la línea de la gráfica por activo (hex concreto para el SVG). */
const CHART_COLOR: Record<string, string> = {
  XLM: "#C8FF4D",
  CETES: "#5BD6C0",
  USDC: "#7C9EFF",
};

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 96;
  const pad = 5;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (p - min) / range);
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L${last[0].toFixed(1)},${h} L${first[0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="assetSparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#assetSparkGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function ScreenAssetDetail({ go, ctx }: { go: Go; ctx: unknown }) {
  const stellar = useSeyfStellarWallet();
  const c = (ctx && typeof ctx === "object" ? ctx : {}) as Partial<AssetCtx>;
  const code = (c.code ?? "").toUpperCase();
  const bal = Number(c.bal ?? 0);
  const color = CHART_COLOR[code] ?? "#C8FF4D";

  const [price, setPrice] = useState<number | null>(null);
  const [points, setPoints] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ codes: code });
        if (stellar.publicKey) qs.set("wallet", stellar.publicKey);
        const [pRes, hRes] = await Promise.all([
          fetch(`/api/prices/mxn?${qs.toString()}`).then((r) => r.json()).catch(() => ({})),
          fetch(`/api/prices/history?code=${encodeURIComponent(code)}`).then((r) => r.json()).catch(() => ({})),
        ]);
        if (!active) return;
        const p = (pRes as { prices?: Record<string, number> })?.prices?.[code];
        setPrice(typeof p === "number" ? p : null);
        const pts = (hRes as { points?: unknown })?.points;
        setPoints(Array.isArray(pts) ? (pts as number[]) : []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code, stellar.publicKey]);

  const mxnValue = price != null ? bal * price : null;
  const change =
    points.length >= 2 && points[0] > 0
      ? ((points[points.length - 1] - points[0]) / points[0]) * 100
      : null;

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={code} go={go} back="home" />
      <div className="screen-pad">
        {/* Encabezado del activo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
          <div style={{ transform: "scale(1.5)", transformOrigin: "left center" }}>
            <StellarAssetAvatar code={code} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>{stellarAssetName(code)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{code} · Red Stellar</p>
          </div>
        </div>

        {/* Saldo y valor en MXN */}
        <div className="card" style={{ marginTop: 18, padding: 20 }}>
          <p className="eyebrow">Tu saldo</p>
          <p className="num" style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 900 }}>
            {FMT(bal, 4)} <span style={{ fontSize: 16, color: "var(--txt-muted)" }}>{code}</span>
          </p>
          {mxnValue != null && (
            <p className="num" style={{ margin: "4px 0 0", fontSize: 15, color: "var(--txt-muted)" }}>
              ≈ ${FMT(mxnValue, 2)} MXN
            </p>
          )}
        </div>

        {/* Precio + gráfica */}
        <div className="card" style={{ marginTop: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <p className="eyebrow">Precio</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800 }}>
                {price != null ? `$${FMT(price, price < 10 ? 4 : 2)}` : "—"}{" "}
                <span style={{ fontSize: 12, color: "var(--txt-muted)" }}>MXN</span>
              </p>
            </div>
            {change != null && (
              <span style={{ fontSize: 13, fontWeight: 800, color: change >= 0 ? "#34d399" : "var(--neg)" }}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%{" "}
                <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}>7d</span>
              </span>
            )}
          </div>
          <div style={{ marginTop: 14, minHeight: 96 }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "34px 0" }}>
                <span className="spin" style={{ color }} />
              </div>
            ) : points.length >= 2 ? (
              <Sparkline points={points} color={color} />
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--txt-dim)", lineHeight: 1.5, padding: "22px 0", textAlign: "center" }}>
                {code === "CETES"
                  ? "Los CETES son un bono de tasa fija: su precio es estable y rinde a la tasa anual del gobierno."
                  : "Sin datos de mercado para este activo por ahora."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
