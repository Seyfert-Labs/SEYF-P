"use client";

/* SEYF — Mercado: índice de precios de la Central de Abastos.
   Lista de productos (frutas y verduras) con precio de referencia del día.
   Tocar un producto → negocios que lo venden a distintos precios.
   Botón Vender → dar de alta tu negocio. */
import React, { useMemo, useState } from "react";
import { Icon, Spark } from "../ui";
import { SubHeader } from "../shared";
import { PRODUCTS, OFFERS, FMT, type MarketProduct, type MarketOffer, type MarketCat } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { Portal } from "../Portal";
import { useBusinesses } from "@/hooks/useBusinesses";

const CATS: (MarketCat | "Todos")[] = ["Todos", "Verdura", "Fruta", "Chile"];

function ProductIcon({ emoji, size = 46 }: { emoji: string; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 14, flexShrink: 0,
        background: "var(--surface-2)", border: "1px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.5,
      }}
    >
      {emoji}
    </span>
  );
}

function Trend({ v }: { v: number }) {
  const up = v > 0, flat = v === 0;
  const color = flat ? "var(--txt-muted)" : up ? "var(--neg)" : "var(--accent)";
  // En precios de mercado, subir es "caro" (rojo) y bajar es "barato" (verde).
  return (
    <span style={{ color, fontSize: 12, fontWeight: 800 }} className="num">
      {flat ? "→" : up ? "↑" : "↓"} {up ? "+" : ""}{FMT(v, 1)}%
    </span>
  );
}

/* ---------------- MERCADO (índice) ---------------- */
export function ScreenMercado({ go }: { go: Go }) {
  const [cat, setCat] = useState<(MarketCat | "Todos")>("Todos");
  const list = cat === "Todos" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat);

  const index = useMemo(() => {
    const avg = PRODUCTS.reduce((s, p) => s + p.avg, 0) / PRODUCTS.length;
    const trend = PRODUCTS.reduce((s, p) => s + p.trend, 0) / PRODUCTS.length;
    const verified = PRODUCTS.reduce((s, p) => s + p.verified, 0);
    return { avg, trend, verified };
  }, []);

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Mercado</p>
        <button className="icon-btn" onClick={() => go("vender")} aria-label="Vender">
          <Icon name="store" size={20} />
        </button>
      </div>
      <div className="screen-pad">
        {/* Índice del día */}
        <div className="card glow" style={{ padding: 22 }}>
          <p className="eyebrow">Índice de la Central · hoy</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12 }}>
            <span className="amount num" style={{ fontSize: 34 }}>${FMT(index.avg, 2)}</span>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>promedio canasta</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <Trend v={Number(index.trend.toFixed(1))} />
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>vs ayer · {index.verified} registros verificados</span>
          </div>
        </div>

        {/* Filtro por categoría */}
        <div className="seg" style={{ margin: "18px 0 16px" }}>
          {CATS.map((c) => (
            <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>

        {/* Lista de productos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((p) => (
            <div key={p.id} className="card bond-card" onClick={() => go("producto", p)}>
              <ProductIcon emoji={p.emoji} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{p.name}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                  ${FMT(p.low, 0)}–${FMT(p.high, 0)} / {p.unit} · {p.offers} negocios
                </p>
                <div style={{ marginTop: 6 }}>
                  {p.seyfBase ? (
                    <span className="pos-pill" style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)" }}>
                      <Icon name="leaf" size={11} /> Precio Seyf
                    </span>
                  ) : (
                    <span className="pos-pill"><Icon name="check" size={11} /> {p.verified} verificados</span>
                  )}
                </div>
              </div>
              <Spark data={p.series} w={48} h={28} fillArea color={p.trend > 0 ? "var(--neg)" : "var(--accent)"} />
              <div className="yield" style={{ textAlign: "right" }}>
                <div className="num" style={{ fontWeight: 800, fontSize: 17 }}>${FMT(p.avg, 2)}</div>
                <Trend v={p.trend} />
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={() => go("vender")}>
          <Icon name="store" size={18} /> Vender · dar de alta mi negocio
        </button>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- DETALLE DE PRODUCTO ---------------- */
export function ScreenProductDetail({ go, ctx }: { go: Go; ctx?: unknown }) {
  const p = (ctx as MarketProduct) || PRODUCTS[0];
  const offers = OFFERS.filter((o) => o.productId === p.id).sort((a, b) => a.price - b.price);

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={p.name} go={go} back="mercado" />
      <div className="screen-pad">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ProductIcon emoji={p.emoji} size={58} />
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>{p.name}</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{p.cat} · por {p.unit}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 22 }}>
          <span className="det-amount num">${FMT(p.avg, 2)}</span>
          <span style={{ fontSize: 15, color: "var(--txt-muted)" }}>precio de referencia / {p.unit}</span>
        </div>
        <div style={{ marginTop: 8 }}><Trend v={p.trend} /></div>

        <div className="card" style={{ marginTop: 18, padding: "22px 20px 16px" }}>
          <Spark data={p.series} w={320} h={110} color={p.trend > 0 ? "var(--neg)" : "var(--accent)"} fillArea />
          <p style={{ margin: "6px 2px 0", fontSize: 12, color: "var(--txt-dim)" }}>Últimos 8 días</p>
        </div>

        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="tile"><div className="k">Rango hoy</div><div className="v num" style={{ fontSize: 18 }}>${FMT(p.low, 0)}–${FMT(p.high, 0)}</div></div>
          <div className="tile"><div className="k">Negocios</div><div className="v num" style={{ fontSize: 18 }}>{p.offers}</div></div>
          <div className="tile"><div className="k">Verificados</div><div className="v num" style={{ fontSize: 18 }}>{p.verified}</div></div>
          <div className="tile"><div className="k">Fuente</div><div className="v" style={{ fontSize: 15 }}>{p.seyfBase ? "Seyf" : "Mercado"}</div></div>
        </div>

        <div className="sec-head"><h3>Quién lo vende</h3><span style={{ fontSize: 12, color: "var(--txt-dim)" }}>menor precio primero</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {offers.map((o) => (
            <div key={o.id} className="card" style={{ padding: 16, cursor: "pointer" }} onClick={() => go("comprar", { product: p, offer: o })}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{o.business}</p>
                    {o.verified && <Icon name="check" size={14} color="var(--accent)" />}
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{o.location}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--txt-dim)" }}>
                    ⭐ {FMT(o.rating, 1)} · {o.ops} operaciones · {FMT(o.available, 0)} {p.unit} disp.
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontWeight: 800, fontSize: 18 }}>${FMT(o.price, 2)}</div>
                  <div style={{ fontSize: 11, color: "var(--txt-muted)" }}>/ {p.unit}</div>
                </div>
                <Icon name="chevR" size={18} color="var(--txt-dim)" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- COMPRAR / APARTAR ---------------- */
export function ScreenComprar({ go, ctx }: { go: Go; ctx?: unknown }) {
  const data = ctx as { product: MarketProduct; offer: MarketOffer } | undefined;
  const product = data?.product ?? PRODUCTS[0];
  const offer = data?.offer ?? OFFERS[0];

  const [qty, setQty] = useState("10");
  const [done, setDone] = useState(false);
  const q = Number(qty) || 0;
  const total = q * offer.price;
  const apartado = total * 0.1;
  const efectivo = total - apartado;
  const valid = q > 0 && q <= offer.available;

  if (done) {
    return (
      <div className="screen screen-enter">
        <div className="safe-top" />
        <div className="screen-pad" style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 56, margin: "6px 0 8px" }}>✓</div>
          <p className="modal-title" style={{ textAlign: "center" }}>¡Apartado listo!</p>
          <p className="modal-sub" style={{ textAlign: "center" }}>
            Apartaste <b style={{ color: "var(--txt)" }}>{FMT(q, 0)} {product.unit}</b> de {product.name} con <b style={{ color: "var(--accent)" }}>${FMT(apartado, 2)}</b>.
          </p>
          <div className="card" style={{ marginTop: 18, textAlign: "left", background: "var(--accent-soft)", border: "none" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--txt-muted)" }}>
              Ve con <b style={{ color: "var(--txt)" }}>{offer.business}</b> ({offer.location}) y paga los <b style={{ color: "var(--txt)" }}>${FMT(efectivo, 2)}</b> restantes <b style={{ color: "var(--txt)" }}>en efectivo</b> al recoger tu producto.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => go("mercado")}>Listo</button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => go("compras")}>Ver mis compras</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="icon-btn" onClick={() => go("producto", product)} aria-label="Atrás"><Icon name="chevL" size={20} /></button>
          <p className="name" style={{ fontSize: 20 }}>Apartar</p>
        </div>
        <span style={{ width: 42 }} />
      </div>
      <div className="screen-pad">
        {/* Comercio */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 16 }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="store" size={20} color="var(--accent)" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{offer.business}</p>
              {offer.verified && <Icon name="check" size={14} color="var(--accent)" />}
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{offer.location}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-dim)" }}>⭐ {FMT(offer.rating, 1)} · {offer.ops} operaciones</p>
          </div>
        </div>

        {/* Producto + precio */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
          <ProductIcon emoji={product.emoji} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{product.name}</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>${FMT(offer.price, 2)} / {product.unit}</p>
          </div>
        </div>

        {/* Cantidad */}
        <span className="field-label">¿Cuánto quieres? ({product.unit})</span>
        <input className="input num-input" type="number" inputMode="decimal" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        {q > offer.available && <div className="alert alert-error">Solo hay {FMT(offer.available, 0)} {product.unit} disponibles.</div>}

        {/* Resumen */}
        <div className="card" style={{ marginTop: 16, padding: "8px 18px" }}>
          <div className="fx-row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "var(--txt-muted)" }}>Total</span>
            <span className="num" style={{ fontWeight: 700 }}>${FMT(total, 2)}</span>
          </div>
          <div className="divider" />
          <div className="fx-row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "var(--accent)", fontWeight: 700 }}>Apartas ahora (10%)</span>
            <span className="num" style={{ fontWeight: 800, color: "var(--accent)" }}>${FMT(apartado, 2)}</span>
          </div>
          <div className="fx-row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "var(--txt-muted)" }}>Pagas en efectivo al recibir</span>
            <span className="num" style={{ fontWeight: 700 }}>${FMT(efectivo, 2)}</span>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "flex-start", background: "var(--accent-2-soft)", border: "none" }}>
          <Icon name="info" size={18} color="var(--accent-2)" />
          <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.45 }}>
            Apartas con el <b style={{ color: "var(--txt)" }}>10%</b> desde la app. El resto se <b style={{ color: "var(--txt)" }}>liquida en efectivo directo en el negocio del vendedor</b> cuando recojas tu producto.
          </p>
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: "14px 22px 24px", background: "linear-gradient(to top, var(--bg) 70%, transparent)" }}>
        <button className="btn btn-primary" disabled={!valid} onClick={() => setDone(true)}>
          Apartar ahora · ${FMT(apartado, 2)}
        </button>
      </div>
    </div>
  );
}

/* ---------------- MIS COMPRAS / MIS VENTAS ---------------- */
export function ScreenCompras({ go }: { go: Go }) {
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Mis compras" go={go} back="home" />
      <div className="screen-pad">
        <div className="card" style={{ textAlign: "center", padding: 28 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="bag" size={26} /></span>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Aún no tienes compras</p>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--txt-muted)" }}>Aparta productos en el mercado y aquí verás tu historial.</p>
          <button className="btn btn-primary" onClick={() => go("mercado")}><Icon name="store" size={18} /> Ir al mercado</button>
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

export function ScreenVentas({ go }: { go: Go }) {
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Mis ventas" go={go} back="home" />
      <div className="screen-pad">
        <div className="card" style={{ textAlign: "center", padding: 28 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="store" size={26} /></span>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Aún no tienes ventas</p>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--txt-muted)" }}>Da de alta tu negocio y publica tu producto para empezar a vender.</p>
          <button className="btn btn-primary" onClick={() => go("vender")}><Icon name="store" size={18} /> Dar de alta mi negocio</button>
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- DAR DE ALTA NEGOCIO ---------------- */
export function ScreenVender({ go }: { go: Go }) {
  const wallet = useWallet();
  const { businesses, addBusiness, removeBusiness } = useBusinesses(wallet.address);
  const [adding, setAdding] = useState(false);

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Mi negocio" go={go} back="mercado" />
      <div className="screen-pad">
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", background: "var(--accent-soft)", border: "none" }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="store" size={22} />
          </span>
          <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.45 }}>
            Publica tu producto y aparece en el mercado. Los compradores apartan con el <b style={{ color: "var(--txt)" }}>10%</b> y el resto lo pagan al recibir.
          </p>
        </div>

        <div className="sec-head"><h3>Mis negocios</h3></div>

        {businesses.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="store" size={26} /></span>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Aún no tienes un negocio</p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--txt-muted)" }}>Da de alta tu puesto y publica tu producto principal.</p>
            <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Dar de alta mi negocio</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {businesses.map((b) => (
              <div key={b.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="store" size={20} color="var(--accent)" /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{b.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{b.product} · ${FMT(b.price, 2)}/{b.unit}</p>
                    {b.location && <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-dim)" }}>{b.location}</p>}
                  </div>
                  <button className="icon-btn" onClick={() => removeBusiness(b.id)} aria-label="Eliminar"><Icon name="logout" size={18} /></button>
                </div>
              </div>
            ))}
            <button className="card" onClick={() => setAdding(true)} style={{ textAlign: "center", cursor: "pointer", borderStyle: "dashed", color: "var(--txt-muted)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent" }}>
              <Icon name="plus" size={18} /> Dar de alta otro negocio
            </button>
          </div>
        )}
      </div>
      <div className="scroll-bottom" />
      {adding && <Portal><AltaNegocioModal onClose={() => setAdding(false)} onCreate={(b) => { addBusiness(b); setAdding(false); }} /></Portal>}
    </div>
  );
}

function AltaNegocioModal({ onClose, onCreate }: { onClose: () => void; onCreate: (b: { name: string; product: string; unit: string; price: number; location: string }) => void }) {
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const valid = name.trim().length > 0 && product.trim().length > 0 && Number(price) > 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Dar de alta mi negocio</p>
        <p className="modal-sub">Un negocio, un producto principal. Así apareces en el mercado.</p>

        <span className="field-label">Nombre del negocio</span>
        <input className="input" placeholder="Ej. Bodega Don Memo" value={name} onChange={(e) => setName(e.target.value)} />

        <span className="field-label">Producto principal</span>
        <input className="input" placeholder="Ej. Jitomate bola" value={product} onChange={(e) => setProduct(e.target.value)} />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="field-label">Precio</span>
            <input className="input num-input" type="number" inputMode="decimal" placeholder="13.50" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div style={{ width: 110 }}>
            <span className="field-label">Unidad</span>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ appearance: "none", WebkitAppearance: "none" }}>
              {["kg", "caja", "pieza", "manojo", "costal"].map((u) => <option key={u} value={u} style={{ color: "#000" }}>{u}</option>)}
            </select>
          </div>
        </div>

        <span className="field-label">Ubicación (opcional)</span>
        <input className="input" placeholder="Nave I · Pasillo 14, Local 23" value={location} onChange={(e) => setLocation(e.target.value)} />

        <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={!valid} onClick={() => onCreate({ name: name.trim(), product: product.trim(), unit, price: Number(price), location: location.trim() })}>
          <Icon name="check" size={18} /> Publicar negocio
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
