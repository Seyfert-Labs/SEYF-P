"use client";

/* Carga diferida de los objetos 3D (three.js solo baja cuando se muestra uno).
   Mientras carga, o sin WebGL, queda un halo lima/violeta del mismo tamaño:
   no hay salto de layout. */
import dynamic from "next/dynamic";
import type React from "react";
import type { ObjectKind } from "./Object3D";

export type { ObjectKind };

const halo: React.CSSProperties = {
  background: "radial-gradient(closest-side, rgba(205,252,74,.22), rgba(131,87,245,.12) 55%, transparent 75%)",
};

const Object3D = dynamic(() => import("./Object3D"), {
  ssr: false,
  loading: () => <div style={{ width: "100%", height: "100%", ...halo }} />,
});

export function Seyf3D({
  kind,
  size = 160,
  burst,
  style,
  className,
}: {
  kind: ObjectKind;
  /** Lado en px (cuadrado) o cualquier valor CSS. */
  size?: number | string;
  burst?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={className} style={{ width: size, height: size, flexShrink: 0, ...halo, ...style }} aria-hidden>
      <Object3D kind={kind} burst={burst} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
