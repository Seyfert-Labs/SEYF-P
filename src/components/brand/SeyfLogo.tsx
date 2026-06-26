/* Marca SEYF — logos del brand kit servidos desde /public/brand.
   Símbolo: barra violeta + "R" lima con flecha ascendente.
   Paleta: lima #CDFC4A, violeta #8357F5, dark #0A0912. */
import React from "react";

type ImgProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
};

/** Símbolo solo (transparente). Para chips con fondo propio, watermarks. */
export function SeyfSymbol({ size = 28, className, style, alt = "SEYF" }: ImgProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/seyf-symbol.svg"
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

/** App icon: símbolo sobre cuadrado dark con esquinas redondeadas. */
export function SeyfMark({ size = 56, className, style, alt = "SEYF" }: ImgProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/seyf-appicon.svg"
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

/** Logo horizontal (símbolo + wordmark "SEYF"). `light` para fondos claros. */
export function SeyfWordmark({
  height = 32,
  light = false,
  className,
  style,
  alt = "SEYF",
}: Omit<ImgProps, "size"> & { height?: number; light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={light ? "/brand/seyf-horizontal-light.svg" : "/brand/seyf-horizontal-dark.svg"}
      height={height}
      alt={alt}
      className={className}
      style={{ display: "block", height, width: "auto", ...style }}
    />
  );
}
