/* UTONOMA — datos mock + helpers de formato */

export const FMT = (n: number, dec = 2) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export interface Alloc { key: string; nm: string; vl: number; color: string; }
export interface Vault {
  id: string; nm: string; bal: number; goal: number; apy: number; color: string;
  locked: boolean; note: string;
}
/** Tipo de movimiento → define color del icono (no solo el icono en sí).
   pos = entrada · vault = abono/retiro de bóveda · swap = intercambio FX ·
   advance = adelanto de liquidez · neutral = salida/gasto. */
export type TxnTint = "pos" | "vault" | "swap" | "advance" | "neutral";

export interface Txn {
  id: number; nm: string; su: string; amt: number; ic: string; pos?: boolean;
  cur?: string; sub?: string | null; tint?: TxnTint;
  /** Campos extra para movimientos on-chain */
  hash?: string; fromAddr?: string; toAddr?: string; blockNumber?: string;
}

export const ALLOC: Alloc[] = [
  { key: "pesos", nm: "Pesos digitales", vl: 48250.4, color: "var(--accent)" },
  { key: "bovedas", nm: "Bóveda de retiro", vl: 95400.0, color: "var(--accent-2)" },
];

export const VAULTS: Vault[] = [
  { id: "emg", nm: "Fondo de emergencia", bal: 35000, goal: 50000, apy: 9.0, color: "var(--accent)", locked: false, note: "Disponible al instante" },
  { id: "jpn", nm: "Viaje a Japón", bal: 18400, goal: 40000, apy: 10.5, color: "var(--accent-2)", locked: true, note: "Bloqueada · 8 meses" },
  { id: "dpt", nm: "Enganche depa", bal: 42000, goal: 300000, apy: 11.2, color: "#5BD6C0", locked: true, note: "Bloqueada · 24 meses" },
];

/* Un ejemplo de cada tipo de movimiento (icono + color propio):
   recibido · abono a bóveda · intercambio · enviado · adelanto · rendimiento. */
export const TXNS: Txn[] = [
  { id: 1, nm: "Dinero recibido", su: "SPEI de Mariana G.", amt: +2500.0, ic: "in", pos: true, tint: "pos" },
  { id: 2, nm: "Abono a bóveda", su: "Fondo de emergencia", amt: -1500.0, ic: "vault", tint: "vault" },
  { id: 3, nm: "Intercambio", su: "MXN → USD", amt: +128.5, cur: "USD", pos: true, ic: "swap", tint: "swap" },
  { id: 4, nm: "Dinero enviado", su: "A Carlos M.", amt: -850.0, ic: "send", tint: "neutral" },
  { id: 5, nm: "Adelanto de liquidez", su: "Sobre tu bóveda", amt: +3200.0, ic: "bolt", pos: true, tint: "advance" },
  { id: 6, nm: "Rendimiento diario", su: "Bóveda · 9% anual", amt: +12.4, ic: "leaf", pos: true, tint: "pos" },
];

export const CARD_TXNS: Txn[] = [
  { id: 1, nm: "Uber", su: "Ciudad de México", amt: -148.0, cur: "MXN", sub: null, ic: "car" },
  { id: 2, nm: "Amazon", su: "Compra internacional", amt: -24.99, cur: "USD", sub: "$428.13 MXN", ic: "bag" },
  { id: 3, nm: "Starbucks", su: "Polanco", amt: -92.0, cur: "MXN", sub: null, ic: "cup" },
  { id: 4, nm: "Booking.com", su: "Reserva · São Paulo", amt: -320.0, cur: "BRL", sub: "$1,113.60 MXN", ic: "bed" },
];

export const NET_WORTH = ALLOC.reduce((s, a) => s + a.vl, 0);

/* ============================================================
   AHORRO A LARGO PLAZO — planes de bóveda / AFORE
   ============================================================ */

export type RiskLevel = "Bajo" | "Medio" | "Alto";

/** Plan de ahorro que define el perfil de una bóveda. El `apy` es único por
   plan: así derivamos el plan de una bóveda guardada sin tocar el schema. */
export interface AllocationSlice {
  label: string;
  pct: number;   // 0–100, suma debe ser 100
  color: string;
  apy: number;   // rendimiento individual estimado
}

export interface VaultPlan {
  id: string;
  name: string;
  tagline: string;
  risk: RiskLevel;
  exposure: string;      // a qué está expuesto el ahorro
  apy: number;           // rendimiento esperado anual (único por plan)
  horizon: string;       // horizonte recomendado
  structured: string;    // descripción del producto / beneficio
  color: string;
  emoji: string;
  featured?: boolean;
  riskProfile?: boolean; // true = perfil de riesgo del cuestionario; false/undefined = producto (AFORE)
  blend?: string;        // mezcla de instrumentos soberanos diversificados
  allocation?: AllocationSlice[];
  /** Riel que respalda la bóveda (detalle interno, nunca visible al usuario).
     "etherfuse" = bonos soberanos tokenizados vía Etherfuse (requiere KYC). */
  backend?: "etherfuse" | "defi";
  /** Exige verificación de identidad antes de abrir/fondear esta bóveda. */
  kycGated?: boolean;
}

/* Los 4 perfiles de riesgo del MVP (riskProfile: true) + el producto AFORE
   destacado aparte. Cada `apy` es único → planByApy() deriva el plan sin schema. */
export const VAULT_PLANS: VaultPlan[] = [
  {
    id: "afore",
    name: "Mi Retiro (AFORE)",
    tagline: "Ahorra para tu pensión",
    risk: "Medio",
    exposure: "Deuda soberana global diversificada",
    blend: "Deuda soberana de varios países",
    apy: 10.5,
    horizon: "Para el retiro · acceso a los 65",
    structured: "Aportaciones deducibles de impuestos. Tu pensión, en tus manos, sin las comisiones de una Afore tradicional.",
    color: "var(--accent-2)",
    emoji: "🏦",
    featured: true,
    allocation: [
      { label: "CETES (México)",     pct: 35, color: "#5BD6C0", apy: 9.0 },
      { label: "T-Bills (EE.UU.)",   pct: 35, color: "#7C9EFF", apy: 6.5 },
      { label: "Bonos Europa",        pct: 30, color: "#F5A623", apy: 4.5 },
    ],
  },
  {
    id: "conservador",
    name: "Conservador",
    tagline: "Protege tu capital",
    risk: "Bajo",
    exposure: "100% deuda soberana de corto plazo",
    blend: "Deuda soberana de corto plazo",
    apy: 8.0,
    horizon: "0 a 3 años",
    structured: "Tu capital protegido con rendimiento estable y predecible. Para metas cercanas.",
    color: "#5BD6C0",
    emoji: "🛡️",
    riskProfile: true,
    // Riel soberano respaldado por Etherfuse (bonos tokenizados). Interno.
    backend: "etherfuse",
    kycGated: true,
    allocation: [
      { label: "CETES (México)",   pct: 60, color: "#5BD6C0", apy: 9.0 },
      { label: "T-Bills (EE.UU.)", pct: 40, color: "#7C9EFF", apy: 6.5 },
    ],
  },
  {
    id: "moderado",
    name: "Moderado",
    tagline: "Crece con prudencia",
    risk: "Bajo",
    exposure: "Deuda soberana diversificada por país",
    blend: "Deuda soberana diversificada",
    apy: 9.5,
    horizon: "3 a 7 años",
    structured: "Diversificas entre gobiernos para crecer un poco más, manteniendo bajo el riesgo.",
    color: "#5BD6C0",
    emoji: "🧭",
    riskProfile: true,
    allocation: [
      { label: "CETES (México)",   pct: 40, color: "#5BD6C0", apy: 9.0 },
      { label: "T-Bills (EE.UU.)", pct: 30, color: "#7C9EFF", apy: 6.5 },
      { label: "Bonos Europa",      pct: 30, color: "#F5A623", apy: 4.5 },
    ],
  },
  {
    id: "balanceado",
    name: "Balanceado",
    tagline: "Equilibrio seguridad y crecimiento",
    risk: "Medio",
    exposure: "Deuda soberana + algo de renta variable",
    blend: "Deuda soberana + índices",
    apy: 11.5,
    horizon: "7 a 15 años",
    structured: "El equilibrio entre seguridad y crecimiento para tu futuro de mediano plazo.",
    color: "var(--accent)",
    emoji: "📊",
    riskProfile: true,
    allocation: [
      { label: "CETES (México)",    pct: 40, color: "#5BD6C0", apy: 9.0 },
      { label: "T-Bills (EE.UU.)",  pct: 30, color: "#7C9EFF", apy: 6.5 },
      { label: "Índices globales",   pct: 30, color: "#B07EFF", apy: 18.0 },
    ],
  },
  {
    id: "crecimiento",
    name: "Crecimiento",
    tagline: "Máximo rendimiento a largo plazo",
    risk: "Alto",
    exposure: "Mayor exposición a renta variable global",
    blend: "Índices globales + tecnología",
    apy: 14.0,
    horizon: "15+ años",
    structured: "Máxima exposición a mercados para horizontes largos. El tiempo trabaja a tu favor.",
    color: "#F5A623",
    emoji: "📈",
    riskProfile: true,
    allocation: [
      { label: "Índices globales",   pct: 45, color: "#B07EFF", apy: 18.0 },
      { label: "Tecnología EE.UU.",  pct: 35, color: "#F5A623", apy: 22.0 },
      { label: "Deuda soberana",     pct: 20, color: "#7C9EFF", apy: 7.5  },
    ],
  },
];

/** Solo los 4 perfiles de riesgo (excluye el producto AFORE), en orden de riesgo. */
export const RISK_PROFILES: VaultPlan[] = VAULT_PLANS.filter((p) => p.riskProfile);

export const planByApy = (apy: number): VaultPlan =>
  VAULT_PLANS.find((p) => Math.abs(p.apy - apy) < 0.01) ?? VAULT_PLANS[0];

export const planById = (id: string): VaultPlan =>
  VAULT_PLANS.find((p) => p.id === id) ?? VAULT_PLANS[0];

/** Proyección de saldo futuro con aportación mensual y rendimiento anual. */
export function projectSavings(current: number, monthly: number, apy: number, years: number): number {
  const r = apy / 100 / 12;
  const n = years * 12;
  const fvCurrent = current * Math.pow(1 + r, n);
  const fvContrib = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return fvCurrent + fvContrib;
}

/* ----- Comparativo vs AFORE tradicional ----- */

/** Comisión anual sobre saldo de una Afore (Profuturo: 0.54%). Se cobra sobre
   TODO el saldo cada año, así que su costo compuesto a 30 años es enorme. */
export const AFORE_COMMISSION = 0.54;
/** Comisión de SEYF sobre el saldo: 0%. (El modelo de negocio es spread, no saldo.) */
export const SEYF_COMMISSION = 0;
/** Tasa de referencia de un préstamo sobre pensión/nómina (Profuturo: 16–40% + IVA). */
export const AFORE_LOAN_RATE = 35;

export interface AforeVsSeyf { years: number; afore: number; seyf: number; feesCost: number; }

/** Mismo rendimiento bruto para ambos: la ÚNICA diferencia es la comisión sobre
   saldo. `feesCost` = cuánto te cuesta esa comisión (diferencia de saldo final). */
export function aforeVsSeyf(
  current: number,
  monthly: number,
  grossApy: number,
  horizons: number[] = [10, 20, 30],
): AforeVsSeyf[] {
  return horizons.map((years) => {
    const seyf = projectSavings(current, monthly, grossApy - SEYF_COMMISSION, years);
    const afore = projectSavings(current, monthly, grossApy - AFORE_COMMISSION, years);
    return { years, afore, seyf, feesCost: seyf - afore };
  });
}

/* ----- Adelanto de liquidez sobre rendimientos futuros ----- */

/** Monto que puedes adelantar sin vender posiciones: hasta los próximos 12 meses
   de rendimiento proyectado de tu ahorro. Liquidez inmediata, tu capital sigue creciendo. */
export function liquidityAdvance(saved: number, apy: number): number {
  return saved * (apy / 100);
}

/* ----- Cuestionario de perfil de riesgo ----- */

export interface QuizOption { label: string; sub?: string; score: number }
export interface QuizQuestion { id: string; q: string; emoji: string; options: QuizOption[] }

/** 5 preguntas → puntaje 5–20 que mapea a uno de los 4 perfiles de riesgo. */
export const RISK_QUESTIONS: QuizQuestion[] = [
  {
    id: "age",
    q: "¿Cuántos años tienes?",
    emoji: "🧑",
    options: [
      { label: "18 – 29 años", sub: "Máximo horizonte de crecimiento", score: 4 },
      { label: "30 – 40 años", sub: "Todavía tienes mucho tiempo", score: 3 },
      { label: "41 – 50 años", sub: "Horizonte balanceado", score: 2 },
      { label: "51 años o más", sub: "Priorizo preservar lo acumulado", score: 1 },
    ],
  },
  {
    id: "retirement",
    q: "¿A qué edad te quieres retirar?",
    emoji: "🏖️",
    options: [
      { label: "A los 70 años o después", sub: "Tiempo extra para crecer", score: 4 },
      { label: "A los 65 años", sub: "La edad tradicional", score: 3 },
      { label: "A los 60 años", sub: "Un poco antes", score: 2 },
      { label: "Antes de los 55 años", sub: "Retiro anticipado", score: 1 },
    ],
  },
  {
    id: "tolerance",
    q: "Si tu ahorro bajara 10% en un mes, ¿qué harías?",
    emoji: "🎢",
    options: [
      { label: "Retiraría todo de inmediato", sub: "No tolero ver pérdidas", score: 1 },
      { label: "Me preocuparía, pero esperaría", sub: "Esperaría a que se recupere", score: 2 },
      { label: "Lo dejaría sin tocarlo", sub: "Sé que el mercado se recupera", score: 3 },
      { label: "Aportaría más para aprovechar", sub: "Las caídas son oportunidades", score: 4 },
    ],
  },
  {
    id: "goal",
    q: "¿Qué buscas principalmente?",
    emoji: "🎯",
    options: [
      { label: "Proteger lo que tengo", sub: "Que no pierda valor", score: 1 },
      { label: "Crecer de forma estable", sub: "Sin grandes sobresaltos", score: 2 },
      { label: "Equilibrio riesgo–rendimiento", sub: "Un poco de ambos", score: 3 },
      { label: "El mayor crecimiento posible", sub: "Acepto la volatilidad", score: 4 },
    ],
  },
  {
    id: "emergency",
    q: "¿Tienes un fondo de emergencia?",
    emoji: "🛟",
    options: [
      { label: "Sí, cubro más de 6 meses", sub: "Estoy bien protegido", score: 4 },
      { label: "Sí, cubro 3 a 6 meses", sub: "Tengo un colchón razonable", score: 3 },
      { label: "Algo tengo, menos de 3 meses", sub: "Lo estoy construyendo", score: 2 },
      { label: "No tengo fondo de emergencia", sub: "Prefiero ser conservador", score: 1 },
    ],
  },
];

/** Mapea el puntaje total del cuestionario (5–20) a un perfil de riesgo. */
export function recommendPlan(totalScore: number): VaultPlan {
  if (totalScore <= 8)  return planById("conservador");
  if (totalScore <= 12) return planById("moderado");
  if (totalScore <= 16) return planById("balanceado");
  return planById("crecimiento");
}

/* Persistencia del perfil de riesgo.
   - localStorage: lectura síncrona rápida (UI).
   - Supabase (via store): persiste entre dispositivos cuando el usuario está autenticado. */
const RISK_KEY = "seyf_risk_profile";

export function saveRiskProfile(planId: string, address?: string) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(RISK_KEY, planId); } catch {}
  }
  if (address) {
    // Fire-and-forget: no bloquea la UI.
    import("@/lib/store").then(({ store }) => void store.setRiskProfile(address, planId));
  }
}

export function loadRiskProfile(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(RISK_KEY); } catch { return null; }
}

/** Carga el risk_profile desde Supabase y lo siembra en localStorage si no estaba. */
export async function syncRiskProfile(address: string): Promise<string | null> {
  const { store } = await import("@/lib/store");
  const remote = await store.getRiskProfile(address);
  if (remote && !loadRiskProfile()) {
    try { window.localStorage.setItem(RISK_KEY, remote); } catch {}
  }
  return remote ?? loadRiskProfile();
}

