import { WORRY_LABEL, type Decider, type WorryKey } from "./answers";

/**
 * Every line the agent says in สำรวจความคุ้มครอง, in the agency's own words, built in one place
 * so that what the page shows and what the voice reads (owner, 2026-10-22, mockup
 * 6eXVC2yugSk2rhBRok4Kv2) are the same sentence. The server builds a line again from its key and
 * these few values rather than reading any text from the browser: the voice only ever says the
 * script.
 */

export const LINE_KEYS = [
  "open", "companies", "tie", "reasons", "household", "care", "help", "planned", "worries",
  "budget", "decider", "place", "when", "period", "close", "contact",
] as const;
export type LineKey = (typeof LINE_KEYS)[number];

export interface ScriptCtx {
  female: boolean;
  /** the agent's first name, as the opening says it */
  agentName: string;
  top: WorryKey | null;
  decider: Decider | null;
  /** yyyy-mm-dd and HH:MM, for the closing line */
  date: string;
  time: string;
}

/** the name the opening line uses: the first word of the account's name */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

const DAY = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
const MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** "วันอาทิตย์ที่ 25 ตุลาคม", the way it is said aloud */
export function spokenDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}ที่ ${d} ${MONTH[m - 1]}`;
}

/** the hours the survey offers, as Thai speakers say them */
export const SPOKEN_HOUR: Record<string, string> = {
  "09:00": "เก้าโมงเช้า", "10:00": "สิบโมงเช้า", "11:00": "สิบเอ็ดโมง",
  "13:00": "บ่ายโมง", "14:00": "บ่ายสองโมง", "15:00": "บ่ายสามโมง", "16:00": "สี่โมงเย็น",
  "17:00": "ห้าโมงเย็น", "18:00": "หกโมงเย็น", "19:00": "หนึ่งทุ่ม",
};

/** The line, or "" when it needs a value it does not have yet (the closing before a time is picked). */
export function scriptLine(key: LineKey, c: ScriptCtx): string {
  const me = c.female ? "ดิฉัน" : "ผม";
  const e = c.female ? "ค่ะ" : "ครับ";
  const q = c.female ? "คะ" : "ครับ";
  switch (key) {
    case "open": return `สวัสดี${e} ${me}${c.agentName} ตัวแทนจาก UnitClub ตอนนี้${me}ทำแบบสำรวจสั้น ๆ ว่าคนไทยมีประกันชีวิตกันแค่ไหน ใช้ราว 3 นาที ข้อไหนไม่สะดวกตอบ ข้ามได้เลย${e}`;
    case "companies": return `ตอนนี้มีประกันชีวิตไว้กับบริษัทไหนบ้าง${q}`;
    case "tie": return `ตัวแทนที่ดูแลอยู่ รู้จักกันทางไหน${q}`;
    case "reasons": return `ตอนนั้นตัดสินใจทำเพราะอะไร${q}`;
    case "household": return `คนในบ้านมีประกันกันครบไหม${q} แล้วถือมากี่ปีแล้ว${q}`;
    case "care": return `ทุกวันนี้ตัวแทนยังติดต่อดูแลอยู่ไหม${q}`;
    case "help": return `มีเรื่องไหนที่อยากให้${me}ช่วยดูให้ไหม${q} ไม่มีค่าใช้จ่าย${e}`;
    case "planned": return `เคยมีใครนั่งวางแผนการเงินให้ทั้งครอบครัวบ้างไหม${q} แผนที่ดีช่วยให้ทุกช่วงชีวิตมีเงินพร้อมใช้ ไม่สะดุดเวลาเจอเรื่องไม่คาดคิด${e}`;
    case "worries": return `${me}อ่านให้ฟัง 4 เรื่องนะ${q} แล้วบอก${me}ว่าเรื่องไหนห่วงที่สุด`;
    case "budget": return `ถ้ามีแผนที่ดูแลเรื่อง${c.top ? WORRY_LABEL[c.top] : "ที่ห่วง"}ได้ คุณเก็บเพิ่มได้เดือนละเท่าไรที่ยังสบาย ไม่ตึงเกินไป${q}`;
    case "decider": return `เรื่องเงินก้อนนี้ คุณตัดสินใจเองได้ หรืออยากให้ใครร่วมฟังด้วย${q}`;
    case "place": {
      const withWhom = c.decider === "spouse" ? "พร้อมคู่สมรส" : c.decider === "parents" ? "พร้อมคุณพ่อคุณแม่" : "";
      return `ถ้าจะนั่งคุย${withWhom} ปกติสะดวกที่ไหน${q}`;
    }
    case "when": return `วันธรรมดาหรือเสาร์อาทิตย์ดี${q}`;
    case "period": return `ช่วงเช้า ช่วงบ่าย หรือช่วงเย็นดี${q} แล้วสะดวกกี่โมงดี${q}`;
    case "close": {
      const hour = SPOKEN_HOUR[c.time];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !hour) return "";
      return `ขอเวลา${me}ไปเลือกแผนที่ตรงกับเรื่องที่ห่วงก่อนนะ${q} แล้ว${spokenDay(c.date)} ${hour} ${me}ขอเข้าไปเล่าให้ฟัง${e}`;
    }
    case "contact": return `ขอชื่อ เบอร์โทร และวันเกิดไว้ใช้วางแผนคร่าว ๆ ก่อนนะ${q}`;
  }
}
