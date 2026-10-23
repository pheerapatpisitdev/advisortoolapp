import type { Metadata } from "next";
import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { monthStart } from "@/lib/ai/ledger";
import { frozenWallets, walletSettings, walletSummary } from "@/lib/wallet/store";
import { PageHead } from "../ui";
import { TopupsPanel } from "../topups/TopupsPanel";
import { WalletAdmin } from "./WalletAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงิน | AdvisorTool" };

/**
 * กระเป๋าเงิน: the switch, every wallet's line, and the frozen ones. Its prices, the members'
 * pass and ชวนเพื่อน moved to /admin/prices on 2026-10-15 (owner chose ข). The day-by-day
 * history of money in joined it as a second tab on 2026-10-23 (owner chose ก, mockup
 * https://claude.ai/artifact/1MZqF78ZXVU64Pv5wPzh2u); it used to be its own page, /admin/topups.
 */
const TABS = [
  { key: "wallets", label: "กระเป๋าของตัวแทน", href: "/admin/wallet" },
  { key: "topups", label: "ประวัติเติมเงิน", href: "/admin/wallet?tab=topups" },
] as const;

export default async function AdminWalletPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/wallet", "backoffice");
  const sp = await searchParams;
  const tab = sp.tab === "topups" ? "topups" : "wallets";
  return (
    <>
      <PageHead title="กระเป๋าเงิน" hint="เปิดปิดกระเป๋า ยอดเติมและคงเหลือของแต่ละคน กระเป๋าที่ถูกพัก และประวัติเติมเงินรายวัน" />
      <nav aria-label="มุมมอง" className="mb-4 flex gap-0.5 overflow-x-auto border-b border-[var(--bot-line)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm no-underline ${t.key === tab
              ? "border-[var(--bot-navy)] font-semibold text-[var(--bot-ink)]"
              : "border-transparent text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink-foot)]"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "topups" ? <TopupsPanel sp={sp} /> : <Wallets />}
    </>
  );
}

async function Wallets() {
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
  return <WalletAdmin settings={settings} rows={rows} frozen={frozen} />;
}
