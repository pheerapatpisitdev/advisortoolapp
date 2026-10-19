import { SalesTheme } from "@/components/sales/SalesTheme";
import "./tool.css";

export default function GlobalSavingLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
