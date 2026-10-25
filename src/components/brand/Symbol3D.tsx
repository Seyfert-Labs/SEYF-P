"use client";

/* SEYF — símbolo de marca en 3D (three.js, sin assets externos).
   Los dos arcos del logo (violeta + lima) se modelan como toros parciales con
   tapas redondas y se entrelazan en z, igual que el SVG. Iluminación con
   RoomEnvironment (PMREM) para reflejos tipo render de estudio.
   `progress` (0→1, p.ej. scroll) controla giro/escala; el mouse agrega parallax.
   Solo pinta cuando está en pantalla; con reduce-motion renderiza un cuadro fijo. */
import React, { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const LIME = 0xcdfc4a;
const VIOLET = 0x8357f5;

// Geometría derivada de public/brand/seyf-symbol.svg (unidades SVG / 100, eje y hacia arriba).
const R = 0.754;
const TUBE = 0.2175;
const ARC = (284 * Math.PI) / 180;
const ARCS = [
  { color: VIOLET, cx: 0.218, cy: -0.508, start: (183 * Math.PI) / 180, lift: 1 },
  { color: LIME, cx: -0.218, cy: 0.508, start: (2.96 * Math.PI) / 180, lift: -1 },
];
// Desplazamiento en z que hace que los arcos se "crucen" en lugar de atravesarse.
const weave = (y: number, lift: number) => lift * 0.1 * Math.tanh(-y / 0.3);

function buildArc(a: (typeof ARCS)[number], mat: THREE.Material) {
  const g = new THREE.Group();
  const torus = new THREE.TorusGeometry(R, TUBE, 48, 220, ARC);
  torus.rotateZ(a.start);
  torus.translate(a.cx, a.cy, 0);
  const pos = torus.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + weave(pos.getY(i), a.lift));
  torus.computeVertexNormals();
  g.add(new THREE.Mesh(torus, mat));
  // tapas redondas (stroke-linecap: round)
  const cap = new THREE.SphereGeometry(TUBE, 40, 28);
  for (const ang of [a.start, a.start + ARC]) {
    const x = a.cx + R * Math.cos(ang);
    const y = a.cy + R * Math.sin(ang);
    const m = new THREE.Mesh(cap, mat);
    m.position.set(x, y, weave(y, a.lift));
    g.add(m);
  }
  return g;
}

export default function Symbol3D({
  progress,
  className,
  style,
  scale = 1,
  spin = true,
}: {
  progress?: MotionValue<number>;
  className?: string;
  style?: React.CSSProperties;
  scale?: number;
  spin?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // sin WebGL: el contenedor queda con su fondo/fallback CSS
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
    camera.position.set(0, 0, 10.9);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rimV = new THREE.PointLight(VIOLET, 18, 12);
    rimV.position.set(-3, -1.5, -1.5);
    scene.add(rimV);
    const rimL = new THREE.PointLight(LIME, 10, 12);
    rimL.position.set(3, 2, -1);
    scene.add(rimL);

    const mats = ARCS.map(
      (a) =>
        new THREE.MeshPhysicalMaterial({
          color: a.color,
          roughness: 0.22,
          metalness: 0.15,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          sheen: 0.4,
          sheenColor: new THREE.Color(a.color),
          emissive: new THREE.Color(a.color),
          emissiveIntensity: 0.08,
        }),
    );

    const symbol = new THREE.Group();
    ARCS.forEach((a, i) => symbol.add(buildArc(a, mats[i])));
    const rig = new THREE.Group(); // rig = mouse/scroll; symbol = idle
    rig.add(symbol);
    scene.add(rig);

    // anillo orbital + partículas: el "dinero" que gira alrededor
    const ringGeo = new THREE.TorusGeometry(2.05, 0.004, 8, 240);
    const ringMat = new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.42;
    const ring2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.3 }));
    ring2.rotation.set(Math.PI * 0.55, 0.5, 0);
    ring2.scale.setScalar(1.18);
    rig.add(ring, ring2);

    const N = 420;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(N * 3);
    const pCol = new Float32Array(N * 3);
    const cL = new THREE.Color(LIME);
    const cV = new THREE.Color(VIOLET);
    // pseudo-aleatorio determinista (mismo cielo en cada carga)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const r = 1.6 + rnd() * 2.6;
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(2 * rnd() - 1);
      pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pPos[i * 3 + 1] = r * Math.cos(ph) * 0.7;
      pPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const c = rnd() > 0.45 ? cL : cV;
      pCol.set([c.r, c.g, c.b], i * 3);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pGeo, pMat);
    rig.add(points);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // en pantallas angostas alejamos la cámara para que el símbolo no se corte
      camera.position.z = (w / h < 1.1 ? 13.4 : 10.9) / scale;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      const p = progress?.get() ?? 0;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      if (spin) {
        symbol.rotation.y = Math.sin(t * 0.5) * 0.22;
        symbol.rotation.x = Math.sin(t * 0.37) * 0.12;
        symbol.position.y = Math.sin(t * 0.9) * 0.06;
      }
      // scroll: un giro completo + leve acercamiento y salida hacia arriba
      // scroll: gira de frente (eje z) con un balanceo leve en y — nunca de canto, para que no se deforme
      rig.rotation.z = -p * Math.PI;
      rig.rotation.y = Math.sin(p * Math.PI * 2) * 0.32 + mouse.x * 0.25;
      rig.rotation.x = mouse.y * 0.16;
      ring.rotation.z = t * 0.18;
      ring2.rotation.z = -t * 0.12;
      points.rotation.y = t * 0.03 + p * 1.2;
      renderer.render(scene, camera);
    };

    if (reduced) {
      renderer.render(scene, camera);
      const rerender = () => renderer.render(scene, camera);
      ro.disconnect();
      const ro2 = new ResizeObserver(() => {
        resize();
        rerender();
      });
      ro2.observe(host);
      return () => {
        ro2.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        dispose();
      };
    }
    frame();

    function dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      dispose();
    };
  }, [progress, scale, spin]);

  return <div ref={hostRef} className={className} style={style} aria-hidden />;
}
