import { SalesTheme } from "@/components/sales/SalesTheme";

export default function PaLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
