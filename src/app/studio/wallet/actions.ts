"use server";
import { requireMember } from "@/lib/auth/viewer";
import { siteOrigin } from "@/lib/site-url";
import { stripe } from "@/lib/stripe/client";
import { checkoutParams } from "@/lib/wallet/checkout";
import { isTopUpThb, toSatang } from "@/lib/wallet/money";
import { balanceSatang, openTopUp, topUpState, walletFrozen, walletSettings, type TopUpStatus } from "@/lib/wallet/store";

/**
 * Starting a top-up and asking how it went. The money is added only by Stripe's webhook
 * (src/app/api/stripe/webhook/route.ts); the page coming back from Stripe only reads.
 */

export type StartResult = { ok: true; url: string } | { ok: false; error: string };

export async function startTopUp(thb: unknown): Promise<StartResult> {
  const viewer = await requireMember();
  if (viewer.staff) return { ok: false, error: "ทีมงานใช้ AI ได้โดยไม่ต้องเติมเงินครับ" };
  // only the five amounts on the page; a number sent by hand is not a price
  if (!isTopUpThb(thb)) return { ok: false, error: "เลือกยอดเติมจากปุ่มบนหน้านี้นะครับ" };
  const settings = await walletSettings().catch(() => null);
  if (!settings?.enabled) return { ok: false, error: "ตอนนี้ยังเติมเงินไม่ได้ครับ" };
  // a wallet a refund or a dispute froze takes no new money until the owner lifts it (owner, 2026-10-01)
  if (await walletFrozen(viewer.agentId)) return { ok: false, error: "กระเป๋าเงินถูกพักไว้ชั่วคราว — ติดต่อสำนักงานนะครับ" };
  try {
    const session = await stripe().checkout.sessions.create(checkoutParams({ agentId: viewer.agentId, thb, origin: siteOrigin() }));
    if (!session.url) throw new Error(`session ${session.id} has no url`);
    await openTopUp(session.id, viewer.agentId, toSatang(thb));
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("top-up start failed:", e);
    return { ok: false, error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export async function topUpStatus(sessionId: string): Promise<{ status: TopUpStatus | null; balanceSatang: number }> {
  const viewer = await requireMember();
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return { status: null, balanceSatang: 0 };
  const [status, balance] = await Promise.all([topUpState(sessionId, viewer.agentId), balanceSatang(viewer.agentId)]);
  return { status, balanceSatang: balance };
}
