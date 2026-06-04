/* UTONOMA — datos mock + helpers de formato */

export const FMT = (n: number, dec = 2) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export interface Alloc { key: string; nm: string; vl: number; color: string; }
export interface Vault {
  id: string; nm: string; bal: number; goal: number; apy: number; color: string;
  locked: boolean; note: string;
}
export interface Txn {
  id: number; nm: string; su: string; amt: number; ic: string; pos?: boolean;
  cur?: string; sub?: string | null;
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

export const TXNS: Txn[] = [
  { id: 1, nm: "Rendimiento diario", su: "Pesos digitales · 9% anual", amt: +12.4, ic: "leaf", pos: true },
  { id: 2, nm: "Transferencia SPEI", su: "De Mariana G.", amt: +2500.0, ic: "in", pos: true },
  { id: 3, nm: "OXXO", su: "Hoy · 14:20", amt: -85.0, ic: "bag" },
  { id: 4, nm: "Spotify", su: "Suscripción", amt: -129.0, ic: "music" },
  { id: 5, nm: "Recarga de saldo", su: "Tarjeta ··4821", amt: +5000.0, ic: "in", pos: true },
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
    blend: "CETES · Treasuries · Tesouro · KTB",
    apy: 10.5,
    horizon: "Para el retiro · acceso a los 65",
    structured: "Aportaciones deducibles de impuestos. Tu pensión, en tus manos, sin las comisiones de una Afore tradicional.",
    color: "var(--accent-2)",
    emoji: "🏦",
    featured: true,
  },
  {
    id: "conservador",
    name: "Conservador",
    tagline: "Protege tu capital",
    risk: "Bajo",
    exposure: "100% deuda soberana de corto plazo",
    blend: "CETES · US Treasuries",
    apy: 8.0,
    horizon: "0 a 3 años",
    structured: "Tu capital protegido con rendimiento estable y predecible. Para metas cercanas.",
    color: "#5BD6C0",
    emoji: "🛡️",
    riskProfile: true,
  },
  {
    id: "moderado",
    name: "Moderado",
    tagline: "Crece con prudencia",
    risk: "Bajo",
    exposure: "Deuda soberana diversificada por país",
    blend: "CETES · Treasuries · KTB",
    apy: 9.5,
    horizon: "3 a 7 años",
    structured: "Diversificas entre gobiernos para crecer un poco más, manteniendo bajo el riesgo.",
    color: "#5BD6C0",
    emoji: "🧭",
    riskProfile: true,
  },
  {
    id: "balanceado",
    name: "Balanceado",
    tagline: "Equilibrio seguridad y crecimiento",
    risk: "Medio",
    exposure: "Deuda soberana + algo de renta variable",
    blend: "CETES · Tesouro · Treasuries · índices",
    apy: 11.5,
    horizon: "7 a 15 años",
    structured: "El equilibrio entre seguridad y crecimiento para tu futuro de mediano plazo.",
    color: "var(--accent)",
    emoji: "📊",
    riskProfile: true,
  },
  {
    id: "crecimiento",
    name: "Crecimiento",
    tagline: "Máximo rendimiento a largo plazo",
    risk: "Alto",
    exposure: "Mayor exposición a renta variable global",
    blend: "Tesouro · índices globales · tecnología",
    apy: 14.0,
    horizon: "15+ años",
    structured: "Máxima exposición a mercados para horizontes largos. El tiempo trabaja a tu favor.",
    color: "#F5A623",
    emoji: "📈",
    riskProfile: true,
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
/** Comisión de Reyf sobre el saldo: 0%. (El modelo de negocio es spread, no saldo.) */
export const SEYF_COMMISSION = 0;
/** Tasa de referencia de un préstamo sobre pensión/nómina (Profuturo: 16–40% + IVA). */
export const AFORE_LOAN_RATE = 35;

export interface AforeVsReyf { years: number; afore: number; reyf: number; feesCost: number; }

/** Mismo rendimiento bruto para ambos: la ÚNICA diferencia es la comisión sobre
   saldo. `feesCost` = cuánto te cuesta esa comisión (diferencia de saldo final). */
export function aforeVsReyf(
  current: number,
  monthly: number,
  grossApy: number,
  horizons: number[] = [10, 20, 30],
): AforeVsReyf[] {
  return horizons.map((years) => {
    const reyf = projectSavings(current, monthly, grossApy - SEYF_COMMISSION, years);
    const afore = projectSavings(current, monthly, grossApy - AFORE_COMMISSION, years);
    return { years, afore, reyf, feesCost: reyf - afore };
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

/** 3 preguntas → puntaje 3–12 que mapea a uno de los 4 perfiles de riesgo. */
export const RISK_QUESTIONS: QuizQuestion[] = [
  {
    id: "horizon",
    q: "¿Cuándo crees que usarás este dinero?",
    emoji: "⏳",
    options: [
      { label: "En menos de 3 años", sub: "Una meta cercana", score: 1 },
      { label: "Entre 3 y 7 años", sub: "Mediano plazo", score: 2 },
      { label: "Entre 7 y 15 años", sub: "Largo plazo", score: 3 },
      { label: "En más de 15 años", sub: "Para mi retiro", score: 4 },
    ],
  },
  {
    id: "tolerance",
    q: "Si tu ahorro bajara 10% en un mes, ¿qué harías?",
    emoji: "🎢",
    options: [
      { label: "Retiraría todo", sub: "No tolero pérdidas", score: 1 },
      { label: "Me preocuparía, pero esperaría", score: 2 },
      { label: "Lo dejaría tranquilo", sub: "Sé que se recupera", score: 3 },
      { label: "Aprovecharía para aportar más", score: 4 },
    ],
  },
  {
    id: "goal",
    q: "¿Qué buscas sobre todo?",
    emoji: "🎯",
    options: [
      { label: "Proteger mi capital", score: 1 },
      { label: "Crecer de forma estable", score: 2 },
      { label: "Equilibrio entre ambos", score: 3 },
      { label: "El mayor crecimiento posible", score: 4 },
    ],
  },
];

/** Mapea el puntaje total del cuestionario (3–12) a un perfil de riesgo. */
export function recommendPlan(totalScore: number): VaultPlan {
  if (totalScore <= 4) return planById("conservador");
  if (totalScore <= 7) return planById("moderado");
  if (totalScore <= 10) return planById("balanceado");
  return planById("crecimiento");
}

/* Persistencia ligera del perfil recomendado (cliente). */
const RISK_KEY = "reyf_risk_profile";

export function saveRiskProfile(planId: string) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(RISK_KEY, planId); } catch {}
  }
}

export function loadRiskProfile(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(RISK_KEY); } catch { return null; }
}

