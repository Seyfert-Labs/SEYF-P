import type { Metadata } from "next";
import SeyfApp from "@/components/app/SeyfApp";

export const metadata: Metadata = {
  title: "Seyf — App",
};

export default function AppPage() {
  return <SeyfApp />;
}
