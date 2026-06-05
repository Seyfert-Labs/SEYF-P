import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Imagen de previsualización para redes/mensajería (Telegram, WhatsApp, X…).
   Se genera en build y se sirve como PNG. Usa el logo horizontal del brand kit. */
export const alt = "Reyf — Super app de finanzas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(
    join(process.cwd(), "public/brand/reyf-horizontal-dark.svg"),
    "base64",
  );
  const logoSrc = `data:image/svg+xml;base64,${logo}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0912",
          backgroundImage:
            "radial-gradient(900px 480px at 82% -8%, rgba(131,87,245,0.30), transparent 60%), radial-gradient(760px 420px at 4% 110%, rgba(205,252,74,0.16), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "30px 56px",
            borderRadius: 32,
            background: "#0A0912",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={560} alt="Reyf" />
        </div>
        <div
          style={{
            marginTop: 44,
            maxWidth: 880,
            textAlign: "center",
            fontSize: 34,
            lineHeight: 1.35,
            color: "#C9C4DC",
          }}
        >
          Pesos digitales, bonos de gobierno y bóvedas de ahorro con rendimiento
          diario.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            padding: "12px 26px",
            borderRadius: 999,
            background: "rgba(205,252,74,0.12)",
            border: "1px solid rgba(205,252,74,0.35)",
            color: "#CDFC4A",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          Tu dinero, creciendo
        </div>
      </div>
    ),
    { ...size },
  );
}
