import type { Metadata } from "next";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { allowanceOf } from "@/lib/auth/quota";
import { creditLotsOf, creditOf } from "@/lib/members/credit";
import { freeVideosLeft } from "@/lib/quote-video/rows";
import { walletEntries, walletPrices, walletSettings, walletStatus } from "@/lib/wallet/store";
import { PriceList } from "./PriceList";
import { memberAccess, passOpen } from "@/lib/members/access";
import { WalletClient } from "./WalletClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงิน | Studio" };

/**
 * An agent's wallet: what is in it (a member's pass credit apart, 2026-10-17), the free rounds left, the five top-ups, and what it was
 * spent on (owner, 2026-09-30). Every read has a fallback, so the page opens, empty, before the
 * wallet's tables exist. The owner has no wallet: they use AI without paying; assistants have one
 * as any agent (owner, 2026-10-02). A wallet a refund or
 * a dispute froze says so, and to contact the office (owner, 2026-10-01).
 */
export default async function WalletPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const viewer = await gatePage("/studio/wallet");
  const { paid } = await searchParams;
  const prices = await walletPrices();
  if (can(viewer, "owner")) {
    // the owner pays nothing, but sees the list the agents see (owner, 2026-10-12)
    const settings = await walletSettings().catch(() => ({ enabled: false, multiplier: 2 }));
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <p className="text-sm text-[var(--ct-mute)]">เจ้าของระบบใช้ AI ใน Studio ได้โดยไม่ต้องเติมเงินครับ ด้านล่างคือราคาที่ตัวแทนเห็น แก้ได้ที่หลังบ้าน › กระเป๋าเงินตัวแทน</p>
        <PriceList prices={prices} multiplier={settings.multiplier} />
      </div>
    );
  }
  // read first: it writes a UnitClub agent's starter credit the first time (owner, 2026-10-18)
  const wallet = await walletStatus(viewer.agentId).catch(() => ({ satang: 0, own: 0, credit: 0, frozen: false }));
  const [settings, entries, allowance, videosLeft, lots] = await Promise.all([
    walletSettings().catch(() => ({ enabled: false, multiplier: 2 })),
    walletEntries(viewer.agentId).catch(() => []),
    allowanceOf(viewer),
    freeVideosLeft(viewer).catch(() => null),
    // a member's pass credit (owner, 2026-10-17) or a UnitClub agent's starter credit (2026-10-18)
    creditLotsOf(viewer.agentId).catch(() => null),
  ]);
  // a member whose pass ran out renews before topping up (owner chose 5ก, 2026-10-18); unreadable shows the buttons, the action checks again
  const access = await memberAccess(viewer).catch(() => null);
  const passEnded = access ? !passOpen(access) : false;
  // with no free rounds left to give (a member's pass, a UnitClub agent), the credit is shown instead
  const credit = lots && allowance.limit === 0
    ? { name: viewer.kind === "member" ? "เครดิตสมาชิก" : "เครดิตเริ่มต้น UnitClub", own: wallet.own, satang: wallet.credit, expiresAt: creditOf(lots, new Date()).expiresAt, lots }
    : null;
  return (
    <WalletClient
      enabled={settings.enabled}
      multiplier={settings.multiplier}
      balanceSatang={wallet.satang}
      frozen={wallet.frozen}
      passEnded={passEnded}
      creditUnread={lots === null && allowance.limit === 0}
      entries={entries}
      rounds={{ used: allowance.used, limit: allowance.limit ?? 0 }}
      videos={videosLeft}
      prices={prices}
      credit={credit}
      paid={typeof paid === "string" ? paid : null}
    />
  );
}
