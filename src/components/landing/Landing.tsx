"use client";

/* UTONOMA — Landing page (portada de _prototype/Utonoma Landing.html).
   Animaciones reimplementadas sin anime.js: reveals + counters (IntersectionObserver
   + rAF), nav hide-on-scroll, FAQ acordeón, tilt 3D de la tarjeta. CTAs → /app. */
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

/* ---------- counter animado ---------- */
function Counter({
  target,
  decimals = 0,
  suffix = "",
  prefix = "",
}: {
  target: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let started = false;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting || started) return;
          started = true;
          obs.disconnect();
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reduce) {
            setVal(target);
            return;
          }
          const dur = 1500;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(2, -10 * t); // easeOutExpo
            setVal(t < 1 ? target * eased : target);
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]);
  const txt = val.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref}>
      {prefix}
      {txt}
      {suffix}
    </span>
  );
}

/* ---------- banderas ---------- */
const FlagMX = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="12" height="36" x="0" fill="#0a6b3b" /><rect width="12" height="36" x="12" fill="#f4f4f4" /><rect width="12" height="36" x="24" fill="#c8102e" /><circle cx="18" cy="18" r="3.4" fill="#7a5230" /></svg>
);
const FlagUS = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="36" height="36" fill="#f4f4f4" />{[0, 5.5, 11, 16.6, 22.1, 27.7, 33.2].map((y, i) => <rect key={i} width="36" height="2.7" y={y} fill="#b22234" />)}<rect width="17" height="19" fill="#3c3b6e" /></svg>
);
const FlagBR = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="36" height="36" fill="#1b9e3e" /><path d="M18 5L33 18 18 31 3 18z" fill="#ffd200" /><circle cx="18" cy="18" r="6.2" fill="#1e3a8a" /></svg>
);
const FlagKR = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="36" height="36" fill="#f4f4f4" /><path d="M18 12a6 6 0 010 12 6 6 0 000-12z" fill="#c8102e" /><path d="M18 12a6 6 0 000 12 6 6 0 010-12z" fill="#0047a0" /></svg>
);

const AppStoreBtn = () => (
  <a className="store-btn" href="#descargar">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 1.8c.1 1-.3 2-.9 2.8-.7.8-1.7 1.4-2.7 1.3-.1-1 .4-2 1-2.7.7-.8 1.8-1.4 2.6-1.4zM19 17c-.5 1.1-.7 1.6-1.3 2.6-.9 1.4-2.1 3.1-3.6 3.1-1.3 0-1.7-.9-3.5-.9s-2.2.8-3.5.9c-1.5.1-2.6-1.5-3.5-2.9C1 16.7.8 12.3 2.4 9.9c1-1.6 2.6-2.5 4.1-2.5 1.6 0 2.5.9 3.8.9 1.2 0 2-.9 3.8-.9 1.4 0 2.8.7 3.8 2-3.3 1.8-2.8 6.5.8 7.6z" /></svg>
    <span><span className="sub">Descarga en</span><br /><span className="big">App Store</span></span>
  </a>
);
const GooglePlayBtn = () => (
  <a className="store-btn" href="#descargar">
    <svg width="20" height="22" viewBox="0 0 24 24" fill="none"><path d="M3.6 2.3 13.3 12 3.6 21.7c-.3-.2-.5-.6-.5-1V3.3c0-.4.2-.8.5-1z" fill="#C8FF4D" /><path d="m16.8 8.5 2.9 1.7c1 .6 1 2 0 2.6l-2.9 1.7L13.8 12l3-3.5z" fill="#8B5CF6" /><path d="M3.6 2.3c.3-.2.7-.2 1.1 0l11 6.2-1.9 1.9L3.6 2.3z" fill="#fff" /><path d="m13.8 13.6 1.9 1.9-11 6.2c-.4.2-.8.2-1.1 0l10.2-8.1z" fill="#9C96B4" /></svg>
    <span><span className="sub">Disponible en</span><br /><span className="big">Google Play</span></span>
  </a>
);

const FAQ_ITEMS = [
  { q: "¿Cómo gana rendimiento mi saldo en pesos?", a: "Tu saldo disponible genera 9% anual, calculado y pagado todos los días. No hay plazos forzosos: puedes usar o retirar tu dinero cuando quieras." },
  { q: "¿Los bonos de gobierno tienen riesgo?", a: "La deuda soberana es de los instrumentos más seguros que existen. Cada bono muestra su calificación, riesgo y plazo antes de invertir, para que decidas con total transparencia." },
  { q: "¿De verdad el tipo de cambio es igual al de Google?", a: "Sí. Usamos el tipo de cambio interbancario real, el mismo que aparece en Google, sin agregar márgenes ni comisiones ocultas por la conversión." },
  { q: "¿Está protegido mi dinero?", a: "Tu saldo está asegurado hasta $3,000,000 MXN, cifrado con AES‑256 y protegido con acceso biométrico y verificación en dos pasos." },
];

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const [navHidden, setNavHidden] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // reveal on scroll (con stagger por grupo)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const sibs = Array.prototype.filter.call(
            el.parentElement?.children ?? [],
            (c: Element) => c.classList.contains("reveal"),
          );
          const idx = sibs.indexOf(el);
          el.style.transitionDelay = Math.max(0, idx) * 75 + "ms";
          el.classList.add("in");
          obs.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    root.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // nav: ocultar al bajar, mostrar al subir
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      setNavScrolled(y > 24);
      if (y < 120) setNavHidden(false);
      else if (y > lastY + 6) setNavHidden(true);
      else if (y < lastY - 6) setNavHidden(false);
      lastY = y;
      ticking = false;
    };
    const handler = () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // tilt 3D de la tarjeta
  const onCardMove = (ev: React.MouseEvent) => {
    const card = creditRef.current;
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = card.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateY(${px * 12}deg) rotateX(${-py * 12}deg)`;
  };
  const onCardLeave = () => {
    if (creditRef.current) creditRef.current.style.transform = "rotateY(0) rotateX(0)";
  };

  return (
    <div className="lp" ref={rootRef}>
      {/* atmospheric bg */}
      <div className="atmos">
        <div className="glow g1" />
        <div className="glow g2" />
        <div className="grid" />
      </div>

      {/* NAV */}
      <div className={`nav-inner${navHidden ? " nav-hidden" : ""}${navScrolled ? " nav-scrolled" : ""}`}>
        <a href="#" className="brand-logo"><span className="mk">S</span> Seyf</a>
        <div className="nav-links">
          <a href="#producto">Producto</a>
          <a href="#bonos">Bonos</a>
          <a href="#tarjeta">Tarjeta</a>
          <a href="#seguridad">Seguridad</a>
        </div>
        <div className="nav-cta">
          <Link className="btn btn-ghost btn-sm" href="/app">Iniciar sesión</Link>
          <Link className="btn btn-primary btn-sm" href="/app">Iniciar</Link>
        </div>
      </div>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="pill-tag reveal"><b>NUEVO</b> Rendimiento diario sobre tus pesos</span>
              <h1 className="display">
                <span className="hero-word">Tu</span> <span className="hero-word">dinero,</span>{" "}
                <span className="hero-word em">protegido</span>{" "}
                <span className="hero-word">y</span> <span className="hero-word em2">creciendo</span>{" "}
                <span className="hero-word">en</span> <span className="hero-word">automático.</span>
              </h1>
              <p className="lede reveal">Pesos digitales, bonos de gobierno de 4 países, bóvedas de ahorro y una tarjeta que gasta en cualquier divisa al tipo de cambio de Google. Todo en una sola app.</p>
              <div className="hero-cta reveal">
                <Link className="btn btn-primary btn-lg" href="/app">Iniciar ahora</Link>
                <AppStoreBtn />
                <GooglePlayBtn />
              </div>
              <div className="hero-trust reveal">
                <span className="t"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg> Saldo asegurado</span>
                <span className="t"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 018 0v3" /></svg> Cifrado AES‑256</span>
                <span className="t"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></svg> Regulado</span>
              </div>
            </div>

            {/* phone mockup */}
            <div className="phone-stage">
              <div className="float-card fc1 reveal">
                <div className="k">Rinde solo</div>
                <div className="v"><span style={{ color: "var(--accent)" }}>+</span><span className="num"><Counter target={9} suffix="% anual" /></span></div>
              </div>
              <div className="float-card fc2 reveal">
                <div className="k">Bono México</div>
                <div className="v num"><Counter target={10.25} decimals={2} suffix="%" /></div>
              </div>
              <div className="phone" id="phone">
                <div className="phone-screen">
                  <div className="mini">
                    <div className="mini-top">
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>Buenas tardes</div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>Diego</div>
                      </div>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent-2),var(--accent))", display: "grid", placeItems: "center", fontWeight: 800, color: "var(--on-accent)", fontSize: 12 }}>DR</div>
                    </div>
                    <div className="mini-bal">
                      <div className="mini-eyebrow">Patrimonio total</div>
                      <div className="num" style={{ fontSize: 27, fontWeight: 700, marginTop: 7 }}>$585,050<span style={{ opacity: 0.5 }}>.40</span></div>
                      <div className="mini-alloc">
                        <span style={{ width: "8%", background: "var(--accent)" }} />
                        <span style={{ width: "53%", background: "var(--accent-2)" }} />
                        <span style={{ width: "16%", background: "#5BD6C0" }} />
                        <span style={{ width: "23%", background: "#F5A623" }} />
                      </div>
                    </div>
                    <div className="mini-row">
                      <div className="mini-flag"><FlagMX /></div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>Bono México</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Bonos M · MXN</div></div>
                      <div className="num" style={{ color: "var(--accent)", fontWeight: 800, fontSize: 15 }}>10.25%</div>
                    </div>
                    <div className="mini-row">
                      <div className="mini-flag"><FlagUS /></div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13 }}>US Treasury</div><div style={{ fontSize: 11, color: "var(--muted)" }}>Bono · USD</div></div>
                      <div className="num" style={{ color: "var(--accent)", fontWeight: 800, fontSize: 15 }}>4.45%</div>
                    </div>
                    <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                      <Link href="/app" style={{ flex: 1, background: "var(--accent)", color: "var(--on-accent)", borderRadius: 13, padding: 11, textAlign: "center", fontWeight: 800, fontSize: 13 }}>Invertir</Link>
                      <Link href="/app" style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 13, padding: 11, textAlign: "center", fontWeight: 800, fontSize: 13 }}>Convertir</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <React.Fragment key={dup}>
                <span className="it"><span className="flag"><FlagMX /></span> México · Bonos M 10.25%</span>
                <span className="it"><span className="flag"><FlagUS /></span> EE. UU. · Treasury 4.45%</span>
                <span className="it"><span className="flag"><FlagBR /></span> Brasil · Tesouro Selic 11.75%</span>
                <span className="it"><span className="flag"><FlagKR /></span> Corea · KTB 3.35%</span>
                <span className="it" style={{ color: "var(--accent)" }}>Tipo de cambio igual a Google</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* STATS */}
        <section className="sec-pad">
          <div className="wrap">
            <div className="stats">
              <div className="stat reveal"><div className="n num">$<Counter target={2.4} decimals={1} /><span className="suf">MMD</span></div><div className="l">gestionados en la plataforma</div></div>
              <div className="stat reveal"><div className="n num"><Counter target={850} suffix="K" /><span className="suf">+</span></div><div className="l">usuarios ahorrando</div></div>
              <div className="stat reveal"><div className="n num"><Counter target={4} /></div><div className="l">países con bonos soberanos</div></div>
              <div className="stat reveal"><div className="n num"><Counter target={0} /><span className="suf">comisiones</span></div><div className="l">por cambio de divisa</div></div>
            </div>
          </div>
        </section>

        {/* BENTO / PRODUCTO */}
        <section className="sec-pad" id="producto">
          <div className="wrap">
            <div className="reveal" style={{ marginBottom: 44 }}>
              <span className="sec-tag">Una sola app</span>
              <h2 className="sec-title display">Toda tu vida financiera, concentrada.</h2>
              <p className="sec-sub">Ahorro, inversión y gasto trabajando juntos — con rendimientos premium y la seguridad de un banco.</p>
            </div>
            <div className="bento">
              <div className="card-glass col-3 row-2 reveal">
                <div className="b-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14-1 0-1-1-1-1z" /><path d="M9 15c2-3 5-5 8-6" /></svg></div>
                <h3>Pesos digitales que rinden</h3>
                <p>Tu saldo gana <b style={{ color: "var(--accent)" }}>9% anual</b> pagado todos los días. Sin plazos forzosos, disponible al instante.</p>
                <div className="big-stat num" style={{ marginTop: 26 }}>9<span className="suf">%</span></div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>rendimiento anual · pagado diario</div>
                <div className="accent-glow" />
              </div>
              <div className="card-glass col-3 reveal">
                <div className="b-icon v"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg></div>
                <h3>Bonos de 4 gobiernos</h3>
                <p>México, EE. UU., Brasil y Corea. Deuda soberana, el instrumento más seguro para crecer.</p>
              </div>
              <div className="card-glass col-3 reveal">
                <div className="b-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="12" cy="12" r="3.5" /><path d="M12 4.5v2M12 17.5v2" /></svg></div>
                <h3>Bóvedas de ahorro</h3>
                <p>Metas con rendimiento de hasta 11.2% y ahorro automático cada quincena.</p>
              </div>
              <div className="card-glass col-2 reveal">
                <div className="b-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M2.5 9.5h19" /></svg></div>
                <h3>Tarjeta global</h3>
                <p>Gasta en pesos y divisas sin comisión.</p>
              </div>
              <div className="card-glass col-2 reveal">
                <div className="b-icon v"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 4v13M7 4L4 7M7 4l3 3" /><path d="M17 20V7M17 20l3-3M17 20l-3-3" /></svg></div>
                <h3>Cambio justo</h3>
                <p>El tipo de cambio real, idéntico a Google.</p>
              </div>
              <div className="card-glass col-2 reveal">
                <div className="b-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg></div>
                <h3>Seguridad bancaria</h3>
                <p>Cifrado AES‑256 y saldo asegurado.</p>
              </div>
            </div>
          </div>
        </section>

        {/* BONOS */}
        <section className="sec-pad" id="bonos">
          <div className="wrap">
            <div className="reveal" style={{ marginBottom: 44 }}>
              <span className="sec-tag">Bonos de gobierno</span>
              <h2 className="sec-title display">Rendimientos soberanos, en un toque.</h2>
              <p className="sec-sub">Invierte en deuda respaldada por gobiernos desde $50. Liquidación T+1 y custodia regulada.</p>
            </div>
            <div className="bonds-row">
              <div className="bond reveal"><div className="flag"><FlagMX s={46} /></div><div className="country">México</div><div className="code">Bonos M · CETES · MXN</div><div className="yld num"><Counter target={10.25} decimals={2} />%<small>anual</small></div></div>
              <div className="bond reveal"><div className="flag"><FlagUS s={46} /></div><div className="country">Estados Unidos</div><div className="code">US Treasury · USD</div><div className="yld num"><Counter target={4.45} decimals={2} />%<small>anual</small></div></div>
              <div className="bond reveal"><div className="flag"><FlagBR s={46} /></div><div className="country">Brasil</div><div className="code">Tesouro Selic · BRL</div><div className="yld num"><Counter target={11.75} decimals={2} />%<small>anual</small></div></div>
              <div className="bond reveal"><div className="flag"><FlagKR s={46} /></div><div className="country">Corea del Sur</div><div className="code">Korea Treasury · KRW</div><div className="yld num"><Counter target={3.35} decimals={2} />%<small>anual</small></div></div>
            </div>
          </div>
        </section>

        {/* TARJETA */}
        <section className="sec-pad" id="tarjeta">
          <div className="wrap split">
            <div className="reveal">
              <div className="credit" ref={creditRef} onMouseMove={onCardMove} onMouseLeave={onCardLeave}>
                <div className="sheen" /><div className="blob" />
                <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span className="display" style={{ fontSize: 22, fontWeight: 800 }}>Seyf</span>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>
                </div>
                <div style={{ position: "relative" }}>
                  <div className="num" style={{ fontSize: 20, letterSpacing: ".14em" }}>4821 ··· ··· 7‑903</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
                    <div><div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".08em" }}>TITULAR</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>DIEGO ROBLES</div></div>
                    <span className="display" style={{ fontSize: 17, fontStyle: "italic", fontWeight: 800, color: "var(--accent)" }}>VISA</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="reveal">
              <span className="sec-tag">Tarjeta global</span>
              <h2 className="sec-title display" style={{ fontSize: 38 }}>Gasta en cualquier moneda, sin sorpresas.</h2>
              <div className="feat-list">
                {[
                  { ti: "Tipo de cambio de Google", de: "Convertimos al cambio real del mercado, sin margen oculto ni comisión." },
                  { ti: "Saldos en múltiples divisas", de: "Guarda MXN, USD, BRL y KRW y paga con el que prefieras." },
                  { ti: "Control total", de: "Congela la tarjeta, cambia tu PIN y recibe alertas de cada cargo al instante." },
                ].map((f) => (
                  <div className="feat-item" key={f.ti}><span className="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12l4.5 4.5L19 7" /></svg></span><div><div className="ti">{f.ti}</div><div className="de">{f.de}</div></div></div>
                ))}
              </div>
              <div className="cur-chips">
                <span className="cur-chip">$ MXN</span>
                <span className="cur-chip"><span style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", display: "inline-block" }}><FlagUS s={18} /></span> USD</span>
                <span className="cur-chip"><span style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", display: "inline-block" }}><FlagBR s={18} /></span> BRL</span>
                <span className="cur-chip"><span style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", display: "inline-block" }}><FlagKR s={18} /></span> KRW</span>
              </div>
            </div>
          </div>
        </section>

        {/* FX */}
        <section className="sec-pad">
          <div className="wrap split">
            <div className="reveal">
              <span className="sec-tag">Tipo de cambio</span>
              <h2 className="sec-title display" style={{ fontSize: 38 }}>El mismo cambio que ves en Google.</h2>
              <p className="sec-sub">Sin márgenes inflados ni letras chiquitas. Te damos el tipo de cambio interbancario real, en tiempo real.</p>
              <div style={{ marginTop: 24 }}><span className="match-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12l4.5 4.5L19 7" /></svg> Igual a Google · 0% comisión</span></div>
            </div>
            <div className="fx-panel reveal">
              <div className="fx-line"><span className="flag"><FlagUS s={32} /></span><div><div style={{ fontWeight: 700, fontSize: 14 }}>USD</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Dólar estadounidense</div></div><div className="rate num">$<Counter target={17.1252} decimals={4} /></div></div>
              <div className="fx-line"><span className="flag"><FlagBR s={32} /></span><div><div style={{ fontWeight: 700, fontSize: 14 }}>BRL</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Real brasileño</div></div><div className="rate num">$<Counter target={3.482} decimals={4} /></div></div>
              <div className="fx-line"><span className="flag"><FlagKR s={32} /></span><div><div style={{ fontWeight: 700, fontSize: 14 }}>KRW</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Won surcoreano</div></div><div className="rate num">$<Counter target={0.01243} decimals={5} /></div></div>
            </div>
          </div>
        </section>

        {/* ALIADOS */}
        <section className="sec-pad" id="aliados">
          <div className="wrap">
            <div className="reveal partners-head">
              <span className="sec-tag">Aliados</span>
              <h2 className="sec-title display" style={{ marginLeft: "auto", marginRight: "auto" }}>Respaldado por la mejor infraestructura.</h2>
              <p className="sec-sub" style={{ marginLeft: "auto", marginRight: "auto" }}>Conectamos liquidez, custodia y rieles de pago de primer nivel para que tu dinero se mueva seguro.</p>
            </div>
            <div className="logo-wall">
              <a className="ally reveal" href="#" aria-label="Bitso Business">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="15" cy="15" r="12" /><path d="M11 9v12M11 9h4.5a3 3 0 010 6H11m0 0h5a3 3 0 010 6h-5" strokeWidth="2" /></svg>
                <span style={{ display: "flex", flexDirection: "column" }}><span className="ally-name">bitso</span><span className="ally-sub">Business</span></span>
              </a>
              <a className="ally reveal" href="#" aria-label="Etherfuse">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3l10 6v12l-10 6L5 21V9l10-6z" /><path d="M15 9v12M10.5 12l9 6M19.5 12l-9 6" strokeWidth="1.6" opacity="0.85" /></svg>
                <span className="ally-name">etherfuse</span>
              </a>
              <a className="ally reveal" href="#" aria-label="Arbitrum">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="15" cy="15" r="12" /><path d="M9 21l5-11 5 11M11.4 16h5.2" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
                <span className="ally-name">Arbitrum</span>
              </a>
              <a className="ally reveal" href="#" aria-label="SPEI">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11h15l-3.5-3.5M24 19H9l3.5 3.5" /></svg>
                <span style={{ display: "flex", flexDirection: "column" }}><span className="ally-name" style={{ letterSpacing: ".04em" }}>SPEI</span><span className="ally-sub">Transferencias</span></span>
              </a>
            </div>
            <p className="ally-note">Integraciones ilustrativas para fines de demostración.</p>
          </div>
        </section>

        {/* SEGURIDAD */}
        <section className="sec-pad" id="seguridad">
          <div className="wrap">
            <div className="reveal sec-head-center" style={{ marginBottom: 44 }}>
              <span className="sec-tag">Seguridad primero</span>
              <h2 className="sec-title display">Tu dinero, blindado en cada capa.</h2>
              <p className="sec-sub">Construido con los mismos estándares que la banca tradicional — y la transparencia que ella no te da.</p>
            </div>
            <div className="sec-grid">
              <div className="sec-card reveal"><div className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg></div><h4>Saldo asegurado</h4><p>Protección de hasta $3,000,000 MXN por usuario en cuentas reguladas.</p></div>
              <div className="sec-card reveal"><div className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 018 0v3" /></svg></div><h4>Cifrado AES‑256</h4><p>Cada dato y movimiento viaja cifrado de extremo a extremo, grado bancario.</p></div>
              <div className="sec-card reveal"><div className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11v3a5 5 0 01-1.5 3.5" /><path d="M8.5 7.5a5 5 0 017 1.5" /><path d="M6.5 12a6.5 6.5 0 0111-4.7" /></svg></div><h4>Acceso biométrico</h4><p>Face ID, PIN y verificación en 2 pasos para que solo tú entres a tu dinero.</p></div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec-pad">
          <div className="wrap">
            <div className="reveal sec-head-center" style={{ marginBottom: 44 }}>
              <span className="sec-tag">Preguntas</span>
              <h2 className="sec-title display">Lo que quieres saber.</h2>
            </div>
            <div className="faq-list">
              {FAQ_ITEMS.map((item, i) => (
                <div className={`faq reveal${openFaq === i ? " open" : ""}`} key={i}>
                  <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {item.q}
                    <span className="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg></span>
                  </div>
                  <div className="faq-a"><p>{item.a}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="sec-pad" id="descargar">
          <div className="wrap">
            <div className="final reveal">
              <div className="glow-c" />
              <h2 className="display">Empieza a hacer crecer tu dinero hoy.</h2>
              <p>Abre tu cuenta en minutos. Sin comisiones de apertura, sin saldo mínimo.</p>
              <div className="hero-cta">
                <Link className="btn btn-primary btn-lg" href="/app">Iniciar ahora</Link>
                <AppStoreBtn />
                <GooglePlayBtn />
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="wrap">
            <div className="foot-grid">
              <div className="foot-col">
                <a href="#" className="brand-logo" style={{ marginBottom: 16 }}><span className="mk">S</span> Seyf</a>
                <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 280, margin: 0 }}>La super app de finanzas para ahorrar, invertir y gastar sin fronteras.</p>
              </div>
              <div className="foot-col"><h5>Producto</h5><a href="#producto">Pesos digitales</a><a href="#bonos">Bonos</a><a href="#producto">Bóvedas</a><a href="#tarjeta">Tarjeta</a></div>
              <div className="foot-col"><h5>Compañía</h5><a href="#">Sobre nosotros</a><a href="#seguridad">Seguridad</a><a href="#">Carreras</a><a href="#">Prensa</a></div>
              <div className="foot-col"><h5>Legal</h5><a href="#">Términos</a><a href="#">Privacidad</a><a href="#">Comisiones</a><a href="#">Soporte</a></div>
            </div>
            <div className="foot-bottom">
              <span>© 2026 Seyf. Todos los derechos reservados.</span>
              <span>Hecho con seguridad de grado bancario · Regulado en México</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
