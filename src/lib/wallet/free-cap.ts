import { monthStart, RESERVATION_MODEL } from "@/lib/ai/ledger";
import { pushToOwner } from "@/lib/line/owner-alert";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * เพดานงบใช้ฟรีต่อเดือน (owner, 2026-10-15; mockup https://claude.ai/artifact/3TVTjpUcpnPz9ApRNjV241,
 * option ก): the most the AI behind agents' free rounds and free clips may cost in a calendar
 * month. Once it is reached their free rounds and clips pause until the 1st — the free rounds
 * are not used up, only not given — and the wallet pays as it does once they run out.
 *
 * Counted: the AI cost of Studio work (content-* tasks) and clips (quote-video-*) asked for by
 * an agent, less what agents paid for from their wallets (a charge keeps its round's AI cost).
 * Not counted: the owner and the Super Admins, who use everything free; members, whose rounds
 * come with the pass they paid for; ถาม AI; the bots. It took the place of งบสร้างคอนเทนต์,
 * which held the owner's own work too and left clips out.
 */

export interface FreeSpend { studioThb: number; clipsThb: number; thb: number }

export interface FreeCap {
  /** null = no limit */
  cap: number | null;
  spent: FreeSpend;
  /** the last alert sent, "2026-10:1" (80%) or "2026-10:2" (full) */
  alerted: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isStudio = (task: string) => task.startsWith("content");
const isClip = (task: string) => task.startsWith("quote-video");
/** a clip's wallet charge is "quote-video"; every other charge is a Studio round */
const CLIP_ROUND = "quote-video";

/** what agents' free use cost: their AI lines less what they paid from wallets; `excluded` are the owner's, the Super Admins' and members' ids */
export function freeSpend(
  lines: { agentId: string | null; task: string; model: string | null; thb: number }[],
  charges: { agentId: string; round: string | null; costThb: number }[],
  excluded: Set<string>,
): FreeSpend {
  let studio = 0, clips = 0;
  for (const l of lines) {
    if (!l.agentId || excluded.has(l.agentId) || l.model === RESERVATION_MODEL) continue;
    if (isStudio(l.task)) studio += l.thb;
    else if (isClip(l.task)) clips += l.thb;
  }
  for (const c of charges) {
    if (excluded.has(c.agentId)) continue;
    if (c.round === CLIP_ROUND) clips -= c.costThb; else studio -= c.costThb;
  }
  // a round charged this month whose AI lines fell just before the 1st can tip a part below zero
  const studioThb = round2(Math.max(0, studio)), clipsThb = round2(Math.max(0, clips));
  return { studioThb, clipsThb, thb: round2(studioThb + clipsThb) };
}

export const capFull = (c: Pick<FreeCap, "cap" | "spent">): boolean => c.cap !== null && c.spent.thb >= c.cap;

/** "2026-10", the Bangkok month a moment falls in */
export const monthKey = (now: Date): string => new Date(monthStart(now).getTime() + 7 * 3_600_000).toISOString().slice(0, 7);

/** the alert due now, as the key to claim, or null: 80% once a month, then full once */
export function alertDue(c: FreeCap, now: Date): { key: string; full: boolean } | null {
  if (c.cap === null || c.cap <= 0) return null;
  const level = c.spent.thb >= c.cap ? 2 : c.spent.thb >= c.cap * 0.8 ? 1 : 0;
  if (!level) return null;
  const key = `${monthKey(now)}:${level}`;
  // keys sort by month, then level, so anything at or past this one was already sent
  return c.alerted && c.alerted >= key ? null : { key, full: level === 2 };
}

/** "1 พ.ย.", the day the free rounds come back */
export function nextFirst(now: Date): string {
  const start = monthStart(now);
  const mid = new Date(start.getTime() + 40 * 86_400_000); // well inside next month
  return `1 ${mid.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", month: "short" })}`;
}

/** the words for an agent whose free rounds are paused and whose wallet cannot pay */
export const freeCapRefusal = (now = new Date()): string =>
  `รอบฟรีของเดือนนี้หมดแล้ว — เติมเงินเพื่อใช้ต่อได้ทันทีที่เมนู "กระเป๋าเงิน" หรือรอรอบฟรีใหม่วันที่ ${nextFirst(now)}`;

const PAGE = 1000;

async function paged<T>(what: string, page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let at = 0; at < 50_000; at += PAGE) {
    const { data, error } = await page(at, at + PAGE - 1);
    if (error) throw new Error(`${what}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** this month's ceiling and what agents' free use has cost so far. Throws when it cannot be read. */
export async function readFreeCap(now = new Date()): Promise<FreeCap> {
  const db = supabaseAdmin();
  const since = monthStart(now).toISOString();
  const [settings, lines, charges, owners, supers] = await Promise.all([
    db.from("ins_ai_settings").select("free_budget_thb, free_alerted").maybeSingle(),
    paged<Row>("ledger", (a, b) => db.from("ins_usage_ledger").select("agent_id, task, model, cost_thb")
      .gte("created_at", since).not("agent_id", "is", null).or("task.like.content%,task.like.quote-video%")
      .order("created_at").order("id").range(a, b)),
    paged<Row>("charges", (a, b) => db.from("ins_wallet_entries").select("agent_id, round, cost_thb")
      .eq("kind", "charge").gte("created_at", since).order("created_at").order("id").range(a, b)),
    db.from("ins_staff").select("agent_id").eq("is_owner", true),
    db.from("ins_super_admins").select("id"),
  ]);
  if (settings.error) throw new Error(`free cap: ${settings.error.message}`);
  if (owners.error) throw new Error(`owners: ${owners.error.message}`);
  if (supers.error) throw new Error(`super admins: ${supers.error.message}`);

  const ids = [...new Set([...lines.map((l) => str(l.agent_id)), ...charges.map((c) => str(c.agent_id))].filter((x): x is string => Boolean(x)))];
  const members = ids.length ? await db.from("ins_members").select("id").in("id", ids) : { data: [], error: null };
  if (members.error) throw new Error(`members: ${members.error.message}`);
  const excluded = new Set([
    ...(owners.data ?? []).map((r) => String(r.agent_id)),
    ...(supers.data ?? []).map((r) => String(r.id)),
    ...(members.data ?? []).map((r) => String(r.id)),
  ]);

  const set = (settings.data as Row | null)?.free_budget_thb;
  return {
    cap: set === null || set === undefined ? null : Number(set),
    alerted: str((settings.data as Row | null)?.free_alerted),
    spent: freeSpend(
      lines.map((l) => ({ agentId: str(l.agent_id), task: str(l.task) ?? "", model: str(l.model), thb: Number(l.cost_thb ?? 0) })),
      charges.map((c) => ({ agentId: str(c.agent_id) ?? "", round: str(c.round), costThb: Number(c.cost_thb ?? 0) })),
      excluded,
    ),
  };
}

const baht = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/**
 * Tells the owner on LINE at 80% and when full, once each a month. The key is claimed in the
 * database first, so rounds started together send one message. Never throws.
 */
export async function alertOwnerIfDue(c: FreeCap, now = new Date()): Promise<void> {
  try {
    const due = alertDue(c, now);
    if (!due) return;
    const { data, error } = await supabaseAdmin().from("ins_ai_settings").update({ free_alerted: due.key })
      .eq("id", true).or(`free_alerted.is.null,free_alerted.lt.${due.key}`).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return;
    const used = `${baht(c.spent.thb)} จาก ${baht(c.cap!)}`;
    await pushToOwner(due.full
      ? `⛔ งบใช้ฟรีเดือนนี้เต็มแล้ว (${used})\nรอบฟรีและคลิปฟรีของตัวแทนหยุดถึงวันที่ ${nextFirst(now)} · งานที่จ่ายจากกระเป๋ายังใช้ได้\nปรับเพดานได้ที่ ${siteUrl("/admin/prices")}`
      : `⚠️ งบใช้ฟรีเดือนนี้ใช้ไป 80% แล้ว (${used})\nปรับเพดานได้ที่ ${siteUrl("/admin/prices")}`);
  } catch (e) {
    console.error("free cap alert not sent:", e);
  }
}

/**
 * Whether an agent's free round or clip may start now. Members and the owner are not asked. A
 * ceiling that cannot be read lets it through: the month's whole AI budget still stands over it,
 * and a hiccup should not turn every agent's free round into a charge.
 */
export async function freePaused(now = new Date()): Promise<boolean> {
  const c = await readFreeCap(now).catch((e) => {
    console.error("free cap unreadable, free rounds let through:", e);
    return null;
  });
  if (!c) return false;
  // awaited: a serverless function may stop once the round answers. Quick unless an alert is due
  await alertOwnerIfDue(c, now);
  return capFull(c);
}

/**
 * The ceiling as typed on ราคาและโปรโมชัน: empty is no limit; otherwise baht, not below zero and
 * not above the month's whole AI budget, past which every AI call stops, the bots' included.
 */
export function readFreeBudget(raw: string, monthly: number | null): { ok: true; value: number | null } | { ok: false; error: string } {
  const s = String(raw ?? "").replace(/[,\s฿]/g, "");
  if (s === "") return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: "เพดานต้องเป็นตัวเลข — ถ้าไม่อยากจำกัดให้เว้นว่าง" };
  const value = Number(s);
  if (monthly !== null && value > monthly) {
    return { ok: false, error: `เพดานใช้ฟรีต้องไม่เกินงบ AI รวมต่อเดือน (${baht(monthly)}) ที่หน้าตั้งค่า AI` };
  }
  return { ok: true, value };
}

/** the month's whole AI budget (/admin/ai), null when it has none */
export async function monthlyBudget(): Promise<number | null> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("monthly_budget_thb").maybeSingle();
  if (error) throw new Error(error.message);
  const v = (data as Row | null)?.monthly_budget_thb;
  return v === null || v === undefined ? null : Number(v);
}

export async function saveFreeBudget(value: number | null): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings")
    .upsert({ id: true, free_budget_thb: value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
