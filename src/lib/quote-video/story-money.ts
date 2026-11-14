import { checkDevice } from "@/lib/prompt-story/check";
import { isTaxRate, LIFE_CAP } from "@/lib/scene-library/tax-th";
import { isMoneyTopic, MONEY_INPUTS, type MoneyField, type MoneyTopic } from "@/lib/story/topics";
import type { StoryVideoInput } from "./story";
import {
  big, incomestopLost, lifeneedTotals, moneysplitRemainder, small, taxbackRefund, withBaht,
  type DeviceLayout, type KnowScene, type KnowShow, type LifeShow,
} from "./story-knowledge";

export type { MoneyTopic } from "@/lib/story/topics";

/**
 * ทุนชีวิต ภาษี มรดก (device round 2, spec docs/superpowers/specs/2026-11-14-devices-life-tax-design.md): three fixed
 * episodes in คลิปเล่าเรื่อง, no AI, five scenes each and the agent's card, drawn by the round-2 devices. Every number
 * on screen or in the voice is one the agent typed on the form (input.money, checked by storyMoney), one worked out
 * here from those (a total, a gap, income lost, a refund), or the tax table's own (taxcap, the note's "10 ปี").
 * Each device goes through checkDevice with the typed numbers as its only source (and the chip's rate, itself an
 * input); a device it refuses is drawn in its words-only form. With nothing typed every device is words-only and the
 * clip is still made. Nothing here promises a return, and nothing says ปลอดภาษี beyond the deduction itself.
 */

/** the numbers the agent typed for a ทุนชีวิต ภาษี มรดก topic, each optional; `bracket` one of the tax table's rates */
export type StoryMoney = Partial<Record<MoneyField | "bracket", number>>;

/**
 * The typed numbers a topic takes, checked: a whole number from 1 to the field's cap (topics.ts MONEY_INPUTS), and
 * taxback's bracket one of the table's rates. Anything else (out of range, a fraction, nought, a string, another
 * topic's field) is left off, not refused: the device then says it in words. None left → undefined.
 */
export function storyMoney(topic: string, v: unknown): StoryMoney | undefined {
  if (!isMoneyTopic(topic) || !v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: StoryMoney = {};
  for (const f of MONEY_INPUTS[topic]) {
    const x = o[f.key];
    if (typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= f.max) out[f.key] = x;
  }
  if (topic === "taxback" && isTaxRate(o.bracket)) out.bracket = o.bracket;
  return Object.keys(out).length ? out : undefined;
}

export const MONEY_CLOSE: Record<MoneyTopic, string> = {
  lifeneed: "อยากรู้ว่าทุนชีวิตของคุณพอไหม ทักมาได้เลย",
  ciincome: "อยากรู้ว่าเงินก้อนเท่าไหร่ถึงพอ ทักมาได้เลย",
  taxback: "อยากรู้ว่าลดหย่อนได้เท่าไหร่ ทักมาได้เลย",
};

type Device = Extract<KnowShow, { layout: DeviceLayout }>;

/** a device with its numbers taken off: top-level figures, and a row's share or a part's amount */
function wordsOnly(show: Device): Device {
  const strip = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== "number"));
  const bare = strip(show) as Record<string, unknown>;
  for (const k of ["rows", "parts"]) {
    if (Array.isArray(bare[k])) bare[k] = (bare[k] as unknown[]).map((r) => (r && typeof r === "object" ? strip(r) : r));
  }
  return bare as Device;
}

/**
 * a device made from the agent's numbers, held to its sources: checkDevice with `allowed` (the typed numbers) keeps
 * it, or drops what the rules leave off (shares not totalling 100, amounts over the total, a rate not the table's);
 * refused, it is drawn in its words-only form. Our own words failing the rules is a mistake here, so it throws.
 */
export function sourced(show: Device, allowed: Set<number>): Device {
  const d = checkDevice(show, allowed);
  if (typeof d !== "string") return d;
  const w = checkDevice(wordsOnly(show), new Set());
  if (typeof w === "string") throw new Error(`${show.layout}: ${w}`);
  return w;
}

const scene = (key: KnowScene["key"], show: KnowShow, voice: string): KnowScene => ({ key, show, voice });
/** the numbers a topic's devices may show: what was typed, and nothing else */
const typed = (m: StoryMoney): Set<number> => new Set(Object.values(m).filter((v): v is number => typeof v === "number"));

/* ---------- ทุนชีวิตเท่าไหร่ถึงพอ: ask → lifeneed → beneficiary → moneysplit → recap ---------- */

function lifeneedVoice(show: LifeShow<"lifeneed">): string {
  const t = lifeneedTotals(show);
  if (!t.blocks.length || t.need === undefined) return "ทุนชีวิตควรครอบคลุมหนี้ที่ยังค้าง ค่าใช้จ่ายของครอบครัวอีกหลายปี และค่าเรียนลูกค่ะ";
  const said = t.blocks.map((b) => b.key === "debts" ? `หนี้คงเหลือ ${withBaht(b.amount)}`
    : b.key === "living" ? `ค่าใช้จ่ายครอบครัวปีละ ${withBaht(show.expenses!)} อีก ${show.years} ปี เป็น ${withBaht(b.amount)}`
      : `ค่าการศึกษาลูก ${withBaht(b.amount)}`).join(" ");
  const sum = t.blocks.length === 3 ? `รวมแล้วทุนชีวิตที่ควรมีคือ ${withBaht(t.need)}` : `รวมที่กรอกไว้ ${withBaht(t.need)}`;
  const had = t.have === undefined ? ""
    : t.gap === undefined ? ` มีทุนอยู่แล้ว ${withBaht(t.have)}`
      : t.gap > 0 ? ` มีอยู่แล้ว ${withBaht(t.have)} ยังขาดอีก ${withBaht(t.gap)}` : ` ทุนที่มีอยู่ ${withBaht(t.have)} พอแล้ว`;
  return `ลองรวมดูนะคะ ${said} ${sum}${had}ค่ะ`;
}

function lifeneed(m: StoryMoney): KnowScene[] {
  const allowed = typed(m);
  const living = m.expenses !== undefined && m.years !== undefined;
  const anyBlock = m.debts !== undefined || living || m.education !== undefined;
  // only what the drawer draws: expenses with years, and what is had beside at least one block
  const need = sourced({
    layout: "lifeneed", title: ["ทุนชีวิต", "ที่ควรมี"],
    ...(m.debts !== undefined ? { debts: m.debts } : {}), ...(living ? { expenses: m.expenses, years: m.years } : {}),
    ...(m.education !== undefined ? { education: m.education } : {}), ...(anyBlock && m.have !== undefined ? { have: m.have } : {}),
  }, allowed) as LifeShow<"lifeneed">;
  const heirs = sourced({ layout: "beneficiary", title: ["ผู้รับประโยชน์", "เงินไปถึงใคร"], rows: [{ name: "คู่ชีวิต" }, { name: "ลูก" }] }, allowed);
  // the sum had, paying the debts and the school fees, the rest left for the home; in words when it does not stretch
  const fits = m.have !== undefined && m.debts !== undefined && m.education !== undefined && m.debts + m.education <= m.have;
  const split = sourced(fits
    ? { layout: "moneysplit", title: ["เงินก้อนนี้", "ช่วยคนในบ้าน"], total: m.have, parts: [{ label: "ปิดหนี้", amount: m.debts }, { label: "ค่าเรียนลูก", amount: m.education }] }
    : { layout: "moneysplit", title: ["เงินก้อนนี้", "ช่วยคนในบ้าน"], ...(m.have !== undefined ? { total: m.have } : {}), parts: [{ label: "ปิดหนี้" }, { label: "ค่าเรียนลูก" }, { label: "ใช้จ่ายในบ้าน" }] },
  allowed) as LifeShow<"moneysplit">;
  const [debts, school] = split.parts;
  const left = moneysplitRemainder(split);
  const splitVoice = split.total !== undefined && debts?.amount !== undefined && school?.amount !== undefined
    ? `ถ้าวันหนึ่งเราไม่อยู่ ทุน ${withBaht(split.total)} ปิดหนี้ ${withBaht(debts.amount)} เก็บเป็นค่าเรียนลูก ${withBaht(school.amount)}${left !== undefined ? ` ยังเหลือ ${withBaht(left)} ไว้ใช้จ่ายในบ้าน` : ""}ค่ะ`
    : `ถ้าวันหนึ่งเราไม่อยู่ เงินก้อน${split.total !== undefined ? ` ${withBaht(split.total)}` : "จากประกัน"} ช่วยปิดหนี้ เป็นค่าเรียนลูก และค่าใช้จ่ายในบ้านค่ะ`;
  return [
    scene("knowAsk", { layout: "ask", title: ["ทุนชีวิต", "เท่าไหร่ถึงพอ?"] }, "ทุนประกันชีวิต ควรมีเท่าไหร่ถึงจะพอคะ"),
    scene("knowOne", need, lifeneedVoice(need)),
    scene("knowTwo", heirs, "เงินก้อนนี้จะไปถึงใคร ขึ้นกับชื่อผู้รับประโยชน์ค่ะ เช่น คู่ชีวิต และลูก ระบุชื่อและสัดส่วนไว้ในใบคำขอให้ชัด"),
    scene("knowThree", split, splitVoice),
    scene("knowRecap", { layout: "recap", lines: [big("หนี้ ค่าใช้จ่าย ค่าเรียนลูก"), big("รวมเป็นทุนที่ควรมี", "green"), small("ทบทวนเมื่อชีวิตเปลี่ยน")] },
      "จำง่าย ๆ ค่ะ รวมหนี้ ค่าใช้จ่ายครอบครัว และค่าเรียนลูก ได้เท่าไหร่ คือทุนชีวิตที่ควรมี แล้วทบทวนทุกครั้งที่ชีวิตเปลี่ยน"),
  ];
}

/* ---------- ป่วยหนัก รายได้หายไปไหน: ask → incomestop → cilump → list → recap ---------- */

function ciincome(m: StoryMoney): KnowScene[] {
  const allowed = typed(m);
  const stop = sourced({
    layout: "incomestop", title: ["รายได้หยุด", "ระหว่างรักษา"],
    ...(m.monthly !== undefined ? { monthly: m.monthly } : {}), ...(m.months !== undefined ? { months: m.months } : {}),
  }, allowed) as LifeShow<"incomestop">;
  const lost = incomestopLost(stop);
  const stopVoice = lost !== undefined ? `ถ้ารายได้เดือนละ ${withBaht(stop.monthly!)} ต้องหยุดรักษา ${stop.months} เดือน รายได้หายไปรวม ${withBaht(lost)}ค่ะ`
    : stop.monthly !== undefined ? `รายได้เดือนละ ${withBaht(stop.monthly)} จะหยุดไปตลอดช่วงที่ต้องหยุดรักษาค่ะ`
      : stop.months !== undefined ? `ถ้าต้องหยุดรักษา ${stop.months} เดือน รายได้ช่วงนั้นก็หยุดไปด้วยค่ะ`
        : "ป่วยหนักต้องหยุดงานไปรักษาตัว รายได้ช่วงนั้นก็หยุดไปด้วยค่ะ";
  const lump = sourced({ layout: "cilump", title: ["เงินก้อน", "ตอนวินิจฉัย"], ...(m.ciSum !== undefined ? { sum: m.ciSum } : {}), note: "ใช้แทนรายได้ช่วงรักษาตัว" }, allowed) as LifeShow<"cilump">;
  return [
    scene("knowAsk", { layout: "ask", title: ["ป่วยหนัก", "รายได้หายไปไหน?"] }, "ถ้าป่วยหนัก ต้องหยุดงานไปรักษาตัวหลายเดือน รายได้ช่วงนั้นหายไปไหนคะ"),
    scene("knowOne", stop, stopVoice),
    scene("knowTwo", lump, `ประกันโรคร้ายแรงจ่ายเป็นเงินก้อน${lump.sum !== undefined ? ` ${withBaht(lump.sum)}` : ""} เมื่อแพทย์วินิจฉัยตามเงื่อนไขกรมธรรม์ เอามาใช้แทนรายได้ช่วงรักษาตัวได้ค่ะ`),
    scene("knowThree", { layout: "list", title: ["ค่าใช้จ่ายที่ยังเดิน", "ระหว่างรักษา"], mark: "warn", items: ["ค่าผ่อนบ้านและรถ", "ค่ากินอยู่ในบ้าน", "ค่าเรียนลูก"] },
      "ระหว่างรักษา ค่าใช้จ่ายของบ้านไม่ได้หยุดตามค่ะ ทั้งค่าผ่อนบ้าน ค่าผ่อนรถ ค่ากินอยู่ และค่าเรียนลูก"),
    scene("knowRecap", { layout: "recap", lines: [big("รายได้หยุด"), big("ค่าใช้จ่ายไม่หยุด", "red"), small("เงินก้อนช่วยให้บ้านเดินต่อ")] },
      "จำง่าย ๆ ค่ะ ป่วยหนัก รายได้หยุด แต่ค่าใช้จ่ายไม่หยุด เงินก้อนจากประกันโรคร้ายแรง ช่วยให้บ้านเดินต่อได้ ตามเงื่อนไขกรมธรรม์"),
  ];
}

/* ---------- เบี้ยประกันลดหย่อนได้เท่าไหร่: ask → taxcap → taxback → note → recap ---------- */

function taxback(m: StoryMoney): KnowScene[] {
  // the chip's rate is an input the agent stated (task 1's note): it is in the allowed set like the typed premium
  const allowed = typed(m);
  const cap = sourced({ layout: "taxcap", title: ["เพดานลดหย่อน", "แต่ละแบบประกัน"] }, allowed);
  const back = sourced({
    layout: "taxback", title: ["ภาษีที่ลดได้", "ตามฐานภาษี"],
    ...(m.premium !== undefined ? { premium: m.premium } : {}), ...(m.bracket !== undefined ? { bracket: m.bracket } : {}),
  }, allowed) as LifeShow<"taxback">;
  const refund = taxbackRefund(back);
  const backVoice = refund !== undefined
    ? `ถ้าจ่ายเบี้ยประกันชีวิตปีละ ${withBaht(back.premium!)} ฐานภาษี ${back.bracket} เปอร์เซ็นต์ ภาษีจะลดลงราว ${withBaht(refund)}ค่ะ${back.premium! > LIFE_CAP ? " ส่วนที่ใช้ลดหย่อนได้ ไม่เกินเพดานของประกันชีวิต" : ""}`
    : back.premium !== undefined ? `เบี้ยปีละ ${withBaht(back.premium)} ลดภาษีได้มากน้อยตามฐานภาษีของแต่ละคนค่ะ ฐานยิ่งสูง ภาษีที่ลดได้ยิ่งมาก`
      : back.bracket !== undefined ? `ฐานภาษี ${back.bracket} เปอร์เซ็นต์ ยิ่งลดหย่อนได้มาก ภาษีก็ยิ่งลดลงค่ะ`
        : "ภาษีที่ลดได้ ขึ้นกับฐานภาษีของแต่ละคนค่ะ ฐานยิ่งสูง ภาษีที่ลดได้ยิ่งมาก";
  return [
    scene("knowAsk", { layout: "ask", title: ["เบี้ยประกัน", "ลดหย่อนได้เท่าไหร่?"] }, "เบี้ยประกันชีวิตที่จ่ายไปทุกปี ลดหย่อนภาษีได้เท่าไหร่คะ"),
    scene("knowOne", cap, "ประกันแต่ละแบบ มีเพดานลดหย่อนของตัวเองค่ะ ทั้งประกันชีวิต ประกันสุขภาพของเราและของพ่อแม่ และประกันแบบบำนาญ ตามเกณฑ์กรมสรรพากร"),
    scene("knowTwo", back, backVoice),
    scene("knowThree", {
      layout: "note", title: ["ใช้สิทธิลดหย่อน", "ต้องรู้ก่อน"],
      // the condition as one sentence over two lines, so "10" never ends a line apart from its "ปีขึ้นไป"
      note: [small("กรมธรรม์ต้องมีระยะเวลาคุ้มครอง"), big("10 ปีขึ้นไป", "green"), small("นำไปหักลดหย่อนในแบบ ภ.ง.ด.")],
    }, "ใช้สิทธิได้เมื่อกรมธรรม์มีระยะเวลาคุ้มครองสิบปีขึ้นไป แล้วนำเบี้ยไปหักลดหย่อน ตอนยื่นแบบแสดงรายการภาษีค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("เบี้ยประกันชีวิต"), big("ลดหย่อนภาษีได้", "green"), small("ตามเกณฑ์กรมสรรพากร")] },
      "จำง่าย ๆ ค่ะ เบี้ยประกันชีวิตลดหย่อนภาษีได้ ตามเกณฑ์กรมสรรพากร ตรวจสอบเงื่อนไขก่อนใช้สิทธินะคะ"),
  ];
}

/** an episode of ทุนชีวิต ภาษี มรดก: its five scenes, from the numbers the agent typed (checked again here) or none */
export function moneyScenes(topic: MoneyTopic, input: StoryVideoInput): KnowScene[] {
  const m = storyMoney(topic, input.money) ?? {};
  return { lifeneed, ciincome, taxback }[topic](m);
}
