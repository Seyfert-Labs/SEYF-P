"use client";

/* SEYF — objetos 3D de marca (three.js, sin assets externos).
   Mismo lenguaje que las piezas de redes: violeta metálico + acentos lima con
   brillo, monedas "$" orbitando y aros de neón detrás.
     vault     · bóveda con perilla que gira          → ahorrar / abonar
     padlock   · candado cuyo arco sube y baja        → seguridad / perfil conservador
     hourglass · reloj de arena con arena lima        → adelanto / tiempo
     suitcase  · maleta con correas lima              → crear bóveda (metas)
     coins     · pila de monedas + moneda que gira    → enviar / recibir / convertir
   Entra con un "pop" (escala + giro); `burst` hace que las monedas salgan del
   centro como en una celebración. Solo pinta en pantalla; con reduce-motion deja
   un cuadro fijo. Se carga con `Seyf3D` (lazy) para no meter three.js al bundle. */
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type ObjectKind = "vault" | "padlock" | "hourglass" | "suitcase" | "coins";

const LIME = 0xcdfc4a;
const VIOLET = 0x8357f5;
const VIOLET_LIGHT = 0xa184ff;
const DARK = 0x16121f;
const COIN = 0x9fdc2c;

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

type Mats = ReturnType<typeof makeMaterials>;

function makeMaterials() {
  return {
    violet: new THREE.MeshPhysicalMaterial({
      color: VIOLET, metalness: 0.45, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: new THREE.Color(VIOLET), emissiveIntensity: 0.06,
    }),
    violetLight: new THREE.MeshPhysicalMaterial({
      color: VIOLET_LIGHT, metalness: 0.4, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06,
    }),
    lime: new THREE.MeshPhysicalMaterial({
      color: LIME, metalness: 0.1, roughness: 0.3, clearcoat: 1,
      emissive: new THREE.Color(LIME), emissiveIntensity: 0.45,
    }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xece9f7, metalness: 1, roughness: 0.16 }),
    white: new THREE.MeshPhysicalMaterial({ color: 0xf2f0f8, metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ color: DARK, metalness: 0.3, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.2,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  };
}

/** Cara de moneda: blanca (se tiñe con el color del material) con aro y "$" en relieve. */
function coinTexture() {
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

/** Halo radial (lima → violeta → transparente) para el fondo. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(205,252,74,0.55)");
  grd.addColorStop(0.35, "rgba(131,87,245,0.28)");
  grd.addColorStop(1, "rgba(131,87,245,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function coinMesh(r: number, faceTex: THREE.Texture, seg = 40) {
  // verde lima más saturado que el de UI: con tone mapping el lima puro se lava a blanco
  const side = new THREE.MeshPhysicalMaterial({
    color: COIN, metalness: 0.45, roughness: 0.4, envMapIntensity: 0.55,
    emissive: new THREE.Color(COIN), emissiveIntensity: 0.05,
  });
  const face = new THREE.MeshPhysicalMaterial({
    color: COIN, map: faceTex, metalness: 0.4, roughness: 0.42, envMapIntensity: 0.55,
    emissive: new THREE.Color(COIN), emissiveIntensity: 0.03,
  });
  const geo = new THREE.CylinderGeometry(r, r, r * 0.22, seg);
  return new THREE.Mesh(geo, [side, face, face]);
}

type Built = { group: THREE.Group; tick: (t: number) => void };

function buildVault(m: Mats, lite: boolean): Built {
  const group = new THREE.Group();
  const seg = lite ? 3 : 5;
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.55, 1.2, seg, 0.16), m.violet);
  group.add(body);
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.16, 1.2, 0.14, seg, 0.08), m.violetLight);
  door.position.z = 0.6;
  group.add(door);
  // bisagras
  for (const y of [0.36, -0.36]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 20), m.chrome);
    h.position.set(-0.62, y, 0.64);
    group.add(h);
  }
  // perilla: disco cromado, aro lima y manija de tres rayos
  const dial = new THREE.Group();
  dial.position.set(0.04, 0.02, 0.7);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 48), m.chrome);
  disc.rotation.x = Math.PI / 2;
  dial.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 16, 64), m.lime);
  ring.position.z = 0.05;
  dial.add(ring);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 32), m.dark);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.06;
  dial.add(hub);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 12), m.chrome);
    spoke.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.14);
    spoke.rotation.z = a - Math.PI / 2;
    dial.add(spoke);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), m.lime);
    knob.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.14);
    dial.add(knob);
  }
  group.add(dial);
  // patas
  for (const x of [-0.55, 0.55]) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.12, 0.9, 2, 0.04), m.dark);
    f.position.set(x, -0.82, 0);
    group.add(f);
  }
  group.rotation.y = -0.38;
  return {
    group,
    // la perilla "marca la combinación": va y viene
    tick: (t) => {
      dial.rotation.z = Math.sin(t * 0.9) * 1.2 + Math.sin(t * 2.3) * 0.15;
    },
  };
}

function buildPadlock(m: Mats, lite: boolean): Built {
  const group = new THREE.Group();
  const seg = lite ? 3 : 5;
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.36, 1.1, 0.55, seg, 0.18), m.violet);
  body.position.y = -0.38;
  group.add(body);
  const band = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.1, 0.57, 2, 0.04), m.lime);
  band.position.y = -0.74;
  group.add(band);
  // arco: medio toro + dos patas
  const shackle = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 24, lite ? 48 : 72, Math.PI), m.chrome);
  arc.position.y = 0.38;
  shackle.add(arc);
  for (const x of [-0.42, 0.42]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.56, 24), m.chrome);
    leg.position.set(x, 0.1, 0);
    shackle.add(leg);
  }
  group.add(shackle);
  // cerradura
  const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 12, 40), m.lime);
  kRing.position.set(0, -0.3, 0.28);
  group.add(kRing);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), m.dark);
  hole.position.set(0, -0.27, 0.281);
  group.add(hole);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.16), m.dark);
  slot.position.set(0, -0.37, 0.281);
  group.add(slot);
  group.rotation.y = -0.3;
  group.position.y = 0.06;
  return {
    group,
    // el arco se abre (sube) y vuelve a cerrar con un pequeño rebote
    tick: (t) => {
      const c = (t % 4) / 4;
      const open = c < 0.5 ? easeOut(clamp01(c / 0.25)) : 1 - easeOutBack(clamp01((c - 0.5) / 0.25));
      shackle.position.y = Math.max(-0.02, open) * 0.24;
      shackle.rotation.y = Math.max(0, open) * 0.5;
    },
  };
}

function buildHourglass(m: Mats, lite: boolean): Built {
  const group = new THREE.Group();
  const inner = new THREE.Group(); // lo que gira al voltear
  group.add(inner);
  const H = 0.9; // media altura del vidrio
  for (const y of [H + 0.1, -H - 0.1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.14, 48), m.violet);
    cap.position.y = y;
    inner.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 12, 64), m.lime);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + (y > 0 ? -0.07 : 0.07);
    inner.add(rim);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2 * H + 0.1, 16), m.chrome);
    rod.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
    inner.add(rod);
  }
  // vidrio: perfil de dos bulbos unidos por un cuello
  const prof: THREE.Vector2[] = [];
  const steps = lite ? 24 : 40;
  const radius = (y: number) => 0.07 + 0.45 * Math.pow(Math.sin((Math.abs(y) / H) * (Math.PI / 2)), 0.7);
  for (let i = 0; i <= steps; i++) {
    const y = -H + (2 * H * i) / steps;
    prof.push(new THREE.Vector2(radius(y), y));
  }
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, lite ? 32 : 48), m.glass);
  glass.renderOrder = 2;
  inner.add(glass);
  // arena: cono arriba (se vacía) y montículo abajo (se llena)
  const sandTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.05, 0.62, 32, 1, false), m.lime);
  inner.add(sandTop);
  const sandBot = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.5, 32), m.lime);
  inner.add(sandBot);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, H, 8), m.lime);
  stream.position.y = -H / 2;
  inner.add(stream);
  // granos que caen por el cuello
  const G = lite ? 18 : 30;
  const grains = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 6, 6), m.lime, G);
  inner.add(grains);
  const dummy = new THREE.Object3D();
  const DUR = 5.5; // vaciado
  const FLIP = 0.9; // volteo
  return {
    group,
    tick: (t) => {
      const c = t % (DUR + FLIP);
      const p = Math.min(1, c / DUR); // 0 lleno arriba → 1 lleno abajo
      // arriba: el cono baja y se angosta
      const top = 1 - p;
      sandTop.visible = top > 0.02;
      sandTop.scale.set(0.35 + 0.65 * top, Math.max(0.001, top), 0.35 + 0.65 * top);
      sandTop.position.y = 0.1 + 0.31 * top;
      // abajo: el montículo crece
      sandBot.scale.set(0.3 + 0.7 * p, Math.max(0.001, p), 0.3 + 0.7 * p);
      sandBot.position.y = -H + 0.25 * p;
      const flowing = p < 1;
      stream.visible = flowing;
      for (let i = 0; i < G; i++) {
        const k = ((t * 0.9 + i / G) % 1);
        dummy.position.set(Math.sin(i * 12.9) * 0.02, -k * (H - 0.2 * p), Math.cos(i * 7.3) * 0.02);
        dummy.scale.setScalar(flowing ? 1 : 0);
        dummy.updateMatrix();
        grains.setMatrixAt(i, dummy.matrix);
      }
      grains.instanceMatrix.needsUpdate = true;
      // volteo: al terminar se da la vuelta; al final del giro se reinicia (es simétrico)
      inner.rotation.z = c > DUR ? easeInOut((c - DUR) / FLIP) * Math.PI : 0;
    },
  };
}

function buildSuitcase(m: Mats, lite: boolean): Built {
  const group = new THREE.Group();
  const seg = lite ? 3 : 5;
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.2, 0.62, seg, 0.16), m.white);
  group.add(body);
  // costuras horizontales
  for (const y of [0.32, -0.32]) {
    const r = new THREE.Mesh(new RoundedBoxGeometry(1.71, 0.035, 0.63, 2, 0.015), m.violetLight);
    r.position.y = y;
    group.add(r);
  }
  // correas lima
  for (const x of [-0.45, 0.45]) {
    const s = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.24, 0.66, 2, 0.04), m.lime);
    s.position.x = x;
    group.add(s);
    const buckle = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.16, 0.06, 2, 0.02), m.chrome);
    buckle.position.set(x, -0.05, 0.34);
    group.add(buckle);
  }
  // asa
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 16, 40, Math.PI), m.violet);
  handle.position.y = 0.62;
  group.add(handle);
  for (const x of [-0.24, 0.24]) {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.06, 0.18, 2, 0.02), m.violet);
    base.position.set(x, 0.62, 0);
    group.add(base);
  }
  // etiqueta colgando
  const tag = new THREE.Group();
  tag.position.set(0.86, 0.42, 0.18);
  const card = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.03, 2, 0.02), m.violet);
  card.position.set(0.12, -0.22, 0);
  tag.add(card);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), m.lime);
  cord.position.set(0.05, -0.1, 0);
  cord.rotation.z = 0.5;
  tag.add(cord);
  group.add(tag);
  // ruedas
  for (const x of [-0.62, 0.62]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 20), m.dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, -0.66, 0.18);
    group.add(w);
  }
  group.rotation.y = -0.42;
  return {
    group,
    // saltito y la etiqueta se balancea
    tick: (t) => {
      const c = (t % 2.6) / 2.6;
      const hop = c < 0.3 ? Math.sin((c / 0.3) * Math.PI) : 0;
      group.position.y = hop * 0.12;
      group.rotation.z = hop * 0.04;
      tag.rotation.z = Math.sin(t * 2.4) * 0.25 - hop * 0.3;
    },
  };
}

function buildCoins(m: Mats, faceTex: THREE.Texture): Built {
  const group = new THREE.Group();
  // pila violeta/lima detrás
  for (let i = 0; i < 6; i++) {
    const c = coinMesh(0.42, faceTex, 40);
    c.position.set(-0.32 + Math.sin(i * 1.7) * 0.03, -0.75 + i * 0.1, -0.2);
    c.rotation.y = i * 0.6;
    if (i % 2) (c.material as THREE.MeshPhysicalMaterial[])[0] = m.violet;
    group.add(c);
  }
  // moneda grande al frente que gira
  const big = coinMesh(0.62, faceTex, 56);
  big.rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  holder.position.set(0.25, 0.15, 0.3);
  holder.add(big);
  group.add(holder);
  return {
    group,
    tick: (t) => {
      holder.rotation.y = t * 1.6;
      holder.position.y = 0.15 + Math.sin(t * 1.8) * 0.06;
    },
  };
}

export default function Object3D({
  kind,
  burst = false,
  className,
  style,
}: {
  kind: ObjectKind;
  /** Las monedas salen disparadas del centro al montar (celebración). */
  burst?: boolean;
  className?: string;
  style?: React.CSSProperties;
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
      return; // sin WebGL: queda el halo CSS del contenedor
    }
    const lite = window.matchMedia("(max-width: 880px), (pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rimV = new THREE.PointLight(VIOLET, 16, 12);
    rimV.position.set(-3, -1, -1.5);
    scene.add(rimV);
    const rimL = new THREE.PointLight(LIME, 12, 12);
    rimL.position.set(3, 2, -1);
    scene.add(rimL);

    const mats = makeMaterials();
    const faceTex = coinTexture();
    const gTex = glowTexture();

    // halo + aros de neón detrás del objeto
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      new THREE.MeshBasicMaterial({ map: gTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.position.z = -1.4;
    scene.add(halo);
    const rings = new THREE.Group();
    rings.position.z = -0.9;
    const ringMat = (c: number, o: number) =>
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.012, 8, 128), ringMat(LIME, 0.75));
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.008, 8, 128), ringMat(VIOLET_LIGHT, 0.6));
    r2.rotation.x = 0.5;
    rings.add(r1, r2);
    scene.add(rings);

    const built =
      kind === "vault" ? buildVault(mats, lite)
      : kind === "padlock" ? buildPadlock(mats, lite)
      : kind === "hourglass" ? buildHourglass(mats, lite)
      : kind === "suitcase" ? buildSuitcase(mats, lite)
      : buildCoins(mats, faceTex);
    const rig = new THREE.Group(); // rig = entrada + flotado; built.group = animación propia
    rig.add(built.group);
    scene.add(rig);

    // monedas orbitando
    const NC = kind === "coins" ? 0 : lite ? 5 : 7;
    const orbit = new THREE.Group();
    const coins: { mesh: THREE.Mesh; ang: number; rad: number; y: number; spin: number; delay: number }[] = [];
    for (let i = 0; i < NC; i++) {
      const mesh = coinMesh(0.15, faceTex, 28);
      const c = { mesh, ang: (i / NC) * Math.PI * 2 + 0.4, rad: 1.35 + (i % 3) * 0.14, y: ((i * 37) % 7) / 7 - 0.5, spin: 0.8 + (i % 4) * 0.35, delay: i * 0.05 };
      coins.push(c);
      orbit.add(mesh);
    }
    scene.add(orbit);

    // partículas tenues
    const NP = lite ? 70 : 120;
    const pPos = new Float32Array(NP * 3);
    const pCol = new Float32Array(NP * 3);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cL = new THREE.Color(LIME);
    const cV = new THREE.Color(VIOLET_LIGHT);
    for (let i = 0; i < NP; i++) {
      const r = 1.2 + rnd() * 1.1;
      const th = rnd() * Math.PI * 2;
      pPos.set([Math.cos(th) * r, (rnd() - 0.5) * 2.4, Math.sin(th) * r * 0.5 - 0.4], i * 3);
      const c = rnd() > 0.5 ? cL : cV;
      pCol.set([c.r, c.g, c.b], i * 3);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scene.add(points);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // encuadre: radio ~1.85 (objeto + monedas) visible en el lado más corto
      const fov = (camera.fov * Math.PI) / 180;
      const fitH = 1.85 / Math.tan(fov / 2);
      const fitW = 1.85 / (Math.tan(fov / 2) * camera.aspect);
      camera.position.set(0, 0.15, Math.max(fitH, fitW));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(host);

    const pose = (t: number) => {
      // entrada: pop con giro
      const intro = easeOutBack(clamp01(t / 0.8));
      rig.scale.setScalar(Math.max(0.001, intro));
      rig.rotation.y = (1 - easeOut(clamp01(t / 1.1))) * -1.4 + Math.sin(t * 0.6) * 0.18;
      rig.position.y = Math.sin(t * 1.2) * 0.06;
      built.tick(t);
      rings.rotation.z = t * 0.15;
      r2.rotation.y = Math.sin(t * 0.4) * 0.4;
      points.rotation.y = t * 0.04;
      for (const c of coins) {
        // burst: salen del centro a su órbita; si no, ya están en órbita
        const k = burst ? easeOut(clamp01((t - 0.25 - c.delay) / 0.9)) : 1;
        const a = c.ang + t * 0.35;
        const rad = c.rad * k;
        c.mesh.position.set(Math.cos(a) * rad, c.y * k + Math.sin(t * 1.3 + c.ang) * 0.08, Math.sin(a) * rad * 0.55);
        c.mesh.scale.setScalar(Math.max(0.001, burst ? clamp01(k * 1.4) : 1));
        c.mesh.rotation.set(Math.PI / 2 + Math.sin(t + c.ang) * 0.5, t * c.spin, 0);
      }
    };

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      pose(clock.getElapsedTime());
      renderer.render(scene, camera);
    };

    function dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.InstancedMesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => mt.dispose());
        }
      });
      faceTex.dispose();
      gTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }

    if (reduced) {
      // cuadro fijo, ya "asentado"
      pose(2.2);
      renderer.render(scene, camera);
      ro.disconnect();
      const ro2 = new ResizeObserver(() => {
        resize();
        renderer.render(scene, camera);
      });
      ro2.observe(host);
      return () => {
        ro2.disconnect();
        io.disconnect();
        dispose();
      };
    }
    frame();
    return () => {
      ro.disconnect();
      io.disconnect();
      dispose();
    };
  }, [kind, burst]);

  return <div ref={hostRef} className={className} style={style} aria-hidden />;
}
