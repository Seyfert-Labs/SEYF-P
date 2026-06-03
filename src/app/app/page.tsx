import type { Metadata } from "next";
import ReyfApp from "@/components/app/ReyfApp";

export const metadata: Metadata = {
  title: "Reyf — App",
};

export default function AppPage() {
  return <ReyfApp />;
}
