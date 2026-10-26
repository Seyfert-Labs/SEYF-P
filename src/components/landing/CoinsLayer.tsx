"use client";

/* SEYF — monedas 3D alrededor del celular de "Así funciona" (three.js).
   Capa transparente sobre el escenario; mide dónde está el teléfono en pantalla
   y anima monedas según el paso:
     0 · Deposita  → llueven monedas lima que entran a la pantalla
     1 · Convierte → orbitan el teléfono y cambian lima (MXN) ↔ azul (USDC)
     2 · Ahorra    → saltan del teléfono a una pila violeta (bóveda) que crece
   Entre pasos cada moneda se desliza de su posición anterior a la nueva.
   Solo pinta en pantalla; con reduce-motion deja un cuadro fijo. */
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const LIME = new THREE.Color(0xc8ff4d);
const USDC = new THREE.Color(0x2775ca);
const VIOLET = new THREE.Color(0x8b5cf6);
const N = 22; // monedas en movimiento
const STACK = 14; // monedas máximas en la pila
const COIN_PX = 30; // radio de la moneda en px con el teléfono de escritorio (330 px de ancho)

const ease = (x: number) => 1 - Math.pow(1 - x, 3);

/** Textura de la cara: blanca (se tiñe con el color del material) con aro y "$" en relieve. */
function faceTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#9a9a9a";
  g.lineWidth = 12;
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#8a8a8a";
  g.font = "bold 150px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("$", 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type Coin = {
  mesh: THREE.Mesh;
  side: THREE.MeshPhysicalMaterial;
  face: THREE.MeshPhysicalMaterial;
  from: THREE.Vector3; // posición al cambiar de paso (para el deslizamiento)
};

export default function CoinsLayer({
  mode,
  phoneRef,
  className,
}: {
  mode: number;
  phoneRef: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const switchRef = useRef<{ at: number; pending: boolean }>({ at: 0, pending: false });

  useEffect(() => {
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      switchRef.current = { at: performance.now(), pending: true };
    }
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 6);
    scene.add(key);

    // cámara: 1 unidad de mundo = 1 px de pantalla en el plano z = 0
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 10000);
    const tex = faceTexture();
    const geo = new THREE.CylinderGeometry(1, 1, 0.16, 48);
    geo.rotateX(Math.PI / 2); // la cara mira a la cámara

    const makeCoin = (color: THREE.Color): Coin => {
      const side = new THREE.MeshPhysicalMaterial({ color, metalness: 0.85, roughness: 0.25, clearcoat: 1, transparent: true });
      const face = new THREE.MeshPhysicalMaterial({ color, map: tex, metalness: 0.7, roughness: 0.3, clearcoat: 1, transparent: true });
      const mesh = new THREE.Mesh(geo, [side, face, face]);
      scene.add(mesh);
      return { mesh, side, face, from: new THREE.Vector3() };
    };
    const coins = Array.from({ length: N }, () => makeCoin(LIME));
    const stack = Array.from({ length: STACK }, () => makeCoin(VIOLET));

    // geometría del escenario en px (origen al centro del canvas, y hacia arriba)
    const box = { w: 1, h: 1, cx: 0, cy: 0, pw: 300, ph: 600 };
    const measure = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.set(0, 0, h / 2 / Math.tan((15 * Math.PI) / 180));
      camera.updateProjectionMatrix();
      const hr = host.getBoundingClientRect();
      const pr = phoneRef.current?.getBoundingClientRect();
      box.w = w;
      box.h = h;
      if (pr) {
        box.cx = pr.left + pr.width / 2 - (hr.left + w / 2);
        box.cy = -(pr.top + pr.height / 2 - (hr.top + h / 2));
        box.pw = pr.width;
        box.ph = pr.height;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    if (phoneRef.current) ro.observe(phoneRef.current);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(host);

    const tgt = new THREE.Vector3();
    const tmpC = new THREE.Color();
    let stackCount = 0;
    let stackClock = 0;

    // posición/rotación/opacidad/color de cada moneda para el paso `m` en el tiempo `t`
    // radio de la moneda proporcional al teléfono (en móvil el celular es más chico)
    const coinR = () => COIN_PX * Math.min(1, box.pw / 330);
    // x de la pila de la bóveda: a la derecha del teléfono, sin salirse del canvas (móvil)
    const stackX = () => Math.min(box.cx + box.pw * 0.5 + coinR() * 3.2, box.w / 2 - coinR() * 1.8);
    const place = (m: number, i: number, t: number) => {
      const c = coins[i];
      const r = coinR();
      let s = 1;
      let op = 1;
      let col = LIME;
      if (m === 0) {
        // lluvia: de arriba hacia la pantalla del teléfono, encogiéndose al "entrar"
        const cycle = 2.2;
        const u = ((t / cycle + i / N) % 1 + 1) % 1;
        const seed = Math.sin(i * 91.7) * 0.5 + 0.5;
        const x0 = box.cx + (seed - 0.5) * box.pw * 1.6;
        const y0 = box.h / 2 + r * 2;
        const x1 = box.cx + (seed - 0.5) * box.pw * 0.3;
        const y1 = box.cy + box.ph * 0.18;
        const e = u * u;
        tgt.set(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, 40 * (1 - u));
        s = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
        op = Math.min(1, u * 6) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
        c.mesh.rotation.set(t * 2 + i, t * 3 + i * 0.7, 0);
      } else if (m === 1) {
        // órbita alrededor del teléfono; a la izquierda MXN (lima), a la derecha USDC (azul)
        const a = t * 0.9 + (i / N) * Math.PI * 2;
        // órbita ancha y baja (a la altura de la lista), para no tapar los montos
        const rx = box.pw * 0.98;
        const ry = box.ph * 0.1;
        tgt.set(box.cx + Math.cos(a) * rx, box.cy - box.ph * 0.2 + Math.sin(a) * ry + Math.sin(a * 2 + i) * 6, Math.sin(a) * 120);
        const k = (Math.cos(a) + 1) / 2; // 1 = derecha
        col = tmpC.copy(LIME).lerp(USDC, k);
        s = 0.55 + 0.2 * ((Math.sin(a) + 1) / 2);
        op = Math.sin(a) < -0.2 ? 0.25 : 1; // detrás del teléfono: casi invisible
        c.mesh.rotation.set(0.3, a * 2, 0);
      } else {
        // del teléfono a la pila de la bóveda, en arco
        const cycle = 1.6;
        const u = ((t / cycle + i / N) % 1 + 1) % 1;
        const sx = box.cx;
        const sy = box.cy + box.ph * 0.05;
        const ex = stackX();
        const ey = box.cy - box.ph * 0.42 + Math.min(stackCount, STACK) * r * 0.32;
        tgt.set(sx + (ex - sx) * u, sy + (ey - sy) * u + Math.sin(u * Math.PI) * box.ph * 0.28, 30);
        col = tmpC.copy(LIME).lerp(VIOLET, ease(u));
        op = Math.min(1, u * 5) * (u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1);
        s = 0.8;
        c.mesh.rotation.set(t * 4 + i, 0.4, 0);
      }
      return { s, op, col };
    };

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const m = modeRef.current;
      const sw = switchRef.current;
      if (sw.pending) {
        coins.forEach((c) => c.from.copy(c.mesh.position));
        sw.pending = false;
      }
      const b = Math.min(1, (performance.now() - sw.at) / 700);
      const blend = sw.at ? ease(b) : 1;

      coins.forEach((c, i) => {
        const { s, op, col } = place(m, i, t);
        if (blend < 1) c.mesh.position.lerpVectors(c.from, tgt, blend);
        else c.mesh.position.copy(tgt);
        c.mesh.scale.setScalar(coinR() * s);
        c.side.opacity = c.face.opacity = op;
        c.side.color.copy(col);
        c.face.color.copy(col);
      });

      // pila de la bóveda (solo en el paso 3): crece una moneda cada ~0.35 s y se reinicia
      if (m === 2) {
        stackClock += dt;
        if (stackClock > 0.35) {
          stackClock = 0;
          stackCount = stackCount >= STACK ? 0 : stackCount + 1;
        }
      } else {
        stackCount = 0;
      }
      stack.forEach((c, i) => {
        const on = m === 2 && i < stackCount;
        c.mesh.visible = on;
        if (!on) return;
        const r = coinR();
        c.mesh.position.set(stackX() + Math.sin(i * 1.7) * 2, box.cy - box.ph * 0.42 + i * r * 0.32, 30);
        c.mesh.rotation.set(Math.PI / 2 - 0.35, 0, 0); // acostadas, vistas un poco desde arriba
        c.mesh.scale.setScalar(r * 0.95);
      });

      renderer.render(scene, camera);
    };
    if (reduced) {
      coins.forEach((c, i) => {
        const { s, op, col } = place(modeRef.current, i, 0.8);
        c.mesh.position.copy(tgt);
        c.mesh.scale.setScalar(coinR() * s);
        c.side.opacity = c.face.opacity = op;
        c.side.color.copy(col);
        c.face.color.copy(col);
      });
      stack.forEach((c) => (c.mesh.visible = false));
      renderer.render(scene, camera);
    } else frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      [...coins, ...stack].forEach((c) => {
        c.side.dispose();
        c.face.dispose();
      });
      geo.dispose();
      tex.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [phoneRef]);

  return <div ref={hostRef} className={className} aria-hidden />;
}
