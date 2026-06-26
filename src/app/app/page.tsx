import type { Metadata } from "next";
import SeyfApp from "@/components/app/SeyfApp";

export const metadata: Metadata = {
  title: "SEYF — App",
};

export default function AppPage() {
  return <SeyfApp />;
}
