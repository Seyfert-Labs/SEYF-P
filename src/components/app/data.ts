/* UTONOMA — datos mock + helpers de formato */

export const FMT = (n: number, dec = 2) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export interface Alloc { key: string; nm: string; vl: number; color: string; }
export interface Bond {
  id: string; country: string; flag: string; code: string; yield: number; cur: string;
  risk: string; term: string; min: number; rating: string; desc: string; series: number[];
}
export interface Vault {
  id: string; nm: string; bal: number; goal: number; apy: number; color: string;
  locked: boolean; note: string;
}
export interface Txn {
  id: number; nm: string; su: string; amt: number; ic: string; pos?: boolean;
  cur?: string; sub?: string | null;
}
export interface FxRate { code: string; nm: string; flag: string; rate: number; chg: number; }

export const ALLOC: Alloc[] = [
  { key: "pesos", nm: "Pesos digitales", vl: 48250.4, color: "var(--accent)" },
  { key: "bonos", nm: "Bonos de gobierno", vl: 312800.0, color: "var(--accent-2)" },
  { key: "bovedas", nm: "Bóvedas", vl: 95400.0, color: "#5BD6C0" },
  { key: "acciones", nm: "Acciones premium", vl: 128600.0, color: "#F5A623" },
];

export const BONDS: Bond[] = [
  { id: "mx", country: "México", flag: "mx", code: "Bonos M · CETES", yield: 10.25, cur: "MXN", risk: "Bajo", term: "28d – 10 años", min: 100, rating: "A", desc: "Deuda soberana del Gobierno de México. Tasa fija respaldada por Banxico.", series: [38, 40, 39, 42, 44, 43, 46, 48, 47, 50, 52, 55] },
  { id: "us", country: "Estados Unidos", flag: "us", code: "US Treasury Bond", yield: 4.45, cur: "USD", risk: "Muy bajo", term: "3m – 30 años", min: 50, rating: "AAA", desc: "Treasuries del gobierno de EE. UU. El activo de refugio más líquido del mundo.", series: [30, 31, 30, 32, 33, 34, 33, 35, 36, 37, 38, 40] },
  { id: "br", country: "Brasil", flag: "br", code: "Tesouro Selic", yield: 11.75, cur: "BRL", risk: "Medio", term: "1 – 6 años", min: 200, rating: "BB", desc: "Bonos del Tesouro Nacional indexados a la tasa Selic brasileña.", series: [42, 44, 43, 46, 48, 47, 49, 52, 54, 53, 56, 58] },
  { id: "kr", country: "Corea del Sur", flag: "kr", code: "Korea Treasury Bond", yield: 3.35, cur: "KRW", risk: "Muy bajo", term: "2 – 30 años", min: 80, rating: "AA", desc: "Deuda soberana surcoreana (KTB). Grado de inversión estable.", series: [28, 29, 28, 30, 29, 31, 32, 31, 33, 34, 33, 35] },
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

export const FX: FxRate[] = [
  { code: "USD", nm: "Dólar estadounidense", flag: "us", rate: 17.1252, chg: +0.18 },
  { code: "BRL", nm: "Real brasileño", flag: "br", rate: 3.482, chg: -0.42 },
  { code: "KRW", nm: "Won surcoreano", flag: "kr", rate: 0.01243, chg: +0.05 },
  { code: "EUR", nm: "Euro", flag: "eu", rate: 18.401, chg: +0.21 },
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
/** Comisión de Seyf sobre el saldo: 0%. (El modelo de negocio es spread, no saldo.) */
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
const RISK_KEY = "seyf_risk_profile";

export function saveRiskProfile(planId: string) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(RISK_KEY, planId); } catch {}
  }
}

export function loadRiskProfile(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(RISK_KEY); } catch { return null; }
}

/* ============================================================
   MERCADO — índice de precios de la Central de Abastos
   ============================================================ */

export type MarketCat = "Verdura" | "Fruta" | "Chile" | "Abarrote";

/** Producto del índice. `avg` es el precio de referencia del día (mediana
   ponderada); `seyfBase` indica que Seyf trackea ese precio de forma
   independiente cuando aún no hay suficientes registros de usuarios. */
export interface MarketProduct {
  id: string;
  name: string;
  emoji: string;
  cat: MarketCat;
  unit: string;        // "kg", "caja", "pieza", "manojo"
  avg: number;         // precio de referencia del día
  low: number;         // mínimo del rango
  high: number;        // máximo del rango
  trend: number;       // % vs ayer
  verified: number;    // registros verificados hoy
  offers: number;      // negocios que lo ofrecen
  seyfBase: boolean;   // precio establecido por Seyf (no por usuarios)
  series: number[];    // últimos días (spark)
}

/** Oferta concreta de un negocio para un producto. */
export interface MarketOffer {
  id: string;
  productId: string;
  business: string;
  location: string;
  price: number;
  available: number;   // unidades disponibles
  rating: number;
  ops: number;         // operaciones completadas
  verified: boolean;   // negocio con historial verificado
}

export const PRODUCTS: MarketProduct[] = [
  { id: "jitomate", name: "Jitomate bola", emoji: "🍅", cat: "Verdura", unit: "kg", avg: 13.5, low: 12, high: 16, trend: +4.2, verified: 47, offers: 9, seyfBase: false, series: [11, 12, 12.5, 12, 13, 13.5, 14, 13.5] },
  { id: "aguacate", name: "Aguacate Hass", emoji: "🥑", cat: "Fruta", unit: "kg", avg: 30, low: 28, high: 34, trend: -1.1, verified: 23, offers: 6, seyfBase: false, series: [33, 32, 31, 31, 30, 30, 29, 30] },
  { id: "serrano", name: "Chile serrano", emoji: "🌶️", cat: "Chile", unit: "kg", avg: 22, low: 19, high: 26, trend: +6.8, verified: 18, offers: 5, seyfBase: false, series: [18, 19, 20, 20, 21, 21, 22, 22] },
  { id: "cebolla", name: "Cebolla blanca", emoji: "🧅", cat: "Verdura", unit: "kg", avg: 16, low: 14, high: 18, trend: 0, verified: 31, offers: 7, seyfBase: false, series: [16, 16, 15.5, 16, 16, 16, 16, 16] },
  { id: "limon", name: "Limón sin semilla", emoji: "🍋", cat: "Fruta", unit: "kg", avg: 19.5, low: 17, high: 23, trend: +2.4, verified: 28, offers: 8, seyfBase: false, series: [18, 18, 19, 19, 19, 20, 19, 19.5] },
  { id: "papa", name: "Papa blanca", emoji: "🥔", cat: "Verdura", unit: "kg", avg: 17, low: 15, high: 19, trend: -0.8, verified: 14, offers: 5, seyfBase: true, series: [17.5, 17, 17, 17, 17, 17, 17, 17] },
  { id: "platano", name: "Plátano Tabasco", emoji: "🍌", cat: "Fruta", unit: "kg", avg: 14, low: 12, high: 16, trend: +1.5, verified: 12, offers: 4, seyfBase: true, series: [13.5, 14, 14, 13.5, 14, 14, 14, 14] },
  { id: "zanahoria", name: "Zanahoria", emoji: "🥕", cat: "Verdura", unit: "kg", avg: 12, low: 10, high: 14, trend: -2.3, verified: 9, offers: 3, seyfBase: true, series: [13, 12.5, 12, 12, 12, 12, 12, 12] },
];

export const OFFERS: MarketOffer[] = [
  // Jitomate
  { id: "o1", productId: "jitomate", business: "Bodega Don Memo", location: "Nave I · Pasillo 14, Local 23", price: 12.5, available: 500, rating: 4.8, ops: 89, verified: true },
  { id: "o2", productId: "jitomate", business: "Frutas y Verduras El Güero", location: "Nave I · Pasillo 9, Local 7", price: 13, available: 320, rating: 4.6, ops: 54, verified: true },
  { id: "o3", productId: "jitomate", business: "Comercializadora La Selecta", location: "Nave II · Pasillo 22, Local 41", price: 14.5, available: 1200, rating: 4.9, ops: 210, verified: true },
  { id: "o4", productId: "jitomate", business: "Don Rafa Mayoreo", location: "Nave I · Pasillo 3, Local 12", price: 15.5, available: 180, rating: 4.2, ops: 23, verified: false },
  // Aguacate
  { id: "o5", productId: "aguacate", business: "Aguacates de Michoacán", location: "Nave II · Pasillo 18, Local 5", price: 28, available: 200, rating: 4.9, ops: 156, verified: true },
  { id: "o6", productId: "aguacate", business: "Frutería La Esperanza", location: "Nave I · Pasillo 11, Local 30", price: 31, available: 90, rating: 4.5, ops: 47, verified: true },
  { id: "o7", productId: "aguacate", business: "Rancho Sinaloa", location: "Proveedor externo", price: 34, available: 600, rating: 4.7, ops: 78, verified: false },
  // Serrano
  { id: "o8", productId: "serrano", business: "Chiles Doña Lupe", location: "Nave I · Pasillo 6, Local 18", price: 19, available: 150, rating: 4.8, ops: 92, verified: true },
  { id: "o9", productId: "serrano", business: "El Picosito Mayoreo", location: "Nave II · Pasillo 20, Local 9", price: 24, available: 80, rating: 4.4, ops: 35, verified: true },
  // Cebolla
  { id: "o10", productId: "cebolla", business: "Bodega Don Memo", location: "Nave I · Pasillo 14, Local 23", price: 14, available: 400, rating: 4.8, ops: 89, verified: true },
  { id: "o11", productId: "cebolla", business: "La Surtidora del Valle", location: "Nave II · Pasillo 17, Local 2", price: 17, available: 700, rating: 4.6, ops: 61, verified: true },
  // Limón
  { id: "o12", productId: "limon", business: "Cítricos de Colima", location: "Nave II · Pasillo 19, Local 14", price: 17, available: 350, rating: 4.9, ops: 134, verified: true },
  { id: "o13", productId: "limon", business: "Frutas y Verduras El Güero", location: "Nave I · Pasillo 9, Local 7", price: 20, available: 120, rating: 4.6, ops: 54, verified: true },
];

/** Negocios destacados (semilla del marketplace). */
export const BUSINESSES = [
  { id: "b1", name: "Bodega Don Memo", product: "Jitomate bola", location: "Nave I · Pasillo 14, Local 23", rating: 4.8, ops: 89 },
  { id: "b2", name: "Aguacates de Michoacán", product: "Aguacate Hass", location: "Nave II · Pasillo 18, Local 5", rating: 4.9, ops: 156 },
  { id: "b3", name: "Chiles Doña Lupe", product: "Chile serrano", location: "Nave I · Pasillo 6, Local 18", rating: 4.8, ops: 92 },
];
