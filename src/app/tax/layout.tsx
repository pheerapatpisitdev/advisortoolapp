import { SalesTheme } from "@/components/sales/SalesTheme";

export default function TaxLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
