# Reyf — Brand Kit (base-set)

Base-set del logo de Reyf **vectorizado a partir del PNG original** (trazado
fiel a los píxeles, no redibujado a mano). Símbolo: barra violeta + "R" lima con
flecha ascendente. Wordmark "Reyf" convertido a curvas.

> Generado vectorizando `reyf-logo-original.png` con un trazador de contornos
> propio (Pillow + scikit-image + clustering K-means de color). Los SVG
> reproducen la geometría real del logo.

## Archivos

| Archivo | Uso |
|---------|-----|
| `00-reyf-traced-raw.svg` | Trazado maestro completo (logo tal cual, sobre fondo). Fuente del resto. |
| `01-reyf-horizontal-dark.svg` | Logo principal sobre fondo oscuro. Web header, README, slides. |
| `02-reyf-horizontal-light.svg` | Logo sobre fondo claro (wordmark en oscuro). |
| `03-reyf-stacked-dark.svg` | Versión apilada (símbolo arriba, nombre abajo). Espacios cuadrados. |
| `04-reyf-symbol.svg` | Solo el símbolo (R + barra), fondo transparente. Favicon, watermark. |
| `05-reyf-appicon.svg` | App icon con fondo oscuro y esquinas redondeadas. App Store / Play Store. |
| `06-reyf-mono-white.svg` | Monocromático blanco (todo a un tono). Fondos oscuros, fotos. |
| `07-reyf-mono-black.svg` | Monocromático negro. Fondos claros, impresión a un tono, grabado. |
| `08-reyf-favicon.svg` | Favicon compacto sobre cuadrado de marca (16–32 px). |
| `preview.html` | Vista previa de todo el kit. Ábrelo en el navegador. |

## Paleta (extraída del propio logo)

| Color | Hex | Uso |
|-------|-----|-----|
| Lima | `#CDFC4A` | La "R" y la flecha (crecimiento, rendimiento). |
| Violeta | `#8357F5` | Barra / tallo (ahorro, estabilidad). |
| Fondo | `#0A0912` | Dark de marca. |
| Blanco | `#FDFDFD` | Wordmark sobre oscuro. |

## Tipografía

- El wordmark **ya está convertido a curvas (paths)** dentro de los SVG, así que
  se ve idéntico en cualquier equipo **sin depender de ninguna fuente instalada**.
- Si necesitas escribir textos de marca a juego, la familia más cercana al
  wordmark es una sans-serif geométrica redondeada (tipo **Poppins** / Montserrat).

## Concepto

- **Barra violeta** = lo que guardas (ahorro, base, estabilidad).
- **"R" lima con flecha hacia arriba-derecha** = crecimiento y rendimiento.
- Juntos forman la **"R"** de Reyf y, a la vez, una flecha ascendente: tu dinero
  creciendo.

## Reglas de uso

- **Zona de protección:** deja al menos el ancho de la barra violeta de aire
  alrededor del logo.
- **Tamaño mínimo:** horizontal ≥ 120 px de ancho; símbolo solo ≥ 24 px (por
  debajo usa `08-reyf-favicon.svg`).
- **No** estirar/comprimir, **no** alterar la relación de color (violeta=barra,
  lima=R/flecha), **no** agregar sombras ni efectos, **no** rotar el símbolo.

## Reproducir / re-generar

Los scripts `vectorize.py` (traza el PNG → `00-...raw.svg`) y `generate_kit.py`
(deriva el resto del kit) quedaron en `logo-propuestas/` por si quieres re-correr
el proceso con otro PNG fuente.
