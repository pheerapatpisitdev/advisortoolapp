import { monthStart } from "@/lib/ai/ledger";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatBaht, holdSatang } from "@/lib/wallet/money";
import type { RoundPass } from "@/lib/wallet/round";
import { holdWallet, walletSettings } from "@/lib/wallet/store";
import type { Viewer } from "./access";

/**
 * How many AI rounds an agent may start in a Thai month (owner, 2026-09-27).
 *
 * Every agent of every UnitOS room may write in Studio now, and every round is paid from the
 * owner's one AI budget. So each agent has an allowance of their own, smaller for a room still
 * on its free trial: enough to use the thing properly, not enough for one person — or one
 * person who signed up a trial room to try — to spend the month for everybody. Staff are
 * outside it; the owner's content ceiling on /admin/ai still stands over all of it.
 *
 * A round is a writing round, a หาทีม round, a รีวิวเคลม reading or a picture drawn — the four
 * things that call a model on purpose. Counted from ins_audit, so deleting the piece a round
 * made does not give the round back.
 *
 * Each round cost about ฿1–3 in September 2026 (฿0.53 a written piece on average, a round
 * writes several, a picture costs more), so 20 a month is at most about ฿60 an agent.
 */
export const DEFAULT_MEMBER_AI_MONTH = 20;
export const DEFAULT_TRIAL_AI_MONTH = 5;

export const AI_ROUNDS = ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft"] as const;
export type AiRound = (typeof AI_ROUNDS)[number];

export interface Allowance {
  /** null for staff: no allowance of their own */
  limit: number | null;
  used: number;
}

export async function allowanceOf(viewer: Viewer): Promise<Allowance> {
  if (viewer.staff) return { limit: null, used: 0 };
  const db = supabaseAdmin();
  const [{ data: settings }, { count, error }] = await Promise.all([
    db.from("ins_ai_settings").select("member_ai_month, trial_ai_month").maybeSingle(),
    db.from("ins_audit").select("id", { count: "exact", head: true })
      .eq("agent_id", viewer.agentId).in("action", [...AI_ROUNDS]).gte("at", monthStart().toISOString()),
  ]);
  if (error) throw new Error(`อ่านโควตาไม่ได้: ${error.message}`);
  const set = viewer.trial ? settings?.trial_ai_month : settings?.member_ai_month;
  const limit = typeof set === "number" ? set : viewer.trial ? DEFAULT_TRIAL_AI_MONTH : DEFAULT_MEMBER_AI_MONTH;
  return { limit, used: count ?? 0 };
}

/** The refusal to show, or null when a round may start. */
export function overAllowance(a: Allowance, trial: boolean): string | null {
  if (a.limit === null || a.used < a.limit) return null;
  return trial
    ? `ห้องทดลองใช้สร้างด้วย AI ได้เดือนละ ${a.limit} ครั้ง — ใช้ครบแล้วเดือนนี้ (เปิดใช้เต็มรูปแบบใน UnitOS เพื่อใช้ได้มากขึ้น)`
    : `สร้างด้วย AI ได้คนละ ${a.limit} ครั้งต่อเดือน — ใช้ครบแล้วเดือนนี้ เริ่มใหม่วันที่ 1`;
}

/** the refusal when the free month is used and the wallet has not got this round's price */
export const walletShort = (neededSatang: number): string =>
  `โควตาฟรีเดือนนี้หมดแล้ว — รอบนี้ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(neededSatang)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`;

/**
 * Asks for one round and says who pays for it: nobody for staff, the free month while it
 * lasts, then the agent's wallet (owner, 2026-09-30) — the round's price set aside first, so
 * rounds started together cannot spend the same baht. A round is written down before the
 * model is called either way, so rounds started together count each other.
 */
export async function takeRound(viewer: Viewer, round: AiRound, target: string | null = null): Promise<RoundPass> {
  // staff have no allowance to count against; the content ceiling covers them
  if (viewer.staff) return { ok: true, paidBy: "staff" };
  const db = supabaseAdmin();
  const refusal = overAllowance(await allowanceOf(viewer), viewer.trial);
  if (!refusal) {
    const { error } = await db.from("ins_audit").insert({ agent_id: viewer.agentId, action: round, target });
    if (error) console.error(`round ${round} not counted:`, error.message);
    return { ok: true, paidBy: "free" };
  }
  // an unreadable wallet is a closed one: the round is refused, never let through unpaid
  const settings = await walletSettings().catch((e) => {
    console.error("wallet settings unreadable:", e);
    return null;
  });
  if (!settings?.enabled) return { ok: false, refusal };
  const heldSatang = holdSatang(round, settings.multiplier);
  const holdId = await holdWallet(viewer.agentId, heldSatang, round).catch((e) => {
    console.error("wallet hold failed:", e);
    return null;
  });
  if (!holdId) return { ok: false, refusal: walletShort(heldSatang) };
  const { error } = await db.from("ins_audit").insert({ agent_id: viewer.agentId, action: round, target, detail: { wallet: true } });
  if (error) console.error(`round ${round} not counted:`, error.message);
  return { ok: true, paidBy: "wallet", holdId, heldSatang, multiplier: settings.multiplier };
}
