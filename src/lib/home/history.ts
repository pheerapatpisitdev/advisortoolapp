import type { Gap } from "@/lib/fhc/gaps";
import { entryLabel } from "@/lib/wallet/labels";
import type { WalletEntry } from "@/lib/wallet/store";
import { gapLine } from "./today";

/**
 * ประวัติการทำงาน: everything a person did in the system, newest first (owner chose option ก,
 * 2026-10-14; mockup https://claude.ai/artifact/F1RaNZ4oSiQyYdMfJqsmxN). A card of the latest
 * on /home, the whole of it month by month on /home/history.
 *
 * Shaped from rows the stores already keep (history-read.ts reads them), so it is pure and
 * tested. Nothing new is written anywhere for it. Only the viewer's own work: the owner looks
 * at other people's from the admin pages.
 */

export type HistKind = "studio" | "clip" | "fhc" | "ads" | "money";

export const KIND_WORD: Record<HistKind, string> = {
  studio: "Studio", clip: "คลิป", fhc: "FHC", ads: "แอด", money: "เงิน",
};

/** the filter chips, in the order the page shows them */
export const KIND_FILTERS: { key: HistKind | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "studio", label: "Studio / โพสต์" },
  { key: "clip", label: "คลิป" },
  { key: "fhc", label: "FHC" },
  { key: "ads", label: "แอด" },
  { key: "money", label: "เงิน" },
];

export const isHistKind = (v: unknown): v is HistKind =>
  typeof v === "string" && KIND_FILTERS.some((k) => k.key === v && v !== "all");

export interface HistItem {
  key: string;
  kind: HistKind;
  /** the word on the pill: โพสต์ for a post put on a Page, else the kind's own */
  word: string;
  at: string;
  title: string;
  note: string;
  href: string | null;
  action: string | null;
  /** money rows: the signed amount, drawn in place of a link */
  satang?: number;
}

/** the rows as the reader hands them over; plan names already looked up */
export interface HistSources {
  pieces: { id: string; createdAt: string; format: string; planName: string; hook: string; campaignId: string | null }[];
  /** ins_audit rows of putting pieces on a Page: post, schedule, reschedule, unschedule */
  posts: { id: string; at: string; action: string; pieceId: string | null; pageName: string | null; hook: string; when: string | null }[];
  videos: { id: string; createdAt: string; product: string | null; fhc: boolean; motion: boolean; customer: string; status: string }[];
  customers: { id: string; createdAt: string; name: string; gaps: Gap[] }[];
  thumbnails: { id: string; createdAt: string }[];
  readings: { id: string; createdAt: string; summary: string }[];
  sends: { id: string; createdAt: string; campaignId: string | null; campaignName: string | null; pageName: string | null; objective: string; budgetMinor: number; currency: string; error: string | null }[];
  entries: (Pick<WalletEntry, "id" | "kind" | "amountSatang" | "round" | "note" | "createdAt">)[];
}

const TZ = "Asia/Bangkok";
const DAY_MS = 24 * 60 * 60 * 1000;

const snippet = (s: string, max = 48) => {
  const line = s.split("\n")[0].trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
};
/** a hook in quotes; one that already opens with quote marks keeps its own, not two pairs */
const quoted = (s: string) => {
  const bare = s.trim().replace(/^["“”']+/, "").replace(/["“”']+$/, "");
  return bare ? `“${snippet(bare)}”` : "";
};

const FORMAT_WORD: Record<string, string> = { post: "เขียนโพสต์", script: "เขียนสคริปต์", ad: "เขียนแอด", clip: "ตัดต่อคลิป" };

const PRODUCT_NAME: Record<string, string> = {
  LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", PENSION: "บำนาญ 95", LEGACY: "มรดก", PLB: "Protection Life",
};

const VIDEO_STATE: Record<string, string> = { done: "เสร็จแล้ว", failed: "ไม่สำเร็จ", drawing: "กำลังทำ", rendering: "กำลังทำ" };

const POST_WORD: Record<string, string> = {
  post: "โพสต์ขึ้นเพจ", schedule: "ตั้งเวลาโพสต์", reschedule: "เลื่อนเวลาโพสต์", unschedule: "ถอนโพสต์ที่ตั้งเวลา",
};
export const POST_ACTIONS = Object.keys(POST_WORD);

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short" });
const ymdOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

const money = (minor: number, currency: string) =>
  `${currency === "THB" ? "฿" : `${currency} `}${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** every row as one line of the history, newest first */
export function buildHistory(s: HistSources): HistItem[] {
  const items: HistItem[] = [];

  for (const p of s.pieces) {
    const ad = p.format === "ad";
    items.push({
      key: `piece-${p.id}`, kind: "studio", word: KIND_WORD.studio, at: p.createdAt,
      title: `${FORMAT_WORD[p.format] ?? "เขียนชิ้นงาน"} · ${p.planName}`,
      note: quoted(p.hook),
      href: ad ? (p.campaignId ? `/studio/ads/${p.campaignId}` : "/studio/ads") : `/studio/write?open=${p.id}`,
      action: "เปิด",
    });
  }

  // a post dragged about the calendar is moved many times in a day: that day shows its last move only
  const seen = new Set<string>();
  for (const p of [...s.posts].sort((a, b) => b.at.localeCompare(a.at))) {
    const word = POST_WORD[p.action];
    if (!word) continue;
    const once = `${p.pieceId ?? p.id}|${p.action}|${ymdOf(new Date(p.at))}`;
    if (seen.has(once)) continue;
    seen.add(once);
    const when = p.when && p.action !== "unschedule" && p.action !== "post" ? `ขึ้น ${shortDate(p.when)} ${clock(p.when)}` : "";
    items.push({
      key: `post-${p.id}`, kind: "studio", word: "โพสต์", at: p.at,
      title: [word, quoted(p.hook)].filter(Boolean).join(" "),
      note: [p.pageName ?? "เพจ", when].filter(Boolean).join(" · "),
      href: p.pieceId ? `/studio/write?open=${p.pieceId}` : "/studio/calendar",
      action: "เปิด",
    });
  }

  for (const v of s.videos) {
    const plan = v.fhc ? "สรุป FHC" : `วิดีโอนำเสนอ ${PRODUCT_NAME[v.product ?? "LIFEPROTECT"] ?? ""}`.trim();
    items.push({
      key: `clip-${v.id}`, kind: "clip", word: KIND_WORD.clip, at: v.createdAt,
      title: v.customer ? `${plan} · ${v.customer}` : plan,
      note: [VIDEO_STATE[v.status] ?? v.status, v.fhc ? "" : v.motion ? "Motion Graphic" : "ปกติ"].filter(Boolean).join(" · "),
      href: "/studio/quote-video",
      action: v.status === "done" ? "ดูคลิป" : "เปิด",
    });
  }

  for (const c of s.customers) {
    items.push({
      key: `fhc-${c.id}`, kind: "fhc", word: KIND_WORD.fhc, at: c.createdAt,
      title: `เพิ่มลูกค้า ${c.name}`,
      note: gapLine(c.gaps) || "ครบทุกด้านแล้ว",
      href: `/fhc/customers/${c.id}`, action: "เปิด",
    });
  }

  for (const t of s.thumbnails) {
    items.push({
      key: `thumb-${t.id}`, kind: "studio", word: KIND_WORD.studio, at: t.createdAt,
      title: "ทำภาพปกคลิป", note: "", href: "/studio/thumbnail", action: "เปิด",
    });
  }

  for (const r of s.readings) {
    items.push({
      key: `read-${r.id}`, kind: "studio", word: KIND_WORD.studio, at: r.createdAt,
      title: "ถอดรูปเป็น prompt", note: snippet(r.summary, 60), href: "/studio/describe", action: "เปิด",
    });
  }

  for (const a of s.sends) {
    items.push({
      key: `send-${a.id}`, kind: "ads", word: KIND_WORD.ads, at: a.createdAt,
      title: `ยิงแอด ${a.objective === "leads" ? "ฟอร์มลูกค้า" : "Messenger"}${a.campaignName ? ` · ${a.campaignName}` : ""}`,
      note: [a.pageName, `${money(a.budgetMinor, a.currency)}/วัน`, a.error ? "ไม่สำเร็จ" : ""].filter(Boolean).join(" · "),
      href: a.campaignId ? `/studio/ads/${a.campaignId}` : "/studio/ads",
      action: "ผล",
    });
  }

  for (const e of s.entries) {
    items.push({
      key: `money-${e.id}`, kind: "money", word: KIND_WORD.money, at: e.createdAt,
      title: e.kind === "topup" ? "เติมเงินกระเป๋า" : e.kind === "charge" ? `หักค่า${entryLabel(e)}` : entryLabel(e),
      note: "กระเป๋าเงิน", href: "/studio/wallet", action: null, satang: e.amountSatang,
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

/** the search box: every word typed must be in the line's title or note */
export function matches(item: HistItem, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${item.title} ${item.note}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** "วันนี้ · พุธ 14 ต.ค.", "เมื่อวาน · อังคาร 13 ต.ค.", else "จันทร์ 12 ต.ค." */
export function dayLabel(ymd: string, now: Date): string {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  const name = d.toLocaleDateString("th-TH", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).replace(/^วัน/, "");
  if (ymd === ymdOf(now)) return `วันนี้ · ${name}`;
  if (ymd === ymdOf(new Date(now.getTime() - DAY_MS))) return `เมื่อวาน · ${name}`;
  return name;
}

/** the full page: the lines under their Bangkok day, the hour on each */
export function byDay(items: HistItem[], now: Date): { day: string; label: string; items: (HistItem & { time: string })[] }[] {
  const days: { day: string; label: string; items: (HistItem & { time: string })[] }[] = [];
  for (const it of items) {
    const day = ymdOf(new Date(it.at));
    let group = days[days.length - 1];
    if (!group || group.day !== day) days.push(group = { day, label: dayLabel(day, now), items: [] });
    group.items.push({ ...it, time: clock(it.at) });
  }
  return days;
}

/** the card on /home: the hour today, เมื่อวาน, else the date */
export function whenShort(iso: string, now: Date): string {
  const day = ymdOf(new Date(iso));
  if (day === ymdOf(now)) return clock(iso);
  if (day === ymdOf(new Date(now.getTime() - DAY_MS))) return "เมื่อวาน";
  return shortDate(iso);
}

export interface MonthSummary { studio: number; clips: number; customers: number; spentSatang: number }

/** the four figures over the month's list: Studio work, clips finished, FHC customers, money spent */
export function summarize(items: HistItem[]): MonthSummary {
  const sum: MonthSummary = { studio: 0, clips: 0, customers: 0, spentSatang: 0 };
  for (const it of items) {
    if (it.kind === "studio" && it.word !== "โพสต์") sum.studio++;
    else if (it.kind === "clip" && it.key.startsWith("clip-") && it.note.startsWith(VIDEO_STATE.done)) sum.clips++;
    else if (it.kind === "fhc") sum.customers++;
    else if (it.kind === "money" && it.title.startsWith("หักค่า") && (it.satang ?? 0) < 0) sum.spentSatang -= it.satang!;
  }
  return sum;
}

/** a month as the page's ?m= carries it, "2026-10" */
export type Month = `${number}-${number}`;

export const monthOf = (now: Date): Month => ymdOf(now).slice(0, 7) as Month;

export function parseMonth(v: unknown, now: Date): Month {
  if (typeof v === "string" && /^20\d\d-(0[1-9]|1[0-2])$/.test(v) && v <= monthOf(now)) return v as Month;
  return monthOf(now);
}

/** midnight on the 1st to midnight on the next 1st, Bangkok */
export function monthRange(m: Month): [Date, Date] {
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return [new Date(`${m}-01T00:00:00+07:00`), new Date(`${next}-01T00:00:00+07:00`)];
}

export function shiftMonth(m: Month, by: number): Month {
  const [y, mo] = m.split("-").map(Number);
  const n = y * 12 + (mo - 1) + by;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}` as Month;
}

/** "ตุลาคม 2569" */
export const monthLabel = (m: Month) =>
  new Date(`${m}-15T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: TZ, month: "long", year: "numeric" });

/** the month picker: this month back to the first month the system kept work (2026-09) */
export const FIRST_MONTH: Month = "2026-09";
export function monthOptions(now: Date): Month[] {
  const out: Month[] = [];
  for (let m = monthOf(now); m >= FIRST_MONTH; m = shiftMonth(m, -1)) out.push(m);
  return out;
}
