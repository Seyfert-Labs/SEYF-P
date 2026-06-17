"use client";

import React from "react";

/** Agrega separadores de miles al entero, preservando los decimales que se escriben. */
export function formatWithCommas(raw: string): string {
  if (raw === "") return "";
  let s = raw.replace(/[^\d.]/g, "");
  // un solo punto decimal
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  const hasDot = s.includes(".");
  const [intPart = "", decPart = ""] = s.split(".");
  const intClean = intPart.replace(/^0+(?=\d)/, "");
  const intFmt = (intClean === "" ? (hasDot ? "0" : "") : intClean).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasDot ? `${intFmt || "0"}.${decPart}` : intFmt;
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Valor numérico como string SIN comas (p. ej. "1234.5"). */
  value: string;
  /** Recibe el valor numérico SIN comas. */
  onChange: (value: string) => void;
};

/**
 * Input de montos de dinero que muestra comas de miles mientras escribes, pero
 * entrega/recibe un string numérico limpio (sin comas), listo para `Number()`.
 */
export function MoneyInput({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={formatWithCommas(value)}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) onChange(raw);
      }}
    />
  );
}
