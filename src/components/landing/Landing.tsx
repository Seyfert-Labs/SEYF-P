"use client";

/* SEYF — Landing page.
   Narrativa por scroll: hero "cinemático" con el símbolo SEYF en 3D (three.js)
   pinneado mientras cambian los mensajes, historia del producto con el celular
   fijo y bonos en carrusel horizontal guiado por scroll con cada país en relieve.
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
import { LangProvider, LangSwitch, useI18n } from "./i18n";

// three.js solo en el navegador y fuera del bundle inicial
const Symbol3D = dynamic(() => import("@/components/brand/Symbol3D"), { ssr: false });
const CoinsLayer = dynamic(() => import("./CoinsLayer"), { ssr: false });

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

const AppStoreBtn = ({ sub }: { sub: string }) => (
  <a className="store-btn" href="#descargar">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 1.8c.1 1-.3 2-.9 2.8-.7.8-1.7 1.4-2.7 1.3-.1-1 .4-2 1-2.7.7-.8 1.8-1.4 2.6-1.4zM19 17c-.5 1.1-.7 1.6-1.3 2.6-.9 1.4-2.1 3.1-3.6 3.1-1.3 0-1.7-.9-3.5-.9s-2.2.8-3.5.9c-1.5.1-2.6-1.5-3.5-2.9C1 16.7.8 12.3 2.4 9.9c1-1.6 2.6-2.5 4.1-2.5 1.6 0 2.5.9 3.8.9 1.2 0 2-.9 3.8-.9 1.4 0 2.8.7 3.8 2-3.3 1.8-2.8 6.5.8 7.6z" /></svg>
    <span><span className="sub">{sub}</span><br /><span className="big">App Store</span></span>
  </a>
);
const GooglePlayBtn = ({ sub }: { sub: string }) => (
  <a className="store-btn" href="#descargar">
    <svg width="20" height="22" viewBox="0 0 24 24" fill="none"><path d="M3.6 2.3 13.3 12 3.6 21.7c-.3-.2-.5-.6-.5-1V3.3c0-.4.2-.8.5-1z" fill="#C8FF4D" /><path d="m16.8 8.5 2.9 1.7c1 .6 1 2 0 2.6l-2.9 1.7L13.8 12l3-3.5z" fill="#8B5CF6" /><path d="M3.6 2.3c.3-.2.7-.2 1.1 0l11 6.2-1.9 1.9L3.6 2.3z" fill="#fff" /><path d="m13.8 13.6 1.9 1.9-11 6.2c-.4.2-.8.2-1.1 0l10.2-8.1z" fill="#9C96B4" /></svg>
    <span><span className="sub">{sub}</span><br /><span className="big">Google Play</span></span>
  </a>
);

// accent = color del país (glow, pin y medidor); wall = color base del relieve
// nombres de país y capital: en i18n (t.bonds.countries / capitals)
const BONDS: { cc: CountryCode; Flag: React.FC<{ s?: number }>; inst: string; cur: string; y: number; accent: string; wall: string }[] = [
  { cc: "mx", Flag: FlagMX, inst: "CETES · Bonos M", cur: "MXN", y: 10.25, accent: "#2ecc71", wall: "#0b5a33" },
  { cc: "us", Flag: FlagUS, inst: "US Treasury", cur: "USD", y: 4.45, accent: "#6c8cff", wall: "#2c2e6e" },
  { cc: "br", Flag: FlagBR, inst: "Tesouro Selic", cur: "BRL", y: 11.75, accent: "#ffd400", wall: "#0f6b34" },
  { cc: "ar", Flag: FlagAR, inst: "Lecap", cur: "ARS", y: 14.5, accent: "#74acdf", wall: "#3b6f9c" },
  { cc: "co", Flag: FlagCO, inst: "TES", cur: "COP", y: 9.6, accent: "#fcd116", wall: "#00307d" },
  { cc: "eu", Flag: FlagEU, inst: "Bonos UE", cur: "EUR", y: 3.4, accent: "#ffcc00", wall: "#0d2f80" },
  { cc: "kr", Flag: FlagKR, inst: "Korea Treasury", cur: "KRW", y: 3.35, accent: "#ff5a6a", wall: "#3a3f55" },
];
const MAX_YIELD = Math.max(...BONDS.map((b) => b.y));

const STEPS = ["01", "02", "03"]; // textos en t.story.steps

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
  const { t } = useI18n();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = t.manifesto.split(" ");
  return (
    <section className="manifesto sec-pad">
      <div className="wrap">
        <span className="sec-tag">{t.manifestoTag}</span>
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

/** true mientras se cumpla la media query (false en el servidor y en el primer render). */
function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Monta a sus hijos cuando el contenedor queda a `margin` de la pantalla, y ya no
    los desmonta. Para escenas WebGL: crearlas cuesta (shaders, PMREM, geometría). */
function LazyMount({ children, className, margin = "600px" }: { children: React.ReactNode; className?: string; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [on, margin]);
  if (on) return <>{children}</>;
  return <div ref={ref} className={className} aria-hidden />;
}

/** Hero pinneado: el símbolo 3D gira con el scroll mientras cambian 3 mensajes. */
function HeroCinema() {
  const { t } = useI18n();
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
  // en el beat 2 el símbolo se encoge para caber entre "Rinde" y "diario"
  const symScaleDesk = useTransform(p, [0.26, 0.38, 0.6, 0.74], [1, 0.58, 0.58, 0.8]);
  // móvil: el canvas ajusta el símbolo al ancho, así que de entrada se achica para
  // caber entre la barra y el texto sin taparlos
  const symScaleMob = useTransform(p, [0.26, 0.38, 0.6, 0.74], [0.66, 0.46, 0.46, 0.6]);
  const mobile = useMediaQuery("(max-width: 880px)");
  const symScale = mobile ? symScaleMob : symScaleDesk;
  const hint = useTransform(p, [0, 0.06], [1, 0]);
  // una parada por mensaje: propuesta, "Rinde diario", "Sin letras chiquitas"
  useSnapSection(ref, [0, 0.48, 0.88]);

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
            <motion.div className="hero-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: EASE }}>
              <span className="live-dot" /> {t.hero.eyebrow}
            </motion.div>
            <h1 className="display">
              {t.hero.words.map((w, i) => (
                <span className="hero-word-mask" key={i}>
                  <motion.span
                    className="hero-word"
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
              {t.hero.lede}
            </motion.p>
            <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.9, ease: EASE }}>
              <Link className="btn btn-primary btn-lg magnetic" href="/app">
                {t.hero.cta}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <a className="hero-link" href="#producto">{t.hero.how}</a>
            </motion.div>
          </div>
        </motion.div>

        {/* Beat 2 — rendimiento */}
        <motion.div className="beat beat-2" style={{ opacity: b2o, scale: b2s }}>
          <div className="beat-2-row display">
            <span className="big-l">{t.hero.yieldL}</span>
            <span className="big-gap" />
            <span className="big-r">{t.hero.yieldR}</span>
          </div>
          <div className="beat-2-foot">
          <p className="beat-sub">{t.hero.yieldSub}</p>
          <div className="beat-cards">
            <div className="float-card">
              <div className="k"><span className="live-dot" /> {t.hero.earnedToday}</div>
              {/* ilustrativo: solo anima el contador, no promete una tasa */}
              <div className="v"><GrowingAmount base={12.4} apy={9} size={30} align="left" color="var(--accent)" prefix="+$" tail={2} id="lp-ganado" /></div>
            </div>
            <div className="float-card">
              <div className="k">{t.hero.withdrawK}</div>
              <div className="v num">{t.hero.withdrawV}</div>
            </div>
          </div>
          </div>
        </motion.div>

        {/* Beat 3 — simple */}
        <motion.div className="beat beat-3" style={{ opacity: b3o, y: b3y }}>
          <div className="wrap beat-3-inner">
            <h2 className="display">
              <span className="soft">{t.hero.simple[0]}<br />{t.hero.simple[1]}</span><br />{t.hero.simple[2]}
            </h2>
            <p className="beat-sub">{t.hero.simpleSub}</p>
          </div>
        </motion.div>

        <motion.div className="scroll-hint" style={{ opacity: hint }}>
          <span>{t.hero.scroll}</span>
          <i />
        </motion.div>
      </div>
    </section>
  );
}

/** "Acomodo" en una sección pinneada: el scroll es libre (nunca se bloquea); al
    detenerse dentro de la sección, se desliza a la parada siguiente en la dirección
    en que ibas (o a la anterior si subías). Pasando la última/primera parada no
    hace nada, para poder salir. `points` = avance (0–1) de cada parada. */
function useSnapSection(ref: React.RefObject<HTMLElement | null>, points: number[]) {
  const settling = useRef(false);
  const geo = () => {
    const el = ref.current!;
    const top = el.getBoundingClientRect().top + window.scrollY;
    return { top, dist: Math.max(1, el.offsetHeight - window.innerHeight) };
  };
  const goTo = (i: number) => {
    if (!ref.current) return;
    const { top, dist } = geo();
    const y = top + dist * points[i];
    if (Math.abs(y - window.scrollY) < 4) return;
    settling.current = true;
    const done = () => (settling.current = false);
    window.setTimeout(done, 1300); // por si el usuario interrumpe la animación
    if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: 1, onComplete: done });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t = 0;
    let start = -1; // avance cuando empezó el gesto actual
    const onScroll = () => {
      if (settling.current || !ref.current) return;
      const { top, dist } = geo();
      const v = (window.scrollY - top) / dist;
      if (start < 0) start = v;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const from = start;
        start = -1;
        if (v <= 0.001 || v >= 0.999) return;
        const down = v > from;
        // bajando → la siguiente parada adelante; subiendo → la anterior
        const i = down ? points.findIndex((p) => p >= v - 0.005) : points.map((p) => p <= v + 0.005).lastIndexOf(true);
        if (i >= 0) goTo(i);
      }, 170);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return goTo;
}

/* Por paso: ángulo del celular, color del brillo y tarjetas que "salen" del teléfono
   (los textos de cada tarjeta están en t.story.chips). */
const STORY_FX = [
  { ry: -18, rx: 6, glow: "rgba(200,255,77,.30)", chips: [
    { tone: "lime", pos: "c-tl" },
    { tone: "plain", pos: "c-br" },
  ] },
  { ry: 16, rx: 4, glow: "rgba(91,140,255,.30)", chips: [
    { tone: "plain", pos: "c-tr" },
    { tone: "lime", pos: "c-bl" },
  ] },
  { ry: -10, rx: 10, glow: "rgba(139,92,246,.38)", chips: [
    { tone: "violet", pos: "c-tl" },
    { tone: "lime", pos: "c-bl" },
  ] },
];

/** Celular en 3D: cambia de ángulo por paso, tarjetas flotantes con parallax
    (más cerca = se mueven más) y tilt siguiendo el mouse. */
function Phone({ screen }: { screen: number }) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const fx = STORY_FX[screen];
  const onMove = (ev: React.MouseEvent) => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = stage.getBoundingClientRect();
    stage.style.setProperty("--px", `${(ev.clientX - r.left) / r.width - 0.5}`);
    stage.style.setProperty("--py", `${(ev.clientY - r.top) / r.height - 0.5}`);
  };
  const onLeave = () => {
    stageRef.current?.style.setProperty("--px", "0");
    stageRef.current?.style.setProperty("--py", "0");
  };
  return (
    <div className="phone-stage" ref={stageRef} onMouseMove={onMove} onMouseLeave={onLeave} style={{ "--glow": fx.glow } as React.CSSProperties}>
      <AnimatePresence mode="wait">
        <motion.span
          key={screen}
          className="story-num display"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.6, ease: EASE }}
          aria-hidden
        >
          {STEPS[screen]}
        </motion.span>
      </AnimatePresence>
      <motion.div
        className="phone-3d"
        animate={{ rotateY: fx.ry, rotateX: fx.rx }}
        transition={{ duration: 1.1, ease: EASE }}
      >
        <div className="phone-tilt">
          <div className="phone" ref={phoneRef}>
            <div className="phone-screen">
              <AppMock screen={screen} />
            </div>
          </div>
        </div>
      </motion.div>
      {/* monedas 3D: llueven, orbitan o se apilan según el paso */}
      <LazyMount className="coins-layer"><CoinsLayer mode={screen} phoneRef={phoneRef} className="coins-layer" /></LazyMount>
      <AnimatePresence>
        {fx.chips.map((c, i) => (
          <motion.div
            key={`${screen}-${i}`}
            className={`float-chip ${c.pos} t-${c.tone}`}
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.6, delay: 0.35 + i * 0.12, ease: EASE }}
          >
            <span className="k">{t.story.chips[screen][i].k}</span>
            <span className="v num">{t.story.chips[screen][i].v}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Historia del producto: el celular queda fijo y cada paso "se detiene" (snap
    por gesto) para que no se pase de largo. Los pasos también se pueden tocar. */
function PhoneStory() {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const [screen, setScreen] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setScreen(Math.min(2, Math.max(0, Math.floor(v * 3)))));
  const goTo = useSnapSection(ref, [1 / 6, 1 / 2, 5 / 6]);

  return (
    <section className="story" id="producto" ref={ref}>
      <div className="story-sticky">
        <div className="wrap story-grid">
          <div className="story-copy">
            <span className="sec-tag">{t.story.tag}</span>
            <h2 className="sec-title display">{t.story.title}</h2>
            <div className="steps">
              {t.story.steps.map((s, i) => (
                <button key={STEPS[i]} className={`step${screen === i ? " on" : ""}`} onClick={() => goTo(i)}>
                  <StepBar progress={scrollYProgress} i={i} />
                  <span className="step-n num">{STEPS[i]}</span>
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
  const { t } = useI18n();
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
          <span className="bond-cap"><i />{t.bonds.capitals[b.cc]}</span>
        </div>
        <div className="bond-head">
          <span className="bond-flag"><b.Flag s={34} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="country">{t.bonds.countries[b.cc]}</div>
            <div className="code">{b.inst}</div>
          </div>
          <span className="bond-cur">{b.cur}</span>
        </div>
        <div className="yld num"><Counter target={b.y} decimals={2} />%<small>{t.bonds.annual}</small></div>
        <div className="bond-meter"><i style={{ width: `${(b.y / MAX_YIELD) * 100}%` }} /></div>
        <div className="bond-foot"><span>{t.bonds.from}</span><span>{t.bonds.liquidity}</span></div>
      </div>
    </motion.div>
  );
}

/** Bonos en carril horizontal que avanza con el scroll vertical. */
function BondsRail() {
  const { t } = useI18n();
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
          <span className="sec-tag">{t.bonds.tag}</span>
          <h2 className="sec-title display">{t.bonds.title}</h2>
          <p className="sec-sub">{t.bonds.sub}</p>
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

/* ---------- actividad del adelanto en mainnet ----------
   Cifras de /api/advance/activity, leídas del contrato seyf_advance. No es
   TVL: el vault es de un tercero. Sin datos, la sección no se muestra. */
type AdvanceActivity = { advances: number; accounts: number; backing: string; asOf: string; contract: string };
const DATE_LOCALE = { es: "es-MX", en: "en-US", pt: "pt-BR" } as const;

function LiveActivity() {
  const { t, lang } = useI18n();
  const [activity, setActivity] = useState<AdvanceActivity | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/advance/activity", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { activity?: AdvanceActivity | null } | null) => setActivity(body?.activity ?? null))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (!activity) return null;
  const backing = Number(BigInt(activity.backing)) / 1e7; // USDC: 7 decimales
  const asOf = new Date(activity.asOf).toLocaleString(DATE_LOCALE[lang], {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <section className="sec-pad" id="en-vivo">
      <div className="wrap">
        <SecHead center tag={t.live.tag} title={t.live.title} sub={t.live.sub} />
        <div className="stats stats-3">
          {[
            { n: <Counter target={activity.advances} />, l: t.live.stats[0] },
            { n: <Counter target={activity.accounts} />, l: t.live.stats[1] },
            { n: <><span className="suf">$</span><Counter target={backing} decimals={2} /></>, l: t.live.stats[2] },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 0.08} className="stat">
              <div className="n num">{s.n}</div>
              <div className="l">{s.l}</div>
            </Reveal>
          ))}
        </div>
        <p className="live-note">
          <span className="live-dot" /> {t.live.asOf} {asOf} ·
          <a href={`https://stellar.expert/explorer/public/contract/${activity.contract}`} target="_blank" rel="noopener noreferrer">
            {t.live.verify}
          </a>
        </p>
      </div>
    </section>
  );
}

// el rol de cada aliado está en t.partners.roles (mismo orden)
const PARTNERS = [
  { name: "Stellar", logo: "/partners/stellar.svg", h: 30, url: "https://stellar.org", color: "#ffffff" },
  { name: "DeFindex", logo: "/partners/defindex.svg", h: 30, url: "https://defindex.io", color: "#DEC9F4" },
  { name: "Pollar", logo: "/partners/pollar.png", h: 22, url: "https://pollar.xyz", color: "#6c8cff" },
  { name: "Etherfuse", logo: "/partners/etherfuse.svg", h: 24, url: "https://www.etherfuse.com", color: "#C8FF4D" },
];

// títulos y descripciones en t.security.layers (mismo orden)
const LAYERS = [
  { ic: <><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></> },
  { ic: <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 018 0v3" /></> },
  { ic: <><path d="M12 11v3a5 5 0 01-1.5 3.5" /><path d="M8.5 7.5a5 5 0 017 1.5" /><path d="M6.5 12a6.5 6.5 0 0111-4.7" /></> },
];

// rebanadas bajo cada placa: dan el canto (grosor) sin geometría real
const PLATE_EDGE = [2, 4, 6, 8, 10, 12, 14];

/** Placa sólida de la pila: la capa 0 es la base; las de arriba se separan más.
    El ícono va en la esquina frontal, la única zona que no tapa la placa de arriba. */
function Plate({ layer, i, gap, on }: { layer: (typeof LAYERS)[number]; i: number; gap: MotionValue<number>; on: boolean }) {
  const z = useTransform(gap, (g) => i * g); // la elevación de la activa va en CSS (.plate.on)
  return (
    <motion.div className={`plate p${i}${on ? " on" : ""}`} style={{ translateZ: z }}>
      {PLATE_EDGE.map((d) => (
        <span key={d} className="plate-edge" style={{ transform: `translateZ(${-d}px)` }} />
      ))}
      <span className="plate-face" />
      <span className="plate-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{layer.ic}</svg></span>
    </motion.div>
  );
}

/** "Blindado en cada capa", literal: pila isométrica de placas de vidrio que se
    separan con el scroll; la capa activa se eleva y brilla. Cambia sola cada 3 s
    o al pasar el mouse por la lista. */
function SecurityStack() {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const gap = useTransform(scrollYProgress, [0, 1], [18, 70]);
  const spin = useTransform(scrollYProgress, [0, 1], [-60, -45]);
  const coreZ = useTransform(gap, (g) => LAYERS.length * g + 40);
  useEffect(() => {
    if (hover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % LAYERS.length), 3000);
    return () => clearInterval(id);
  }, [hover]);
  return (
    <section className="sec-pad" id="seguridad" ref={ref}>
      <div className="wrap split sec-stack-grid">
        <div>
          <Reveal><span className="sec-tag">{t.security.tag}</span></Reveal>
          <Reveal delay={0.05}><h2 className="sec-title display">{t.security.title}</h2></Reveal>
          <Reveal delay={0.1}><p className="sec-sub">{t.security.sub}</p></Reveal>
          <div className="layer-list" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            {LAYERS.map((l, i) => (
              <button key={i} className={`layer-item${active === i ? " on" : ""}`} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}>
                <span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{l.ic}</svg></span>
                <span className="tx">
                  <span className="ti">{t.security.layers[i].ti}</span>
                  <span className="de">{t.security.layers[i].de}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="stack-stage" aria-hidden>
          <div className="stack-glow" />
          <motion.div className="stack" style={{ rotateZ: spin }}>
            {LAYERS.map((l, i) => (
              <Plate key={i} layer={l} i={i} gap={gap} on={active === i} />
            ))}
            {/* el símbolo va plano sobre la tapa: parado se hundía a medias en la placa */}
            <motion.div className="plate-core" style={{ translateZ: coreZ }}>
              {PLATE_EDGE.slice(0, 5).map((d) => (
                <span key={d} className="plate-edge" style={{ transform: `translateZ(${-d}px)` }} />
              ))}
              <span className="plate-face" />
              <SeyfSymbol size={52} />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ---------- landing ---------- */
export default function Landing() {
  return (
    <LangProvider>
      <LandingInner />
    </LangProvider>
  );
}

function LandingInner() {
  const { t } = useI18n();
  const [navHidden, setNavHidden] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  // smooth scroll (Lenis) — usa el scroll nativo, así que useScroll sigue funcionando
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // lerp bajo + rueda menos sensible: el scroll se siente pesado/suave y las transiciones se alcanzan a ver
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.75, touchMultiplier: 1, anchors: { offset: -80 } });
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
          <a href="#producto">{t.nav.product}</a>
          <a href="#bonos">{t.nav.bonds}</a>
          <a href="#seguridad">{t.nav.security}</a>
        </div>
        <div className="nav-cta">
          <LangSwitch />
          <Link className="btn btn-ghost btn-sm" href="/app">{t.nav.login}</Link>
          <Link className="btn btn-primary btn-sm" href="/app">{t.nav.start}</Link>
        </div>
      </div>

      <main>
        <HeroCinema />

        {/* MARQUEE */}
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((dup) => (
              <React.Fragment key={dup}>
                <span className="it"><span className="flag"><FlagMX /></span> {t.bonds.countries.mx} · Bonos M 10.25%</span>
                <span className="it"><span className="flag"><FlagUS /></span> {t.bonds.short.us} · Treasury 4.45%</span>
                <span className="it"><span className="flag"><FlagBR /></span> {t.bonds.countries.br} · Tesouro Selic 11.75%</span>
                <span className="it"><span className="flag"><FlagAR /></span> {t.bonds.countries.ar} · Lecap 14.50%</span>
                <span className="it"><span className="flag"><FlagCO /></span> {t.bonds.countries.co} · TES 9.60%</span>
                <span className="it"><span className="flag"><FlagEU /></span> {t.bonds.countries.eu} · Bonos UE 3.40%</span>
                <span className="it"><span className="flag"><FlagKR /></span> {t.bonds.short.kr} · KTB 3.35%</span>
                <span className="it" style={{ color: "var(--accent)" }}>{t.marqueeFx}</span>
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
                { n: <><span className="suf">$</span><Counter target={50} /></>, l: t.stats[0] },
                { n: <><Counter target={24} /><span className="suf">/7</span></>, l: t.stats[1] },
                { n: <><Counter target={5} /><span className="suf">s</span></>, l: t.stats[2] },
                { n: <><Counter target={0} /><span className="suf">%</span></>, l: t.stats[3] },
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

        {/* ALIADOS */}
        <section className="sec-pad" id="aliados">
          <div className="wrap">
            <SecHead center tag={t.partners.tag} title={t.partners.title} sub={t.partners.sub} />
            <div className="ally-grid">
              {PARTNERS.map((p, i) => (
                <Reveal key={p.name} delay={i * 0.07}>
                  <a className="ally" href={p.url} target="_blank" rel="noopener noreferrer" style={{ "--c": p.color } as React.CSSProperties}>
                    <span className="ally-logo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.logo} alt={p.name} style={{ height: p.h }} />
                    </span>
                    <span className="ally-role">{t.partners.roles[i]}</span>
                    <span className="ally-arrow" aria-hidden>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M7 17L17 7M9 7h8v8" /></svg>
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <LiveActivity />

        <SecurityStack />

        {/* FAQ */}
        <section className="sec-pad">
          <div className="wrap">
            <SecHead center tag={t.faq.tag} title={t.faq.title} />
            <div className="faq-list">
              {t.faq.items.map((item, i) => (
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
              {/* se monta al acercarse: crear la escena 3D al cargar la página trababa el celular */}
              <LazyMount className="final-canvas"><Symbol3D className="final-canvas" scale={0.8} /></LazyMount>
              <div className="final-inner">
                <h2 className="display">{t.final.title}</h2>
                <p>{t.final.sub}</p>
                <div className="hero-cta">
                  <Link className="btn btn-primary btn-lg" href="/app">{t.hero.cta}</Link>
                  <AppStoreBtn sub={t.store.appSub} />
                  <GooglePlayBtn sub={t.store.playSub} />
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
                <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 280, margin: 0 }}>{t.footer.tagline}</p>
              </div>
              <div className="foot-col"><h5>{t.footer.product}</h5><a href="#producto">{t.footer.digitalPesos}</a><a href="#bonos">{t.footer.bonds}</a><a href="#producto">{t.footer.vaults}</a></div>
              <div className="foot-col"><h5>{t.footer.company}</h5><Link href="/nosotros">{t.footer.about}</Link><a href="#seguridad">{t.footer.security}</a><Link href="/empleos">{t.footer.jobs}</Link><Link href="/prensa">{t.footer.press}</Link></div>
              <div className="foot-col"><h5>{t.footer.legal}</h5><Link href="/terminos">{t.footer.terms}</Link><Link href="/privacidad">{t.footer.privacy}</Link><Link href="/comisiones">{t.footer.fees}</Link><Link href="/soporte">{t.footer.support}</Link></div>
              <div className="foot-col">
                <h5>{t.footer.investors}</h5>
                <a href="mailto:inversionistas@seyf.app">{t.footer.investorContact}</a>
              </div>
            </div>
            <div className="foot-giant display" aria-hidden>SEYF</div>
            <div className="foot-bottom">
              <span>{t.footer.rights}</span>
              <span>{t.footer.made}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
