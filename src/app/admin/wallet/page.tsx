import type { Metadata } from "next";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { monthStart } from "@/lib/ai/ledger";
import { frozenWallets, walletPrices, walletSettings, walletSummary } from "@/lib/wallet/store";
import { WalletAdmin } from "./WalletAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงินตัวแทน | AdvisorTool" };

export default async function AdminWalletPage() {
  const viewer = await gatePage("/admin/wallet", "admin");
  const [settings, rows, frozen, prices] = await Promise.all([
    walletSettings().catch((e) => {
      console.error("wallet settings unreadable:", e);
      return null;
    }),
    walletSummary(monthStart()).catch((e) => {
      console.error("wallet summary unreadable:", e);
      return null;
    }),
    // wallets a refund or a dispute froze (owner, 2026-10-01); null before that migration is applied
    frozenWallets().catch((e) => {
      console.error("frozen wallets unreadable:", e);
      return null;
    }),
    // never throws: the defaults when the column is not there yet
    walletPrices(),
  ]);
  return <WalletAdmin settings={settings} rows={rows} frozen={frozen} prices={prices} canPrice={can(viewer, "owner")} />;
}
