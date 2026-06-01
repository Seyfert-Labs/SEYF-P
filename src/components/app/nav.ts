/* UTONOMA — tipos de navegación compartidos */

export type Screen =
  | "home" | "wallet" | "bonos" | "bono" | "bovedas" | "boveda"
  | "card" | "perfil" | "convertir" | "cambio" | "notifs" | "txn"
  // Mercado
  | "mercado" | "producto" | "comprar" | "vender" | "altaNegocio"
  // Perfil — secciones
  | "compras" | "ventas" | "negocios" | "recompensas";

/** Navega a una pantalla, opcionalmente con contexto (bono/bóveda/txn seleccionado). */
export type Go = (screen: Screen, ctx?: unknown) => void;
