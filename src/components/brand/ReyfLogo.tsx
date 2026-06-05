/* Marca Reyf — logos del brand kit servidos desde /public/brand.
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
export function ReyfSymbol({ size = 28, className, style, alt = "Reyf" }: ImgProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/reyf-symbol.svg"
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

/** App icon: símbolo sobre cuadrado dark con esquinas redondeadas. */
export function ReyfMark({ size = 56, className, style, alt = "Reyf" }: ImgProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/reyf-appicon.svg"
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

/** Logo horizontal (símbolo + wordmark "Reyf"). `light` para fondos claros. */
export function ReyfWordmark({
  height = 32,
  light = false,
  className,
  style,
  alt = "Reyf",
}: Omit<ImgProps, "size"> & { height?: number; light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={light ? "/brand/reyf-horizontal-light.svg" : "/brand/reyf-horizontal-dark.svg"}
      height={height}
      alt={alt}
      className={className}
      style={{ display: "block", height, width: "auto", ...style }}
    />
  );
}
