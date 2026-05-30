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
