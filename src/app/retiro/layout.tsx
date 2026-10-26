import SeyfPollarProvider from "@/components/providers/SeyfPollarProvider";

/* /retiro solo usa Stellar: Pollar (que ya monta SeyfAuthBridge para la sesión
   SEP-10), sin Privy ni el WalletContext EVM de /app. */
export default function RetiroLayout({ children }: { children: React.ReactNode }) {
  return <SeyfPollarProvider>{children}</SeyfPollarProvider>;
}
