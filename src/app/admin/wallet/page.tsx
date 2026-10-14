import type { Metadata } from "next";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { monthStart } from "@/lib/ai/ledger";
import { passSettings } from "@/lib/members/pass-store";
import { referralReport, referralSettings } from "@/lib/referrals/store";
import { frozenWallets, walletPrices, walletSettings, walletSummary } from "@/lib/wallet/store";
import { WalletAdmin } from "./WalletAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงินตัวแทน | AdvisorTool" };

export default async function AdminWalletPage() {
  const viewer = await gatePage("/admin/wallet", "backoffice");
  const [settings, rows, frozen, prices, pass, referral, report] = await Promise.all([
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
    // the outside members' 30-day pass (owner, 2026-10-13); null before 20261027_member_pass
    passSettings().catch((e) => {
      console.error("member pass settings unreadable:", e);
      return null;
    }),
    // เพื่อนชวนเพื่อน (owner, 2026-10-14); null before 20261103_referrals
    referralSettings().catch((e) => {
      console.error("referral settings unreadable:", e);
      return null;
    }),
    referralReport().catch((e) => {
      console.error("referral report unreadable:", e);
      return null;
    }),
  ]);
  return (
    <WalletAdmin settings={settings} rows={rows} frozen={frozen} prices={prices} pass={pass}
                 referral={referral} report={report} canPrice={can(viewer, "backoffice")} />
  );
}
