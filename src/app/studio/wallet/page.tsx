import type { Metadata } from "next";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { allowanceOf } from "@/lib/auth/quota";
import { walletEntries, walletSettings, walletStatus } from "@/lib/wallet/store";
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
  if (can(viewer, "owner")) {
    return <p className="text-sm text-[var(--ct-mute)]">เจ้าของระบบใช้ AI ใน Studio ได้โดยไม่ต้องเติมเงินครับ</p>;
  }
  const [settings, wallet, entries, allowance] = await Promise.all([
    walletSettings().catch(() => ({ enabled: false, multiplier: 2 })),
    walletStatus(viewer.agentId).catch(() => ({ satang: 0, frozen: false })),
    walletEntries(viewer.agentId).catch(() => []),
    allowanceOf(viewer),
  ]);
  return (
    <WalletClient
      enabled={settings.enabled}
      multiplier={settings.multiplier}
      balanceSatang={wallet.satang}
      frozen={wallet.frozen}
      entries={entries}
      rounds={{ used: allowance.used, limit: allowance.limit ?? 0 }}
      paid={typeof paid === "string" ? paid : null}
    />
  );
}
