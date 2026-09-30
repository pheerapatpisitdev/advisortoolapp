import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatBaht, holdSatang, holdSatangFor } from "@/lib/wallet/money";
import type { RoundPass } from "@/lib/wallet/round";
import { holdWallet, walletSettings } from "@/lib/wallet/store";
import type { Viewer } from "./access";

/**
 * How many AI rounds an agent may start without paying: ten, once (owner, 2026-09-30).
 *
 * Until then it was twenty a Thai month, five for a trial room, paid from the owner's one AI
 * budget. With the wallet (src/lib/wallet/) the owner chose a taste instead of an allowance:
 * ten rounds to try Studio (five at first, raised to ten the same day), for a paying room and a trial room alike, never given again —
 * after them every round is paid from the agent's own wallet. Staff are outside it; the
 * owner's content ceiling on /admin/ai still stands over the free rounds.
 *
 * Counted from 1 October 2026 in Thailand, so rounds used under the monthly allowance before
 * the change do not eat into the ten (owner, 2026-09-30).
 *
 * A round is a writing round, a หาทีม round, a รีวิวเคลม reading or a picture drawn — the
 * things that call a model on purpose. Counted from ins_audit, so deleting the piece a round
 * made does not give the round back.
 */
export const FREE_ROUNDS = 10;
export const FREE_ROUNDS_FROM = new Date("2026-10-01T00:00:00+07:00");

export const AI_ROUNDS = ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft"] as const;
export type AiRound = (typeof AI_ROUNDS)[number];

export interface Allowance {
  /** null for staff: no allowance of their own */
  limit: number | null;
  used: number;
}

export async function allowanceOf(viewer: Viewer): Promise<Allowance> {
  if (viewer.staff) return { limit: null, used: 0 };
  const { count, error } = await supabaseAdmin().from("ins_audit").select("id", { count: "exact", head: true })
    .eq("agent_id", viewer.agentId).in("action", [...AI_ROUNDS]).gte("at", FREE_ROUNDS_FROM.toISOString());
  if (error) throw new Error(`อ่านโควตาไม่ได้: ${error.message}`);
  return { limit: FREE_ROUNDS, used: count ?? 0 };
}

/** The refusal to show, or null when a round may start. */
export function overAllowance(a: Allowance): string | null {
  if (a.limit === null || a.used < a.limit) return null;
  return `ใช้รอบฟรีครบ ${a.limit} ครั้งแล้ว`;
}

/** the refusal when the free rounds are used and the wallet has not got this round's price */
export const walletShort = (neededSatang: number): string =>
  `รอบฟรีหมดแล้ว — รอบนี้ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(neededSatang)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`;

/**
 * Asks for one round and says who pays for it: nobody for staff, the free rounds while they
 * last, then the agent's wallet (owner, 2026-09-30) — the round's price set aside first, so
 * rounds started together cannot spend the same baht. A round is written down before the
 * model is called either way, so rounds started together count each other.
 *
 * `holdThb`: what the caller can already price, in baht before the multiplier, used in place
 * of the round's default. A picture is the case: the default is the dearest one's (Gemini
 * with a person), so five drawn at once set aside ฿30 of a wallet that would have paid ฿5 for
 * them and the last ones failed with money in it (owner, 2026-09-30).
 */
export async function takeRound(viewer: Viewer, round: AiRound, target: string | null = null, holdThb?: number): Promise<RoundPass> {
  // staff have no allowance to count against; the content ceiling covers them
  if (viewer.staff) return { ok: true, paidBy: "staff" };
  const db = supabaseAdmin();
  const refusal = overAllowance(await allowanceOf(viewer));
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
  const priced = typeof holdThb === "number" && Number.isFinite(holdThb) && holdThb > 0;
  const heldSatang = priced ? holdSatangFor(holdThb, settings.multiplier) : holdSatang(round, settings.multiplier);
  const holdId = await holdWallet(viewer.agentId, heldSatang, round).catch((e) => {
    console.error("wallet hold failed:", e);
    return null;
  });
  if (!holdId) return { ok: false, refusal: walletShort(heldSatang) };
  const { error } = await db.from("ins_audit").insert({ agent_id: viewer.agentId, action: round, target, detail: { wallet: true } });
  if (error) console.error(`round ${round} not counted:`, error.message);
  return { ok: true, paidBy: "wallet", holdId, heldSatang, multiplier: settings.multiplier };
}
