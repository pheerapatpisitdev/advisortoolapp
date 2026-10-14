import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { monthStart } from "@/lib/ai/ledger";
import { frozenWallets, walletSettings, walletSummary } from "@/lib/wallet/store";
import { PageHead } from "../ui";
import { WalletAdmin } from "./WalletAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงิน | AdvisorTool" };

/**
 * กระเป๋าเงิน: the switch, every wallet's line, and the frozen ones. Its prices, the members'
 * pass and ชวนเพื่อน moved to /admin/prices on 2026-10-15 (owner chose ข).
 */
export default async function AdminWalletPage() {
  await gatePage("/admin/wallet", "backoffice");
  const [settings, rows, frozen] = await Promise.all([
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
  ]);
  return (
    <>
      <PageHead title="กระเป๋าเงิน" hint="เปิดปิดกระเป๋า ยอดเติมและคงเหลือของแต่ละคน และกระเป๋าที่ถูกพัก" />
      <WalletAdmin settings={settings} rows={rows} frozen={frozen} />
    </>
  );
}
