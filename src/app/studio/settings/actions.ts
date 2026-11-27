"use server";
import { limiter } from "@/lib/assistant/rate-limit";
import { isDemo } from "@/lib/auth/demo";
import { requireMember } from "@/lib/auth/viewer";
import type { AgentPrefs } from "@/lib/pay-prefs";
import { saveAgentPrefs } from "@/lib/pay-prefs-store";
import { sendAgentTest, setAgentNotify, startAgentLink, unlinkAgent, type AgentNotify } from "@/lib/line/agent-line";
import { lineViewFor } from "@/lib/line/agent-line-view";
import type { LineView } from "@/lib/line/link-view";
import { cleanFormLink, saveOwnFormLink, unitclubFormLink } from "@/lib/line/agent-form";

export type Result = { ok: true } | { ok: false; error: string };

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14): which instalments this agent's own quotes show, and whether
 * their tables carry the pen notes. Saved per account, so it follows them to every phone and
 * computer they sign in on. The trial account is shared, so it cannot be set.
 */
export async function saveMyPrefs(p: AgentPrefs): Promise<Result> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองตั้งค่านี้ไม่ได้" };
  if (!p || typeof p.monthly !== "boolean" || typeof p.semi !== "boolean" || typeof p.pen !== "boolean") {
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  try {
    await saveAgentPrefs(viewer.agentId, { monthly: p.monthly, semi: p.semi, pen: p.pen });
  } catch (e) {
    console.error("prefs not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true };
}

/* ── เชื่อม LINE ของฉัน (owner chose ข, 2026-11-19; src/lib/line/agent-line.ts) ─────────────────── */

const LINE_FAILED = "ทำไม่สำเร็จ ลองใหม่อีกครั้ง";

/** A fresh code and its QR, good for ten minutes. The trial account is shared, so it cannot link. */
export async function startMyLineLink(): Promise<{ ok: true; view: LineView } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองเชื่อม LINE ไม่ได้" };
  try {
    await startAgentLink(viewer.agentId);
    return { ok: true, view: await lineViewFor(viewer) };
  } catch (e) {
    console.error("line link not started:", e);
    return { ok: false, error: LINE_FAILED };
  }
}

/** Read while a code or the QR waits, so the page turns to เชื่อมแล้ว the moment LINE took it; also ตรวจอีกครั้ง. */
export async function myLine(): Promise<LineView | null> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return null;
  try {
    return await lineViewFor(viewer);
  } catch (e) {
    console.error("line link not read:", e);
    return null;
  }
}

export async function unlinkMyLine(): Promise<Result> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองเชื่อม LINE ไม่ได้" };
  try {
    await unlinkAgent(viewer.agentId);
  } catch (e) {
    console.error("line not unlinked:", e);
    return { ok: false, error: LINE_FAILED };
  }
  return { ok: true };
}

/** each test is a push from the month's 300: three in ten minutes is more than anybody checking needs */
const testAllowed = limiter(3, 10 * 60_000);

/** ส่งข้อความทดสอบ: one push to the linked LINE, so the agent sees an alert arrive. */
export async function sendMyLineTest(): Promise<Result> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองเชื่อม LINE ไม่ได้" };
  if (!testAllowed(viewer.agentId)) return { ok: false, error: "ส่งทดสอบไปหลายครั้งแล้ว รออีกสักครู่" };
  try {
    if ((await sendAgentTest(viewer.agentId)) === "unlinked") return { ok: false, error: "ยังไม่ได้เชื่อม LINE" };
  } catch (e) {
    console.error("line test not sent:", e);
    return { ok: false, error: "ส่งไม่สำเร็จ ตรวจว่าได้เพิ่ม advisortool เป็นเพื่อนแล้ว" };
  }
  return { ok: true };
}

const NOTIFY_KEYS: AgentNotify[] = ["clipDone", "clipFailed", "moneyLow"];

export async function setMyLineNotify(which: AgentNotify, on: boolean): Promise<Result> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองเชื่อม LINE ไม่ได้" };
  if (!NOTIFY_KEYS.includes(which) || typeof on !== "boolean") return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  try {
    await setAgentNotify(viewer.agentId, which, on);
  } catch (e) {
    console.error("line notify not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true };
}

/* ── ลิงก์ฟอร์มใบคำขอของฉัน (owner chose ค ก ก, 2026-11-27; src/lib/line/agent-form.ts) ─────────── */

export type FormLinkView = { own: string | null; unitclub: string | null };

/**
 * Saves the link the LINE OA sends this agent when they ask for a form. Blank, or the same link
 * as their UnitClub form, keeps nothing of their own: the UnitClub one is then used, and follows
 * it if UnitClub changes it.
 */
export async function saveMyFormLink(input: string): Promise<{ ok: true; view: FormLinkView } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองตั้งค่านี้ไม่ได้" };
  if (typeof input !== "string") return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  const clean = cleanFormLink(input);
  if (!clean.ok) return clean;
  try {
    const unitclub = await unitclubFormLink(viewer.agentId).catch((e) => {
      console.error("unitclub form link not read:", e);
      return null;
    });
    const own = clean.url && clean.url !== unitclub ? clean.url : null;
    await saveOwnFormLink(viewer.agentId, own);
    return { ok: true, view: { own, unitclub } };
  } catch (e) {
    console.error("form link not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
