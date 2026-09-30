import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { allowanceOf } from "@/lib/auth/quota";
import { balanceSatang, walletEntries, walletSettings } from "@/lib/wallet/store";
import { WalletClient } from "./WalletClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "กระเป๋าเงิน | Studio" };

/**
 * An agent's wallet: what is in it, the free rounds left, the five top-ups, and what it was
 * spent on (owner, 2026-09-30). Every read has a fallback, so the page opens, empty, before the
 * wallet's tables exist. Staff have no wallet: they use AI without paying.
 */
export default async function WalletPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const viewer = await gatePage("/studio/wallet");
  const { paid } = await searchParams;
  if (viewer.staff) {
    return <p className="text-sm text-[var(--ct-mute)]">ทีมงานใช้ AI ใน Studio ได้โดยไม่ต้องเติมเงินครับ</p>;
  }
  const [settings, balance, entries, allowance] = await Promise.all([
    walletSettings().catch(() => ({ enabled: false, multiplier: 2 })),
    balanceSatang(viewer.agentId).catch(() => 0),
    walletEntries(viewer.agentId).catch(() => []),
    allowanceOf(viewer),
  ]);
  return (
    <WalletClient
      enabled={settings.enabled}
      multiplier={settings.multiplier}
      balanceSatang={balance}
      entries={entries}
      rounds={{ used: allowance.used, limit: allowance.limit ?? 0 }}
      paid={typeof paid === "string" ? paid : null}
    />
  );
}
