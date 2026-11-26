import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bóveda Ship-It · testnet",
  description: "Reclama 5555 XLM de testnet con el código correcto.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
