"use client";

/* UTONOMA — helpers de layout compartidos */
import React from "react";
import { Icon } from "./ui";
import { FMT, type Txn } from "./data";
import type { Go, Screen } from "./nav";
import { useWallet } from "@/components/wallet/WalletContext";

/* barra superior con saludo + acciones (estilo home) */
export function TopBar({ go }: { go: Go }) {
  const wallet = useWallet();
  const authed = wallet.enabled && wallet.authenticated;
  const display = authed ? wallet.email ?? "Mi cuenta" : "Diego Robles";
  const initials = authed
    ? (wallet.email ? wallet.email.slice(0, 2).toUpperCase() : "MX")
    : "DR";
  return (
    <div className="app-head">
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="greet">Buenas tardes</p>
        <p
          className="name"
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 230 }}
        >
          {display}
        </p>
      </div>
      <div className="head-actions">
        <button className="icon-btn" onClick={() => go("bovedas")} aria-label="Bóvedas de ahorro">
          <Icon name="vault" size={20} />
        </button>
        <button className="avatar" onClick={() => go("perfil")}>{initials}</button>
      </div>
    </div>
  );
}

/* cabecera de subpágina: atrás + título + acción opcional */
export function SubHeader({
  title,
  go,
  back = "home",
  action,
}: {
  title: string;
  go: Go;
  back?: Screen;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-head" style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="icon-btn" onClick={() => go(back)} aria-label="Atrás">
          <Icon name="chevL" size={20} />
        </button>
        <p className="name" style={{ fontSize: 20 }}>{title}</p>
      </div>
      {action || <span style={{ width: 42 }} />}
    </div>
  );
}

/* cifra monetaria con divisa */
export function Money({
  amount,
  cur = "MXN",
  sign = false,
  size = "inherit",
  cents = true,
}: {
  amount: number;
  cur?: string;
  sign?: boolean;
  size?: number | string;
  cents?: boolean;
}) {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const s = sign ? (neg ? "−" : "+") : neg ? "−" : "";
  const [int, dec] = FMT(abs, cents ? 2 : 0).split(".");
  return (
    <span className="num" style={{ fontSize: size }}>
      {s}${int}
      {cents && <span style={{ opacity: 0.5 }}>.{dec}</span>}
      <span style={{ fontSize: "0.62em", opacity: 0.55, marginLeft: 5, fontWeight: 600 }}>{cur}</span>
    </span>
  );
}

/* fila de transacción pendiente (optimistic UI · confirmando on-chain) */
export function PendingTxnRow({ p }: { p: { kind: "deposit" | "send"; amount: number } }) {
  const pos = p.kind === "deposit";
  return (
    <div className="lrow" style={{ opacity: 0.92 }}>
      <div className="ava" style={{ background: "var(--surface-3)" }}>
        <span className="spin" style={{ width: 18, height: 18, color: "var(--accent)" }} />
      </div>
      <div className="mid">
        <p className="ti">{pos ? "Depósito" : "Envío"}</p>
        <p className="su" style={{ color: "var(--accent-2)" }}>Pendiente · confirmando…</p>
      </div>
      <div className="amt">
        <div className="a" style={{ color: pos ? "var(--accent)" : "var(--txt)" }}>
          {pos ? "+" : "−"}<span className="num">${FMT(p.amount, 2)}</span>
        </div>
      </div>
    </div>
  );
}

/* fila de transacción / lista */
export function TxnRow({ t, go }: { t: Txn; go?: Go }) {
  const pos = t.amt > 0;
  return (
    <div className="lrow" onClick={() => go && go("txn", t)}>
      <div className="ava" style={pos ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" } : {}}>
        <Icon name={t.ic} size={20} />
      </div>
      <div className="mid">
        <p className="ti">{t.nm}</p>
        <p className="su">{t.su}</p>
      </div>
      <div className="amt">
        <div className="a" style={{ color: pos ? "var(--accent)" : "var(--txt)" }}>
          <Money amount={t.amt} cur={t.cur || "MXN"} sign={pos} />
        </div>
        {t.sub && <div className="s num">{t.sub}</div>}
      </div>
    </div>
  );
}
