import { supabaseAdmin } from "@/lib/supabase/admin";
import { broadcast, broadcastSeen, friends, quota, type LineMessage } from "@/lib/line/client";
import { MENUS } from "@/lib/line/rich-menu";

/**
 * Broadcasts from /admin/line (owner chose ข, 2026-10-15: sent now or at a set time).
 *
 * A broadcast goes to every friend who has not blocked the account. Choosing who gets it is not
 * possible here: the webhook keeps a LINE user only as a hash, and LINE's own audiences by sex
 * and age need a hundred friends. Each friend reached is one of the month's pushed messages,
 * however many bubbles it carries.
 */

export type Part = { type: "text"; text: string } | { type: "image"; url: string };
export interface Reply { label: string; text: string }

export const MAX_PARTS = 5;
const MAX_TEXT = 5000;
/** a scheduled broadcast a year out is a typo, not a plan */
const MAX_AHEAD_MS = 365 * 86_400_000;
const BUCKET = "line-broadcast";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

/**
 * The quick replies a broadcast may carry: the start menu's own buttons, whose words the bot
 * already reads, so a tap is answered like a tap on the menu.
 */
export const REPLY_CHOICES: Reply[] = MENUS.start.buttons.map((b) => ({ label: b.title, text: b.text }));

export function bucketPrefix(): string {
  return supabaseAdmin().storage.from(BUCKET).getPublicUrl("x").data.publicUrl.slice(0, -1);
}

export async function saveBroadcastPicture(bytes: Buffer, mimeType: string): Promise<string> {
  const ext = EXT[mimeType];
  if (!ext) throw new Error("unsupported picture type");
  const name = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(name, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return `${bucketPrefix()}${name}`;
}

export interface BroadcastInput { parts: Part[]; replies: Reply[]; sendAt: Date | null }

/** What the page sent, checked: parts in order, replies from the menu, and a time or now. */
export function readBroadcastInput(input: unknown, prefix: string, now = Date.now()):
  { ok: true; value: BroadcastInput } | { ok: false; error: string } {
  const o = (input ?? {}) as { parts?: unknown; replies?: unknown; sendAt?: unknown };
  if (!Array.isArray(o.parts)) return { ok: false, error: "ไม่มีข้อความ" };
  const parts: Part[] = [];
  for (const p of o.parts as { type?: unknown; text?: unknown; url?: unknown }[]) {
    if (p?.type === "text" && typeof p.text === "string") {
      const text = p.text.trim();
      if (!text) continue;
      if (text.length > MAX_TEXT) return { ok: false, error: `ข้อความยาวเกิน ${MAX_TEXT.toLocaleString("en-US")} ตัวอักษร` };
      parts.push({ type: "text", text });
    } else if (p?.type === "image" && typeof p.url === "string" && p.url.startsWith(prefix)) {
      parts.push({ type: "image", url: p.url });
    } else {
      return { ok: false, error: "มีชิ้นที่อ่านไม่ได้ ลองลบแล้วใส่ใหม่" };
    }
  }
  if (!parts.length) return { ok: false, error: "ใส่ข้อความหรือรูปอย่างน้อย 1 ชิ้น" };
  if (parts.length > MAX_PARTS) return { ok: false, error: `ส่งได้ครั้งละไม่เกิน ${MAX_PARTS} ชิ้น` };

  const wanted = Array.isArray(o.replies) ? (o.replies as unknown[]).filter((r): r is string => typeof r === "string") : [];
  const replies = REPLY_CHOICES.filter((c) => wanted.includes(c.text));

  let sendAt: Date | null = null;
  if (o.sendAt !== null && o.sendAt !== undefined && o.sendAt !== "") {
    const t = typeof o.sendAt === "string" ? Date.parse(o.sendAt) : NaN;
    if (!Number.isFinite(t)) return { ok: false, error: "อ่านเวลาส่งไม่ได้" };
    if (t < now + 60_000) return { ok: false, error: "เวลาส่งต้องเป็นเวลาข้างหน้า" };
    if (t > now + MAX_AHEAD_MS) return { ok: false, error: "ตั้งเวลาล่วงหน้าได้ไม่เกิน 1 ปี" };
    sendAt = new Date(t);
  }
  return { ok: true, value: { parts, replies, sendAt } };
}

/** The bubbles as LINE takes them, the buttons on the last. The owner's words go as written. */
export function toLineMessages(parts: Part[], replies: Reply[]): LineMessage[] {
  const messages: LineMessage[] = parts.map((p) => (p.type === "text"
    ? { type: "text", text: p.text }
    : { type: "image", originalContentUrl: p.url, previewImageUrl: p.url }));
  if (replies.length && messages.length) {
    messages[messages.length - 1].quickReply = {
      items: replies.map((r) => ({ type: "action", action: { type: "message", label: r.label.slice(0, 20), text: r.text } })),
    };
  }
  return messages;
}

export type Status = "scheduled" | "sending" | "sent" | "failed" | "cancelled";

export interface Broadcast {
  id: string;
  parts: Part[];
  replies: Reply[];
  status: Status;
  sendAt: string;
  sentAt: string | null;
  requestId: string | null;
  recipients: number | null;
  error: string | null;
  /** how many saw it, when LINE says (twenty reached or more) */
  seen?: number | null;
}

interface Row {
  id: string; parts: Part[]; replies: Reply[]; status: Status; send_at: string; sent_at: string | null;
  request_id: string | null; recipients: number | null; error: string | null;
}

const COLUMNS = "id, parts, replies, status, send_at, sent_at, request_id, recipients, error";

function fromRow(r: Row): Broadcast {
  return {
    id: r.id, parts: r.parts ?? [], replies: r.replies ?? [], status: r.status, sendAt: r.send_at, sentAt: r.sent_at,
    requestId: r.request_id, recipients: r.recipients, error: r.error,
  };
}

export async function createBroadcast(b: BroadcastInput, by: string | null): Promise<string> {
  const { data, error } = await supabaseAdmin().from("ins_line_broadcasts").insert({
    parts: b.parts, replies: b.replies, status: "scheduled",
    send_at: (b.sendAt ?? new Date()).toISOString(), created_by: by,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

async function finish(id: string, patch: Partial<Row>): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_line_broadcasts").update(patch).eq("id", id);
  if (error) console.error("[line] broadcast row not updated:", id, error.message);
}

/**
 * Sends one broadcast whose time has come. The row is claimed (scheduled → sending) before LINE
 * is called, so the five-minute sweep and a "send now" can never both send it; and its id is
 * LINE's retry key besides. Returns the row as it ends, or null when it was not this call's.
 */
export async function sendBroadcast(id: string): Promise<Broadcast | null> {
  const { data, error } = await supabaseAdmin().from("ins_line_broadcasts")
    .update({ status: "sending" }).eq("id", id).eq("status", "scheduled").lte("send_at", new Date().toISOString())
    .select(COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Row;

  // a broadcast the month cannot pay for is refused here, in Thai, instead of by LINE in English
  const [q, f] = await Promise.all([quota(), friends()]);
  if (q?.limit != null && f && q.used + f.reach > q.limit) {
    const error = `โควตาไม่พอ: ต้องใช้ ${f.reach} เหลือ ${Math.max(0, q.limit - q.used)} จาก ${q.limit}`;
    await finish(id, { status: "failed", error });
    return fromRow({ ...row, status: "failed", error });
  }

  try {
    const sent = await broadcast(toLineMessages(row.parts, row.replies), id);
    const patch = { status: "sent" as const, sent_at: new Date().toISOString(), request_id: sent.requestId, recipients: f?.reach ?? null, error: null };
    await finish(id, patch);
    return fromRow({ ...row, ...patch });
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 500) : String(e);
    console.error("[line] broadcast not sent:", id, error);
    await finish(id, { status: "failed", error });
    return fromRow({ ...row, status: "failed", error });
  }
}

/** Every broadcast whose time has come, oldest first: the five-minute sweep. */
export async function sendDue(): Promise<number> {
  const { data, error } = await supabaseAdmin().from("ins_line_broadcasts")
    .select("id").eq("status", "scheduled").lte("send_at", new Date().toISOString()).order("send_at").limit(10);
  if (error) throw new Error(error.message);
  let sent = 0;
  for (const { id } of (data ?? []) as { id: string }[]) {
    if ((await sendBroadcast(id))?.status === "sent") sent += 1;
  }
  return sent;
}

/** Only a broadcast still waiting for its time can be cancelled. */
export async function cancelBroadcast(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("ins_line_broadcasts")
    .update({ status: "cancelled" }).eq("id", id).eq("status", "scheduled").select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** The latest broadcasts, newest time first, with what LINE says of who saw the sent ones. */
export async function listBroadcasts(limit = 20): Promise<Broadcast[]> {
  const { data, error } = await supabaseAdmin().from("ins_line_broadcasts")
    .select(COLUMNS).order("send_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Row[]).map(fromRow);
  await Promise.all(rows.map(async (b) => {
    if (b.status === "sent" && b.requestId) b.seen = await broadcastSeen(b.requestId);
  }));
  return rows;
}

/** Friends that scheduled broadcasts will spend, so the page can say what is left after them. */
export function pendingSpend(list: Broadcast[], reach: number): number {
  return list.filter((b) => b.status === "scheduled").length * reach;
}
