import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * How an agent is reached from the ads on one Facebook Page: ins_page_contact, service_role
 * only. Kept once per Page and appended to every long-form ad. All three fields are optional;
 * a Page with none set has no row.
 */

export interface PageContact { agentName: string | null; lineId: string | null; inboxUrl: string | null }

const NAME_MAX = 60;
const LINE_MAX = 40;
const INBOX_MAX = 200;
const BAD_INBOX = "ลิงก์ Inbox ต้องขึ้นต้นด้วย https://";
const LONG_INBOX = `ลิงก์ Inbox ยาวเกินไป (ไม่เกิน ${INBOX_MAX} ตัวอักษร)`;

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Loose typing in, tidy contact out: trimmed, @ and inner spaces gone from the Line ID, https
 * only. The scheme is stored in lower case, so "HTTPS://…" passes the table's ^https:// check.
 */
export function cleanContact(v: unknown): PageContact | { error: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const name = text(o.agentName).slice(0, NAME_MAX);
  const line = text(o.lineId).replace(/^@/, "").replace(/\s+/g, "").slice(0, LINE_MAX);
  const inbox = text(o.inboxUrl).replace(/^https:\/\//i, "https://");
  if (inbox) {
    let ok = false;
    try { ok = inbox.startsWith("https://") && new URL(inbox).protocol === "https:"; } catch { /* not a URL */ }
    if (!ok) return { error: BAD_INBOX };
    if (inbox.length > INBOX_MAX) return { error: LONG_INBOX };
  }
  return { agentName: name || null, lineId: line || null, inboxUrl: inbox || null };
}

/** The closing lines of an ad: whichever contacts are set, or a plain invitation. */
export function contactBlock(c: PageContact | null): string {
  const lines: string[] = [];
  if (c?.agentName) lines.push(`👉 ${c.agentName}`);
  if (c?.lineId) lines.push(`📲 Line: @${c.lineId}`);
  if (c?.inboxUrl) lines.push(`👉 Inbox: ${c.inboxUrl}`);
  return lines.length ? lines.join("\n") : "ทักแชทได้เลย";
}

export async function getPageContact(pageId: string): Promise<PageContact | null> {
  const { data, error } = await supabaseAdmin()
    .from("ins_page_contact")
    .select("agent_name, line_id, inbox_url")
    .eq("page_id", pageId)
    .maybeSingle();
  if (error) throw new Error(`getPageContact: ${error.message}`);
  if (!data) return null;
  const r = data as { agent_name: string | null; line_id: string | null; inbox_url: string | null };
  return { agentName: r.agent_name, lineId: r.line_id, inboxUrl: r.inbox_url };
}

/** Saves the Page's contacts; with nothing set the row is deleted, which is how a form is cleared. */
export async function savePageContact(pageId: string, c: PageContact): Promise<void> {
  const db = supabaseAdmin();
  if (!c.agentName && !c.lineId && !c.inboxUrl) {
    const { error } = await db.from("ins_page_contact").delete().eq("page_id", pageId);
    if (error) throw new Error(`savePageContact: ${error.message}`);
    return;
  }
  const { error } = await db.from("ins_page_contact").upsert({
    page_id: pageId,
    agent_name: c.agentName,
    line_id: c.lineId,
    inbox_url: c.inboxUrl,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`savePageContact: ${error.message}`);
}
