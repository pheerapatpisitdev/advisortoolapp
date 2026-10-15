import { dayLabel, type HistItem, type HistKind } from "@/lib/home/history";
import { ROUND_NAMES } from "@/lib/wallet/labels";

/**
 * ประวัติผู้ใช้: the Super Admin's view of anybody's whole history (owner, 2026-10-15; mockup
 * https://claude.ai/artifact/2uzD38rmUBZ223o6SPG3M1). The lines /home's history already draws
 * (src/lib/home/history.ts) plus what only the owner sees: every AI round, every question asked
 * on ถาม AI with its words and cost, each sign-in, each calculator opened, what was set up, what
 * the owner did to the person, and the monthly passes. Each line carries the work it made — the
 * pictures, the clip, the words — so the owner sees what was made, not only that it was
 * ("อยากให้เห็นรายการที่ทำด้วย เช่น Gen ภาพวิดีโอหรือสร้าง Content รูปภาพ").
 *
 * Pure: people-history-read.ts reads the rows and signs the file links.
 */

export type AdminKind = HistKind | "ask" | "login" | "setup" | "calc";

export const ADMIN_KIND_WORD: Record<AdminKind, string> = {
  studio: "Studio", clip: "คลิป", fhc: "FHC", ads: "แอด", money: "เงิน",
  ask: "ถาม AI", login: "เข้าระบบ", setup: "เพจและตั้งค่า", calc: "เครื่องคิดเบี้ย",
};

export const ADMIN_FILTERS: { key: AdminKind | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "studio", label: "Studio / โพสต์" },
  { key: "clip", label: "คลิป" },
  { key: "fhc", label: "FHC" },
  { key: "ads", label: "แอด" },
  { key: "money", label: "เงิน" },
  { key: "ask", label: "ถาม AI" },
  { key: "login", label: "เข้าระบบ" },
  { key: "setup", label: "เพจและตั้งค่า" },
  { key: "calc", label: "เครื่องคิดเบี้ย" },
];

export const isAdminKind = (v: unknown): v is AdminKind =>
  typeof v === "string" && v !== "all" && ADMIN_FILTERS.some((k) => k.key === v);

/** a picture or a clip a line made; `url` null when its file is gone */
export interface Media {
  type: "image" | "video";
  url: string | null;
  /** the full-size picture to open (a poster with its words), when the thumbnail is only its photograph */
  full?: string | null;
  label?: string;
}

export interface AdminItem {
  key: string;
  kind: AdminKind;
  word: string;
  at: string;
  title: string;
  note: string;
  /** whose line it is: the person's id (the feed names them) */
  by: string | null;
  /** signed amount in satang, money lines */
  satang?: number;
  /** what the AI behind the line cost the system, in baht */
  costThb?: number;
  media: Media[];
  /** the words the line made or asked: a post, a question */
  text?: string;
  /** the answer to a question, opened on request */
  answer?: string;
  /** somewhere to see it outside: the post on Facebook */
  link?: { href: string; label: string } | null;
}

/** /home's lines as the owner's, with whose each is */
export function fromHistory(items: HistItem[], by: Map<string, string | null>): AdminItem[] {
  return items.map((it) => ({
    key: it.key, kind: it.kind, word: it.word, at: it.at, title: it.title, note: it.note,
    by: by.get(it.key) ?? null, satang: it.satang, media: [],
  }));
}

const snip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/* --------------------------------- AI rounds --------------------------------- */

export const ROUND_ACTIONS = [...Object.keys(ROUND_NAMES).filter((k) => k.startsWith("ai-")), "ai-returned"];

export interface RoundRow { id: string; at: string; by: string | null; action: string; target: string | null; wallet: boolean }

/** every AI round used, paid or free, with the piece it was for */
export function buildRounds(rows: RoundRow[]): AdminItem[] {
  return rows.map((r) => ({
    key: `round-${r.id}`, kind: "studio", word: ADMIN_KIND_WORD.studio, at: r.at, by: r.by, media: [],
    title: r.action === "ai-returned" ? "คืนรอบ AI (ทำไม่สำเร็จ)" : `ใช้รอบ AI · ${ROUND_NAMES[r.action] ?? r.action}`,
    note: r.action === "ai-returned" ? "ไม่นับรอบนี้" : r.wallet ? "จ่ายจากกระเป๋า" : "รอบฟรี",
  }));
}

/* ----------------------------- คลิปตามโจทย์ drafts ----------------------------- */

export interface DraftRow { id: string; at: string; by: string | null; brief: unknown; madeClipId: string | null }

/** every script the คลิปตามโจทย์ writer wrote for a person, with the brief it was written from (read-only) */
export function buildDrafts(rows: DraftRow[]): AdminItem[] {
  return rows.map((r) => {
    const brief = typeof (r.brief as { brief?: unknown } | null)?.brief === "string" ? (r.brief as { brief: string }).brief : "";
    return {
      key: `draft-${r.id}`, kind: "studio", word: ADMIN_KIND_WORD.studio, at: r.at, by: r.by, media: [],
      title: `เขียนบทคลิปตามโจทย์${brief ? ` “${snip(brief, 60)}”` : ""}`,
      note: r.madeClipId ? "ทำเป็นคลิปแล้ว" : "ยังไม่ได้ทำคลิป",
      text: brief || undefined,
    };
  });
}

/* --------------------------------- ถาม AI --------------------------------- */

export interface AskRow { id: string; at: string; by: string | null; question: string; answer: string; model: string | null; failed: boolean }
/** the ledger's lines of one question, summed: ask_id, its cost and how many calls */
export interface AskCost { askId: string; at: string; by: string | null; thb: number; calls: number; model: string | null; studio: boolean }

/**
 * One line per question asked on ถาม AI. A question kept in ins_ai_asks shows its words; one
 * the ledger knows of from before the words were kept (10–15 Oct 2026) shows only its cost.
 */
export function buildAsks(asks: AskRow[], costs: AskCost[]): AdminItem[] {
  const cost = new Map(costs.map((c) => [c.askId, c]));
  const items: AdminItem[] = asks.map((a) => {
    const c = cost.get(a.id);
    return {
      key: `ask-${a.id}`, kind: "ask", word: ADMIN_KIND_WORD.ask, at: a.at, by: a.by, media: [],
      title: `ถาม “${snip(a.question, 70)}”`,
      note: [a.failed ? "ตอบไม่สำเร็จ" : "", c?.model ?? a.model ?? "", c ? `${c.calls} ครั้งที่เรียก AI` : ""].filter(Boolean).join(" · "),
      text: a.question, answer: a.answer, costThb: c?.thb,
    };
  });
  const kept = new Set(asks.map((a) => a.id));
  for (const c of costs) {
    if (c.studio || kept.has(c.askId)) continue;
    items.push({
      key: `ask-${c.askId}`, kind: "ask", word: ADMIN_KIND_WORD.ask, at: c.at, by: c.by, media: [],
      title: "ถาม AI", note: ["ก่อนเริ่มเก็บข้อความ (15 ต.ค. 2569)", c.model ?? ""].filter(Boolean).join(" · "),
      costThb: c.thb,
    });
  }
  return items;
}

/* --------------------------------- sign-ins --------------------------------- */

export interface LoginRow { id: string; at: string; by: string; how: string; ip: string | null; userAgent: string | null }

const HOW_WORD: Record<string, string> = {
  sso: "เข้าระบบผ่าน UnitOS", code: "เข้าระบบด้วยรหัสตัวแทน", google: "เข้าระบบด้วย Google", super: "เข้าหลังบ้าน (Super Admin)",
};

/** "iPhone · Safari", "Android · LINE", read off the browser's own line; "" when it says nothing known */
export function deviceOf(ua: string | null): string {
  if (!ua) return "";
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const app = /\bLine\//i.test(ua) ? "LINE" : /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook" : /Edg\//.test(ua) ? "Edge"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [device, app].filter(Boolean).join(" · ");
}

/** the address, shortened the way the mockup shows it: the last part hidden */
export function ipShort(ip: string | null): string {
  if (!ip) return "";
  const v4 = ip.split(".");
  if (v4.length === 4) return `IP ${v4[0]}.${v4[1]}.x.x`;
  const v6 = ip.split(":");
  return v6.length > 2 ? `IP ${v6.slice(0, 3).join(":")}:…` : `IP ${ip}`;
}

export function buildLogins(rows: LoginRow[]): AdminItem[] {
  return rows.map((r) => ({
    key: `login-${r.id}`, kind: "login", word: ADMIN_KIND_WORD.login, at: r.at, by: r.by, media: [],
    title: HOW_WORD[r.how] ?? "เข้าระบบ",
    note: [deviceOf(r.userAgent), ipShort(r.ip)].filter(Boolean).join(" · "),
  }));
}

/* --------------------------------- calculators --------------------------------- */

export interface OpenRow { at: string; by: string; tool: string; name: string }

const TZ = "Asia/Bangkok";
const ymd = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

/** a calculator opened ten times in a day is one line: the day's last open, and how many */
export function buildOpens(rows: OpenRow[]): AdminItem[] {
  const days = new Map<string, { last: OpenRow; n: number }>();
  for (const r of rows) {
    const k = `${r.by}|${r.tool}|${ymd(r.at)}`;
    const d = days.get(k);
    if (!d) days.set(k, { last: r, n: 1 });
    else {
      d.n++;
      if (r.at > d.last.at) d.last = r;
    }
  }
  return [...days.entries()].map(([k, { last, n }]) => ({
    key: `calc-${k}`, kind: "calc" as const, word: ADMIN_KIND_WORD.calc, at: last.at, by: last.by, media: [],
    title: `เปิดเครื่องคิดเบี้ย ${last.name}`, note: n > 1 ? `เปิด ${n} ครั้งในวันนั้น` : "",
  }));
}

/* --------------------------------- set-up and the owner's hand --------------------------------- */

export const SETUP_WORD: Record<string, string> = {
  "connect-page": "เชื่อมเพจ", "disconnect-page": "ถอดเพจ",
  "connect-ads": "เชื่อมบัญชีโฆษณา", "connect-ads-manage": "เชื่อมบัญชีโฆษณา (สิทธิ์จัดการ)", "disconnect-ads": "ถอดบัญชีโฆษณา",
  "ads-send-activate": "เปิดแอดให้วิ่ง", "create-ad-campaign": "สร้างแคมเปญโฆษณา", "ads-campaign-delete": "ลบแคมเปญโฆษณา", "ads-page-contact": "แก้ช่องทางติดต่อของเพจในแอด",
  "staff-add": "เพิ่มเข้าทีมงาน", "staff-update": "แก้สิทธิ์ทีมงาน", "staff-remove": "เอาออกจากทีมงาน", "staff-pages": "แก้เพจที่ดูแล",
  "wallet-adjust": "ปรับยอดกระเป๋า", "wallet-unfreeze": "ปลดระงับกระเป๋า", "wallet-settings": "ตั้งค่ากระเป๋าเงิน", "wallet-prices": "แก้ราคา",
  "member-pass-grant": "ให้บัตรรายเดือน", "member-delete": "ลบสมาชิก", "member-suspend": "ระงับสมาชิก", "member-reinstate": "คืนสิทธิ์สมาชิก",
  "member-pass-settings": "ตั้งค่าบัตรรายเดือน", "member-signup-switch": "เปิด/ปิดรับสมัครสมาชิก", "referral-settings": "ตั้งค่าชวนเพื่อน",
  "voice-approve": "อนุมัติเสียง", "voice-reject": "ไม่อนุมัติเสียง",
  "line-broadcast": "ส่งบรอดแคสต์ LINE", "line-broadcast-cancel": "ยกเลิกบรอดแคสต์ LINE", "line-bot": "เปิด/ปิดบอท LINE", "line-menus": "แก้เมนู LINE",
  "line-owner-link-start": "เริ่มผูก LINE เจ้าของ", "line-owner-unlink": "ถอด LINE เจ้าของ", "line-notify-new-member": "ตั้งแจ้งเตือนสมาชิกใหม่",
  "page-welcome": "แก้ข้อความต้อนรับของเพจ", "page-welcome-reset": "คืนข้อความต้อนรับเดิม", "intro-pictures": "แก้รูปต้อนรับ", "intro-pictures-reset": "คืนรูปต้อนรับเดิม",
  "teach-lesson": "สอนบอท", "teach-edit": "แก้บทเรียนบอท", "teach-report": "รายงานคำตอบบอท", "bot-test-save": "บันทึกบททดสอบบอท", "bot-test-delete": "ลบบททดสอบบอท",
};

/** the lines of ins_audit that are neither posts, rounds nor ad sends: those have lines of their own */
export const SKIP_SETUP = new Set(["post", "schedule", "reschedule", "unschedule", "ads-send", ...ROUND_ACTIONS]);

export interface SetupRow { id: string; at: string; actor: string | null; action: string; target: string | null; detail: Record<string, unknown> | null }

/**
 * What the person set up, and what was done to them. `person` is whose history this is: a
 * line someone else wrote about them (the owner adjusting their wallet) says who did it.
 * `names` names the actors.
 */
export function buildSetup(rows: SetupRow[], person: string | null, names: Record<string, string>): AdminItem[] {
  return rows.filter((r) => !SKIP_SETUP.has(r.action)).map((r) => {
    const d = r.detail ?? {};
    const done = person && r.actor !== person;
    const bits = [
      typeof d.pageName === "string" ? d.pageName : "",
      typeof d.satang === "number" ? `${d.satang > 0 ? "+" : ""}฿${(d.satang / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "",
      typeof d.days === "number" ? `${d.days} วัน` : "",
      typeof d.note === "string" && d.note ? `หมายเหตุ: ${d.note}` : "",
      done ? `ทำโดย: ${(r.actor && names[r.actor]) || "เจ้าของ (Super Admin)"}` : "",
    ];
    return {
      key: `setup-${r.id}`, kind: "setup" as const, word: ADMIN_KIND_WORD.setup, at: r.at, by: done ? person : r.actor, media: [],
      title: SETUP_WORD[r.action] ?? r.action, note: bits.filter(Boolean).join(" · "),
    };
  });
}

/* --------------------------------- monthly pass --------------------------------- */

export interface PassRow { id: string; at: string; by: string; kind: string; days: number; satang: number; note: string | null }

const PASS_WORD: Record<string, string> = {
  trial: "เริ่มทดลองใช้", paid: "ซื้อบัตรรายเดือน", granted: "ได้บัตรรายเดือนจากเจ้าของ", referral: "ได้วันเพิ่มจากชวนเพื่อน", revoked: "ถูกยกเลิกบัตร",
};

export function buildPasses(rows: PassRow[]): AdminItem[] {
  return rows.map((r) => ({
    key: `pass-${r.id}`, kind: "money" as const, word: ADMIN_KIND_WORD.money, at: r.at, by: r.by, media: [],
    title: `${PASS_WORD[r.kind] ?? r.kind}${r.days ? ` ${r.days} วัน` : ""}`,
    note: ["บัตรสมาชิก", r.note ?? ""].filter(Boolean).join(" · "),
    satang: r.kind === "paid" && r.satang ? r.satang : undefined,
  }));
}

/* --------------------------------- the whole --------------------------------- */

export function mergeItems(...lists: AdminItem[][]): AdminItem[] {
  const seen = new Set<string>();
  const out: AdminItem[] = [];
  for (const it of lists.flat()) {
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    out.push(it);
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

export interface PersonMonth {
  studio: number; clips: number; customers: number; asks: number;
  toppedUpSatang: number; spentSatang: number; aiThb: number; pictures: number;
}

/** the figures over a person's month */
export function summarizeAdmin(items: AdminItem[], aiThb: number): PersonMonth {
  const s: PersonMonth = { studio: 0, clips: 0, customers: 0, asks: 0, toppedUpSatang: 0, spentSatang: 0, aiThb, pictures: 0 };
  for (const it of items) {
    if (it.kind === "studio" && it.key.startsWith("piece-")) s.studio++;
    else if (it.kind === "studio" && it.word === "โพสต์") s.studio++;
    else if (it.kind === "clip" && it.note.startsWith("เสร็จแล้ว")) s.clips++;
    else if (it.kind === "fhc") s.customers++;
    else if (it.kind === "ask") s.asks++;
    else if (it.kind === "money" && it.satang) {
      if (it.title === "เติมเงินกระเป๋า" || it.key.startsWith("pass-")) s.toppedUpSatang += Math.max(0, it.satang);
      else if (it.satang < 0) s.spentSatang -= it.satang;
    }
    s.pictures += it.media.filter((m) => m.type === "image" && m.url).length;
  }
  return s;
}

/** the CSV of a list, for Excel: a BOM so Thai opens right */
export function toCsv(items: AdminItem[], names: Record<string, string>): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const when = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16);
  const head = ["เวลา", "ชื่อ", "ประเภท", "รายการ", "รายละเอียด", "เงิน (บาท)", "ค่า AI (บาท)", "ข้อความ"];
  const rows = items.map((it) => [
    when(it.at), (it.by && names[it.by]) || "", it.word, it.title, it.note,
    it.satang != null ? (it.satang / 100).toFixed(2) : "", it.costThb != null ? it.costThb.toFixed(4) : "", it.text ?? "",
  ]);
  return `﻿${[head, ...rows].map((r) => r.map((c) => cell(String(c))).join(",")).join("\r\n")}`;
}

/** the lines under their Bangkok day, the hour on each */
export function groupDays(items: AdminItem[], now: Date): { day: string; label: string; items: { item: AdminItem; time: string }[] }[] {
  const days: { day: string; label: string; items: { item: AdminItem; time: string }[] }[] = [];
  for (const item of items) {
    const day = ymd(item.at);
    let g = days[days.length - 1];
    if (!g || g.day !== day) days.push(g = { day, label: dayLabel(day, now), items: [] });
    g.items.push({ item, time: new Date(item.at).toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }) });
  }
  return days;
}
