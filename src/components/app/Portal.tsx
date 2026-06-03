"use client";

/* Renderiza children directamente en <body>, fuera del contenedor con scroll
   (.screen) y de cualquier ancestro posicionado. Así los modales (.modal-overlay
   con position: fixed) se anclan al viewport y aparecen donde está el usuario,
   no al tope del contenido scrolleado. */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
