/* UTONOMA — tipos de navegación compartidos */

export type Screen =
  | "home" | "wallet" | "bovedas" | "boveda"
  | "card" | "convertir" | "cambio"
  | "perfil" | "notifs" | "txn" | "recompensas" | "kyc" | "activo";

/** Navega a una pantalla, opcionalmente con contexto (bono/bóveda/txn seleccionado). */
export type Go = (screen: Screen, ctx?: unknown) => void;
