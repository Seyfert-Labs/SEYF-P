// Activos soportados en "Convertir", mapeados a books reales de Bitso (vs MXN).
// MXN ≡ MXNB (peso digital) es la base. Nota: en Bitso (stage) no hay `usdc_mxn`;
// el dólar-stablecoin disponible contra MXN es USDT (y DAI/TUSD/PYUSD).

export interface BitsoAsset {
  code: string;   // identificador en la UI
  name: string;   // nombre legible
  flag: string | null; // bandera (o null = peso/cripto)
  book?: string;  // book de Bitso vs MXN (ausente para MXN)
  dec: number;    // decimales a mostrar
}

export const BITSO_ASSETS: BitsoAsset[] = [
  { code: "MXN", name: "Peso digital (MXNB)", flag: null, dec: 2 },
  { code: "USDT", name: "Dólar digital (USDT)", flag: "us", book: "usdt_mxn", dec: 2 },
  { code: "USD", name: "Dólar (USD)", flag: "us", book: "usd_mxn", dec: 2 },
  { code: "DAI", name: "Dólar DAI", flag: "us", book: "dai_mxn", dec: 2 },
  { code: "EUR", name: "Euro", flag: "eu", book: "eur_mxn", dec: 2 },
  { code: "BRL", name: "Real brasileño", flag: "br", book: "brl_mxn", dec: 2 },
];

export const BITSO_BOOKS = BITSO_ASSETS.filter((a) => a.book).map((a) => a.book!);

export const assetByCode = (code: string) => BITSO_ASSETS.find((a) => a.code === code);

export interface BitsoRate { book: string; last: number; bid: number; ask: number }
