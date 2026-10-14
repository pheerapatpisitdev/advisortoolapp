"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { savePassSettings } from "@/lib/members/pass-store";
import { saveReferralSettings } from "@/lib/referrals/store";
import { readAdjust, readMultiplier, readPassSettings, readPrices, readReferralSettings, readUnfreeze } from "@/lib/wallet/admin-input";
import { adjustWallet, saveWalletPrices, saveWalletSettings, unfreezeWallet } from "@/lib/wallet/store";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveWallet(enabled: boolean, multiplier: string): Promise<Result> {
  await requireStaff("backoffice");
  const m = readMultiplier(multiplier);
  if (!m.ok) return m;
  try {
    await saveWalletSettings({ enabled: enabled === true, multiplier: m.value });
  } catch (e) {
    console.error("wallet settings not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("wallet-settings", null, { enabled: enabled === true, multiplier: m.value });
  revalidatePath("/admin/wallet");
  return { ok: true };
}

/**
 * The fixed prices agents pay (owner, 2026-10-12: "ให้ผมตั้งราคา"). The owner's alone, like a
 * hand on a balance: an admin may switch the wallet, not set what things cost.
 */
export async function savePrices(raw: Record<string, string>): Promise<Result> {
  await requireStaff("backoffice");
  const p = readPrices(raw);
  if (!p.ok) return p;
  try {
    await saveWalletPrices(p.prices);
  } catch (e) {
    console.error("wallet prices not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ — ตรวจว่า migration 20261026_wallet_prices ถูก apply แล้ว" };
  }
  await audit("wallet-prices", null, p.prices);
  revalidatePath("/admin/prices");
  revalidatePath("/studio", "layout");
  return { ok: true };
}

/**
 * What outside members pay for 30 days, their free trial and their Studio rounds (owner,
 * 2026-10-13). The owner's alone, like the price list: the box is read-only for other admins.
 */
export async function saveMemberPass(raw: { enabled: boolean; baht: string; trialDays: string; rounds: string; videos: string }): Promise<Result> {
  await requireStaff("backoffice");
  const p = readPassSettings(raw);
  if (!p.ok) return p;
  try {
    await savePassSettings(p.value);
  } catch (e) {
    console.error("member pass settings not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ — ตรวจว่า migration 20261027_member_pass และ 20261104_member_pass_videos ถูก apply แล้ว" };
  }
  await audit("member-pass-settings", null, { ...p.value });
  revalidatePath("/admin/prices");
  revalidatePath("/admin/members");
  return { ok: true };
}

/**
 * เพื่อนชวนเพื่อน (owner, 2026-10-14): the switch, a member's free days and an agent's baht per
 * friend who pays, and each one's most a month. The owner's alone, like the pass's price.
 */
export async function saveReferral(raw: { enabled: boolean; days: string; daysCap: string; baht: string; bahtCap: string }): Promise<Result> {
  await requireStaff("backoffice");
  const r = readReferralSettings(raw);
  if (!r.ok) return r;
  try {
    await saveReferralSettings(r.value);
  } catch (e) {
    console.error("referral settings not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ — ตรวจว่า migration 20261103_referrals ถูก apply แล้ว" };
  }
  await audit("referral-settings", null, { ...r.value });
  revalidatePath("/admin/prices");
  return { ok: true };
}

/**
 * A hand on an agent's money is the owner's alone, though an admin may switch the wallet and
 * set its multiplier (owner, 2026-09-30).
 */
export async function adjustAgentWallet(agentId: string, baht: string, note: string): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  if (typeof agentId !== "string" || !UUID.test(agentId)) return { ok: false, error: "ไม่พบตัวแทนนี้" };
  const a = readAdjust(baht, note);
  if (!a.ok) return a;
  try {
    const balance = await adjustWallet(agentId, a.satang, a.note, viewer.agentId);
    if (balance === null) return { ok: false, error: "หักเกินยอดที่มีในกระเป๋า" };
  } catch (e) {
    console.error("wallet adjust failed:", e);
    return { ok: false, error: "ปรับยอดไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("wallet-adjust", agentId, { satang: a.satang, note: a.note });
  revalidatePath("/admin/wallet");
  return { ok: true };
}

/**
 * Lifting a freeze a refund or a dispute put on a wallet — the owner's alone, like an
 * adjustment, and with a reason (owner, 2026-10-01). The shortfall is let go with it: to collect
 * it, take it with ปรับยอด first. What was let go is in the audit line.
 */
export async function unfreezeAgentWallet(agentId: string, note: string): Promise<Result> {
  await requireStaff("backoffice");
  if (typeof agentId !== "string" || !UUID.test(agentId)) return { ok: false, error: "ไม่พบตัวแทนนี้" };
  const n = readUnfreeze(note);
  if (!n.ok) return n;
  let forgiven: number | null;
  try {
    forgiven = await unfreezeWallet(agentId, n.note);
  } catch (e) {
    console.error("wallet unfreeze failed:", e);
    return { ok: false, error: "ปลดการพักไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  if (forgiven === null) return { ok: false, error: "กระเป๋านี้ไม่ได้ถูกพักอยู่" };
  await audit("wallet-unfreeze", agentId, { note: n.note, shortfallSatang: forgiven });
  revalidatePath("/admin/wallet");
  return { ok: true };
}
