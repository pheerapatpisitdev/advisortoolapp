/**
 * มีอะไรใหม่ (owner chose 1ข 2ก 3ก, 2026-11-14, mockup https://claude.ai/artifact/NW7M5MzvhWiZHymbyU34hs): the
 * rules, pure, so they are tested without a database. ./store.ts reads and writes the rows
 * (supabase/migrations/20261211_whats_new.sql).
 *
 * 1ข: a red number on มีอะไรใหม่ in the menu and a bar on /home while anything is unread.
 * 2ก: Claude writes a draft on each push; the Super Admin edits it and publishes it on /admin/updates.
 * 3ก: no LINE message.
 */

export type UpdateKind = "new" | "better" | "fix";
export type UpdateGroup = "studio" | "calc" | "plan" | "account" | "other";
export type UpdateAudience = "all" | "owner";
export type UpdateStatus = "draft" | "live" | "skip";

export interface UpdateRow {
  id: string;
  /** YYYY-MM-DD, Bangkok */
  day: string;
  kind: UpdateKind;
  grp: UpdateGroup;
  place: string;
  title: string;
  body: string;
  link: string | null;
  audience: UpdateAudience;
  status: UpdateStatus;
  source: string | null;
  created_at: string;
  published_at: string | null;
}

/** the three labels, coloured as the mockup has them: ใหม่ green, ปรับปรุง navy, แก้ไข sand */
export const KINDS: { key: UpdateKind; label: string }[] = [
  { key: "new", label: "ใหม่" },
  { key: "better", label: "ปรับปรุง" },
  { key: "fix", label: "แก้ไข" },
];

/** the filter chips on /whats-new, in the mockup's order */
export const GROUPS: { key: UpdateGroup; label: string }[] = [
  { key: "studio", label: "Studio" },
  { key: "calc", label: "เครื่องคิดเบี้ย" },
  { key: "plan", label: "วางแผน / FHC" },
  { key: "account", label: "บัญชีและกระเป๋าเงิน" },
  { key: "other", label: "อื่นๆ" },
];

export const AUDIENCES: { key: UpdateAudience; label: string }[] = [
  { key: "all", label: "ทุกคน" },
  { key: "owner", label: "เจ้าของเท่านั้น" },
];

/** how far back /whats-new and the counts look */
export const SHOWN_DAYS = 60;
/** the words' limits, the same as the table's checks */
export const TITLE_MAX = 80;
export const BODY_MAX = 500;
export const PLACE_MAX = 60;

export const kindLabel = (k: UpdateKind) => KINDS.find((x) => x.key === k)?.label ?? k;
export const groupLabel = (g: UpdateGroup) => GROUPS.find((x) => x.key === g)?.label ?? g;

export const isKind = (v: unknown): v is UpdateKind => KINDS.some((k) => k.key === v);
export const isGroup = (v: unknown): v is UpdateGroup => GROUPS.some((g) => g.key === v);
export const isAudience = (v: unknown): v is UpdateAudience => AUDIENCES.some((a) => a.key === v);

/** whether this viewer is shown the row: live, and for the owner alone when it is the owner's tool */
export function visibleTo(row: Pick<UpdateRow, "status" | "audience">, owner: boolean): boolean {
  return row.status === "live" && (row.audience === "all" || owner);
}

export function bangkokDay(at: Date): string {
  return at.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** the first day /whats-new shows, as YYYY-MM-DD in Bangkok */
export function shownFrom(now: Date): string {
  return bangkokDay(new Date(now.getTime() - SHOWN_DAYS * 24 * 60 * 60 * 1000));
}

/** the rows not read yet, in the order given */
export function unreadOf<T extends { id: string }>(rows: T[], read: Iterable<string>): T[] {
  const seen = new Set(read);
  return rows.filter((r) => !seen.has(r.id));
}

/** the rows by day, newest day first, in the order given within a day */
export function byDay<T extends { day: string }>(rows: T[]): { day: string; rows: T[] }[] {
  const days = new Map<string, T[]>();
  for (const r of rows) days.set(r.day, [...(days.get(r.day) ?? []), r]);
  return [...days.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)).map(([day, list]) => ({ day, rows: list }));
}

/** "วันเสาร์ที่ 14 พ.ย. 2569", the day's heading on /whats-new */
export function dayHeading(day: string): string {
  const at = new Date(`${day}T12:00:00+07:00`);
  const weekday = at.toLocaleDateString("th-TH", { weekday: "long", timeZone: "Asia/Bangkok" });
  const date = at.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  return `${weekday} ${date}`;
}

/** the bar on /home: how many, and the first few titles joined the way the mockup writes them */
export function barText(unread: { title: string }[], shown = 3): { count: number; titles: string } {
  const titles = unread.slice(0, shown).map((u) => u.title);
  const more = unread.length - titles.length;
  return { count: unread.length, titles: titles.join(" · ") + (more > 0 ? ` และอีก ${more} เรื่อง` : "") };
}

export interface UpdateInput {
  kind: UpdateKind;
  grp: UpdateGroup;
  place: string;
  title: string;
  body: string;
  link: string | null;
  audience: UpdateAudience;
}

/**
 * The back office's form, checked: words trimmed and within the table's limits, ลองเลย a path in this app
 * (a full advisortool.app address is cut to its path; anything else is refused).
 */
export function cleanInput(raw: Record<string, unknown>): { ok: true; value: UpdateInput } | { ok: false; error: string } {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = text(raw.title);
  const body = text(raw.body);
  const place = text(raw.place);
  if (!title) return { ok: false, error: "ใส่หัวข้อก่อน" };
  if (title.length > TITLE_MAX) return { ok: false, error: `หัวข้อยาวเกิน ${TITLE_MAX} ตัวอักษร` };
  if (body.length > BODY_MAX) return { ok: false, error: `รายละเอียดยาวเกิน ${BODY_MAX} ตัวอักษร` };
  if (place.length > PLACE_MAX) return { ok: false, error: `ชื่อหน้ายาวเกิน ${PLACE_MAX} ตัวอักษร` };
  if (!isKind(raw.kind)) return { ok: false, error: "เลือกประเภท ใหม่ ปรับปรุง หรือ แก้ไข" };
  if (!isGroup(raw.grp)) return { ok: false, error: "เลือกหมวด" };
  if (!isAudience(raw.audience)) return { ok: false, error: "เลือกว่าใครเห็น" };
  const link = cleanLink(text(raw.link));
  if (link === false) return { ok: false, error: "ลิงก์ \"ลองเลย\" ต้องเป็นหน้าในระบบ เช่น /studio/library" };
  return { ok: true, value: { kind: raw.kind, grp: raw.grp, place, title, body, link, audience: raw.audience } };
}

/** ลองเลย's target: a path in this app, null for none, false for anywhere else */
export function cleanLink(s: string): string | null | false {
  if (!s) return null;
  const path = s.replace(/^https?:\/\/(www\.)?advisortool\.app(?=\/)/i, "");
  return /^\/[^/\s]\S*$/.test(path) ? path : false;
}
