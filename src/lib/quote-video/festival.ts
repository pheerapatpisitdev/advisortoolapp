/**
 * ธีมเทศกาล (owner, 2026-10-20, idea 1 on https://claude.ai/artifact/MsvkeeeepPz4XG4TDvhN9n, "ตามที่แนะนำ"):
 * a Motion Graphic look that comes on by itself in the seven days up to a festival, which the agent
 * may turn off. The clip keeps the festival it was asked for in (input.festival), so one drawn a day
 * late still says the same greeting. No drawing here, so the form can import it.
 *
 * Lunar festivals move: their dates are listed year by year, and a year not listed has none.
 * ตรุษจีน 2027–2030 as the calendars agree; ลอยกระทง is the full moon of the twelfth month, which
 * sources put a day apart some years — 2026 and 2027 as the Thai sources give them. Add the next
 * years here before they come.
 */

export type FestivalKey = "newyear" | "cny" | "songkran" | "mother" | "loykrathong" | "father";
export const FESTIVAL_KEYS: FestivalKey[] = ["newyear", "cny", "songkran", "mother", "loykrathong", "father"];
export const readFestival = (v: unknown): FestivalKey | undefined => (FESTIVAL_KEYS.includes(v as FestivalKey) ? (v as FestivalKey) : undefined);

/** the days before a festival its look comes on */
export const FESTIVAL_LEAD_DAYS = 7;

interface Festival {
  name: string;
  /** the festival's own days, month-day ("01-01"), by year where it moves */
  days: (year: number) => { from: string; to: string } | null;
  /** what the clip says at its top, for a festival whose first day falls in `year` (ค.ศ.) */
  greeting: (year: number) => string;
}

const fixed = (from: string, to = from) => () => ({ from, to });
const lunar = (dates: Record<number, string>) => (year: number) => (dates[year] ? { from: dates[year], to: dates[year] } : null);

export const FESTIVALS: Record<FestivalKey, Festival> = {
  newyear: { name: "ปีใหม่", days: fixed("01-01"), greeting: (y) => `สวัสดีปีใหม่ ${y + 543}` },
  cny: { name: "ตรุษจีน", days: lunar({ 2027: "02-06", 2028: "01-26", 2029: "02-13", 2030: "02-03" }), greeting: () => "ซินเจียยู่อี่ ซินนี้ฮวดไช้" },
  songkran: { name: "สงกรานต์", days: fixed("04-13", "04-15"), greeting: () => "สุขสันต์วันสงกรานต์" },
  mother: { name: "วันแม่", days: fixed("08-12"), greeting: () => "สุขสันต์วันแม่" },
  loykrathong: { name: "ลอยกระทง", days: lunar({ 2026: "11-24", 2027: "11-13" }), greeting: () => "สุขสันต์วันลอยกระทง" },
  father: { name: "วันพ่อ", days: fixed("12-05"), greeting: () => "สุขสันต์วันพ่อ" },
};

const DAY = 86_400_000;
/** the date in Bangkok as midnight UTC, so whole days subtract cleanly */
const bangkokDay = (now: Date) => {
  const d = new Date(now.getTime() + 7 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const at = (year: number, md: string) => Date.UTC(year, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5)));

/**
 * The festival whose look is on today in Bangkok: from FESTIVAL_LEAD_DAYS before its first day to its
 * last. When two are on at once, the nearer one. Null between festivals.
 */
export function festivalOn(now = new Date()): { key: FestivalKey; name: string; greeting: string; first: string } | null {
  const today = bangkokDay(now);
  const year = new Date(today).getUTCFullYear();
  let best: { key: FestivalKey; start: number; year: number } | null = null;
  for (const key of FESTIVAL_KEYS) {
    // this year's, and next year's for a festival early in January seen from late December
    for (const y of [year, year + 1]) {
      const days = FESTIVALS[key].days(y);
      if (!days) continue;
      const start = at(y, days.from), end = at(y, days.to);
      if (today < start - FESTIVAL_LEAD_DAYS * DAY || today > end) continue;
      if (!best || start < best.start) best = { key, start, year: y };
    }
  }
  if (!best) return null;
  const f = FESTIVALS[best.key];
  return { key: best.key, name: f.name, greeting: f.greeting(best.year), first: new Date(best.start).toISOString().slice(0, 10) };
}

/** the greeting a clip asked for on `asked` shows, for the festival it kept */
export function festivalGreeting(key: FestivalKey, asked: Date): string {
  const on = festivalOn(asked);
  if (on?.key === key) return on.greeting;
  // asked for outside its days (a row from a test or a hand-made input): this year's words
  return FESTIVALS[key].greeting(new Date(bangkokDay(asked)).getUTCFullYear());
}
