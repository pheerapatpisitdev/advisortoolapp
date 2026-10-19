import { alertClipFailed } from "@/lib/line/owner-alert";
import { isPromptStory } from "@/lib/prompt-story/types";
import { siteUrl } from "@/lib/site-url";
import { topicOf } from "@/lib/story/topics";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isFhcInput } from "./fhc";
import type { Product } from "./script";
import { isStoryInput } from "./story";

/**
 * The owner's LINE told the moment a clip fails (owner chose ก ก, 2026-10-19; mockup
 * https://claude.ai/artifact/GR5tJgN4VsT9jc5533VThz): one message for every clip, the owner's
 * own too — who made it, which tool, why it failed and what was given back.
 */

const NAMES: Record<Product, string> = { LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", PENSION: "บำนาญ 95", LEGACY: "มรดก", PLB: "Protection Life" };

/** the tool and the clip, as the owner knows them on the board */
export function clipWhat(input: unknown): string {
  const v = (input && typeof input === "object" ? input : {}) as { product?: string; style?: string; topic?: string; title?: string };
  if (isFhcInput(v)) return "วิดีโอนำเสนอ · สรุป FHC";
  if (isStoryInput(v)) return `คลิปเล่าเรื่อง · ${topicOf(String(v.topic ?? ""))?.name ?? "ไม่ทราบตอน"}`;
  if (isPromptStory(v)) return `คลิปตามโจทย์ · ${String(v.title ?? "").trim() || "ไม่มีชื่อ"}`;
  const plan = NAMES[(v.product ?? "LIFEPROTECT") as Product] ?? v.product;
  return `วิดีโอนำเสนอ · ${plan}${v.style === "motion" ? " (Motion)" : ""}`;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export interface FailedClip {
  /** the tool and the clip (clipWhat) */
  what: string;
  /** "คุณวิภาวรรณ (ตัวแทน 015872)" */
  who: string;
  at: string;
  reason: string;
  paidBy: "staff" | "free" | "wallet" | null;
  /** what the clip held from the wallet, given back */
  heldSatang: number | null;
  /** a finished clip whose scene was being drawn again: the clip stands, the redraw's money goes back */
  recut?: { satang: number } | null;
  link: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", {
  timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

/** what was given back, in a line */
function refund(c: FailedClip): string {
  if (c.recut) return c.recut.satang > 0 ? `คลิปเดิมยังอยู่ · คืนค่าวาดฉาก ${baht(c.recut.satang)} แล้ว` : "คลิปเดิมยังอยู่";
  const held = Number(c.heldSatang ?? 0);
  if (c.paidBy === "staff") return "ทำในชื่อแอดมิน ไม่ได้ตัดเงิน";
  if (c.paidBy === "free") return held > 0 ? `คืนสิทธิ์คลิปฟรี และคืนค่ารูป ${baht(held)} แล้ว` : "คืนสิทธิ์คลิปฟรีแล้ว";
  return held > 0 ? `คืนเงินแล้ว ${baht(held)} เข้ากระเป๋า` : "ไม่ได้ตัดเงิน";
}

/** The alert's words for one failed clip. */
export function clipFailedText(c: FailedClip): string {
  return [
    c.recut ? "⚠️ แก้ฉากไม่สำเร็จ" : "⚠️ คลิปไม่สำเร็จ",
    c.what,
    c.who,
    `${when(c.at)} น.`,
    `เหตุ: ${c.reason}`,
    refund(c),
    c.link,
  ].join("\n");
}

/** "คุณวิภาวรรณ (ตัวแทน 015872)", "คุณสมศรี (สมาชิกทั่วไป)" or, read from nowhere, the id */
async function whoMade(id: string): Promise<string> {
  const db = supabaseAdmin();
  const title = (name: string) => (name.startsWith("คุณ") ? name : `คุณ${name}`);
  const { data: a } = await db.from("agents").select("name, agent_code").eq("id", id).maybeSingle();
  if (a) {
    const r = a as { name: string | null; agent_code: string | null };
    const name = (r.name ?? "").trim();
    return name ? `${title(name)}${r.agent_code ? ` (ตัวแทน ${r.agent_code})` : ""}` : `ตัวแทน ${r.agent_code ?? id}`;
  }
  const { data: m } = await db.from("ins_members").select("name, email").eq("id", id).maybeSingle();
  if (m) {
    const r = m as { name: string | null; email: string | null };
    const name = (r.name ?? "").trim();
    return `${name ? title(name) : r.email ?? id} (สมาชิกทั่วไป)`;
  }
  return id;
}

/**
 * Sends the owner the message for a clip that has just failed. Never throws: called after the row
 * is marked failed and its money given back, so nothing it does can undo that.
 */
export async function tellOwnerClipFailed(row: {
  id: string; agent_id: string; input: unknown; paid_by: FailedClip["paidBy"]; held_satang: number | null;
  fail_reason: string; error: string | null; recut?: { satang: number } | null;
}): Promise<void> {
  try {
    const who = await whoMade(row.agent_id).catch(() => row.agent_id);
    await alertClipFailed(clipFailedText({
      what: clipWhat(row.input),
      who,
      at: new Date().toISOString(),
      reason: row.fail_reason || row.error || "ไม่ทราบสาเหตุ",
      paidBy: row.paid_by,
      heldSatang: row.held_satang,
      recut: row.recut ?? null,
      link: siteUrl(`/admin/history/${row.agent_id}`),
    }));
  } catch (e) {
    console.error(`[line] clip ${row.id} failed alert not sent:`, e);
  }
}
