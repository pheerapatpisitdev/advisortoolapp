import { memberAccess, PASS_EXPIRED, PASS_UNREADABLE, passOpen } from "@/lib/members/access";
import { roundsFrom } from "@/lib/members/pass";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatBaht, holdSatang, holdSatangFor } from "@/lib/wallet/money";
import type { RoundPass } from "@/lib/wallet/round";
import { holdWallet, walletFrozen, walletSettings } from "@/lib/wallet/store";
import { freeCapRefusal, freePaused } from "@/lib/wallet/free-cap";
import { can, type Viewer } from "./access";

/**
 * How many AI rounds an agent may start without paying: ten, once (owner, 2026-09-30).
 *
 * Until then it was twenty a Thai month, five for a trial room, paid from the owner's one AI
 * budget. With the wallet (src/lib/wallet/) the owner chose a taste instead of an allowance:
 * ten rounds to try Studio (five at first, raised to ten the same day), for a paying room and a trial room alike, never given again —
 * after them every round is paid from the agent's own wallet. The owner alone is outside it;
 * an assistant has the ten and a wallet as any agent does, whatever was ticked for them
 * (owner, 2026-10-02). The month's เพดานงบใช้ฟรี stands over an agent's free rounds: once it
 * is reached they pause until the 1st and the wallet pays (owner, 2026-10-15; src/lib/wallet/free-cap.ts).
 *
 * Counted from 1 October 2026 in Thailand, so rounds used under the monthly allowance before
 * the change do not eat into the ten (owner, 2026-09-30). Moved to 10 October 2026 11:10 to give
 * every agent their ten again, once (owner, 2026-10-10); wallet money was not touched.
 *
 * A round is a writing round, a หาทีม round, a รีวิวเคลม reading or a picture drawn — the
 * things that call a model on purpose. Counted from ins_audit, so deleting the piece a round
 * made does not give the round back. A free round that threw or gave nothing is handed back:
 * its line is renamed 'ai-returned', which this count does not look for (review, 2026-10-01).
 */
export const FREE_ROUNDS = 10;
export const FREE_ROUNDS_FROM = new Date("2026-10-10T11:10:00+07:00");

export const AI_ROUNDS = ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft", "ai-thanks", "ai-showcase", "ai-saying", "ai-clip", "ai-edit", "ai-describe"] as const;
export type AiRound = (typeof AI_ROUNDS)[number];

export interface Allowance {
  /** null for the owner: no allowance of their own */
  limit: number | null;
  used: number;
}

export interface FreeWindow {
  limit: number;
  from: Date;
}

const ONE_TIME: FreeWindow = { limit: FREE_ROUNDS, from: FREE_ROUNDS_FROM };

/** the free rounds a gated member's live pass carries, else the one-time ten */
function windowOf(access: Awaited<ReturnType<typeof memberAccess>>): FreeWindow {
  return (access.gated && roundsFrom(access.state, access.settings)) || ONE_TIME;
}

/**
 * Which free rounds count: a member with a live pass has the pass's rounds, counted afresh from
 * the period's start (owner, 2026-10-13); everyone else the one-time ten. memberAccess reads
 * nothing for a UnitOS agent or while the switch is off. Throws when the pass cannot be read.
 */
export async function freeWindow(viewer: Viewer): Promise<FreeWindow> {
  return windowOf(await memberAccess(viewer));
}

export async function allowanceOf(viewer: Viewer): Promise<Allowance> {
  if (can(viewer, "owner")) return { limit: null, used: 0 };
  // display pages: an unreadable pass throws, as an unreadable count does
  const { limit, from } = await freeWindow(viewer);
  const { count, error } = await supabaseAdmin().from("ins_audit").select("id", { count: "exact", head: true })
    .eq("agent_id", viewer.agentId).in("action", [...AI_ROUNDS]).gte("at", from.toISOString());
  if (error) throw new Error(`อ่านโควตาไม่ได้: ${error.message}`);
  return { limit, used: count ?? 0 };
}

/** The refusal to show, or null when a round may start. */
export function overAllowance(a: Allowance): string | null {
  if (a.limit === null || a.used < a.limit) return null;
  return `ใช้รอบฟรีครบ ${a.limit} ครั้งแล้ว`;
}

/** the refusal when the free rounds are used and the wallet has not got this round's price */
export const walletShort = (neededSatang: number): string =>
  `รอบฟรีหมดแล้ว — รอบนี้ต้องมีเงินในกระเป๋าอย่างน้อย ${formatBaht(neededSatang)} เติมเงินได้ที่เมนู "กระเป๋าเงิน"`;

/** the refusal when the free rounds could not be counted: a round nobody can count is not run free */
export const UNCOUNTED = "นับรอบฟรีไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะครับ";

/** the refusal when a refund or a dispute froze the wallet (owner, 2026-10-01) */
export const WALLET_FROZEN = "กระเป๋าเงินถูกพักไว้ชั่วคราว — ติดต่อสำนักงานนะครับ";

/**
 * One free round, taken under a per-agent lock in the database (ins_take_free_round in
 * supabase/migrations/20261001_wallet_refunds_free_rounds.sql): it counts what allowanceOf
 * counts and writes the round down in one go, so ten rounds sent at 9 of 10 used no longer all
 * read "9" and all run free (review, 2026-10-01). The line's id, so a round that gave nothing
 * can be handed back; null when the free rounds are used. Throws when the database does.
 * Counted in the window takeRound already read (freeWindow's rule), so the pass is read once.
 */
async function takeFreeRound(viewer: Viewer, round: AiRound, target: string | null, { limit, from }: FreeWindow): Promise<number | null> {
  const { data, error } = await supabaseAdmin().rpc("ins_take_free_round", {
    p_agent: viewer.agentId, p_action: round, p_target: target,
    p_limit: limit, p_from: from.toISOString(), p_rounds: [...AI_ROUNDS],
  });
  if (error) throw new Error(`ins_take_free_round: ${error.message}`);
  if (data === null || data === undefined) return null;
  const id = Number(data);
  if (!Number.isSafeInteger(id)) throw new Error(`ins_take_free_round gave back ${String(data)}`);
  return id;
}

/**
 * Asks for one round and says who pays for it: nobody for the owner, the free rounds while they
 * last, then the agent's wallet (owner, 2026-09-30) — the round's price set aside first, so
 * rounds started together cannot spend the same baht. A round is written down before the
 * model is called either way, so rounds started together count each other.
 *
 * A free round that cannot be counted is refused, not run free and uncounted (review,
 * 2026-10-01); one that gives the agent nothing is handed back by payRound
 * (src/lib/wallet/round.ts), the same as a wallet round's money.
 *
 * `hold`: what the caller can already price, used in place of the round's default — in baht
 * before the multiplier, or `{ satang }` for a round at a fixed price (src/lib/wallet/prices.ts,
 * owner 2026-10-12), which the multiplier does not touch. A picture is the case: the default is
 * the dearest one's, so five drawn at once set aside ฿30 of a wallet that would have paid ฿5 for
 * them and the last ones failed with money in it (owner, 2026-09-30).
 */
export async function takeRound(viewer: Viewer, round: AiRound, target: string | null = null, hold?: number | { satang: number }): Promise<RoundPass> {
  // the owner has no allowance to count against; the content ceiling covers them. Assistants
  // used to be let through here too, until the owner gave them wallets (2026-10-02)
  if (can(viewer, "owner")) return { ok: true, paidBy: "staff", agentId: viewer.agentId };
  // an outside member needs a live pass for any round (owner, 2026-10-13); a pass that cannot
  // be read refuses the round, never lets it through. Read once: the window comes from it too
  const access = await memberAccess(viewer).catch((e) => {
    console.error(`round ${round} refused, pass unreadable:`, e);
    return null;
  });
  if (!access) return { ok: false, refusal: PASS_UNREADABLE };
  if (!passOpen(access)) return { ok: false, refusal: PASS_EXPIRED };
  const window = windowOf(access);
  // a member's rounds came with the pass they paid for: the free ceiling is the agents' alone
  const paused = viewer.kind !== "member" && await freePaused();
  const freeId = paused ? null : await takeFreeRound(viewer, round, target, window).catch((e) => {
    console.error(`round ${round} not counted, refused:`, e);
    return undefined;
  });
  if (freeId === undefined) return { ok: false, refusal: UNCOUNTED };
  if (freeId !== null) return { ok: true, paidBy: "free", auditId: freeId, agentId: viewer.agentId };
  const refusal = paused ? freeCapRefusal() : overAllowance({ limit: window.limit, used: window.limit }) ?? "";
  // an unreadable wallet is a closed one: the round is refused, never let through unpaid
  const settings = await walletSettings().catch((e) => {
    console.error("wallet settings unreadable:", e);
    return null;
  });
  if (!settings?.enabled) return { ok: false, refusal };
  const fixed = typeof hold === "object" && Number.isSafeInteger(hold.satang) && hold.satang > 0 ? hold.satang : null;
  const priced = typeof hold === "number" && Number.isFinite(hold) && hold > 0;
  const heldSatang = fixed ?? (priced ? holdSatangFor(hold, settings.multiplier) : holdSatang(round, settings.multiplier));
  const holdId = await holdWallet(viewer.agentId, heldSatang, round).catch((e) => {
    console.error("wallet hold failed:", e);
    return null;
  });
  if (!holdId) {
    // a frozen wallet refuses a hold the same way an empty one does; it is told apart only here
    return { ok: false, refusal: (await walletFrozen(viewer.agentId)) ? WALLET_FROZEN : paused ? freeCapRefusal() : walletShort(heldSatang) };
  }
  const { error } = await supabaseAdmin().from("ins_audit").insert({ agent_id: viewer.agentId, action: round, target, detail: { wallet: true } });
  // the round is paid for by the hold, so a lost line costs the count, not the money
  if (error) console.error(`round ${round} not counted:`, error.message);
  return { ok: true, paidBy: "wallet", holdId, heldSatang, multiplier: settings.multiplier, agentId: viewer.agentId };
}
