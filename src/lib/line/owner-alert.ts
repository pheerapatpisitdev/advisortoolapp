import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { push, reply } from "@/lib/line/client";
import { siteUrl } from "@/lib/site-url";

/**
 * Alerts to the owner's own LINE, sent by the official account (owner chose ก, 2026-10-15: one
 * message for every new member, the moment they join).
 *
 * The webhook keeps customers only as a hash, so the account cannot know which chat is the
 * owner's until the owner says so: /admin/line shows a code, the owner types it into the chat,
 * and that chat's id is kept. Each alert is a push, one of the month's 300.
 */

const LINK_TTL_MS = 10 * 60_000;
/** what the owner types: the word and the six digits on /admin/line */
const LINK_WORDS = /^ผูก\s*(\d{6})$/;

export interface OwnerLine {
  linked: boolean;
  linkedAt: string | null;
  notifyNewMember: boolean;
  /** the code waiting to be typed, while it is still good */
  pendingCode: string | null;
  pendingUntil: string | null;
}

interface Row {
  owner_line_user_id: string | null;
  owner_line_linked_at: string | null;
  owner_line_link_code: string | null;
  owner_line_link_expires: string | null;
  notify_new_member: boolean | null;
}

async function row(): Promise<Row | null> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings")
    .select("owner_line_user_id, owner_line_linked_at, owner_line_link_code, owner_line_link_expires, notify_new_member")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

async function save(patch: Partial<Row>): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings")
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function ownerLine(now = Date.now()): Promise<OwnerLine> {
  const r = await row();
  const live = r?.owner_line_link_code && r.owner_line_link_expires && Date.parse(r.owner_line_link_expires) > now;
  return {
    linked: Boolean(r?.owner_line_user_id),
    linkedAt: r?.owner_line_linked_at ?? null,
    notifyNewMember: r?.notify_new_member !== false,
    pendingCode: live ? r!.owner_line_link_code : null,
    pendingUntil: live ? r!.owner_line_link_expires : null,
  };
}

/** A fresh code for the owner to type, good for ten minutes; any earlier code stops working. */
export async function startLink(): Promise<{ code: string; until: string }> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const until = new Date(Date.now() + LINK_TTL_MS).toISOString();
  await save({ owner_line_link_code: code, owner_line_link_expires: until });
  return { code, until };
}

export async function unlink(): Promise<void> {
  await save({ owner_line_user_id: null, owner_line_linked_at: null, owner_line_link_code: null, owner_line_link_expires: null });
}

export async function setNotifyNewMember(on: boolean): Promise<void> {
  await save({ notify_new_member: on });
}

/** The code's words with the invisible characters a phone keyboard slips in taken out. */
export function linkCodeIn(text: string): string | null {
  const m = text.replace(/[​-‍﻿]/g, "").trim().match(LINK_WORDS);
  return m ? m[1] : null;
}

/**
 * Called by the webhook with every text before the bot sees it. True when it was the owner's
 * code — right or wrong — so the bot does not answer it as a customer's question.
 */
export async function tryLink(text: string, userId: string, replyToken: string): Promise<boolean> {
  const code = linkCodeIn(text);
  if (!code) return false;
  const r = await row().catch(() => null);
  const good = r?.owner_line_link_code && r.owner_line_link_expires
    && Date.parse(r.owner_line_link_expires) > Date.now()
    && r.owner_line_link_code.length === code.length
    && crypto.timingSafeEqual(Buffer.from(r.owner_line_link_code), Buffer.from(code));
  if (!good) {
    await reply(replyToken, [{ type: "text", text: "รหัสไม่ถูกหรือหมดเวลาแล้วครับ กดขอรหัสใหม่ที่หลังบ้าน หน้า LINE OA" }]).catch(() => {});
    return true;
  }
  await save({ owner_line_user_id: userId, owner_line_linked_at: new Date().toISOString(), owner_line_link_code: null, owner_line_link_expires: null });
  await reply(replyToken, [{ type: "text", text: "ผูก LINE นี้กับหลังบ้านแล้วครับ จะแจ้งที่นี่เมื่อมีสมาชิกใหม่" }]).catch(() => {});
  return true;
}

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", {
  timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

/** The alert's words for one new member. */
export function newMemberText(m: { name: string; email: string; createdAt: string }, total: number | null): string {
  return [
    "🆕 สมาชิกใหม่",
    m.name,
    m.email,
    `${when(m.createdAt)} น.`,
    "",
    ...(total !== null ? [`สมาชิกทั้งหมด ${total.toLocaleString("en-US")} คน`] : []),
    siteUrl("/admin/members"),
  ].join("\n");
}

async function pushToOwner(text: string): Promise<boolean> {
  const r = await row();
  if (!r?.owner_line_user_id) return false;
  await push(r.owner_line_user_id, [{ type: "text", text }]);
  return true;
}

/**
 * Tells the owner a member has just joined. Never throws: the sign-in it follows has already
 * succeeded, and an alert that could not go out is only written to the log.
 */
export async function alertNewMember(memberId: string): Promise<void> {
  try {
    const r = await row();
    if (!r?.owner_line_user_id || r.notify_new_member === false) return;
    const db = supabaseAdmin();
    const [m, count] = await Promise.all([
      db.from("ins_members").select("name, email, created_at").eq("id", memberId).maybeSingle(),
      db.from("ins_members").select("id", { count: "exact", head: true }),
    ]);
    if (m.error || !m.data) throw new Error(m.error?.message ?? "member not found");
    const d = m.data as { name: string; email: string; created_at: string };
    await push(r.owner_line_user_id, [{ type: "text", text: newMemberText({ name: d.name, email: d.email, createdAt: d.created_at }, count.count ?? null) }]);
  } catch (e) {
    console.error(`[line] new-member alert for ${memberId} not sent:`, e);
  }
}

/** The test button on /admin/line. */
export async function sendTestAlert(): Promise<boolean> {
  return pushToOwner("✅ ทดสอบแจ้งเตือนจากหลังบ้าน advisortool.app\nถ้าเห็นข้อความนี้ แจ้งเตือนสมาชิกใหม่จะมาที่นี่");
}
