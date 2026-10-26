"use client";

/* SEYF — intro de entrada a la app (onboarding fase 0).
   Secuencia (~3.4 s): ráfaga de líneas que convergen → los dos arcos del símbolo
   entran desde esquinas opuestas y se entrelazan → destello → dos líneas cruzan
   el logo → un barrido diagonal revela el degradado de marca → el logo sube y
   aparecen titular, subtítulo y CTAs. Tocar la pantalla salta al final.
   Solo presentación: los CTAs llaman a los mismos handlers del onboarding. */
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { Icon } from "./ui";

const EASE = [0.22, 1, 0.36, 1] as const;
const EXPO = [0.76, 0, 0.24, 1] as const;

// Geometría del símbolo (public/brand/seyf-symbol.svg)
const VIOLET_D = "M 274.71 288.69 A 75.4 75.4 0 1 1 221.50 364.67";
const LIME_D = "M 275.29 331.32 A 75.4 75.4 0 1 1 328.51 255.34";

const BURST = Array.from({ length: 26 }, (_, i) => ({
  a: (i / 26) * 360 + (i % 2) * 6,
  len: 38 + ((i * 37) % 60),
  d: (i % 5) * 0.03,
}));

const TITLE = ["Tu", "dinero", "rinde", "el", "doble", "que", "tu", "Afore."];

export function IntroScreen({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const reduced = useReducedMotion();
  const [skip, setSkip] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // la secuencia arranca cuando el hilo principal queda libre (tras hidratar Privy/Pollar);
  // si arrancara antes, los primeros cuadros se perderían en celulares lentos
  const [go, setGo] = useState(false);
  const instant = skip || !!reduced;

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idle = 0;
    let timer = 0;
    const whenIdle = () => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setGo(true), { timeout: 1500 });
      else timer = window.setTimeout(() => setGo(true), 200);
    };
    // primero que termine de cargar la página, luego un momento libre del hilo principal
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });
    return () => {
      window.removeEventListener("load", whenIdle);
      if (idle) w.cancelIdleCallback?.(idle);
      clearTimeout(timer);
    };
  }, []);

  // transición con retardo de la línea de tiempo; si se saltó, todo inmediato
  const at = (delay: number, duration: number, ease: Transition["ease"] = EASE): Transition =>
    instant ? { duration: 0 } : { delay, duration, ease };

  // al terminar la secuencia ya no hay nada que saltar
  useEffect(() => {
    if (instant || !go) return;
    const id = setTimeout(() => setSkip(true), 3600);
    return () => clearTimeout(id);
  }, [instant, go]);

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onStart, instant && reduced ? 0 : 520);
  };

  // antes de arrancar: solo el fondo oscuro (primer cuadro de la secuencia)
  if (!go && !instant) return <div className="intro-scr" />;

  return (
    <div className="intro-scr" onClick={() => !skip && setSkip(true)}>
      {/* fondo de marca revelado por el barrido diagonal */}
      <motion.div
        className="intro-bg"
        initial={{ "--wipe": "-40%" } as never}
        animate={{ "--wipe": "140%" } as never}
        transition={at(1.95, 0.75, EXPO)}
      >
        <div className="intro-bg-glow" />
      </motion.div>
      {/* bandas que montan el borde del barrido */}
      {!instant && (
        <>
          <motion.span className="intro-band b1" initial={{ x: "-120%", y: "120%" }} animate={{ x: "120%", y: "-120%" }} transition={at(1.95, 0.75, EXPO)} />
          <motion.span className="intro-band b2" initial={{ x: "-140%", y: "140%" }} animate={{ x: "110%", y: "-110%" }} transition={at(2.0, 0.8, EXPO)} />
        </>
      )}

      {/* ráfaga de líneas que convergen al centro */}
      {!instant && (
        <div className="intro-burst" aria-hidden>
          {BURST.map((b, i) => (
            <span key={i} style={{ rotate: `${b.a}deg` }}>
              <motion.i
                style={{ width: b.len }}
                initial={{ x: 260, opacity: 0 }}
                animate={{ x: [260, 70, 30], opacity: [0, 1, 0] }}
                transition={{ delay: 0.2 + b.d, duration: 0.7, ease: "easeIn" }}
              />
            </span>
          ))}
        </div>
      )}

      {/* líneas finas que cruzan el logo antes del barrido */}
      {!instant && (
        <div className="intro-cross" aria-hidden>
          <motion.i className="h" initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }} transition={{ delay: 1.6, duration: 0.6, times: [0, 0.6, 1] }} />
          <motion.i className="d" initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }} transition={{ delay: 1.7, duration: 0.6, times: [0, 0.6, 1] }} />
        </div>
      )}

      {/* logo: sube a su lugar cuando aparece el contenido */}
      <motion.div
        className="intro-logo"
        initial={{ y: 0, scale: 1 }}
        animate={leaving ? { scale: 1.6, opacity: 0, y: "-26vh" } : { y: "-26vh", scale: 0.78 }}
        transition={leaving ? { duration: 0.5, ease: EASE } : at(2.55, 0.8)}
      >
        <svg viewBox="0 0 344.5 396" width="150" height="172" aria-label="SEYF">
          <defs>
            <clipPath id="intro-vi"><rect x="-1000" y="310" width="3000" height="2000" /></clipPath>
            <linearGradient id="intro-shine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".85" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="intro-mask">
              <g transform="translate(-132.1,-103.5)" fill="none" strokeWidth="43.5" strokeLinecap="round" stroke="#fff">
                <path d={VIOLET_D} />
                <path d={LIME_D} />
              </g>
            </mask>
          </defs>
          <g transform="translate(-132.1,-103.5)" fill="none" strokeWidth="43.5" strokeLinecap="round">
            {/* violeta: entra desde abajo-izquierda (dos trazos: completo + recorte que pasa por encima del lima) */}
            <motion.g initial={{ x: -320, y: 380, rotate: -50, opacity: 0 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={at(0.65, 0.75)} style={{ transformOrigin: "275px 310px" }}>
              <path stroke="#8357F5" d={VIOLET_D} />
            </motion.g>
            {/* lima: entra desde arriba-derecha */}
            <motion.g initial={{ x: 320, y: -380, rotate: 50, opacity: 0 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={at(0.65, 0.75)} style={{ transformOrigin: "275px 310px" }}>
              <path stroke="#CDFC4A" d={LIME_D} />
            </motion.g>
            <motion.g initial={{ x: -320, y: 380, rotate: -50, opacity: 0 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={at(0.65, 0.75)} style={{ transformOrigin: "275px 310px" }}>
              <path stroke="#8357F5" clipPath="url(#intro-vi)" d={VIOLET_D} />
            </motion.g>
          </g>
          {/* destello que recorre el logo ya armado */}
          {!instant && (
            <g mask="url(#intro-mask)">
              <motion.rect y="0" width="140" height="396" fill="url(#intro-shine)" initial={{ x: -160 }} animate={{ x: 380 }} transition={{ delay: 1.3, duration: 0.55, ease: "easeInOut" }} />
            </g>
          )}
        </svg>
        <motion.span className="intro-word" initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: leaving ? 0 : 1, letterSpacing: "0.32em" }} transition={at(2.75, 0.8)}>
          SEYF
        </motion.span>
      </motion.div>

      {/* contenido final */}
      <motion.div className="intro-content" animate={leaving ? { opacity: 0, y: 20, filter: "blur(6px)" } : { opacity: 1 }} transition={{ duration: 0.4 }}>
        <h1 className="intro-title">
          {TITLE.map((w, i) => (
            <motion.span
              key={i}
              className={i >= 4 ? "em" : undefined}
              initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={at(2.9 + i * 0.05, 0.7)}
            >
              {w}{" "}
            </motion.span>
          ))}
        </h1>
        <motion.p className="intro-sub" initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={at(3.2, 0.7)}>
          Ahorra en bonos soberanos de México y el mundo. Retira cuando quieras, sin comisiones.
        </motion.p>
        <motion.div className="intro-ctas" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={at(2.7, 0.7)}>
          <button className="intro-btn primary" onClick={(e) => { e.stopPropagation(); start(); }}>
            Comenzar gratis <Icon name="arrowR" size={18} />
          </button>
          <button className="intro-btn ghost" onClick={(e) => { e.stopPropagation(); onLogin(); }}>
            Ya tengo cuenta
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
