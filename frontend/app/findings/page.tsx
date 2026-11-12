import type { Metadata } from "next";
import FindingsView from "@/components/FindingsView";

export const metadata: Metadata = { title: "Findings · Ghost Unit Radar" };

export default function Page() {
  return <FindingsView />;
}
