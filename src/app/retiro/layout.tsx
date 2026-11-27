import SeyfCrossmintProvider from "@/components/providers/SeyfCrossmintProvider";

export default function RetiroLayout({ children }: { children: React.ReactNode }) {
  return <SeyfCrossmintProvider>{children}</SeyfCrossmintProvider>;
}
