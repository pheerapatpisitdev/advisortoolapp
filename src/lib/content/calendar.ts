/**
 * The content calendar, worked out in Thailand's time — ported from the owner's Maryjane
 * project (src/lib/month-grid.ts, thai-date.ts, schedule-time.ts, calendar-board.ts).
 *
 * Thailand keeps UTC+7 all year, so a day there is a fixed seven hours off UTC and nothing
 * here needs a time-zone library. Day keys are built from UTC arithmetic and never from
 * toISOString() of a local date, which in a +7 browser lands on the day before.
 *
 * Everything is pure, so the board's rules are tested without a browser or a database.
 */

const BKK_MS = 7 * 60 * 60_000;
const DAY_MS = 86_400_000;
const BUDDHIST_OFFSET = 543;

const pad = (n: number) => String(n).padStart(2, "0");
const keyOfUtcMs = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/* -------------------------------- time -------------------------------- */

/** Thailand's date of a moment, "2026-09-25". */
export function dayKey(d: Date): string {
  return keyOfUtcMs(d.getTime() + BKK_MS);
}

export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/** Thailand's clock time of a moment, "19:30". */
export function timeOfDay(d: Date): string {
  const t = new Date(d.getTime() + BKK_MS);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** The moment a Thai day and clock time name: ("2026-09-25", "12:00") → 05:00Z. */
export function bangkokAt(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) - BKK_MS);
}

/** Midnight of a Thai day, as a moment. */
export function dayStart(day: string): Date {
  return bangkokAt(day, "00:00");
}

export function nextDayKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return keyOfUtcMs(Date.UTC(y, m - 1, d) + DAY_MS);
}

/* -------------------------------- month -------------------------------- */

export interface MonthCell {
  day: string;
  /** false: a day borrowed from the month either side, drawn faintly but still droppable */
  inMonth: boolean;
}

/**
 * Every cell of a month's grid, Monday first. The lead and tail borrow real days from the
 * neighbouring months instead of blanks, so a post can be dragged across a month's edge.
 */
export function monthGridDays(year: number, month: number): MonthCell[] {
  const firstMs = Date.UTC(year, month - 1, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (new Date(firstMs).getUTCDay() + 6) % 7;
  const cells: MonthCell[] = [];
  for (let i = lead; i > 0; i--) cells.push({ day: keyOfUtcMs(firstMs - i * DAY_MS), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: `${year}-${pad(month)}-${pad(d)}`, inMonth: true });
  const lastMs = Date.UTC(year, month - 1, daysInMonth);
  for (let i = 1; cells.length % 7 !== 0; i++) cells.push({ day: keyOfUtcMs(lastMs + i * DAY_MS), inMonth: false });
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** A month from the URL, or the fallback when it is not a sensible one — the URL can say anything. */
export function parseMonth(rawYear: string | undefined, rawMonth: string | undefined, fallback: { year: number; month: number }) {
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fallback;
  if (!Number.isInteger(month) || month < 1 || month > 12) return fallback;
  return { year, month };
}

const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_MONTHS_SHORT = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** (2026, 9) → "กันยายน 2569" — Thai calendars count Buddhist years */
export function thaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS[month] ?? ""} ${year + BUDDHIST_OFFSET}`;
}

/** "2026-09-25" → "ศุกร์ที่ 25 ก.ย. 2569" */
export function thaiDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${THAI_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}ที่ ${d} ${THAI_MONTHS_SHORT[m]} ${y + BUDDHIST_OFFSET}`;
}

/* -------------------------------- board -------------------------------- */

/** a piece's place on the board, as the calendar sees it */
export type BoardStatus = "waiting" | "posting" | "scheduled" | "published" | "failed";

export interface BoardItem {
  id: string;
  pageId: string | null;
  pageName: string;
  planHref: string;
  planName: string;
  hook: string;
  body: string;
  /** the poster, drawn by the poster route */
  imageUrl: string;
  status: BoardStatus;
  /** Thai day key; null while it waits in the รอตั้งเวลา rail */
  day: string | null;
  /** "HH:MM"; for a waiting piece, the time a drop will give it */
  time: string;
  postId: string | null;
  /** the piece is still รอตรวจ — nobody has looked it over */
  unreviewed: boolean;
  /** why it may not go up at all: a Facebook-rule finding marked block */
  blocked: string | null;
  /** who last put it on the Page or moved it there, from ins_audit — staff share one Page */
  by?: string;
}

/** where a dropped waiting piece lands on its day — the owner's pick (14:10 for an hour on 2026-09-24, then back) */
export const DROP_TIME = "12:00";

/**
 * The times a drop fills on one Page's day, in order: the owner's noon first, then the
 * evening the editor offers too, then the morning, late afternoon and night.
 *
 * Every drop used to land at noon. Four drops on one day went up on one Page at the same
 * minute, and a drop on today after 11:45 was refused (Facebook holds a post fifteen minutes
 * ahead at least) and jumped back to the rail.
 */
export const DROP_SLOTS = [DROP_TIME, "19:30", "08:30", "17:00", "21:00"] as const;

/** Facebook's fifteen minutes, and five more for the trip there */
const DROP_MARGIN_MS = 20 * 60_000;

/**
 * The time a drop on `day` gets: the first slot still ahead that the Page has nothing at
 * (`taken`, "HH:MM" of its posts that day). With every slot ahead taken it shares the first
 * of them, as all drops did before; null when the day has no slot left ahead at all.
 */
export function dropTime(day: string, taken: readonly string[], now: Date = new Date()): string | null {
  const ahead = DROP_SLOTS.filter((t) => bangkokAt(day, t).getTime() - now.getTime() >= DROP_MARGIN_MS);
  return ahead.find((t) => !taken.includes(t)) ?? ahead[0] ?? null;
}

/**
 * The last day a drop can reach. Facebook holds a post thirty days ahead at most, and the
 * thirtieth day is only partly inside that, so the board stops a day short rather than light
 * up a day the server will refuse.
 */
export function lastDropDay(today: string): string {
  let day = today;
  for (let i = 0; i < 29; i++) day = nextDayKey(day);
  return day;
}

/** Posted or on its way is fixed; waiting, held and refused can still be moved. */
export function canDrag(item: BoardItem): boolean {
  return item.status === "waiting" || item.status === "scheduled" || item.status === "failed";
}

/** What the browser can decide alone; whether the time is still ahead is the server's to say. */
export function canDropOnDay(item: BoardItem, day: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (!canDrag(item) || item.blocked) return false;
  if (day < today || day > lastDropDay(today)) return false;
  return day !== item.day;
}

/** Why a drop is refused, in the owner's words; null when it is not. */
export function dropRejection(item: BoardItem, day: string, today: string): string | null {
  if (!canDrag(item)) return "ชิ้นนี้โพสต์ไปแล้ว ย้ายวันไม่ได้";
  if (item.blocked) return `ชิ้นนี้ผิดกฎโฆษณาของ Facebook (${item.blocked}) — แก้ก่อนแล้วค่อยตั้งเวลา`;
  if (day < today) return "ย้ายไปวันที่ผ่านมาแล้วไม่ได้";
  if (day > lastDropDay(today)) return "ตั้งเวลาล่วงหน้าได้ไม่เกิน 30 วัน";
  return null;
}

/** Posts into their days, by time within a day. */
export function groupByDay(items: BoardItem[]): Map<string, BoardItem[]> {
  const byDay = new Map<string, BoardItem[]>();
  for (const item of items) {
    if (!item.day) continue;
    const list = byDay.get(item.day);
    if (list) list.push(item);
    else byDay.set(item.day, [item]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  return byDay;
}

/**
 * The first day, from today to the last Facebook will hold for, that a Page has nothing on,
 * and the time a drop gives it then (noon, or the evening once noon has gone). "The next gap":
 * the Pages run one post a day, so a gap is a day, not a second slot on a day already posted.
 * `pageDays`: the days the Page has a post held or up.
 */
export function nextOpenDay(pageDays: ReadonlySet<string>, now: Date = new Date()): { day: string; time: string } | null {
  const today = todayKey(now);
  const last = lastDropDay(today);
  for (let day = today; day <= last; day = nextDayKey(day)) {
    if (pageDays.has(day)) continue;
    const time = dropTime(day, [], now);
    if (time) return { day, time };
  }
  return null;
}

/* -------------------------------- the week -------------------------------- */

/** The seven day keys, Monday to Sunday, of the week a day falls in. */
export function weekOf(day: string): string[] {
  const [y, m, d] = day.split("-").map(Number);
  const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday is 0
  let at = keyOfUtcMs(Date.UTC(y, m - 1, d) - back * DAY_MS);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) { days.push(at); at = nextDayKey(at); }
  return days;
}

export interface WeekSummary {
  days: string[];
  published: number;
  scheduled: number;
  failed: number;
  /** today and the days after it this week with nothing up or held */
  emptyAhead: string[];
}

/**
 * This week at a glance, over the board's pieces: what went up, what is held, what did not go
 * up, and the days still to come with nothing on them — the gaps to fill.
 */
export function weekSummary(items: BoardItem[], today: string): WeekSummary {
  const days = weekOf(today);
  const inWeek = items.filter((i) => i.day && days.includes(i.day));
  const count = (s: BoardItem["status"]) => inWeek.filter((i) => i.status === s).length;
  const covered = new Set(inWeek.filter((i) => i.status === "scheduled" || i.status === "published" || i.status === "posting").map((i) => i.day));
  return {
    days,
    published: count("published"),
    scheduled: count("scheduled"),
    failed: count("failed"),
    emptyAhead: days.filter((d) => d >= today && !covered.has(d)),
  };
}

/** A day a post can still be put on: today up to the last day Facebook will hold one for. */
export function fillable(day: string, today: string): boolean {
  return day >= today && day <= lastDropDay(today);
}

/** The rail: what has no day yet, a post that failed first — it was meant to be up already. */
export function unscheduled(items: BoardItem[]): BoardItem[] {
  const rail = items.filter((i) => i.day === null);
  return [...rail.filter((i) => i.status === "failed"), ...rail.filter((i) => i.status !== "failed")];
}

/**
 * The day a piece sits on, or null for the rail. Held and posted pieces sit on their time's
 * day; so does one that failed — a send refused, or a time Facebook let pass — while that day
 * is on the grid shown, so a missed day is seen where it happened and can be dragged from
 * there. It used to wait in the rail with no date, and the red count on a day never showed.
 */
export function boardDay(kind: "none" | "posting" | "scheduled" | "published" | "failed", at: Date | null, from: Date, to: Date): string | null {
  // on its way to the Page this minute: on the day of its send, until Facebook answers
  if (!at || kind === "none") return null;
  if (kind === "failed" && (at < from || at >= to)) return null;
  return dayKey(at);
}

/** posts on the board per Page, for the filter chips */
export function countByPage(items: BoardItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.day || !item.pageId) continue;
    counts.set(item.pageId, (counts.get(item.pageId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Posts that follow one about the same plan on the same Page — a follower reads the same
 * product twice running as the Page having nothing else to say.
 */
export function repeats(items: BoardItem[]): Set<string> {
  const placed = items.filter((i) => i.day).sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));
  const out = new Set<string>();
  const last = new Map<string, string>();
  for (const i of placed) {
    const page = i.pageId ?? "";
    if (last.get(page) === i.planHref) out.add(i.id);
    last.set(page, i.planHref);
  }
  return out;
}
