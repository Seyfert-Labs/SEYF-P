# Utonoma — Plan de implementación (Landing en Next.js) para Claude Code

> Objetivo: portar la landing `Utonoma Landing.html` (HTML/CSS/anime.js) a una página de producción en **Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion**, conservando 1:1 el diseño (dark glassmorphism, neón lima/violeta), las animaciones (contadores, reveals, mockup flotante, tilt 3D) y el comportamiento del nav (hide-on-scroll-down / show-on-scroll-up).

---

## 0. Contexto y fuente de verdad

- El diseño de referencia vive en `Utonoma Landing.html` + `landing.css` + `landing.js`. Úsalos como **spec visual exacta** (colores, tipos, spacing, secciones, copy en español).
- Marca: tono oscuro OLED, vidrio (glassmorphism), acento **lima `#C8FF4D`** + **violeta `#8B5CF6`**, tipografías **Space Grotesk** (display/números) + **Manrope** (texto).
- Idioma de la UI: **español (MX)**. Mantener todo el copy tal cual.
- No reinventar el layout: replicar secciones en el mismo orden.

---

## 1. Stack y dependencias

```bash
npx create-next-app@latest utonoma-landing --ts --tailwind --app --eslint --src-dir --import-alias "@/*"
cd utonoma-landing
npm i framer-motion
npm i clsx
# fuentes vía next/font (no CDN) — ver paso 3
```

Decisiones:
- **App Router** (`src/app`), Server Components por defecto; los componentes con animación/scroll son `"use client"`.
- **Framer Motion** reemplaza a anime.js (entrance, stagger, float loops, tilt). Para los contadores, hook propio con `useInView` + `animate()` de Framer (no añadir react-countup).
- **Tailwind** para layout/spacing; tokens de marca como variables CSS en `globals.css` + extend en `tailwind.config.ts`.
- Sin librerías de UI extra (shadcn opcional, no necesario).

---

## 2. Estructura de archivos

```
src/
  app/
    layout.tsx            # fuentes, <body>, metadata, fondo atmosférico
    page.tsx              # ensambla las secciones en orden
    globals.css           # tokens CSS + base + utilidades glass
  components/
    Nav.tsx               # "use client" — hide/show on scroll + glass
    Hero.tsx              # headline stagger + CTAs + trust badges
    PhoneMockup.tsx       # teléfono + float-cards (mini home de la app)
    Marquee.tsx           # cinta infinita de bonos
    Stats.tsx             # 4 stats con contadores
    Bento.tsx             # grid bento de producto
    Bonds.tsx             # 4 bonos de gobierno con contadores
    CardShowcase.tsx      # tarjeta + tilt 3D + feature list
    Fx.tsx                # panel tipo de cambio (contadores)
    Partners.tsx          # ALIADOS — Bitso Business, Etherfuse, Arbitrum, SPEI
    Security.tsx          # 3 tarjetas de seguridad
    Faq.tsx               # acordeón
    FinalCta.tsx          # CTA final con glow
    Footer.tsx
    ui/
      Reveal.tsx          # wrapper de aparición on-scroll (stagger)
      Counter.tsx         # número animado (data-count → useInView)
      Flag.tsx            # banderas circulares (MX/US/BR/KR) como SVG
      StoreButtons.tsx    # botones App Store / Google Play
      Logos.tsx           # marcas SVG de aliados (swap por oficiales)
  lib/
    fonts.ts              # next/font: Space Grotesk + Manrope
    tokens.ts             # constantes JS de paleta si se necesitan en TS
  data/
    bonds.ts  fx.ts  faq.ts  nav.ts   # contenido tipado (no hardcode en JSX)
public/
  logos/                  # SVGs oficiales de aliados (ver paso 8)
```

---

## 3. Tokens de diseño (copiar EXACTO del prototipo)

En `globals.css` (`:root`), portar las variables de `landing.css`:

```css
:root{
  --bg:#08080D; --bg-2:#0C0B15;
  --surface:rgba(255,255,255,.035); --surface-2:rgba(255,255,255,.06);
  --line:rgba(255,255,255,.09); --line-2:rgba(255,255,255,.16);
  --txt:#F4F2FB; --muted:#A29CB8; --dim:#6A6582;
  --accent:#C8FF4D; --accent-2:#8B5CF6; --on-accent:#0A0A0F;
  --accent-soft:rgba(200,255,77,.13); --accent-2-soft:rgba(139,92,246,.16);
  --neg:#FF7A7A; --r:22px;
}
```

`tailwind.config.ts` → extend con estos colores (`accent`, `accent2`, `surface`, `line`, etc.) y `borderRadius.xl2: '22px'`. Fuentes vía `next/font/google` (`Space_Grotesk`, `Manrope`) expuestas como `--font-display` y `--font-sans`; **no** usar `<link>` a Google Fonts.

Clase utilitaria `.glass` (border + bg + `backdrop-blur`) para no repetir.

---

## 4. Patrones de animación (Framer Motion)

- **`<Reveal>`**: envuelve secciones/tarjetas. `whileInView={{opacity:1,y:0}}` desde `{opacity:0,y:26}`, `viewport={{once:true, margin:"-40px"}}`, soporta `delay` para stagger (índice * 0.075s). Equivale a `.reveal` + IntersectionObserver del prototipo.
- **`<Counter target decimals suffix prefix>`**: `useInView(once)` → `animate(0, target, {duration:1.5, ease:'easeOut', onUpdate})` formateando con `toLocaleString('es-MX')`. Reemplaza los `data-count`.
- **Hero**: timeline con stagger de palabras del `<h1>` (split por palabra) + entrada del teléfono.
- **Float loops**: `animate` con `repeat:Infinity, repeatType:'mirror'` para `#phone`, `.float-card`, y los blobs atmosféricos.
- **Tilt 3D de la tarjeta**: `onMouseMove` → `useMotionValue` x/y → `useTransform` a `rotateX/rotateY` con `perspective` en el contenedor.
- **Marquee**: animar `x: ['0%','-50%']` `repeat:Infinity, ease:'linear'` (track duplicado).
- **Accesibilidad**: respetar `useReducedMotion()` → desactivar loops/stagger y mostrar estados finales. Mantener `@media (prefers-reduced-motion)`.

---

## 5. Nav (hide on scroll down / show on scroll up)

`components/Nav.tsx` (`"use client"`), portar la lógica de `landing.js`:

```ts
const [hidden, setHidden] = useState(false);
const [scrolled, setScrolled] = useState(false);
const lastY = useRef(0);
useEffect(() => {
  const onScroll = () => {
    const y = window.scrollY;
    setScrolled(y > 24);
    if (y < 120) setHidden(false);
    else if (y > lastY.current + 6) setHidden(true);   // baja → oculta
    else if (y < lastY.current - 6) setHidden(false);  // sube → muestra
    lastY.current = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

- Píldora flotante glass centrada (`fixed top-3.5 left-1/2 -translate-x-1/2`).
- Transform: visible `translate(-50%,0)`, oculto `translate(-50%,-160%)`, `transition-transform duration-400`.
- `scrolled` aumenta opacidad de fondo + sombra.
- Throttle con `requestAnimationFrame`.

---

## 6. Mapa sección → componente (orden de `page.tsx`)

1. `<Nav/>`
2. `<Hero/>` (incluye `<PhoneMockup/>`, `<StoreButtons/>`, trust badges)
3. `<Marquee/>`
4. `<Stats/>` — contadores: $2.4 MMD, 850K+ usuarios, 4 países, 0 comisiones
5. `<Bento/>` (#producto) — 6 cards: pesos 9%, bonos, bóvedas, tarjeta, cambio, seguridad
6. `<Bonds/>` (#bonos) — MX 10.25 · US 4.45 · BR 11.75 · KR 3.35
7. `<CardShowcase/>` (#tarjeta) — tarjeta + tilt + multi-divisa
8. `<Fx/>` — USD/BRL/KRW + badge "Igual a Google · 0% comisión"
9. `<Partners/>` (#aliados) — **Bitso Business, Etherfuse, Arbitrum, SPEI**
10. `<Security/>` (#seguridad) — saldo asegurado, AES-256, biométrico
11. `<Faq/>`
12. `<FinalCta/>` (#descargar)
13. `<Footer/>`

Mantener el copy y los números exactamente como en el HTML de referencia.

---

## 7. Datos tipados (`src/data`)

Extraer a archivos para evitar JSX gigante. Ejemplo:

```ts
// data/bonds.ts
export const BONDS = [
  { country:'México', code:'Bonos M · CETES · MXN', flag:'mx', yield:10.25 },
  { country:'Estados Unidos', code:'US Treasury · USD', flag:'us', yield:4.45 },
  { country:'Brasil', code:'Tesouro Selic · BRL', flag:'br', yield:11.75 },
  { country:'Corea del Sur', code:'Korea Treasury · KRW', flag:'kr', yield:3.35 },
] as const;
```

Igual para `fx.ts`, `faq.ts`, `nav.ts`, `stats.ts`, `partners.ts`.

---

## 8. Aliados — logos reales (IMPORTANTE)

En el prototipo los logos de **Bitso Business, Etherfuse, Arbitrum y SPEI** son recreaciones SVG monocromáticas (placeholder legal-safe). Para producción:

1. Conseguir los **SVG oficiales** desde los brand/press kits de cada marca y colocarlos en `public/logos/` (`bitso.svg`, `etherfuse.svg`, `arbitrum.svg`, `spei.svg`).
2. Renderizarlos en un "muro" monocromático uniforme: `className="h-7 w-auto text-muted opacity-70 hover:opacity-100 hover:text-txt transition"` (usar `currentColor` si el SVG lo permite, o `<img>`/`next/image` si son a color).
3. **Verificar derechos de uso de marca** antes de publicar (cada compañía tiene lineamientos de uso de logo). Mantener la nota "Integraciones ilustrativas" hasta confirmar acuerdos/permisos.
4. Mientras tanto, `components/ui/Logos.tsx` exporta las versiones SVG del prototipo como fallback.

---

## 9. SEO / metadata / performance

- `export const metadata` en `layout.tsx`: title, description, OpenGraph, `lang="es"`, theme-color `#08080D`.
- `next/font` (self-hosted) para evitar CLS.
- Imágenes con `next/image`; el mockup del teléfono es DOM/CSS (sin imagen).
- Lighthouse objetivo: Perf ≥ 90, A11y ≥ 95. Contraste AA, focus states visibles, `aria-expanded` en FAQ, `aria-label` en botones de tienda y logos.
- Responsive verificado en 375 / 768 / 1024 / 1440 (breakpoints del prototipo).

---

## 10. Secuencia de tareas (para Claude Code)

- [ ] **T1** Crear proyecto, instalar deps, configurar fuentes (`next/font`) y tokens en `globals.css` + `tailwind.config.ts`.
- [ ] **T2** `Reveal`, `Counter`, `Flag`, `StoreButtons` (primitivas en `components/ui`).
- [ ] **T3** `Nav` con hide/show on scroll + estilo glass.
- [ ] **T4** `Hero` + `PhoneMockup` (mini-home con patrimonio, allocation, 2 filas de bonos, float-cards).
- [ ] **T5** `Marquee` + `Stats` (contadores).
- [ ] **T6** `Bento` (grid responsivo, col-span según breakpoint).
- [ ] **T7** `Bonds` (contadores) + `Fx`.
- [ ] **T8** `CardShowcase` con tilt 3D.
- [ ] **T9** `Partners` (aliados) con logos en `public/logos/`.
- [ ] **T10** `Security`, `Faq` (acordeón accesible), `FinalCta`, `Footer`.
- [ ] **T11** `prefers-reduced-motion`, a11y, metadata/SEO.
- [ ] **T12** QA responsivo (375/768/1024/1440) + Lighthouse; comparar 1:1 contra el prototipo.

---

## 11. Criterios de aceptación

1. Paridad visual con `Utonoma Landing.html` (colores, tipos, spacing, copy).
2. Contadores animan al entrar en viewport y terminan en el valor correcto.
3. Nav se oculta al bajar y reaparece al subir; siempre visible cerca del top.
4. Tilt 3D de la tarjeta y loops de flotación suaves; desactivados con reduced-motion.
5. Sección Aliados con los 4 logos, lista para intercambiar por SVG oficiales.
6. Responsive impecable en los 4 breakpoints; sin overflow horizontal.
7. Sin errores de consola; build de producción (`next build`) limpio.
```
```

---

### Notas de portabilidad rápidas
- `landing.css` → divídelo: tokens/base a `globals.css`, el resto a clases Tailwind o CSS Modules por componente.
- `landing.js` (anime.js) → no se porta literal; cada efecto tiene su equivalente Framer Motion (sección 4).
- Mantén los textos en español y los números idénticos para no romper la paridad.
