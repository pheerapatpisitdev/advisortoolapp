import type { Metadata } from "next";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { allowanceOf } from "@/lib/auth/quota";
import { freeVideosLeft } from "@/lib/quote-video/make";
import { walletEntries, walletPrices, walletSettings, walletStatus } from "@/lib/wallet/store";
import { PriceList } from "./PriceList";
import { WalletClient } from "./WalletClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงิน | Studio" };

/**
 * An agent's wallet: what is in it, the free rounds left, the five top-ups, and what it was
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
  const [settings, wallet, entries, allowance, videosLeft] = await Promise.all([
    walletSettings().catch(() => ({ enabled: false, multiplier: 2 })),
    walletStatus(viewer.agentId).catch(() => ({ satang: 0, frozen: false })),
    walletEntries(viewer.agentId).catch(() => []),
    allowanceOf(viewer),
    freeVideosLeft(viewer).catch(() => null),
  ]);
  return (
    <WalletClient
      enabled={settings.enabled}
      multiplier={settings.multiplier}
      balanceSatang={wallet.satang}
      frozen={wallet.frozen}
      entries={entries}
      rounds={{ used: allowance.used, limit: allowance.limit ?? 0 }}
      videos={videosLeft}
      prices={prices}
      paid={typeof paid === "string" ? paid : null}
    />
  );
}
