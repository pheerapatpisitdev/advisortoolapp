import crypto from "crypto";
import { isFriend, push, reply } from "@/lib/line/client";
import { isPromptStory } from "@/lib/prompt-story/types";
import { isStoryInput } from "@/lib/quote-video/story";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * เชื่อม LINE ของฉัน (owner chose ข, 2026-11-19; mockup https://claude.ai/artifact/DtxS7imFDnoq3EYjweC7aa):
 * each agent links their own LINE to the official account once, and the account then pushes them
 * their own alerts — a clip done, a clip failed, money running low.
 *
 * The webhook keeps chats only as a hash, so the account cannot know which chat is whose until the
 * agent says so: ตั้งค่าส่วนตัว shows a code (and a QR that types it), the agent sends it in the
 * chat, and that chat's id is kept. Every alert is a push, one of the account's monthly allowance
 * (300 on the free plan, shared with broadcasts and the owner's alerts).
 */

/** the official account's basic id, as LINE shows it under its name */
export const OA_ID = "@006crkvq";
const LINK_TTL_MS = 10 * 60_000;
/** below this the money-low message goes, once, until the balance is back above it */
export const MONEY_LOW_SATANG = 5_000;

export type AgentNotify = "clipDone" | "clipFailed" | "moneyLow";
const COLUMN: Record<AgentNotify, "notify_clip_done" | "notify_clip_failed" | "notify_money_low"> = {
  clipDone: "notify_clip_done", clipFailed: "notify_clip_failed", moneyLow: "notify_money_low",
};

interface Row {
  agent_id: string;
  line_user_id: string | null;
  linked_at: string | null;
  link_code: string | null;
  link_expires: string | null;
  notify_clip_done: boolean;
  notify_clip_failed: boolean;
  notify_money_low: boolean;
  money_low_sent: boolean;
}

export interface AgentLine {
  linked: boolean;
  linkedAt: string | null;
  notify: Record<AgentNotify, boolean>;
  /** the code waiting to be sent, while it is still good */
  pendingCode: string | null;
  pendingUntil: string | null;
}

const table = () => supabaseAdmin().from("ins_agent_line");
const COLUMNS = "agent_id, line_user_id, linked_at, link_code, link_expires, notify_clip_done, notify_clip_failed, notify_money_low, money_low_sent";

async function rowOf(agentId: string): Promise<Row | null> {
  const { data, error } = await table().select(COLUMNS).eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`agent line not read: ${error.message}`);
  return data as Row | null;
}

async function save(agentId: string, patch: Partial<Row>): Promise<void> {
  const { error } = await table().upsert({ agent_id: agentId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "agent_id" });
  if (error) throw new Error(`agent line not saved: ${error.message}`);
}

/** what ตั้งค่าส่วนตัว shows; no row = not linked, the default switches */
export function viewOf(r: Row | null, now = Date.now()): AgentLine {
  const live = Boolean(r?.link_code && r.link_expires && Date.parse(r.link_expires) > now);
  return {
    linked: Boolean(r?.line_user_id),
    linkedAt: r?.linked_at ?? null,
    notify: {
      clipDone: r ? r.notify_clip_done : true,
      clipFailed: r ? r.notify_clip_failed : true,
      moneyLow: r ? r.notify_money_low : false,
    },
    pendingCode: live ? r!.link_code : null,
    pendingUntil: live ? r!.link_expires : null,
  };
}

export async function agentLine(agentId: string): Promise<AgentLine> {
  return viewOf(await rowOf(agentId));
}

/** the words the agent sends: the same ones the owner's link reads (owner-alert.ts) */
export const linkWords = (code: string) => `ผูก ${code}`;

/** LINE's own link that opens the account's chat with the words already typed */
export function linkUrl(code: string): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(OA_ID)}/?${encodeURIComponent(linkWords(code))}`;
}

/** the account's add-friend link, for a chat that is not a friend yet */
export const addFriendUrl = () => `https://line.me/R/ti/p/${encodeURIComponent(OA_ID)}`;

/**
 * A fresh code for this agent, good for ten minutes; their earlier code stops working. Six digits
 * no other agent is waiting on (the unique index), drawn again on the rare clash.
 */
export async function startAgentLink(agentId: string): Promise<{ code: string; until: string }> {
  for (let i = 0; i < 5; i++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const until = new Date(Date.now() + LINK_TTL_MS).toISOString();
    const { error } = await table().upsert(
      { agent_id: agentId, link_code: code, link_expires: until, updated_at: new Date().toISOString() },
      { onConflict: "agent_id" },
    );
    if (!error) return { code, until };
    if (error.code !== "23505") throw new Error(`link code not saved: ${error.message}`);
  }
  throw new Error("link code not saved: five clashes in a row");
}

export async function unlinkAgent(agentId: string): Promise<void> {
  await save(agentId, { line_user_id: null, linked_at: null, link_code: null, link_expires: null, money_low_sent: false });
}

export async function setAgentNotify(agentId: string, which: AgentNotify, on: boolean): Promise<void> {
  await save(agentId, { [COLUMN[which]]: on } as Partial<Row>);
}

/** the reply once linked; a chat that is not a friend is asked to add the account, or no push reaches it */
export function linkedText(friend: boolean | null): string {
  return [
    "เชื่อม LINE นี้กับบัญชี advisortool ของคุณแล้วครับ ✅",
    "จะแจ้งที่นี่เมื่อคลิปทำเสร็จหรือไม่สำเร็จ เปิดปิดแต่ละเรื่องได้ที่หน้า ตั้งค่าส่วนตัว",
    ...(friend === false ? ["", `กดเพิ่มเพื่อนด้วยนะครับ ไม่อย่างนั้นแจ้งเตือนจะส่งมาไม่ถึง ${addFriendUrl()}`] : []),
  ].join("\n");
}

/**
 * Called by the owner's link (owner-alert.ts) with a code that was not the owner's. True when it
 * was an agent's live code, now linked to this chat; false leaves the "wrong code" reply to the caller.
 */
export async function tryAgentLink(code: string, userId: string, replyToken: string): Promise<boolean> {
  try {
    return await linkAgent(code, userId, replyToken);
  } catch (e) {
    console.error("[line] agent link failed:", e);
    return false;
  }
}

async function linkAgent(code: string, userId: string, replyToken: string): Promise<boolean> {
  const { data, error } = await table().select(COLUMNS).eq("link_code", code).maybeSingle();
  if (error) {
    console.error("[line] agent link not read:", error.message);
    return false;
  }
  const r = data as Row | null;
  if (!r?.link_expires || Date.parse(r.link_expires) <= Date.now()) return false;
  // the row moves once: the same code sent twice links once
  const { data: moved, error: e2 } = await table()
    .update({ line_user_id: userId, linked_at: new Date().toISOString(), link_code: null, link_expires: null, money_low_sent: false, updated_at: new Date().toISOString() })
    .eq("agent_id", r.agent_id).eq("link_code", code).select("agent_id").maybeSingle();
  if (e2 || !moved) {
    if (e2) console.error("[line] agent link not saved:", e2.message);
    return false;
  }
  const friend = await isFriend(userId);
  await reply(replyToken, [{ type: "text", text: linkedText(friend) }]).catch((e) => console.error("[line] link reply not sent:", e));
  return true;
}

/** One alert to one agent, if linked and that switch is on. Never throws; false when nothing went. */
async function tell(agentId: string, which: AgentNotify, text: string): Promise<boolean> {
  try {
    const r = await rowOf(agentId);
    if (!r?.line_user_id || !r[COLUMN[which]]) return false;
    await push(r.line_user_id, [{ type: "text", text }]);
    return true;
  } catch (e) {
    console.error(`[line] ${which} alert to agent ${agentId} not sent:`, e);
    return false;
  }
}

/** where the agent finds the clip: the board it was made on */
export function clipBoard(input: unknown): string {
  const v = (input && typeof input === "object" ? input : {}) as { product?: string };
  if (isPromptStory(v)) return "/studio/prompt-story";
  if (isStoryInput(v)) return "/studio/story-clip";
  return "/studio/quote-video";
}

/** the clip's name as the agent knows it: "วิดีโอนำเสนอ · Life Protect · คุณสมชาย" */
export function clipName(what: string, customer: string): string {
  const who = customer.trim();
  return who ? `${what} · ${who.startsWith("คุณ") ? who : `คุณ${who}`}` : what;
}

export function clipDoneText(name: string, link: string): string {
  return ["🎬 คลิปทำเสร็จแล้ว", name, "", `ดูคลิป ${link}`].join("\n");
}

export function clipFailedAgentText(name: string, refund: string, link: string): string {
  return ["⚠️ คลิปทำไม่สำเร็จ", name, refund, "", `ลองใหม่ได้ที่ ${link}`].join("\n");
}

export function moneyLowText(satang: number, link: string): string {
  const baht = (satang / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return ["💰 เงินในกระเป๋าเหลือ ฿" + baht, "เติมเงินได้ที่", link].join("\n");
}

export async function tellAgentClipDone(agentId: string, input: unknown, what: string, customer: string): Promise<boolean> {
  return tell(agentId, "clipDone", clipDoneText(clipName(what, customer), siteUrl(clipBoard(input))));
}

export async function tellAgentClipFailed(agentId: string, input: unknown, what: string, customer: string, refund: string): Promise<boolean> {
  return tell(agentId, "clipFailed", clipFailedAgentText(clipName(what, customer), refund, siteUrl(clipBoard(input))));
}

/**
 * After money was taken: below the line, one message until the balance is back above it (a top-up,
 * or money given back), when the next read clears the mark. Never throws.
 */
export async function checkMoneyLow(agentId: string, satang: number): Promise<boolean> {
  try {
    const r = await rowOf(agentId);
    if (!r?.line_user_id) return false;
    if (satang >= MONEY_LOW_SATANG) {
      if (r.money_low_sent) await save(agentId, { money_low_sent: false });
      return false;
    }
    if (r.money_low_sent || !r.notify_money_low) return false;
    // marked first: two clips finishing together send one message
    const { data } = await table().update({ money_low_sent: true, updated_at: new Date().toISOString() })
      .eq("agent_id", agentId).eq("money_low_sent", false).select("agent_id").maybeSingle();
    if (!data) return false;
    await push(r.line_user_id, [{ type: "text", text: moneyLowText(satang, siteUrl("/studio/wallet")) }]);
    return true;
  } catch (e) {
    console.error(`[line] money-low alert to agent ${agentId} not sent:`, e);
    return false;
  }
}
