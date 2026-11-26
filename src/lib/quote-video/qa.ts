import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { iShieldFacts } from "@/lib/ishield-facts";
import { legacyTable } from "@/lib/legacy-table";
import { plbFacts } from "@/lib/plb-facts";
import { plbTable } from "@/lib/plb-table";
import type { Product } from "./script";

/**
 * The questions the longer clips answer (owner, 2026-10-13: ถาม-ตอบ 2 ข้อ "จากคลังถาม-ตอบของบอท").
 *
 * The same answers the chat bots give, from the same sources — src/lib/assistant/lifeprotect/faq.ts,
 * src/lib/assistant/ishield/faq.ts (the /ishield page's own), src/lib/assistant/ihealthy/faq.ts and
 * the /bumnan95 page (its FAQ, removed 2026-10-14; see git history of src/components/pension/Sections.tsx), and for มรดก
 * the /legacy page's own lines (LegacyCalculator.tsx: the footnote, the critical-illness note, the
 * contracts' ages; legacy-table.ts: the monthly minimum), and for Protection Life the bot's own
 * src/lib/assistant/plb/faq.ts (never its waiting-period line, which is unconfirmed; tax relief only
 * for the 10-, 12- and 15-year terms, TAX_RELIEF's meaning) with the page's level price, monthly
 * minimum and sum discount — said for the voice: shorter, a woman's
 * endings (script.ts makes them a man's), and without the words the voice never says (เบี้ย,
 * เสียชีวิต, เวนคืน). Not one fact is added to or taken from the bots' answers.
 */

export interface SpokenQa { key: string; q: string; a: string }

/** Global Savings' own figures for its answers (gsaving.ts GsVideoFacts); absent = 15/8's */
export type GsQaFacts = { payYears: number; term: number; maturityPct: number; bonusYears: number[] };

/** 12 พีแอล's own figures for its answers (twelvepl.ts TwelvePlVideoFacts); `tax` absent = no tax relief said */
export type TpQaFacts = { payYears: number; coverToAge: number; maturityPct: number; tax?: number; dividend?: unknown };

/** `variant`: Protection Life's term, which decides whether tax relief is answered at all */
export function productQas(product: Product, variant?: string, gs?: GsQaFacts, tp?: TpQaFacts): SpokenQa[] {
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
    case "LEGACY": {
      const t = legacyTable();
      return [
        { key: "rises", q: "ค่าใช้จ่ายขึ้นทุกปีไหม", a: "ส่วนโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไปค่ะ ตัวเลขในคลิปนี้คือปีแรก" },
        { key: "after", q: "เคลมโรคร้ายแรงแล้ว ประกันชีวิตยังอยู่ไหม", a: "ยังอยู่ค่ะ โรคร้ายแรงจ่ายครั้งเดียวแล้วสิ้นสุด ประกันชีวิตหลักยังอยู่ต่อให้ครอบครัว" },
        { key: "until", q: "คุ้มครองถึงอายุเท่าไหร่", a: `โรคร้ายแรงคุ้มครองถึงอายุ ${t.contracts.rider.coverToAge} ส่วนประกันชีวิตดูแลถึงอายุ ${t.contracts.base.coverToAge} ค่ะ` },
        { key: "count", q: "โรคร้ายแรงคุ้มครองกี่โรค", a: `${t.diseaseCount} โรค ตามคำนิยามในกรมธรรม์ค่ะ` },
        { key: "monthly", q: "จ่ายรายเดือนได้ไหม", a: `ได้ค่ะ ถ้ายอดรายเดือนถึง ${t.minMonthlyTotal.toLocaleString("en-US")} บาท ไม่ถึงก็เลือกราย 6 เดือนหรือรายปี` },
      ];
    }
    case "PLB": {
      const t = plbTable();
      const d = plbFacts().discount;
      const tax = variant === "PLB10" || variant === "PLB12" || variant === "PLB15";
      return [
        { key: "covers", q: "คุ้มครองกี่ปี", a: "คุ้มครองเท่ากับที่จ่ายค่ะ เลือกจ่าย 5, 10, 12 หรือ 15 ปี ก็คุ้มครองเท่านั้นปี" },
        { key: "end", q: "อยู่ครบสัญญาแล้วได้อะไรไหม", a: "แบบนี้เป็นความคุ้มครองล้วนค่ะ คุ้มครองเท่ากับระยะที่จ่าย อยู่ครบแล้วสัญญาสิ้นสุด" },
        ...(tax ? [{ key: "tax", q: "ลดหย่อนภาษีได้ไหม", a: "ได้ค่ะ ตามที่จ่ายจริง สูงสุด 100,000 บาทต่อปี นับรวมกับประกันชีวิตฉบับอื่น ตามเกณฑ์สรรพากร" }] : []),
        { key: "level", q: "ค่าใช้จ่ายขึ้นทุกปีไหม", a: "ไม่ขึ้นค่ะ เท่าเดิมทุกปีตลอดสัญญา" },
        { key: "bigger", q: "ทุนสูงขึ้น ราคาต่อล้านถูกลงไหม", a: `ถูกลงค่ะ ทุนยิ่งสูงยิ่งได้ส่วนลด ส่วนลดสูงสุดเริ่มที่ทุน ${d.fromSumShort}` },
        { key: "monthly", q: "จ่ายรายเดือนได้ไหม", a: `ได้ค่ะ ถ้ายอดรายเดือนถึง ${t.minMonthly.toLocaleString("en-US")} บาท ไม่ถึงก็เลือกราย 6 เดือนหรือรายปี` },
      ];
    }
    // Global Savings 15/8 (owner, 2026-10-20): the page's own facts (src/calc/global-saving/engine.ts)
    case "GSAVING":
      return [
        { key: "sure", q: "ส่วนไหนได้แน่นอน", a: `เงินคืน 1% ของทุนทุกปี กับเงินครบสัญญา ${gs?.maturityPct ?? 801}% ของทุน ได้แน่นอนค่ะ ส่วนโบนัสตามดัชนีไม่แน่นอน` },
        { key: "bonus", q: "โบนัสดัชนีจ่ายตอนไหน", a: `จ่าย ${gs?.bonusYears.length ?? 2} ครั้งค่ะ สิ้นปีที่ ${(gs?.bonusYears ?? [10, 15]).slice(0, -1).join(" ")} กับตอนครบสัญญาปีที่ ${gs?.term ?? 15} ถ้าดัชนีติดลบ โบนัสเป็นศูนย์ แต่เงินที่การันตียังได้ครบ` },
        { key: "tax", q: "ลดหย่อนภาษีได้ไหม", a: "ได้ค่ะ ตามที่ออมจริง สูงสุด 100,000 บาทต่อปี นับรวมกับประกันชีวิตฉบับอื่น ตามเกณฑ์สรรพากร" },
        { key: "years", q: "ต้องออมกี่ปี", a: `ออม ${gs?.payYears ?? 8} ปีค่ะ ครบสัญญาปีที่ ${gs?.term ?? 15} ระหว่างนั้นยังคุ้มครองชีวิตด้วย` },
        { key: "min", q: "ออมขั้นต่ำเท่าไหร่", a: "ขั้นต่ำปีละ 20,000 บาทค่ะ" },
      ];
    // อีซี่ โพรเทค 6 (owner, 2026-11-26): its page's own lines (EasyProtectCalculator.tsx, plan-notes.ts)
    case "EASYPROTECT":
      return [
        { key: "years", q: "ต้องออมกี่ปี", a: "ออม 6 ปีค่ะ หลังจากนั้นไม่ต้องจ่ายอีก แต่คุ้มครองไปถึงอายุ 99" },
        { key: "level", q: "ยอดออมขึ้นตามอายุไหม", a: "ไม่ขึ้นค่ะ ล็อกตามอายุวันที่เริ่ม เท่าเดิมตลอด 6 ปี" },
        { key: "floor", q: "ถ้าเป็นอะไรไป ครอบครัวได้เท่าไหร่", a: "ได้ตามทุนค่ะ และไม่น้อยกว่า 101% ของที่ออมมาแล้ว" },
        { key: "back", q: "ถ้าอยากได้เงินคืนล่ะ", a: "มีมูลค่าเงินสดโตทุกปีค่ะ ขอคืนได้ตามตาราง แต่ถ้าขอคืนเร็วอาจได้น้อยกว่าที่ออม" },
      ];
    // ไลฟ์เทรเชอร์ (owner, 2026-11-26): its page's own lines (LifeTreasureCalculator.tsx, numbers-cases/lifetreasure.ts)
    case "LIFETREASURE":
      return [
        { key: "years", q: "เลือกจ่ายกี่ปีได้บ้าง", a: "เลือกได้ 6 ปี 12 ปี หรือ 18 ปีค่ะ จ่ายครบแล้วคุ้มครองต่อไปถึงอายุ 99" },
        { key: "level", q: "ยอดออมขึ้นตามอายุไหม", a: "ไม่ขึ้นค่ะ ล็อกตามอายุวันที่เริ่ม เท่าเดิมตลอดระยะที่จ่าย" },
        { key: "floor", q: "ครอบครัวได้เท่าไหร่", a: "ได้ตามทุนที่ระบุไว้ค่ะ ไม่ขึ้นกับตลาด และไม่น้อยกว่า 101% ของที่ออมมาแล้ว" },
        { key: "share", q: "แบ่งให้หลายคนได้ไหม", a: "ได้ค่ะ แบ่งให้ใครเท่าไรก็ระบุได้" },
        { key: "back", q: "ถ้าอยากได้เงินคืนล่ะ", a: "มีมูลค่าเงินสดโตทุกปีค่ะ ขอคืนได้ตามตาราง แต่ถ้าขอคืนเร็วอาจได้น้อยกว่าที่ออม" },
      ];
    // 12 พีแอล (owner, 2026-11-26): the plan's own rules, as the bots say them (src/lib/copilot/knowledge.ts)
    case "TWELVEPL":
      return [
        { key: "sure", q: "ส่วนไหนได้แน่นอน", a: `เงินคืนทุกปี กับเงินครบสัญญา ${tp?.maturityPct ?? 115}% ของทุน ได้แน่นอนเมื่อถือครบถึงอายุ ${tp?.coverToAge ?? 85} ค่ะ${tp?.dividend ? " ส่วนปันผลไม่แน่นอน" : ""}` },
        { key: "back", q: "เงินคืนเริ่มเมื่อไหร่", a: "เริ่มสิ้นปีที่ 2 ค่ะ ที่ 0.25% ของทุน เพิ่มขึ้นทุกปีจนถึง 1% ตั้งแต่ปีที่ 17" },
        { key: "years", q: "ต้องออมกี่ปี", a: `ออม ${tp?.payYears ?? 12} ปีค่ะ แล้วคุ้มครองต่อจนถึงอายุ ${tp?.coverToAge ?? 85}` },
        ...(tp?.tax !== undefined ? [{ key: "tax", q: "ลดหย่อนภาษีได้ไหม", a: "ได้ค่ะ ตามที่ออมจริง สูงสุด 100,000 บาทต่อปี นับรวมกับประกันชีวิตฉบับอื่น ตามเกณฑ์สรรพากร" }] : []),
        { key: "life", q: "ถ้าเป็นอะไรไปก่อน ได้เท่าไหร่", a: "ครอบครัวได้เต็มทุนค่ะ" },
      ];
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
  family: ["until", "after"], illness: ["after", "count"], light: ["rises", "monthly"],
  plbfamily: ["covers", "end"], plbburden: ["covers", "level"], plblight: ["level", "monthly"], plbtax: ["tax", "level"],
  gssure: ["sure", "years"], gsbonus: ["bonus", "sure"], gstax: ["tax", "years"], gsshort: ["years", "sure"],
  epshort: ["years", "level"], epfamily: ["floor", "years"], epcash: ["back", "years"],
  ltlegacy: ["share", "floor"], ltterms: ["years", "level"], ltcash: ["back", "floor"],
  tpback: ["back", "sure"], tpshort: ["years", "life"], tpfamily: ["life", "years"], tptax: ["tax", "years"],
};

/** the two questions a clip answers, for its product and story */
export function pickQas(product: Product, story?: string, variant?: string, hide?: readonly string[], gs?: GsQaFacts, tp?: TpQaFacts): SpokenQa[] {
  // ตั้งค่าส่วนตัว: "จ่ายรายเดือนได้ไหม" names the instalments; never asked where the agent hid one
  const all = productQas(product, variant, gs, tp).filter((q) => !(q.key === "monthly" && hide?.length));
  const first = FIRST[story ?? ""] ?? [];
  const ordered = [...first.map((k) => all.find((q) => q.key === k)).filter((q): q is SpokenQa => Boolean(q)), ...all];
  return ordered.filter((q, i) => ordered.findIndex((x) => x.key === q.key) === i).slice(0, 2);
}
