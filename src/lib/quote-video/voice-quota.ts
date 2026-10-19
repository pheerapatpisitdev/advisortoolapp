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

/**
 * What a clip form says about Gemini's voice (owner, 2026-10-17, mockup https://claude.ai/artifact/WdDKuEDh2k42TZ9nFJjW9x):
 * when a Thai clip has a fallback reader waiting, a green note and no block; otherwise the old warning.
 * `clock` is when the day's cap turns over; null when the key is off in /admin/ai instead.
 */
export function voiceNotice(q: { clock: string | null; fallback: boolean }, thai: boolean): { text: string; ok: boolean; blocked: boolean } {
  if (thai && q.fallback) {
    return { text: "เสียง Gemini ใช้ไม่ได้ตอนนี้ ระบบจะใช้เสียง ElevenLabs แทนให้เอง (อ้อม สำหรับผู้หญิง สมชาย สำหรับผู้ชาย) ไม่คิดเพิ่ม", ok: true, blocked: false };
  }
  return { text: q.clock ? voiceFullNotice(q.clock) : thai ? "เสียงพากย์ Google ใช้ไม่ได้ตอนนี้ เลือกเสียง ElevenLabs แทน" : "เสียงพากย์ภาษานี้ใช้ Google ซึ่งใช้ไม่ได้ตอนนี้ ลองใหม่ภายหลัง", ok: false, blocked: true };
}

/**
 * The form's note while the ElevenLabs voices cannot speak (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/J34jDCp3JK3adTytUcZ36f, ก): the clip still starts, read by Google.
 */
export const ELEVEN_TO_GOOGLE = {
  text: "เสียง ElevenLabs ใช้ไม่ได้ตอนนี้ ระบบจะใช้เสียง Google เพศเดียวกันแทนให้เอง ไม่คิดค่าเสียง ElevenLabs",
  ok: true,
  blocked: false,
} as const;

/** the clip card's line when Google read a clip in place of its ElevenLabs voice */
export const googleInPlace = (eleven: string, google: string) => `เสียง ${eleven} ใช้ไม่ได้ตอนนี้ ใช้เสียง Google (${google}) แทน · ไม่คิดค่าเสียง ElevenLabs`;
