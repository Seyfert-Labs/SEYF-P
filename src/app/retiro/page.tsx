import type { Metadata } from "next";
import RetiroApp from "@/components/retiro/RetiroApp";

export const metadata: Metadata = {
  title: "SEYF — Retiro",
  description: "Ahorro para el retiro en USDC sobre Stellar, con adelanto de rendimiento opcional.",
};

export default function RetiroPage() {
  return <RetiroApp />;
}
