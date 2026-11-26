import { bluewealthNames } from "@/lib/auth/bluewealth";
import { tellAgentClipDone, tellAgentClipFailed } from "@/lib/line/agent-line";
import { alertClipFailed } from "@/lib/line/owner-alert";
import { isPromptStory } from "@/lib/prompt-story/types";
import { siteUrl } from "@/lib/site-url";
import { topicOf } from "@/lib/story/topics";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { boardOf } from "./board";
import { isFhcInput } from "./fhc";
import { readRecipe, RECIPE_NAMES } from "./recipe-keys";
import type { Product } from "./script";
import { isStoryInput } from "./story";

/**
 * The owner's LINE told the moment a clip fails (owner chose ก ก, 2026-10-19; mockup
 * https://claude.ai/artifact/GR5tJgN4VsT9jc5533VThz): one message for every clip, the owner's
 * own too — who made it, which tool, why it failed and what was given back.
 */

const NAMES: Record<Product, string> = { LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", PENSION: "บำนาญ 95", LEGACY: "มรดก", PLB: "Protection Life", GSAVING: "Global Savings 15/8", TWELVEPL: "12PL", EASYPROTECT: "Easy Protect 6", LIFETREASURE: "Life Treasure", CI123: "CI 123", CANCER: "ประกันมะเร็ง", PA: "PA อุบัติเหตุ" };

/** the tool and the clip, as the owner knows them on the board */
export function clipWhat(input: unknown): string {
  const v = (input && typeof input === "object" ? input : {}) as { product?: string; style?: string; topic?: string; title?: string; recipe?: unknown; plan?: unknown; ad?: unknown };
  if (isFhcInput(v)) return "วิดีโอนำเสนอ · สรุป FHC";
  if (isStoryInput(v)) return `คลิปเล่าเรื่อง · ${topicOf(String(v.topic ?? ""))?.name ?? "ไม่ทราบตอน"}`;
  if (isPromptStory(v)) return `คลิปตามโจทย์ · ${String(v.title ?? "").trim() || "ไม่มีชื่อ"}`;
  // an ad clip is a quote clip carrying its plan: the owner reads it as วิดีโอโฆษณา (2026-11-22)
  if (boardOf(v) === "ad") return `วิดีโอโฆษณา · ${NAMES[(v.product ?? "LIFEPROTECT") as Product] ?? v.product}`;
  const plan = v.product === "GSAVING" && v.plan === "25/5" ? "Global Savings 25/5" : NAMES[(v.product ?? "LIFEPROTECT") as Product] ?? v.product;
  // a สูตรคลิป Motion clip is named by its recipe, as the board names it (owner, 2026-11-11, ก ก ก)
  const recipe = v.style === "motion" ? readRecipe(v.recipe) : undefined;
  const look = recipe ? ` (Motion · ${RECIPE_NAMES[recipe]})` : v.style === "motion" ? " (Motion)" : v.style === "chat" ? " (แชท)" : "";
  return `วิดีโอนำเสนอ · ${plan}${look}`;
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
export function refund(c: FailedClip): string {
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
  const [b] = await bluewealthNames([id]);
  if (b) return b.name?.trim() ? `${title(b.name.trim())} (ตัวแทน ${b.agent_code})` : `ตัวแทน ${b.agent_code}`;
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

/**
 * The maker's own LINE, if they linked it (เชื่อม LINE ของฉัน, owner chose ข, 2026-11-19): their clip
 * failed, and what was given back. Never throws, as tellOwnerClipFailed.
 */
export async function tellMakerClipFailed(row: {
  agent_id: string; input: unknown; customer_name: string | null; paid_by: FailedClip["paidBy"]; held_satang: number | null;
}): Promise<void> {
  const back = refund({ what: "", who: "", at: "", reason: "", paidBy: row.paid_by, heldSatang: row.held_satang, link: "" });
  await tellAgentClipFailed(row.agent_id, row.input, clipWhat(row.input), row.customer_name ?? "", back);
}

/** The maker's own LINE: their clip is done. Never throws. */
export async function tellMakerClipDone(row: { agent_id: string; input: unknown; customer_name: string | null }): Promise<void> {
  await tellAgentClipDone(row.agent_id, row.input, clipWhat(row.input), row.customer_name ?? "");
}
