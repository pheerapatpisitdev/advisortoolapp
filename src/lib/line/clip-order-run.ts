import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import { viewerOfAgent } from "@/lib/auth/viewer";
import type { Viewer } from "@/lib/auth/access";
import { clipBoard, clipDoneMessages, clipDoneText, clipName } from "@/lib/line/agent-line";
import type { LineMessage } from "@/lib/line/client";
import {
  asksForClip, cancels, CANCELLED, draftFromChat, freshDraft, inputOf, need, nothingToFetch, otherPlanText,
  personIn, productIn, question, startedReply, startsClip, startsOrder, stillMaking, summaryCard, swapsStyle, fetchAgain,
  formOf, withMessage, ORDER_STYLE, type ClipDraft, type OrderCost,
} from "@/lib/line/clip-order";
import { checked, payAndPen } from "@/lib/quote-video/check-input";
import { clipWhat, lineVideo, pushesNearFull } from "@/lib/quote-video/fail-alert";
import { clipEstimates, costView, videoPrice } from "@/lib/quote-video/make";
import { clipKind, leftWords, progressView, readNote } from "@/lib/quote-video/progress";
import type { VideoRow } from "@/lib/quote-video/rows";
import { quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { NOT_PRICED, startQuoteClip } from "@/lib/quote-video/start";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { walletPrices } from "@/lib/wallet/store";

/**
 * สั่งคลิปในแชท LINE (ทาง ค, owner chose ก ก ก 2026-11-27): the work behind clip-order.ts's words —
 * the order kept on the agent's LINE row, the card priced from their wallet, the clip started by
 * the form's own steps (src/lib/quote-video/start.ts), and "ขอคลิป". Only for a LINE linked by เชื่อม
 * LINE ของฉัน: a customer typing the same words is left to the sales bot.
 */

/** a message longer than this is a question for the bot, not a piece of an order */
const LONGEST = 200;
/** "ขอคลิป" with nothing owed sends the latest finished clip again, from this far back */
const AGAIN_DAYS = 7;
/** a clip asked for longer ago than this and still not done is not waited on */
const MAKING_MINUTES = 30;

const lineRows = () => supabaseAdmin().from("ins_agent_line");
const clipRows = () => supabaseAdmin().from("ins_quote_videos");

const NO_ACCESS = "บัญชีนี้ยังสร้างคลิปไม่ได้ครับ ลองเข้าสู่ระบบที่ advisortool.app เพื่อตรวจสอบสิทธิ์";
const ORDER_GONE = "คำสั่งคลิปนี้หมดเวลาหรือยกเลิกไปแล้วครับ พิมพ์สั่งใหม่ได้เลย เช่น \"คลิป LP ชาย 35 ทุน 1 ล้าน\"";
const text = (t: string): LineMessage => ({ type: "text", text: t });
const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** the agent behind this LINE and the order they are putting together; null = a customer */
async function agentChat(lineUserId: string): Promise<{ agentId: string; draft: ClipDraft | null } | null> {
  const { data, error } = await lineRows().select("agent_id, clip_draft").eq("line_user_id", lineUserId).limit(1);
  if (error) throw new Error(`agent line not read: ${error.message}`);
  const row = ((data ?? []) as { agent_id: string; clip_draft: unknown }[])[0];
  return row ? { agentId: row.agent_id, draft: freshDraft(row.clip_draft) } : null;
}

async function keepDraft(agentId: string, draft: ClipDraft | null): Promise<void> {
  const { error } = await lineRows().update({ clip_draft: draft }).eq("agent_id", agentId);
  if (error) throw new Error(`clip order not kept: ${error.message}`);
}

/**
 * The bot's answer to a linked agent's message when it is about a clip — an order, a piece of one,
 * the card's buttons, or "ขอคลิป" — or null for anything else, which goes on to the sales bot.
 * `slots`: the quote this chat holds, which an order naming nothing of its own starts from.
 */
export async function answerClipChat(asked: string, lineUserId: string, slots: WithPdf<AnySlots> | null | undefined): Promise<LineMessage[] | null> {
  if (!asked.trim() || asked.length > LONGEST) return null;
  const chat = await agentChat(lineUserId);
  if (!chat) return null;
  const { agentId, draft } = chat;
  if (asksForClip(asked)) return fetchClip(agentId);

  if (draft) {
    if (cancels(asked)) {
      await keepDraft(agentId, null);
      return [text(CANCELLED)];
    }
    if (startsClip(asked) && !need(draft)) return start(agentId, draft);
    if (swapsStyle(asked)) return answerDraft(agentId, { ...draft, style: draft.style === "motion" ? "classic" : "motion", at: new Date().toISOString() });
    if (productIn(asked) === "other") {
      await keepDraft(agentId, null);
      return [text(otherPlanText(formOf(draft)))];
    }
    const next = withMessage(draft, asked, need(draft));
    if (changed(draft, next)) return answerDraft(agentId, next);
    // the card's button pressed after the order moved on, or words that add nothing: a new order, or the sales bot's
    if (startsClip(asked)) return answerDraft(agentId, next);
  }

  // a card's button pressed after its order was started, cancelled or forgotten
  if (!draft && (startsClip(asked) || swapsStyle(asked))) return [text(ORDER_GONE)];
  if (!startsOrder(asked)) return null;
  if (productIn(asked) === "other") return [text(otherPlanText(formOf({ style: ORDER_STYLE, at: "" })))];
  // an order that names neither a plan nor a person is about the quote this chat holds, if any
  const own = Boolean(productIn(asked) || personIn(asked));
  const seed = (!own && draftFromChat(slots)) || { style: ORDER_STYLE, at: new Date().toISOString() };
  return answerDraft(agentId, withMessage(seed, asked, null));
}

/** whether the message added anything to the order */
function changed(a: ClipDraft, b: ClipDraft): boolean {
  const { at: _a, ...x } = a;
  const { at: _b, ...y } = b;
  void _a; void _b;
  return JSON.stringify(x) !== JSON.stringify(y);
}

/** the next question, or the card once nothing is missing; the order kept either way */
async function answerDraft(agentId: string, d: ClipDraft): Promise<LineMessage[]> {
  await keepDraft(agentId, d);
  const n = need(d);
  if (n) return [question(n, d)];
  const viewer = await viewerOfAgent(agentId);
  if (!viewer || viewer.kind === "demo" || viewer.kind === "super") return [text(NO_ACCESS)];
  const input = inputOf(d)!;
  const c = checked(input, ...(await payAndPen(agentId)));
  if (typeof c === "string") return [text(`${c}\nพิมพ์แก้ได้เลยครับ`)];
  const facts = quoteVideoFacts(c);
  if (!facts) return [text(`${NOT_PRICED}\nพิมพ์แก้ได้เลยครับ`)];
  const cost = await orderCost(viewer, c);
  if (!cost.ok) return [text(cost.text)];
  return [summaryCard(d, facts, cost)];
}

/** how the clip is paid for, as the card says it; or why it cannot be */
export async function orderCost(viewer: Viewer, input: VideoInput): Promise<OrderCost> {
  const view = await costView(viewer);
  switch (view.kind) {
    case "staff":
      return { ok: true, line: "ไม่ตัดเงิน (บัญชีแอดมิน)", price: "" };
    case "free":
      return { ok: true, line: `ใช้สิทธิ์ฟรี · เหลือ ${view.left} ครั้ง`, price: "(ฟรี)" };
    case "closed":
      return { ok: false, text: view.noFree ? "ตอนนี้ยังใช้เครดิตและกระเป๋าเงินไม่ได้ครับ" : "ใช้วิดีโอฟรีครบแล้ว และกระเป๋าเงินยังไม่เปิดใช้ครับ" };
    case "wallet": {
      const price = videoPrice(input, await walletPrices());
      if (view.satang < price) {
        return { ok: false, text: `⚠️ เงินในกระเป๋าเหลือ ${baht(view.satang)} ไม่พอสำหรับคลิปนี้ (${baht(price)})\nเติมเงิน ${siteUrl("/studio/wallet")}` };
      }
      return { ok: true, line: `${baht(price)} จากกระเป๋า · เหลือ ${baht(view.satang - price)}`, price: baht(price) };
    }
  }
}

/** สร้างคลิป: started by the form's own steps, then the order is done with */
async function start(agentId: string, d: ClipDraft): Promise<LineMessage[]> {
  const viewer = await viewerOfAgent(agentId);
  if (!viewer || viewer.kind === "demo" || viewer.kind === "super") return [text(NO_ACCESS)];
  const input = inputOf(d);
  if (!input) return [question(need(d)!, d)];
  const r = await startQuoteClip(viewer, input, d.customer ?? "", { lineOrder: true });
  if (!r.ok) return [text(r.needContact ? `${r.error}\n${siteUrl("/studio/account")}` : r.error)];
  await keepDraft(agentId, null);
  const near = await pushesNearFull().catch(() => false);
  return [startedReply(!near)];
}

type Owed = Pick<VideoRow, "id" | "input" | "customer_name" | "video_path">;

/** the clip as a reply: its words, the video and the board, as the push would have sent it */
async function clipMessages(row: Owed): Promise<LineMessage[]> {
  const name = clipName(clipWhat(row.input), row.customer_name ?? "");
  const link = siteUrl(clipBoard(row.input));
  const video = row.video_path ? await lineVideo(row.id, row.video_path) : null;
  return video ? clipDoneMessages(name, link, video) : [text(clipDoneText(name, link))];
}

/**
 * ขอคลิป: the latest clip still owed to LINE, as a reply (free), and how many more are owed; else
 * the clip still being made and about how long; else the latest finished one again.
 */
async function fetchClip(agentId: string): Promise<LineMessage[]> {
  const { data: owed, error } = await clipRows().select("id, input, customer_name, video_path")
    .eq("agent_id", agentId).eq("line_pending", true).eq("status", "done").is("deleted_at", null)
    .order("updated_at", { ascending: false }).limit(20);
  if (error) throw new Error(`clips owed not read: ${error.message}`);
  const list = (owed ?? []) as Owed[];
  if (list[0]) {
    const messages = await clipMessages(list[0]);
    const { error: e } = await clipRows().update({ line_pending: false }).eq("id", list[0].id);
    if (e) console.error(`[line] clip ${list[0].id} not marked sent:`, e.message);
    return fetchAgain(messages, list.length - 1);
  }

  const since = new Date(Date.now() - MAKING_MINUTES * 60_000).toISOString();
  const { data: making } = await clipRows().select("status, job, progress, created_at, input")
    .eq("agent_id", agentId).in("status", ["drawing", "rendering"]).is("deleted_at", null).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(1);
  const m = ((making ?? []) as Pick<VideoRow, "status" | "job" | "progress" | "created_at" | "input">[])[0];
  if (m && (m.status === "drawing" || m.status === "rendering")) {
    const est = (await clipEstimates())[clipKind(m.input as Parameters<typeof clipKind>[0])];
    const now = Date.now();
    const started = m.status === "rendering" ? Date.parse(m.job?.startedAt ?? "") : NaN;
    const view = progressView({
      status: m.status, note: readNote(m.progress), est,
      sinceStart: Math.max(0, (now - Date.parse(m.created_at)) / 1000),
      sinceRender: Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : null,
    });
    return [stillMaking(leftWords(view.leftSec))];
  }

  const back = new Date(Date.now() - AGAIN_DAYS * 24 * 3600_000).toISOString();
  const { data: last } = await clipRows().select("id, input, customer_name, video_path")
    .eq("agent_id", agentId).eq("status", "done").is("deleted_at", null).gte("updated_at", back)
    .order("updated_at", { ascending: false }).limit(1);
  const latest = ((last ?? []) as Owed[])[0];
  return latest ? clipMessages(latest) : [text(nothingToFetch(siteUrl("/studio/quote-video")))];
}
