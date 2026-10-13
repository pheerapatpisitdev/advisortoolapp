import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { iShieldFacts } from "@/lib/ishield-facts";
import type { Product } from "./script";

/**
 * The questions the longer clips answer (owner, 2026-10-13: ถาม-ตอบ 2 ข้อ "จากคลังถาม-ตอบของบอท").
 *
 * The same answers the chat bots give, from the same sources — src/lib/assistant/lifeprotect/faq.ts,
 * src/lib/assistant/ishield/faq.ts (the /ishield page's own), src/lib/assistant/ihealthy/faq.ts and
 * the /bumnan95 page (its FAQ, removed 2026-10-14; see git history of src/components/pension/Sections.tsx) — said for the voice: shorter, a woman's
 * endings (script.ts makes them a man's), and without the words the voice never says (เบี้ย,
 * เสียชีวิต, เวนคืน). Not one fact is added to or taken from the bots' answers.
 */

export interface SpokenQa { key: string; q: string; a: string }

export function productQas(product: Product): SpokenQa[] {
  switch (product) {
    case "LIFEPROTECT":
      return [
        { key: "checkup", q: "ต้องตรวจสุขภาพไหม", a: "ขึ้นกับอายุ ทุน และประวัติสุขภาพค่ะ บริษัทพิจารณาแบบปกติ" },
        { key: "waiting", q: "ต้องรอนานไหมกว่าจะคุ้มครอง", a: "คุ้มครองหลังกรมธรรม์อนุมัติ ไม่มีระยะรอคอยค่ะ" },
        { key: "causes", q: "คุ้มครองกรณีไหนบ้าง", a: "ทั้งเจ็บป่วยและอุบัติเหตุ ตลอด 24 ชั่วโมง ทั่วโลกค่ะ" },
        { key: "tax", q: "ลดหย่อนภาษีได้ไหม", a: "ได้ค่ะ ตามยอดที่ออมจริง สูงสุด 100,000 บาทต่อปี ตามเกณฑ์สรรพากร" },
        { key: "monthly", q: "ออมรายเดือนได้ไหม", a: "ได้ค่ะ เลือกรายเดือน ราย 6 เดือน หรือรายปีก็ได้" },
      ];
    case "ISHIELD": {
      const f = iShieldFacts();
      return [
        { key: "waiting", q: "ทำแล้วคุ้มครองโรคร้ายแรงเลยไหม", a: `โรคร้ายแรงเริ่มคุ้มครองหลัง ${f.illness.waitingDays} วันแรก เป็นเงื่อนไขมาตรฐานของประกันโรคร้ายแรงค่ะ` },
        { key: "again", q: "เคลมได้หลายครั้งไหม", a: "ระยะเริ่มต้นเคลมได้อีกถ้าเป็นคนละโรค ส่วนระยะรุนแรงจ่ายสูงสุดเต็มทุน หักส่วนที่รับไปแล้วค่ะ" },
        { key: "level", q: "ยอดออมขึ้นตามอายุไหม", a: "ไม่ขึ้นค่ะ ล็อกไว้ที่อายุวันที่ทำ เท่าเดิมตลอดที่ออม" },
        { key: "maturity", q: "ถ้าไม่ป่วยเลย เงินหายไหม", a: `ไม่หายค่ะ อยู่ครบสัญญาอายุ ${f.maturityAge} ปี รับคืนเต็มทุน` },
        { key: "lump", q: "จ่ายเป็นค่ารักษาหรือเงินก้อน", a: "เป็นเงินก้อนค่ะ เอาไปใช้อะไรก็ได้ ถ้าอยากได้ค่ารักษาด้วยก็พ่วงเพิ่มได้" },
      ];
    }
    case "IHEALTHY": {
      const { terms } = iHealthyFacts();
      return [
        { key: "waiting", q: "ทำแล้วใช้ได้เลยไหม", a: `อุบัติเหตุคุ้มครองเลย ส่วนเจ็บป่วยรอ ${terms.waitingDays} วันค่ะ บางโรครอ ${terms.specialWaitingDays} วัน` },
        { key: "rises", q: "ค่าใช้จ่ายขึ้นทุกปีไหม", a: "ส่วนค่ารักษาปรับตามอายุทุกปีค่ะ ตัวเลขในคลิปนี้คือปีแรก" },
        { key: "tax", q: "ลดหย่อนภาษีได้ไหม", a: "ส่วนสุขภาพลดหย่อนได้ตามที่จ่ายจริง สูงสุด 25,000 บาทต่อปี ตามเกณฑ์สรรพากรค่ะ" },
        { key: "health", q: "มีโรคประจำตัวทำได้ไหม", a: "ยื่นขอได้ค่ะ แถลงสุขภาพตามจริง แล้วบริษัทพิจารณาเป็นรายคน" },
        { key: "monthly", q: "จ่ายรายเดือนได้ไหม", a: "ได้ค่ะ เลือกรายเดือน ราย 6 เดือน หรือรายปีก็ได้" },
      ];
    }
    case "PENSION":
      return [
        { key: "pay", q: "ออม 6 ปี กับออมจนรับบำนาญ ต่างกันยังไง", a: "ทุนเท่ากันได้บำนาญเท่ากันค่ะ แบบ 6 ปีออมต่อปีมากกว่าแต่จบเร็ว อีกแบบออมน้อยกว่าแต่นานกว่า" },
        { key: "tax", q: "ลดหย่อนภาษีได้ไหม", a: "ได้ค่ะ ใช้สิทธิลดหย่อนตามเกณฑ์สรรพากร ประหยัดภาษีทุกปีที่ออม" },
        { key: "known", q: "รู้ได้ไงว่าจะได้เท่าไหร่", a: "บำนาญตกลงกันตั้งแต่วันทำสัญญาค่ะ ไม่ขึ้นกับตลาดหุ้นหรือดอกเบี้ยวันที่เกษียณ" },
        { key: "after", q: "ช่วงรับบำนาญต้องออมต่อไหม", a: "ไม่ต้องแล้วค่ะ ช่วงรับบำนาญมีแต่รับอย่างเดียว" },
      ];
  }
}

/** which questions each story answers first; the rest of the list after them */
const FIRST: Record<string, string[]> = {
  legacy: ["causes", "waiting"], saving: ["tax", "monthly"], shortpay: ["monthly", "tax"], burden: ["causes", "checkup"],
  early: ["again", "waiting"], income: ["lump", "level"], many: ["level", "again"], maturity: ["maturity", "level"],
  lump: ["waiting", "rises"], room: ["waiting", "health"], compare: ["rises", "tax"],
  salary: ["known", "after"], tax: ["tax", "pay"], guarantee: ["known", "pay"], steps: ["known", "after"],
};

/** the two questions a clip answers, for its product and story */
export function pickQas(product: Product, story?: string): SpokenQa[] {
  const all = productQas(product);
  const first = FIRST[story ?? ""] ?? [];
  const ordered = [...first.map((k) => all.find((q) => q.key === k)).filter((q): q is SpokenQa => Boolean(q)), ...all];
  return ordered.filter((q, i) => ordered.findIndex((x) => x.key === q.key) === i).slice(0, 2);
}
