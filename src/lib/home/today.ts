import type { Gap } from "@/lib/fhc/gaps";
import { AREA_LABEL, GAP_WORD } from "@/lib/fhc/gaps";

/**
 * งานวันนี้: what /home shows after signing in (owner chose option ข, 2026-10-14; mockup
 * https://claude.ai/artifact/A68Avj5hwURLdR66fWAzLH). The owner said the page carries no ask-AI
 * box: the chat is at /ask, reached from the menu.
 *
 * Everything here is shaped from figures the page has already read, so it is pure and tested.
 * A figure that could not be read is null and its tile or line is left out: a tile saying ฿0
 * because the wallet was unreadable would be a wrong number, not a missing one.
 */

export interface TodayInput {
  now: Date;
  name: string;
  /** a gated member's live pass end; null for everybody else */
  passEnd: Date | null;
  /** the wallet's balance while the owner has it on; null when off, frozen, unread, or the owner */
  walletSatang: number | null;
  /** Studio's free rounds; null for the owner (no allowance) or when unread */
  rounds: { limit: number; used: number } | null;
  /** posts going up on the viewer's Pages today; null for somebody who posts to no Page */
  postsToday: { at: string; pageName: string; text: string }[] | null;
  /** the viewer's own unused drafts; null when unread */
  drafts: number | null;
  /** the viewer's own FHC customers, newest first; null when unread */
  customers: { id: string; name: string; createdAt: string; gaps: Gap[] }[] | null;
  /** the viewer's clips still being made */
  clipsMaking: { id: string; label: string; status: "drawing" | "rendering"; href?: string }[] | null;
}

export type Tone = "plain" | "warn";

export interface Tile {
  key: "wallet" | "pass" | "rounds" | "posts" | "fhc";
  label: string;
  value: string;
  note: string;
  href: string;
  tone: Tone;
}

export type TodoKind = "clip" | "fhc" | "post";

export interface Todo {
  key: string;
  kind: TodoKind;
  title: string;
  note: string;
  href: string;
  action: string;
}

export interface Today {
  greeting: string;
  date: string;
  tiles: Tile[];
  todos: Todo[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** the customers named on the list; the rest are on /fhc/customers */
export const FHC_SHOWN = 3;
/** the posts named on the list; more than this reads as a calendar, which has its own page */
export const POSTS_SHOWN = 3;

const baht = (satang: number) =>
  `฿${(satang / 100).toLocaleString("en-US", { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const thaiDate = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", ...opts });

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });

/** a customer still lacking something: any area not yet พอแล้ว */
const open = (gaps: Gap[]) => gaps.filter((g) => g.state !== "ok");

/** "ยังขาดสุขภาพ · ชีวิตไม่พอ": the areas in the fixed order the check uses */
export function gapLine(gaps: Gap[]): string {
  return open(gaps).map((g) => (g.state === "missing" ? `ยังขาด${AREA_LABEL[g.key]}` : `${AREA_LABEL[g.key]}${GAP_WORD.short}`)).join(" · ");
}

export function buildToday(i: TodayInput): Today {
  const tiles: Tile[] = [];

  if (i.passEnd) {
    const left = Math.max(0, Math.ceil((i.passEnd.getTime() - i.now.getTime()) / DAY_MS));
    tiles.push({
      key: "pass", label: "สมาชิก", value: `${left} วัน`,
      note: `ถึง ${thaiDate(i.passEnd, { day: "numeric", month: "short" })}`,
      href: "/membership", tone: left <= 3 ? "warn" : "plain",
    });
  } else if (i.walletSatang !== null) {
    tiles.push({ key: "wallet", label: "กระเป๋าเงิน", value: baht(i.walletSatang), note: "เติมเงิน", href: "/studio/wallet", tone: "plain" });
  }

  if (i.rounds && i.rounds.limit === 0) {
    // a member's pass carries credit, not free rounds (owner, 2026-10-17): what Studio can spend, credit and own money together
    if (i.walletSatang !== null) {
      tiles.push({ key: "rounds", label: "เครดิต Studio", value: baht(i.walletSatang), note: "รวมเงินที่เติมเอง", href: "/studio/wallet", tone: i.walletSatang === 0 ? "warn" : "plain" });
    }
  } else if (i.rounds) {
    const left = Math.max(0, i.rounds.limit - i.rounds.used);
    tiles.push({
      key: "rounds", label: "รอบฟรี Studio", value: String(left), note: `จาก ${i.rounds.limit} รอบ`,
      href: "/studio/write", tone: left === 0 ? "warn" : "plain",
    });
  }

  if (i.postsToday) {
    const pages = new Set(i.postsToday.map((p) => p.pageName)).size;
    tiles.push({
      key: "posts", label: "โพสต์วันนี้", value: String(i.postsToday.length),
      note: i.postsToday.length ? `${pages} เพจ` : "ยังไม่มีโพสต์", href: "/studio/calendar", tone: "plain",
    });
  }

  if (i.customers) {
    const lacking = i.customers.filter((c) => open(c.gaps).length > 0).length;
    tiles.push({
      key: "fhc", label: "ลูกค้า FHC", value: String(i.customers.length),
      note: i.customers.length ? `ยังขาดความคุ้มครอง ${lacking}` : "ทำ FHC กับลูกค้าคนแรก",
      href: i.customers.length ? "/fhc/customers" : "/fhc", tone: "plain",
    });
  }

  const todos: Todo[] = [];
  for (const c of i.clipsMaking ?? []) {
    todos.push({
      key: `clip-${c.id}`, kind: "clip", title: c.label,
      note: c.status === "rendering" ? "กำลังตัดต่อคลิป" : "กำลังวาดภาพในคลิป",
      href: c.href ?? "/studio/quote-video", action: "ดู",
    });
  }
  for (const c of (i.customers ?? []).filter((c) => open(c.gaps).length > 0).slice(0, FHC_SHOWN)) {
    const offer = open(c.gaps).find((g) => g.product)?.product;
    todos.push({
      key: `fhc-${c.id}`, kind: "fhc", title: `${c.name} ${gapLine(c.gaps)}`,
      note: `ทำ FHC เมื่อ ${thaiDate(new Date(c.createdAt), { day: "numeric", month: "short" })}`,
      href: `/fhc/customers/${c.id}`, action: offer ? `เสนอ ${offer}` : "ดู",
    });
  }
  if (i.drafts) {
    todos.push({
      key: "drafts", kind: "post", title: `ร่างโพสต์ ${i.drafts} ชิ้นรอตรวจ`,
      note: "ตรวจแล้วกดใช้ หรือตั้งเวลาโพสต์", href: "/studio/write", action: "ไปตรวจ",
    });
  }
  // only what is still to go up: a post already out is on the calendar, not a job
  for (const p of (i.postsToday ?? []).filter((p) => Date.parse(p.at) > i.now.getTime()).slice(0, POSTS_SHOWN)) {
    todos.push({
      key: `post-${p.at}-${p.pageName}`, kind: "post", title: `โพสต์ ${clock(p.at)} วันนี้${p.text ? ` · ${p.text}` : ""}`,
      note: p.pageName, href: "/studio/calendar", action: "ดู",
    });
  }

  return {
    greeting: `สวัสดีคุณ${i.name}`,
    date: thaiDate(i.now, { weekday: "long", day: "numeric", month: "long" }),
    tiles,
    todos,
  };
}

/** The links under ทางลัด: fixed, the tools agents open most (no usage is tracked to rank them). */
export const SHORTCUTS: { href: string; label: string; note: string }[] = [
  { href: "/studio/quote-video", label: "วิดีโอนำเสนอ", note: "Studio" },
  { href: "/studio/write", label: "Organic Studio", note: "Studio" },
  { href: "/lifeprotect", label: "Life Protect x 2", note: "ประกันชีวิต" },
  { href: "/ihealthy-ultra", label: "iHealthy Ultra", note: "ประกันสุขภาพ" },
  { href: "/fhc", label: "Financial Health Check", note: "วางแผนประกัน" },
];
