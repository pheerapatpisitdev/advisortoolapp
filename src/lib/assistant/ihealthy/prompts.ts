import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL } from "@/calc/types";
import {
  benefitValue, iHealthyFacts, isHeading, planLabel, type BenefitRow,
} from "@/lib/ihealthy-facts";
import { PHONE_ROW_LABEL, phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { VOICE } from "../prompts";
import { arrangementFor } from "./quote";
import type { HealthSlots } from "./route";

/**
 * What the model may say about a medical contract, on top of the voice both brains share.
 *
 * The three extra prohibitions are the ones this contract invites and the life one does not:
 * a customer describing a symptom wants to be told they are covered, and neither this code
 * nor a model may say so — whether a condition is accepted is the underwriter's answer, what
 * to do about it is a doctor's, and which hospitals settle a bill directly changes without
 * anyone here being told.
 */
const HEALTH_RULES = `ห้ามประเมินว่าโรค อาการ หรือประวัติการรักษาใดจะได้รับความคุ้มครองหรือรับประกันได้หรือไม่ นั่นเป็นผลการพิจารณาของบริษัท
ห้ามวินิจฉัยอาการ ห้ามแนะนำการรักษา ห้ามแนะนำว่าควรไปโรงพยาบาลไหน
เรื่องการเคลม การใช้สิทธิ และการพิจารณารับประกัน ให้บอกว่า "เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้"
ถ้าพูดถึงเบี้ย ให้บอกว่าเป็นเบี้ยปีแรกและปรับตามอายุที่เพิ่มขึ้นทุกปี
ห้ามคิดตัวเลขเอง`;

export const HEALTH_PLAN_INFO_SYSTEM = `${VOICE}

${HEALTH_RULES}

ข้อมูล: ตอบจากข้อมูลที่ให้ไว้ด้านล่างเท่านั้น ห้ามเดา
ห้ามบอกให้ลูกค้าไปถามตัวแทนเรื่องเบี้ยประกัน ระบบนี้คิดเบี้ยให้ได้เองทุกอายุทุกเพศ
ถ้าลูกค้าอยากรู้เบี้ย ให้ขอเพศกับอายุ แล้วบอกว่าเดี๋ยวคิดให้
ไม่ต้องปิดท้ายทุกข้อความด้วยการให้ไปถามตัวแทน`;

export const HEALTH_SMALL_TALK_SYSTEM = `${VOICE}

${HEALTH_RULES}

ห้ามบอกตัวเลขเบี้ยหรือผลประโยชน์ใดๆ เอง
ถ้าเป็นการทักทายครั้งแรก: ทักกลับสั้นๆ แล้วชวนเข้าเรื่องด้วยการขอ อายุ กับ เพศ เพื่อคิดเบี้ยให้
ถ้าลูกค้าขอบคุณ รับทราบ บอกว่าขอคิดดูก่อน หรือจะติดต่อกลับ: ตอบสั้นๆ บรรทัดเดียวแล้วจบ ห้ามขอข้อมูล ห้ามชวนคุยต่อ ห้ามขาย
ห้ามขอข้อมูลที่ทราบแล้ว (ดูด้านล่าง ถ้ามี)
ความยาวไม่เกิน 2 บรรทัด`;

/**
 * The contract as the company wrote it, for the model to answer out of.
 *
 * Built from the benefit sheet and the rate tables on every call, so a rate revision or a
 * re-extracted sheet reaches the chat without anyone retyping a figure — and so the model has
 * no reason to reach for one of its own.
 */
export function healthFactsFor(slots: HealthSlots, today: Date = new Date()): string {
  const { terms } = iHealthyFacts();
  const table = iHealthyTable(today);

  const contract = [
    "ชื่อสัญญา: สัญญาเพิ่มเติมค่ารักษาพยาบาล ไอเฮลท์ตี้ อัลตร้า (iHealthy Ultra) แบบเหมาจ่ายต่อรอบปีกรมธรรม์",
    `รับประกันอายุ ${table.ageMin}-${table.ageMax} ปี ต่ออายุได้ถึงอายุ ${terms.renewalToAge} ปี`,
    "เป็นสัญญาเพิ่มเติม ต้องแนบกับสัญญาประกันชีวิตเสมอ",
    `ระยะเวลารอคอย ${terms.waitingDays} วัน · โรคเหล่านี้รอ ${terms.specialWaitingDays} วัน: ${terms.specialWaitingDiseases.join(" · ")}`,
    "อุบัติเหตุคุ้มครองทันที ไม่มีระยะเวลารอคอย",
    `ไม่เคลมตลอดปีกรมธรรม์ ได้ส่วนลดเบี้ยปีถัดไป ${terms.noClaimDiscountPercent} เปอร์เซ็นต์`,
    `รักษานอกอาณาเขตที่เลือก คุ้มครองได้ไม่เกิน ${terms.outOfTerritoryDays} วันต่อครั้ง`,
    `เงื่อนไขการต่ออายุของบริษัท: ${terms.renewalCopay}`,
    "เบี้ยส่วนค่ารักษาปรับตามอายุที่เพิ่มขึ้นทุกปี ส่วนเบี้ยสัญญาหลักคงที่",
  ].join("\n");

  return `\n\nข้อมูลสัญญา\n${contract}\n\nผลประโยชน์\n${benefits(slots, today)}${known(slots, today)}`;
}

/** Only the rows, never the headings — a heading has no figure under any plan. */
function rowsOf(entries: readonly (BenefitRow | { heading: string })[]): BenefitRow[] {
  return entries.filter((e): e is BenefitRow => !isHeading(e));
}

/**
 * The benefit rows, narrowed to what this turn is about.
 *
 * A chosen plan gets its whole column — every row of the company's own wording, which is what
 * a question like "ทำฟันได้ไหม" is actually asking about. Before a plan is chosen only the
 * five headline rows of the plans on the menu go in: the whole sheet for six plans is a prompt
 * six times the size, for a customer who has not yet said which one they mean.
 */
function benefits(slots: HealthSlots, today: Date): string {
  const facts = iHealthyFacts();
  const table = iHealthyTable(today);
  /**
   * Which plans exist, and — only once an age is known — which of them this customer may buy.
   *
   * `plansFor` needs an age, and standing in the table's lowest one is how the bot came to
   * tell a grown customer that "แผนที่แนะนำตอนนี้มีสองแผนคือ Smart และ Bronze": at six the
   * company writes only those two, and the model reported what it was given. With no age
   * there is no such list, so every plan goes in and the prompt says the availability
   * depends on an age nobody has given yet.
   */
  const known = slots.age !== undefined;
  const age = slots.age ?? table.ageMin;
  const sellable = known
    ? plansFor(table, age).map((p) => p.code)
    : table.plans.map((p) => p.code);

  if (slots.plan && sellable.includes(slots.plan)) {
    const plan = facts.plans.find((p) => p.code === slots.plan)!;
    const rows = rowsOf(facts.rows)
      .map((row) => {
        const value = benefitValue(row, slots.plan!, age);
        return value ? `${row.title}: ${value}` : "";
      })
      .filter(Boolean);
    return `แผน ${planLabel(plan.code)} (วงเงินค่ารักษาต่อปี ${plan.annualMax.toLocaleString("en-US")} บาท)\n`
      + rows.join("\n");
  }

  const shown = known ? phoneColumns(table.plans.map((p) => p.code), sellable) : sellable;
  const headline = rowsOf(facts.rows).filter((row) => row.no !== null && row.no in PHONE_ROW_LABEL);
  const head = shown.map((code) => {
    const plan = facts.plans.find((p) => p.code === code)!;
    const cells = headline.map(
      (row) => `${PHONE_ROW_LABEL[row.no!].label} ${benefitValue(row, code, age) ?? "-"}`,
    );
    return `${planLabel(code)} · วงเงิน ${plan.annualMax.toLocaleString("en-US")} บาทต่อปี · ${cells.join(" · ")}`;
  });
  return known
    ? `แผนที่เสนออยู่\n${head.join("\n")}\nยังมีแผนอื่นอีก ถ้าลูกค้าถามให้บอกว่าขอดูแผนอื่นได้`
    : `แผนทั้งหมดที่บริษัทเขียน\n${head.join("\n")}\n`
      + "แผนที่ซื้อได้จริงขึ้นกับอายุ ยังไม่ทราบอายุของลูกค้ารายนี้ "
      + "ห้ามบอกว่ามีแค่บางแผน ห้ามบอกว่าแผนไหนซื้อได้หรือไม่ได้ ให้ขอเพศกับอายุก่อน";
}

/**
 * What is already known about this customer, and the premium they have already been sent.
 *
 * A figure the model can copy is a figure it cannot invent: on the life plan, asked whether
 * the premium was level, it answered 3,790 a month where the quotation it had sent five
 * messages earlier said 3,861.
 */
function known(slots: HealthSlots, today: Date): string {
  const bits: string[] = [];
  if (slots.sex) bits.push(slots.sex === "M" ? "ชาย" : "หญิง");
  if (slots.age !== undefined) bits.push(`อายุ ${slots.age} ปี`);
  if (slots.plan) bits.push(`แผน ${planLabel(slots.plan)}`);
  if (slots.territory) bits.push(`อาณาเขต${slots.territory}`);
  if (bits.length === 0) return "";

  const quoted = quotedFigures(slots, today);
  return `\n\nข้อมูลของลูกค้ารายนี้ที่ทราบแล้ว: ${bits.join(" · ")}\n`
    + "ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก\n"
    + (quoted
      ? `เบี้ยที่คิดและส่งให้ลูกค้าไปแล้วคือ ${quoted}\n`
        + "ถ้าจะพูดถึงตัวเลขเบี้ย ให้ใช้ตัวเลขชุดนี้เท่านั้น คัดลอกมาตรงๆ ห้ามคำนวณเอง ห้ามประมาณ ห้ามปัดเศษ\n"
        + "ถ้าลูกค้าอยากได้เบี้ยของอายุหรือแผนอื่น ห้ามตอบเป็นตัวเลข ให้บอกว่าเดี๋ยวคิดให้"
      : "ถ้าลูกค้าอยากได้เบี้ย ให้ขอเฉพาะข้อมูลที่ยังขาด ห้ามตอบตัวเลขเบี้ยเอง");
}

/** The premium this customer has already been sent, as the engine computed it. */
function quotedFigures(slots: HealthSlots, today: Date): string | undefined {
  const table = iHealthyTable(today);
  const { age, sex, plan } = slots;
  if (age === undefined || sex === undefined || plan === undefined || table.expired) return undefined;
  if (!plansFor(table, age).some((p) => p.code === plan)) return undefined;

  const v = arrangementFor({ age, sex, plan, territory: slots.territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan, territory: v.territory, coverage: v.coverage,
  });
  if (!priced) return undefined;
  return priced.total
    .filter((m) => !m.belowMinimum)
    .map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`)
    .join(" · ");
}
