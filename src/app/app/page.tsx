import type { Metadata } from "next";
import UtonomaApp from "@/components/app/UtonomaApp";

export const metadata: Metadata = {
  title: "Utonoma — App",
};

export default function AppPage() {
  return <UtonomaApp />;
}
