"use client";

/* SEYF — Landing page.
   Narrativa por scroll: hero "cinemático" con el símbolo SEYF en 3D (three.js)
   pinneado mientras cambian los mensajes, historia del producto con el celular
   fijo, bonos en carrusel horizontal guiado por scroll y tarjeta que gira en 3D.
   Smooth scroll con Lenis; animaciones ligadas al scroll con motion (useScroll).
   Todo respeta prefers-reduced-motion. CTAs → /app. */
import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import Lenis from "lenis";
import { SeyfSymbol } from "@/components/brand/SeyfLogo";
import { GrowingAmount } from "@/components/app/GrowingAmount";
import AppMock from "./AppMock";
import { CountryRelief, type CountryCode } from "./CountryRelief";

// three.js solo en el navegador y fuera del bundle inicial
const Symbol3D = dynamic(() => import("@/components/brand/Symbol3D"), { ssr: false });

const EASE = [0.22, 1, 0.36, 1] as const;
// instancia de Lenis compartida (para scrollTo programático desde las secciones)
const lenisRef: { current: Lenis | null } = { current: null };
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
const FlagCO = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="36" height="18" fill="#FCD116" /><rect width="36" height="9" y="18" fill="#003893" /><rect width="36" height="9" y="27" fill="#CE1126" /></svg>
);
const FlagAR = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="36" height="36" fill="#74ACDF" /><rect width="36" height="12" y="12" fill="#f4f4f4" /><circle cx="18" cy="18" r="3.4" fill="#F6B40E" /></svg>
);
// Posiciones de las 12 estrellas precalculadas como strings redondeados:
// evita el mismatch de hidratación por diferencias de punto flotante (Math.sin/cos)
// entre el render del servidor y el del navegador.
const EU_STARS: [string, string][] = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  return [(18 + 9 * Math.sin(a)).toFixed(3), (18 - 9 * Math.cos(a)).toFixed(3)];
});
const FlagEU = ({ s = 26 }: { s?: number }) => (
  <svg viewBox="0 0 36 36" width={s} height={s}><rect width="36" height="36" fill="#003399" />{EU_STARS.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.5" fill="#FFCC00" />)}</svg>
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

// accent = color del país (glow, pin y medidor); wall = color base del relieve
const BONDS: { cc: CountryCode; Flag: React.FC<{ s?: number }>; country: string; inst: string; cur: string; capital: string; y: number; accent: string; wall: string }[] = [
  { cc: "mx", Flag: FlagMX, country: "México", inst: "CETES · Bonos M", cur: "MXN", capital: "CDMX", y: 10.25, accent: "#2ecc71", wall: "#0b5a33" },
  { cc: "us", Flag: FlagUS, country: "Estados Unidos", inst: "US Treasury", cur: "USD", capital: "Washington", y: 4.45, accent: "#6c8cff", wall: "#2c2e6e" },
  { cc: "br", Flag: FlagBR, country: "Brasil", inst: "Tesouro Selic", cur: "BRL", capital: "Brasilia", y: 11.75, accent: "#ffd400", wall: "#0f6b34" },
  { cc: "ar", Flag: FlagAR, country: "Argentina", inst: "Lecap", cur: "ARS", capital: "Buenos Aires", y: 14.5, accent: "#74acdf", wall: "#3b6f9c" },
  { cc: "co", Flag: FlagCO, country: "Colombia", inst: "TES", cur: "COP", capital: "Bogotá", y: 9.6, accent: "#fcd116", wall: "#00307d" },
  { cc: "eu", Flag: FlagEU, country: "Europa", inst: "Bonos UE", cur: "EUR", capital: "Bruselas", y: 3.4, accent: "#ffcc00", wall: "#0d2f80" },
  { cc: "kr", Flag: FlagKR, country: "Corea del Sur", inst: "Korea Treasury", cur: "KRW", capital: "Seúl", y: 3.35, accent: "#ff5a6a", wall: "#3a3f55" },
];
const MAX_YIELD = Math.max(...BONDS.map((b) => b.y));

const STEPS = [
  { n: "01", ti: "Deposita por SPEI", de: "Recibe tu CLABE al instante. Cada peso que entra empieza a rendir desde el primer día." },
  { n: "02", ti: "Convierte sin margen", de: "Pasa a dólar digital al tipo de cambio real, en segundos y sin comisión oculta." },
  { n: "03", ti: "Ahorra con metas", de: "Crea bóvedas con rendimiento de hasta 11.2% y retira al banco cuando quieras." },
];

const MANIFESTO =
  "Tu dinero parado pierde contra la inflación todos los días. SEYF hace que cada peso trabaje: rinde diario, se mueve en segundos y sale cuando tú decides. Sin letras chiquitas. Sin jerga.";

/* ---------- piezas de scroll ---------- */

/** Pantalla de entrada: el símbolo se dibuja y la cortina sube. Solo una vez por sesión. */
function Intro() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("seyf-intro") === "1";
      sessionStorage.setItem("seyf-intro", "1");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => setShow(false), seen || reduce ? 0 : 1450);
    return () => clearTimeout(id);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="intro"
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <SeyfSymbol size={64} />
          </motion.div>
          <div className="intro-word display">
            {"SEYF".split("").map((c, i) => (
              <motion.span key={i} initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.25 + i * 0.06, ease: EASE }}>
                {c}
              </motion.span>
            ))}
          </div>
          <motion.div className="intro-bar" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Palabra del manifiesto: se ilumina según el avance del scroll. */
function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const y = useTransform(progress, range, [6, 0]);
  return (
    <motion.span style={{ opacity, y, display: "inline-block", marginRight: "0.26em" }}>{children}</motion.span>
  );
}

function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = MANIFESTO.split(" ");
  return (
    <section className="manifesto sec-pad">
      <div className="wrap">
        <span className="sec-tag">Por qué SEYF</span>
        <div ref={ref} className="manifesto-text display">
          {words.map((w, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
              {w}
            </Word>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Hero pinneado: el símbolo 3D gira con el scroll mientras cambian 3 mensajes. */
function HeroCinema() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  const b1o = useTransform(p, [0, 0.2, 0.3], [1, 1, 0]);
  const b1y = useTransform(p, [0, 0.3], [0, -80]);
  const b2o = useTransform(p, [0.32, 0.37, 0.58, 0.63], [0, 1, 1, 0]);
  const b2s = useTransform(p, [0.32, 0.4], [0.94, 1]);
  const b3o = useTransform(p, [0.66, 0.76, 1], [0, 1, 1]);
  const b3y = useTransform(p, [0.66, 0.78], [60, 0]);
  // --k: 1 = símbolo a la derecha (junto al texto), 0 = centrado; vuelve a la derecha en el beat 3
  const k = useTransform(p, [0, 0.26, 0.4, 0.6, 0.74], [1, 1, 0, 0, 1]);
  // en el beat 2 el símbolo se encoge para caber entre "Rinde" y "9% anual"
  const symScale = useTransform(p, [0.26, 0.38, 0.6, 0.74], [1, 0.58, 0.58, 0.8]);
  const hint = useTransform(p, [0, 0.06], [1, 0]);

  return (
    <section className="hero-cinema" ref={ref}>
      <div className="hero-sticky">
        {/* --k mueve el símbolo vía CSS (translateX); la escala va en el hijo para no pisar el transform */}
        <motion.div className="hero-sym" style={{ "--k": k } as unknown as React.CSSProperties}>
          <motion.div className="hero-sym-inner" style={{ scale: symScale }}>
            <div className="hero-sym-glow" />
            <Symbol3D progress={p} className="hero-canvas" />
          </motion.div>
        </motion.div>

        {/* Beat 1 — propuesta */}
        <motion.div className="wrap beat beat-1" style={{ opacity: b1o, y: b1y }}>
          <div className="hero-copy">
            <h1 className="display">
              {["Tu", "dinero,", "protegido", "y", "creciendo", "en", "automático."].map((w, i) => (
                <span className="hero-word-mask" key={i}>
                  <motion.span
                    className={`hero-word${i === 2 ? " em" : ""}${i === 4 ? " em2" : ""}`}
                    initial={{ y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.9, delay: 0.25 + i * 0.06, ease: EASE }}
                  >
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p className="lede" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.75, ease: EASE }}>
              Tus pesos rinden 9% anual, todos los días. Sin comisiones.
            </motion.p>
            <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.9, ease: EASE }}>
              <Link className="btn btn-primary btn-lg magnetic" href="/app">
                Iniciar ahora
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <a className="hero-link" href="#producto">Ver cómo funciona</a>
            </motion.div>
          </div>
        </motion.div>

        {/* Beat 2 — rendimiento */}
        <motion.div className="beat beat-2" style={{ opacity: b2o, scale: b2s }}>
          <div className="beat-2-row display">
            <span className="big-l">Rinde</span>
            <span className="big-gap" />
            <span className="big-r"><span className="em">9%</span> anual</span>
          </div>
          <div className="beat-2-foot">
          <p className="beat-sub">Pagado todos los días, sobre tus pesos. Sin plazos forzosos.</p>
          <div className="beat-cards">
            <div className="float-card">
              <div className="k"><span className="live-dot" /> Ganado hoy</div>
              <div className="v"><GrowingAmount base={12.4} apy={9} size={20} align="left" color="var(--accent)" prefix="+$" tail={4} id="lp-ganado" /></div>
            </div>
            <div className="float-card">
              <div className="k">Bóvedas hasta</div>
              <div className="v num" style={{ color: "#c4b5fd" }}>11.2%</div>
            </div>
          </div>
          </div>
        </motion.div>

        {/* Beat 3 — simple */}
        <motion.div className="beat beat-3" style={{ opacity: b3o, y: b3y }}>
          <div className="wrap beat-3-inner">
            <h2 className="display">
              Sin seed phrase.<br />Sin comisiones.<br /><span className="em">Sin jerga.</span>
            </h2>
            <p className="beat-sub">Construido sobre Stellar: tu dinero se mueve en segundos y siempre es tuyo.</p>
          </div>
        </motion.div>

        <motion.div className="scroll-hint" style={{ opacity: hint }}>
          <span>Desliza</span>
          <i />
        </motion.div>
      </div>
    </section>
  );
}

/** Celular con el mockup fiel de la app; tilt 3D siguiendo el mouse. */
function Phone({ screen }: { screen: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const onMove = (ev: React.MouseEvent) => {
    const stage = stageRef.current;
    const tilt = tiltRef.current;
    if (!stage || !tilt) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = stage.getBoundingClientRect();
    tilt.style.setProperty("--ptx", `${((ev.clientX - r.left) / r.width - 0.5) * 12}deg`);
    tilt.style.setProperty("--pty", `${-((ev.clientY - r.top) / r.height - 0.5) * 12}deg`);
  };
  const onLeave = () => {
    tiltRef.current?.style.setProperty("--ptx", "0deg");
    tiltRef.current?.style.setProperty("--pty", "0deg");
  };
  return (
    <div className="phone-stage" ref={stageRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="phone-tilt" ref={tiltRef}>
        <div className="phone">
          <div className="phone-screen">
            <AppMock screen={screen} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Historia del producto: el celular queda fijo y cada paso "se detiene" (snap)
    para que no se pase de largo. Los pasos también se pueden tocar. */
function PhoneStory() {
  const ref = useRef<HTMLElement>(null);
  const [screen, setScreen] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setScreen(Math.min(2, Math.max(0, Math.floor(v * 3)))));

  // posición de scroll (px) donde el paso i queda centrado en su tramo
  const stepY = (i: number) => {
    const el = ref.current;
    if (!el) return 0;
    const top = el.getBoundingClientRect().top + window.scrollY;
    return top + (el.offsetHeight - window.innerHeight) * ((i + 0.5) / 3);
  };
  const goTo = (y: number) => {
    if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: 0.9 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  // snap con dirección: al soltar el scroll, si te moviste hacia abajo avanza al
  // siguiente paso; hacia arriba, regresa. En el primer/último paso deja salir.
  const lastStep = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t = 0;
    const onScroll = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const v = (window.scrollY - top) / (el.offsetHeight - window.innerHeight);
        if (v <= 0.02 || v >= 0.98) {
          lastStep.current = v <= 0.02 ? 0 : 2; // fuera de la sección: no secuestrar el scroll
          return;
        }
        const cur = lastStep.current;
        const delta = v - (cur + 0.5) / 3;
        let target = cur;
        if (delta > 0.035) {
          if (cur === 2) return; // bajando desde el último paso: sale de la sección
          target = Math.min(2, Math.max(cur + 1, Math.floor(v * 3)));
        } else if (delta < -0.035) {
          if (cur === 0) return; // subiendo desde el primer paso: sale hacia arriba
          target = Math.max(0, Math.min(cur - 1, Math.floor(v * 3)));
        }
        lastStep.current = target;
        const y = stepY(target);
        if (Math.abs(y - window.scrollY) > 6) goTo(y);
      }, 140);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
  }, []);

  return (
    <section className="story" id="producto" ref={ref}>
      <div className="story-sticky">
        <div className="wrap story-grid">
          <div className="story-copy">
            <span className="sec-tag">Así funciona</span>
            <h2 className="sec-title display">Tres pasos. Cero complicaciones.</h2>
            <div className="steps">
              {STEPS.map((s, i) => (
                <button key={s.n} className={`step${screen === i ? " on" : ""}`} onClick={() => { lastStep.current = i; goTo(stepY(i)); }}>
                  <StepBar progress={scrollYProgress} i={i} />
                  <span className="step-n num">{s.n}</span>
                  <span className="step-body">
                    <span className="step-ti">{s.ti}</span>
                    <span className="step-de">{s.de}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Phone screen={screen} />
        </div>
      </div>
    </section>
  );
}

/** Barrita de cada paso: se llena 0→1 según el avance dentro de su tramo. */
function StepBar({ progress, i }: { progress: MotionValue<number>; i: number }) {
  const fill = useTransform(progress, [i / 3, (i + 1) / 3], [0, 1]);
  return <span className="step-bar"><motion.i style={{ scaleX: fill }} /></span>;
}

/** Tarjeta de bono: relieve 3D del país + rendimiento. Gira en Y según su
    distancia al centro de la pantalla (coverflow) y el mapa se inclina con el mouse. */
function BondCard({ b, x }: { b: (typeof BONDS)[number]; x: MotionValue<number> }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // centro de la tarjeta dentro del carril (sin el desplazamiento x) y ancho de la ventana
  const [geo, setGeo] = useState({ center: 0, vw: 1440 });
  useEffect(() => {
    const on = () => {
      const el = outerRef.current;
      if (el) setGeo({ center: el.offsetLeft + el.offsetWidth / 2, vw: window.innerWidth });
    };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // -1 (a la izquierda) … 0 (centro) … 1 (a la derecha)
  const rel = useTransform(x, (xv) => Math.max(-1, Math.min(1, (geo.center + xv - geo.vw / 2) / (geo.vw * 0.6))));
  const rotateY = useTransform(rel, (r) => r * -22);
  const scale = useTransform(rel, (r) => 1 - Math.abs(r) * 0.08);
  const opacity = useTransform(rel, (r) => 1 - Math.abs(r) * 0.35);
  const onMove = (ev: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${32 - py * 18}deg`);
    el.style.setProperty("--ry", `${px * 22}deg`);
    el.style.setProperty("--mx", `${(px + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(py + 0.5) * 100}%`);
  };
  const onLeave = () => {
    cardRef.current?.style.removeProperty("--rx");
    cardRef.current?.style.removeProperty("--ry");
  };
  return (
    <motion.div className="bond" ref={outerRef} style={{ rotateY, scale, opacity, transformPerspective: 1200, "--c": b.accent } as unknown as React.CSSProperties}>
      <div className="bond-in" ref={cardRef} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="bond-stage">
          <div className="bond-glow" />
          <CountryRelief code={b.cc} wall={b.wall} accent={b.accent} />
          <span className="bond-cap"><i />{b.capital}</span>
        </div>
        <div className="bond-head">
          <span className="bond-flag"><b.Flag s={34} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="country">{b.country}</div>
            <div className="code">{b.inst}</div>
          </div>
          <span className="bond-cur">{b.cur}</span>
        </div>
        <div className="yld num"><Counter target={b.y} decimals={2} />%<small>anual</small></div>
        <div className="bond-meter"><i style={{ width: `${(b.y / MAX_YIELD) * 100}%` }} /></div>
        <div className="bond-foot"><span>Desde $50</span><span>Liquidez T+1</span></div>
      </div>
    </motion.div>
  );
}

/** Bonos en carril horizontal que avanza con el scroll vertical. */
function BondsRail() {
  const ref = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  useIsoLayoutEffect(() => {
    const measure = () => {
      const t = trackRef.current;
      if (!t) return;
      setDist(Math.max(0, t.scrollWidth - window.innerWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -dist]);
  return (
    <section className="rail" id="bonos" ref={ref} style={{ height: `calc(100vh + ${dist}px)` }}>
      <div className="rail-sticky">
        <div className="wrap rail-head">
          <span className="sec-tag">Bonos de gobierno</span>
          <h2 className="sec-title display">Rendimientos soberanos, en un toque.</h2>
          <p className="sec-sub">Invierte en deuda respaldada por gobiernos desde $50. Liquidación T+1 y custodia regulada.</p>
        </div>
        <motion.div className="rail-track" ref={trackRef} style={{ x }}>
          {BONDS.map((b) => (
            <BondCard key={b.cc} b={b} x={x} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** Tarjeta que gira en 3D al entrar en pantalla + tilt con el mouse. */
function CardShowcase() {
  const ref = useRef<HTMLElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotY = useTransform(scrollYProgress, [0, 0.5, 1], [-38, 0, 24]);
  const rotX = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -10]);
  const ty = useTransform(scrollYProgress, [0, 0.5, 1], [80, 0, -40]);
  const onMove = (ev: React.MouseEvent) => {
    const card = creditRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = card.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateY(${px * 14}deg) rotateX(${-py * 14}deg)`;
    card.style.setProperty("--gx", `${(px + 0.5) * 100}%`);
    card.style.setProperty("--gy", `${(py + 0.5) * 100}%`);
  };
  const onLeave = () => {
    if (creditRef.current) creditRef.current.style.transform = "rotateY(0) rotateX(0)";
  };
  return (
    <section className="sec-pad" id="tarjeta" ref={ref}>
      <div className="wrap split">
        <div className="card-stage">
          <motion.div style={{ rotateY: rotY, rotateX: rotX, y: ty, transformPerspective: 1200 }}>
            <div className="credit" ref={creditRef} onMouseMove={onMove} onMouseLeave={onLeave}>
              <div className="sheen" /><div className="blob" /><div className="glare" />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="display" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 800 }}><SeyfSymbol size={22} /> SEYF</span>
                <div className="chip" />
              </div>
              <div style={{ position: "relative" }}>
                <div className="num" style={{ fontSize: 20, letterSpacing: ".14em" }}>4821 ··· ··· 7‑903</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
                  <div><div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".08em" }}>TITULAR</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>DIEGO ROBLES</div></div>
                  <span className="display" style={{ fontSize: 17, fontStyle: "italic", fontWeight: 800, color: "var(--accent)" }}>VISA</span>
                </div>
              </div>
            </div>
          </motion.div>
          <div className="card-shadow" />
        </div>
        <Reveal>
          <span className="sec-tag">Tarjeta global</span>
          <h2 className="sec-title display" style={{ fontSize: "clamp(32px, 4vw, 44px)" }}>Gasta en cualquier moneda, sin sorpresas.</h2>
          <div className="feat-list">
            {[
              { ti: "Tipo de cambio real", de: "Convertimos al cambio real del mercado, sin margen oculto ni comisión." },
              { ti: "Saldos en múltiples divisas", de: "Guarda MXN, USD, BRL y KRW y paga con el que prefieras." },
              { ti: "Control total", de: "Congela la tarjeta, cambia tu PIN y recibe alertas de cada cargo al instante." },
            ].map((f) => (
              <div className="feat-item" key={f.ti}><span className="ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12l4.5 4.5L19 7" /></svg></span><div><div className="ti">{f.ti}</div><div className="de">{f.de}</div></div></div>
            ))}
          </div>
          <div className="cur-chips">
            <span className="cur-chip">$ MXN</span>
            <span className="cur-chip"><span className="cur-flag"><FlagUS s={18} /></span> USD</span>
            <span className="cur-chip"><span className="cur-flag"><FlagBR s={18} /></span> BRL</span>
            <span className="cur-chip"><span className="cur-flag"><FlagKR s={18} /></span> KRW</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Reveal al entrar en pantalla (blur + subida). */
function Reveal({ children, delay = 0, className, style }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduced ? false : { opacity: 0, y: 36, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Título de sección con máscara: cada línea sube desde abajo. */
function SecHead({ tag, title, sub, center = false }: { tag: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "sec-head-center" : undefined} style={{ marginBottom: 48 }}>
      <Reveal><span className="sec-tag">{tag}</span></Reveal>
      <Reveal delay={0.05}><h2 className="sec-title display">{title}</h2></Reveal>
      {sub && <Reveal delay={0.12}><p className="sec-sub">{sub}</p></Reveal>}
    </div>
  );
}

/* ---------- landing ---------- */
export default function Landing() {
  const [navHidden, setNavHidden] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  // smooth scroll (Lenis) — usa el scroll nativo, así que useScroll sigue funcionando
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, anchors: { offset: -80 }, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
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

  return (
    <div className="lp">
      <Intro />
      <motion.div className="scroll-progress" style={{ scaleX: progress }} />

      {/* atmospheric bg */}
      <div className="atmos">
        <div className="glow g1" />
        <div className="glow g2" />
        <div className="grid" />
        <div className="grain" />
      </div>

      {/* NAV */}
      <div className={`nav-inner${navHidden ? " nav-hidden" : ""}${navScrolled ? " nav-scrolled" : ""}`}>
        <a href="#" className="brand-logo"><span className="mk"><SeyfSymbol size={20} /></span> SEYF</a>
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
        <HeroCinema />

        {/* MARQUEE */}
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <React.Fragment key={dup}>
                <span className="it"><span className="flag"><FlagMX /></span> México · Bonos M 10.25%</span>
                <span className="it"><span className="flag"><FlagUS /></span> EE. UU. · Treasury 4.45%</span>
                <span className="it"><span className="flag"><FlagBR /></span> Brasil · Tesouro Selic 11.75%</span>
                <span className="it"><span className="flag"><FlagAR /></span> Argentina · Lecap 14.50%</span>
                <span className="it"><span className="flag"><FlagCO /></span> Colombia · TES 9.60%</span>
                <span className="it"><span className="flag"><FlagEU /></span> Europa · Bonos UE 3.40%</span>
                <span className="it"><span className="flag"><FlagKR /></span> Corea · KTB 3.35%</span>
                <span className="it" style={{ color: "var(--accent)" }}>Tipo de cambio real · 0% comisión</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <Manifesto />

        <PhoneStory />

        {/* STATS — hechos del producto */}
        <section className="sec-pad">
          <div className="wrap">
            <div className="stats">
              {[
                { n: <><Counter target={9} /><span className="suf">%</span></>, l: "anual sobre tu saldo, pagado diario" },
                { n: <><Counter target={24} /><span className="suf">/7</span></>, l: "depósitos y retiros por SPEI" },
                { n: <><Counter target={5} /><span className="suf">s</span></>, l: "para mover tu dinero en Stellar" },
                { n: <><Counter target={0} /><span className="suf">%</span></>, l: "comisión por cambio de divisa" },
              ].map((s, i) => (
                <Reveal key={i} delay={i * 0.08} className="stat">
                  <div className="n num">{s.n}</div>
                  <div className="l">{s.l}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <BondsRail />

        <CardShowcase />

        {/* FX */}
        <section className="sec-pad">
          <div className="wrap split">
            <Reveal>
              <span className="sec-tag">Tipo de cambio</span>
              <h2 className="sec-title display" style={{ fontSize: "clamp(32px, 4vw, 44px)" }}>El mismo cambio que ves en Google.</h2>
              <p className="sec-sub">Sin márgenes inflados ni letras chiquitas. Te damos el tipo de cambio interbancario real, en tiempo real.</p>
              <div style={{ marginTop: 24 }}><span className="match-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12l4.5 4.5L19 7" /></svg> Igual a Google · 0% comisión</span></div>
            </Reveal>
            <Reveal className="fx-panel" delay={0.1}>
              <div className="fx-head"><span>Divisa</span><span>MXN</span></div>
              <div className="fx-line"><span className="flag"><FlagUS s={32} /></span><div><div style={{ fontWeight: 700, fontSize: 14 }}>USD</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Dólar estadounidense</div></div><div className="rate num">$<Counter target={17.1252} decimals={4} /></div></div>
              <div className="fx-line"><span className="flag"><FlagBR s={32} /></span><div><div style={{ fontWeight: 700, fontSize: 14 }}>BRL</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Real brasileño</div></div><div className="rate num">$<Counter target={3.482} decimals={4} /></div></div>
              <div className="fx-line"><span className="flag"><FlagKR s={32} /></span><div><div style={{ fontWeight: 700, fontSize: 14 }}>KRW</div><div style={{ fontSize: 12, color: "var(--muted)" }}>Won surcoreano</div></div><div className="rate num">$<Counter target={0.01243} decimals={5} /></div></div>
            </Reveal>
          </div>
        </section>

        {/* ALIADOS */}
        <section className="sec-pad" id="aliados">
          <div className="wrap">
            <SecHead center tag="Aliados" title="Respaldado por la mejor infraestructura." sub="Conectamos liquidez, custodia y rieles de pago de primer nivel para que tu dinero se mueva seguro." />
            <div className="logo-wall">
              <Reveal className="ally">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="15" cy="15" r="12" /><path d="M7 17.5l16-6.5M7 13l16-6.5M7 22l16-6.5" strokeWidth="1.8" strokeLinecap="round" /></svg>
                <span className="ally-name">Stellar</span>
              </Reveal>
              <Reveal className="ally" delay={0.06}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3l10 6v12l-10 6L5 21V9l10-6z" /><path d="M15 9v12M10.5 12l9 6M19.5 12l-9 6" strokeWidth="1.6" opacity="0.85" /></svg>
                <span className="ally-name">etherfuse</span>
              </Reveal>
              <Reveal className="ally" delay={0.12}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="15" cy="15" r="12" /><path d="M11 9v12M11 9h4.5a3 3 0 010 6H11m0 0h5a3 3 0 010 6h-5" strokeWidth="2" /></svg>
                <span style={{ display: "flex", flexDirection: "column" }}><span className="ally-name">bitso</span><span className="ally-sub">Business</span></span>
              </Reveal>
              <Reveal className="ally" delay={0.18}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 11h15l-3.5-3.5M24 19H9l3.5 3.5" /></svg>
                <span style={{ display: "flex", flexDirection: "column" }}><span className="ally-name" style={{ letterSpacing: ".04em" }}>SPEI</span><span className="ally-sub">Transferencias</span></span>
              </Reveal>
            </div>
            <p className="ally-note">Integraciones ilustrativas para fines de demostración.</p>
          </div>
        </section>

        {/* SEGURIDAD */}
        <section className="sec-pad" id="seguridad">
          <div className="wrap">
            <SecHead center tag="Seguridad primero" title="Tu dinero, blindado en cada capa." sub="Construido con estándares institucionales — y la transparencia on-chain que nadie más te da." />
            <div className="sec-grid">
              {[
                { ti: "Saldo asegurado", de: "Protección de hasta $3,000,000 MXN por usuario en cuentas reguladas.", ic: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></> },
                { ti: "Cifrado AES‑256", de: "Cada dato y movimiento viaja cifrado de extremo a extremo.", ic: <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 018 0v3" /></> },
                { ti: "Acceso biométrico", de: "Face ID, PIN y verificación en 2 pasos para que solo tú entres a tu dinero.", ic: <><path d="M12 11v3a5 5 0 01-1.5 3.5" /><path d="M8.5 7.5a5 5 0 017 1.5" /><path d="M6.5 12a6.5 6.5 0 0111-4.7" /></> },
              ].map((c, i) => (
                <Reveal key={c.ti} className="sec-card" delay={i * 0.08}>
                  <div className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{c.ic}</svg></div>
                  <h4>{c.ti}</h4>
                  <p>{c.de}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="sec-pad">
          <div className="wrap">
            <SecHead center tag="Preguntas" title="Lo que quieres saber." />
            <div className="faq-list">
              {FAQ_ITEMS.map((item, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className={`faq${openFaq === i ? " open" : ""}`}>
                    <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                      {item.q}
                      <span className="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg></span>
                    </button>
                    <div className="faq-a"><p>{item.a}</p></div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="sec-pad" id="descargar">
          <div className="wrap">
            <Reveal className="final">
              <Symbol3D className="final-canvas" scale={0.8} />
              <div className="final-inner">
                <h2 className="display">Empieza a hacer crecer tu dinero hoy.</h2>
                <p>Abre tu cuenta en minutos. Sin comisiones de apertura, sin saldo mínimo.</p>
                <div className="hero-cta">
                  <Link className="btn btn-primary btn-lg" href="/app">Iniciar ahora</Link>
                  <AppStoreBtn />
                  <GooglePlayBtn />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="wrap">
            <div className="foot-grid">
              <div className="foot-col">
                <a href="#" className="brand-logo" style={{ marginBottom: 16 }}><span className="mk"><SeyfSymbol size={20} /></span> SEYF</a>
                <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 280, margin: 0 }}>La super app de finanzas para ahorrar, invertir y gastar sin fronteras.</p>
              </div>
              <div className="foot-col"><h5>Producto</h5><a href="#producto">Pesos digitales</a><a href="#bonos">Bonos</a><a href="#producto">Bóvedas</a><a href="#tarjeta">Tarjeta</a></div>
              <div className="foot-col"><h5>Compañía</h5><a href="#">Sobre nosotros</a><a href="#seguridad">Seguridad</a><a href="#">Carreras</a><a href="#">Prensa</a></div>
              <div className="foot-col"><h5>Legal</h5><a href="#">Términos</a><a href="#">Privacidad</a><a href="#">Comisiones</a><a href="#">Soporte</a></div>
              <div className="foot-col">
                <h5>Inversionistas</h5>
                <a className="foot-pitch" href="/seyf-pitch.html" target="_blank" rel="noopener noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" /></svg>
                  Pitch · Lean Canvas
                </a>
                <p className="foot-pitch-note">Conoce el modelo de negocio, la tecnología y la tracción de SEYF.</p>
                <a href="mailto:inversionistas@seyf.app">Contacto inversión</a>
              </div>
            </div>
            <div className="foot-giant display" aria-hidden>SEYF</div>
            <div className="foot-bottom">
              <span>© 2026 SEYF. Todos los derechos reservados.</span>
              <span>Construido sobre Stellar · Hecho en México</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
