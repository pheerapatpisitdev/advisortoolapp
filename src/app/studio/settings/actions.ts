"use server";
import { isDemo } from "@/lib/auth/demo";
import { requireMember } from "@/lib/auth/viewer";
import type { AgentPrefs } from "@/lib/pay-prefs";
import { saveAgentPrefs } from "@/lib/pay-prefs-store";
import { agentLine, setAgentNotify, startAgentLink, unlinkAgent, type AgentNotify } from "@/lib/line/agent-line";
import { lineViewOf, type LineView } from "@/lib/line/link-view";

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
    return { ok: true, view: lineViewOf(await agentLine(viewer.agentId)) };
  } catch (e) {
    console.error("line link not started:", e);
    return { ok: false, error: LINE_FAILED };
  }
}

/** Read while a code waits, so the page turns to เชื่อมแล้ว the moment the chat took it. */
export async function myLine(): Promise<LineView | null> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return null;
  try {
    return lineViewOf(await agentLine(viewer.agentId));
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
