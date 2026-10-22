import { WORRIES, WORRY_LABEL, type Decider, type WorryKey } from "./answers";

/**
 * Every line the agent says in สำรวจความคุ้มครอง, in the agency's own words, built in one place
 * so that what the page shows and what the voice reads (owner, 2026-10-22, mockup
 * 6eXVC2yugSk2rhBRok4Kv2) are the same sentence. The server builds a line again from its key and
 * these few values rather than reading any text from the browser: the voice only ever says the
 * script. Every line has a handful of forms at most (`allLines`), so all of them are made ahead
 * and play at once (owner chose ค, 2026-10-22: the closing line no longer says the day and hour).
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
}

/** the name the opening line uses: the first word of the account's name */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** The line as the agent says it. */
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
    case "close": return `ขอเวลา${me}ไปเลือกแผนที่ตรงกับเรื่องที่ห่วงก่อนนะ${q} แล้ววันที่นัดไว้ ${me}ขอเข้าไปเล่าให้ฟัง${e}`;
    case "contact": return `ขอชื่อ เบอร์โทร และวันเกิดไว้ใช้วางแผนคร่าว ๆ ก่อนนะ${q}`;
  }
}

/**
 * Every form every line can take, in both voices: the shared lines (which worry, who comes along)
 * and, given a name, that agent's own opening. About forty shared, two per agent.
 */
export function allLines(agentName?: string): { text: string; female: boolean }[] {
  const out = new Map<string, { text: string; female: boolean }>();
  for (const female of [false, true]) {
    const base: ScriptCtx = { female, agentName: agentName ?? "", top: null, decider: null };
    const add = (c: ScriptCtx, k: LineKey) => {
      const text = scriptLine(k, c);
      out.set(`${female}|${text}`, { text, female });
    };
    for (const k of LINE_KEYS) {
      if (k === "open") { if (agentName) add(base, k); continue; }
      if (k === "budget") { for (const top of [null, ...WORRIES]) add({ ...base, top }, k); continue; }
      if (k === "place") { for (const decider of [null, "spouse", "parents"] as const) add({ ...base, decider }, k); continue; }
      add(base, k);
    }
  }
  return [...out.values()];
}
