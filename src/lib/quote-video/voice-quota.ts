/**
 * Gemini's voice runs out for the day (owner, 2026-10-12): 100 lines a day for the whole app, so
 * once one clip hits the cap the board warns everyone until it comes back. Google's day turns over
 * at midnight Pacific time — 14:00 in Bangkok, 15:00 while Pacific time is on standard time.
 */

const PACIFIC = "America/Los_Angeles";

/** what the card of a clip that hit the cap says; the start also marks those rows */
export const VOICE_FULL = "เสียงพากย์ของวันนี้ใช้ครบแล้ว";

/** minutes Pacific time is off UTC at the instant `t` (−420 in summer, −480 in winter) */
function pacificOffset(t: number): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC, timeZoneName: "shortOffset" })
    .formatToParts(t).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : -480;
}

/** midnight of a Pacific calendar day, as an instant (the clocks change at 2 am, after it) */
function pacificMidnight(y: number, m: number, d: number): Date {
  const day = Date.UTC(y, m - 1, d);
  return new Date(day - pacificOffset(day + 8 * 3600_000) * 60_000);
}

/** the Gemini day `now` falls in: from its midnight Pacific to the next */
export function voiceDay(now = new Date()): { from: Date; until: Date } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now).split("-").map(Number);
  return { from: pacificMidnight(y, m, d), until: pacificMidnight(y, m, d + 1) };
}

/** "14:00", Bangkok time */
export function bangkokClock(t: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
}

export const voiceFullText = (until: Date) => `${VOICE_FULL} ลองใหม่ได้หลัง ${bangkokClock(until)} น.`;

/** the form's warning while the voice is used up (mockup https://claude.ai/artifact/EKUYHGVtP3hxNMPxuJDaBt, ข) */
export const voiceFullNotice = (clock: string) => `เสียงพากย์ Google ของวันนี้ใช้ครบแล้ว สร้างได้อีกครั้งหลัง ${clock} น.`;
