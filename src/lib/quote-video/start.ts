/**
 * วิดีโอนำเสนอ's clip started for an agent: checked, priced, paid for and handed to the queue — the
 * steps the form's makeVideo ran, moved here (2026-11-27) so a clip ordered in the LINE chat
 * (src/lib/line/clip-order-run.ts) is started by the very same ones. A "use server" file exports
 * async actions only, so this lives outside it.
 */
import type { Viewer } from "@/lib/auth/access";
import { runLater, runLaterNow } from "@/lib/later";
import { closedFor } from "@/lib/switches/store";
import { checked, payAndPen } from "./check-input";
import { getContact } from "./contact";
import { clipProduce } from "./jobs";
import { createVideo, langOfInput } from "./make";
import { setRow } from "./rows";
import { cleanCustomerName, quoteVideoFacts, type VideoInput } from "./script";
import { voiceRefusal } from "./voice-check";

export const NOT_PRICED = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุ ทุน หรือแผน";
export const NEED_CONTACT = "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอนะครับ";
export const NOT_STARTED = "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้งนะครับ";

export type Started = { ok: true; id: string } | { ok: false; error: string; needContact?: boolean };

/**
 * `lineOrder`: ordered in the agent's LINE chat — the row says so (the clip goes back there whatever
 * the "คลิปทำเสร็จ" switch says), and the job is queued now, from the LINE answer's own tail.
 */
export async function startQuoteClip(viewer: Viewer, v: VideoInput, customer: string, opts: { lineOrder?: boolean } = {}): Promise<Started> {
  const closed = await closedFor(viewer, "quote-video");
  if (closed) return { ok: false, error: closed };
  const c = checked(v, ...(await payAndPen(viewer.agentId)));
  if (typeof c === "string") return { ok: false, error: c };
  if (!quoteVideoFacts(c)) return { ok: false, error: NOT_PRICED };
  const contact = await getContact(viewer.agentId);
  if (!(contact.name || viewer.name).trim() || !contact.phone) return { ok: false, needContact: true, error: NEED_CONTACT };
  const full = await voiceRefusal(c.voice, langOfInput(c) === "th");
  if (full) return { ok: false, error: full };
  try {
    const made = await createVideo(viewer, c, c.length === "short" ? "" : cleanCustomerName(customer));
    if ("refusal" in made) return { ok: false, error: made.refusal };
    const { id } = made;
    const job = { id, agentName: viewer.name.trim() };
    if (opts.lineOrder) {
      await setRow(id, { line_order: true });
      await runLaterNow(clipProduce, job, { agentId: viewer.agentId });
    } else {
      // the making outlives this answer: the board polls the row
      runLater(clipProduce, job, { agentId: viewer.agentId });
    }
    return { ok: true, id };
  } catch (e) {
    console.error("quote video not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: NOT_STARTED };
  }
}
