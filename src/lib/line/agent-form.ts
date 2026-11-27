import { saysFormDone, WANTS_IN } from "@/lib/assistant/common";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

/**
 * ลิงก์ฟอร์มใบคำขอของฉัน (owner chose ค ก ก, 2026-11-27, mockup https://claude.ai/artifact/7sJchDbGgkax2iM1ndUSwH).
 *
 * An agent linked by เชื่อม LINE ของฉัน who asks the LINE OA for a form gets their own form, not
 * the agency's ?ref=sa-9f3a one a customer gets: an application filled in through it then reaches
 * them. Their own is, first, the link they typed in ตั้งค่าส่วนตัว (ins_agent_prefs.form_link), and
 * otherwise, for a UnitClub agent, their UnitClub form <team's site>/apply/<handle> (ค). An agent
 * with neither is told where to set one (ก), and is not sent the agency's form.
 */

export type FormLink = { url: string; source: "own" | "unitclub" };

/** the longest link the column takes (supabase/migrations/20261222_agent_form_link.sql) */
export const FORM_LINK_MAX = 500;

/** where a link is set: the page, opened in the phone's own browser (Google sign-in fails in LINE's) */
export function settingsLink(): string {
  const url = new URL(siteUrl("/studio/settings"));
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

/**
 * A link as it will be kept, or why it cannot be: https only, so a customer is never sent to a
 * plain-text page, and no longer than the column takes. Blank = no link of one's own.
 */
export function cleanFormLink(input: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const raw = input.trim();
  if (!raw) return { ok: true, url: null };
  if (raw.length > FORM_LINK_MAX) return { ok: false, error: "ลิงก์ยาวเกินไป" };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "ลิงก์ไม่ถูกต้อง ตัวอย่าง https://ktaxa83g.com/apply/ชื่อของคุณ" };
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) {
    return { ok: false, error: "ลิงก์ต้องขึ้นต้นด้วย https://" };
  }
  return { ok: true, url: url.toString() };
}

/* ── where the link comes from ─────────────────────────────────────────────────────────────── */

const prefs = () => supabaseAdmin().from("ins_agent_prefs");

/** the link the agent typed, or null */
export async function ownFormLink(agentId: string): Promise<string | null> {
  const { data, error } = await prefs().select("form_link").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`form link not read: ${error.message}`);
  return (data as { form_link?: string | null } | null)?.form_link ?? null;
}

export async function saveOwnFormLink(agentId: string, url: string | null): Promise<void> {
  const { error } = await prefs().upsert(
    { agent_id: agentId, form_link: url, updated_at: new Date().toISOString() },
    { onConflict: "agent_id" },
  );
  if (error) throw new Error(`form link not saved: ${error.message}`);
}

interface Team { slug: string; status: string; custom_domain: string | null; config: { features?: { insurance?: unknown } } | null }

/** the team's own site: its own domain when it set one, else <slug>.unitclub.app (UnitOS tenantHomeUrl) */
export function teamOrigin(team: Pick<Team, "slug" | "custom_domain">): string {
  const host = String(team.custom_domain ?? "").trim() || `${team.slug}.unitclub.app`;
  return `https://${host}`;
}

/** a team whose forms take applications, by UnitOS's own get_apply_agent: open, with ใบคำขอ not switched off */
export function teamTakesForms(team: Pick<Team, "status" | "config">): boolean {
  return ["trialing", "active", "past_due"].includes(team.status) && String(team.config?.features?.insurance ?? "true") !== "false";
}

/**
 * The agent's UnitClub form, or null: not a UnitClub agent (a สมาชิกทั่วไป, KingClub, Bluewealth),
 * no form link made yet (UnitClub makes the handle the first time they open ใบคำขอ), the link
 * blocked, or the team's forms closed. Read with the service key, as UnitClub's tables are.
 */
export async function unitclubFormLink(agentId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: cards, error } = await db.from("agent_cards").select("handle, blocked, tenant_id").eq("agent_id", agentId).limit(1);
  if (error) throw new Error(`agent card not read: ${error.message}`);
  const c = ((cards ?? []) as { handle: string | null; blocked: boolean; tenant_id: string }[])[0];
  if (!c?.handle || c.blocked) return null;
  const { data: tenant, error: tErr } = await db.from("tenants").select("slug, status, custom_domain, config").eq("id", c.tenant_id).maybeSingle();
  if (tErr) throw new Error(`team not read: ${tErr.message}`);
  const t = tenant as Team | null;
  if (!t || !teamTakesForms(t)) return null;
  return `${teamOrigin(t)}/apply/${encodeURIComponent(c.handle)}`;
}

/** the link the bot sends this agent: the one they typed first (ค), else their UnitClub form */
export async function formLinkFor(agentId: string): Promise<FormLink | null> {
  const own = await ownFormLink(agentId);
  if (own) return { url: own, source: "own" };
  const unitclub = await unitclubFormLink(agentId);
  return unitclub ? { url: unitclub, source: "unitclub" } : null;
}

/** the agent whose LINE this is, by เชื่อม LINE ของฉัน; null = a customer, or an agent not linked */
export async function agentOfLine(lineUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().from("ins_agent_line").select("agent_id").eq("line_user_id", lineUserId).limit(1);
  if (error) throw new Error(`agent line not read: ${error.message}`);
  return ((data ?? []) as { agent_id: string }[])[0]?.agent_id ?? null;
}

/* ── the words ─────────────────────────────────────────────────────────────────────────────── */

const ASKS_FORM = /ฟอร์ม|form|ใบคำขอ|ลิงก์สมัคร|ลิ้งค์สมัคร|ลิงค์สมัคร/i;

/**
 * An agent asking for a form: สนใจสมัคร (the customer menu's button, which an agent can still
 * tap), or a short message that names the form. Not one saying a form is done ("ส่งฟอร์มแล้ว"),
 * and not a long message that only mentions one.
 */
export function asksForForm(text: string): boolean {
  const t = text.trim();
  if (t === WANTS_IN) return true;
  if (t.length > 80 || saysFormDone(t)) return false;
  // "กรอกฟอร์มเสร็จแล้ว" is news, not a request: only one that asks (ขอ) wants the link
  if (/เสร็จ|เรียบร้อย|แล้ว/.test(t) && !/ขอ/.test(t)) return false;
  return ASKS_FORM.test(t);
}

/**
 * What the bot sends the agent (ก ก ก): with a link, the link and then a message ready to pass on
 * to a customer (press and hold › แชร์); without one, where to set it.
 */
export function agentFormReply(link: FormLink | null): string[] {
  if (!link) {
    return [[
      "บัญชีของคุณยังไม่มีลิงก์ฟอร์มใบคำขอครับ",
      "วางลิงก์ฟอร์มของคุณได้ที่ ตั้งค่าส่วนตัว › ลิงก์ฟอร์มใบคำขอของฉัน",
      "แล้วพิมพ์ขอฟอร์มอีกครั้ง บอทจะส่งลิงก์ของคุณให้",
      "",
      settingsLink(),
    ].join("\n")];
  }
  const where = link.source === "unitclub"
    ? "ลูกค้ากรอกแล้ว ใบคำขอเข้าเมนูใบคำขอใน UnitClub ของคุณเอง"
    : "ลิงก์ที่คุณตั้งไว้ในตั้งค่าส่วนตัว";
  return [
    [
      "ลิงก์ฟอร์มใบคำขอของคุณครับ 📄",
      where,
      "",
      link.url,
      "",
      "ข้อความถัดไปส่งต่อให้ลูกค้าได้เลย (กดค้างที่ข้อความ › แชร์)",
    ].join("\n"),
    [
      "สมัครออนไลน์ได้ตามนี้เลย 😊",
      "1️⃣ กรอกฟอร์มตามลิงก์นี้",
      link.url,
      "2️⃣ เตรียมบัตรประชาชนตัวจริงที่ยังไม่หมดอายุ",
      "3️⃣ รอ SMS จากบริษัทเพื่อยืนยันตัวตน (e-KYC) แล้วทำตามขั้นตอนบนหน้าจอ",
      "4️⃣ ชำระเบี้ยผ่านลิงก์ใน SMS",
      "กรอกเสร็จแล้วแจ้งกลับได้เลย 🙏",
    ].join("\n"),
  ];
}
