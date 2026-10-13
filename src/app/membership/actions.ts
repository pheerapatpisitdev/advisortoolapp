"use server";
import { requireMember } from "@/lib/auth/viewer";
import { PASS_UNREADABLE } from "@/lib/members/access";
import { passCheckoutParams } from "@/lib/members/pass-checkout";
import { passPaid, passSettings } from "@/lib/members/pass-store";
import { siteOrigin } from "@/lib/site-url";
import { stripe } from "@/lib/stripe/client";

/**
 * Renewing a member's 30-day pass and asking whether it went through (owner, 2026-10-13). The
 * days are added only by Stripe's webhook (src/app/api/stripe/webhook/route.ts); the page coming
 * back from Stripe only reads. Built like the wallet's top-up (src/app/studio/wallet/actions.ts).
 */

export type StartPassResult = { ok: true; url: string } | { ok: false; error: string };

export async function startPass(): Promise<StartPassResult> {
  const viewer = await requireMember();
  // UnitOS agents and staff never pay for the app itself
  if (viewer.kind !== "member") return { ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปครับ" };
  const settings = await passSettings().catch((e) => {
    console.error("pass settings unreadable:", e);
    return null;
  });
  // unreadable settings name no price: refuse rather than charge a guess
  if (!settings) return { ok: false, error: PASS_UNREADABLE };
  if (!settings.enabled) return { ok: false, error: "ตอนนี้สมาชิกใช้งานได้ฟรี ยังไม่ต้องต่ออายุครับ" };
  try {
    const session = await stripe().checkout.sessions.create(
      passCheckoutParams({ memberId: viewer.agentId, satang: settings.satang, origin: siteOrigin() }),
    );
    if (!session.url) throw new Error(`session ${session.id} has no url`);
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("pass checkout start failed:", e);
    return { ok: false, error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

/** Whether the webhook has added this member's own paid session yet. */
export async function passConfirmed(sessionId: string): Promise<boolean> {
  const viewer = await requireMember();
  // a malformed id is never looked up
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return false;
  return passPaid(sessionId, viewer.agentId);
}
