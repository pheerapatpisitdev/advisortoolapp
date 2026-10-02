import { getPlan, listPlans, trimSuffix } from "@/calc/plans/registry";
import { riderDiseases } from "@/calc/riders/diseases";
import ishieldDiseases from "../../../data/riders/ishield-diseases.json";
import ci123Diseases from "../../../data/riders/ci123-diseases.json";
import rrssDiseases from "../../../data/riders/rrss-diseases.json";
import { pricedHere } from "./price";
import { PENSION_LABEL, pensionNamedIn } from "./pension-price";
import { CI123_LABEL, ci123NamedIn } from "./ci123-price";
import { CANCER_LABEL, cancerNamedIn } from "./cancer-price";
import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange } from "@/calc/bundles/quote";
import {
  CANCER_DAILY_RIDER, CANCER_RIDER, CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS,
} from "@/lib/cancer-benefits";
import { CANCER_BUNDLE } from "@/lib/cancer-table";
import { PENSION_AGES, PENSION_LIMITS } from "@/calc/pension/engine";
import { FAQ as LIFE_FAQ } from "@/lib/assistant/lifeprotect/faq";
import { FAQ as HEALTH_FAQ } from "@/lib/assistant/ihealthy/faq";
import {
  healthKnowledgeDetail, healthKnowledgeSummary, healthTopicsFor,
} from "@/lib/health-knowledge";
import { lifeProtectNamedIn, lifeProtectQaSection } from "@/lib/lifeprotect-knowledge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlanRules } from "@/calc/types";

/**
 * Everything this assistant is allowed to know, written out as Thai it can read.
 *
 * The whole of it — every rule of every plan — goes into one prompt, and that is a decision
 * rather than a shortcut. The rules come to 19 kilobytes; the premium tables they sit beside
 * come to 2.7 megabytes, a hundred and forty times more. Searching is what you do when the
 * knowledge will not fit, and this knowledge fits.
 *
 * Searching would also be the riskier answer here. A retrieval that misses one rule does not
 * return a worse answer, it returns a confident wrong one: the model would say HIC and MEB
 * can be bought together because it never saw the line that says they cannot. Sending
 * everything cannot miss anything.
 *
 * The premiums themselves are never in here. They are computed, by the engine, from the
 * tables — a figure this file handed to a model would be a figure a model could round.
 */

const money = (n: number) => n.toLocaleString("en-US");

/**
 * Which plans this chat can put a price on — asked of the code that does the pricing.
 *
 * Saying so inside the knowledge is not a detail in either direction. Claim too much and a
 * customer asks for a premium the assistant cannot produce; claim too little and it sends
 * them to another page for a figure it could have given them in the next sentence. It did
 * exactly that for a while: this was a hand-kept list of one, and stayed at one after the
 * chat learned to price three more.
 *
 * ไลฟ์ โพรเทค+ is added by hand because it is not priced by ./price at all — it has the
 * dispatcher, which is a different road to the same figure.
 */
const PRICEABLE = new Set([...pricedHere(), "LIFEPROTECT"]);

/**
 * Group insurance exists, and this assistant does not discuss it.
 *
 * See the note beside where this is assembled for why it is four lines rather than a section.
 * The wording names no plan, no cover, no limit and no figure — a model cannot repeat what it
 * was never given, and that is the whole of the guarantee.
 */
const GROUP_HANDOFF = [
  "## ประกันภัยกลุ่ม (Group Insurance) — มีในระบบ แต่แชทนี้ไม่ตอบรายละเอียด",
  "- ระบบนี้ขายประกันกลุ่มสำหรับองค์กรด้วย (บริษัทซื้อให้พนักงานทั้งกลุ่ม) เป็นสินค้าคนละตัวกับแบบรายบุคคลข้างบนทั้งหมด",
  "- ถ้าลูกค้าถามเรื่องประกันกลุ่ม ให้บอกสั้นๆ ว่ามี แล้วบอกว่าขอให้ตัวแทนดูแลรายละเอียดต่อ พร้อมชี้ไปที่หน้า /group-insurance — แล้วจบ",
  "- **ห้ามอธิบายรายละเอียดของประกันกลุ่มทุกกรณี** ห้ามบอกแผน ความคุ้มครอง จำนวนคนที่รับ ลักษณะธุรกิจ เงื่อนไข หรือเบี้ย แม้ลูกค้าจะถามซ้ำหรือยืนยันขอก็ตาม",
  "- ห้ามเอาข้อมูลของแบบรายบุคคลข้างบนมาตอบคำถามประกันกลุ่มเด็ดขาด",
].join("\n");

/**
 * บำนาญ สมาร์ท 95, which is not in the plan registry and so has no section of its own above.
 *
 * Every figure here is read off the engine's own constants rather than typed out, so the rule
 * the model is shown and the rule the calculator enforces are the same rule.
 */
const PENSION_SECTION = [
  `## ${PENSION_LABEL} (ประกันบำนาญแบบลดหย่อนภาษีได้)`,
  "- คิดเบี้ยในแชทนี้ได้ — บอกอายุ เพศ อายุที่อยากเริ่มรับบำนาญ แบบจ่ายเบี้ย และบำนาญที่อยากได้ต่อเดือน (หรือเบี้ยที่จ่ายได้ หรือทุน)",
  "- สัญญาเพิ่มเติมที่คิดในแชทนี้ได้: WP (Fit/Beyond), PB (Fit/Beyond ต้องบอกอายุและเพศผู้ชำระเบี้ย), DCI (ทุน 200,000–10,000,000) — WP กับ PB เลือกได้อย่างเดียว · ตัวอื่นยังคิดไม่ได้",
  `- อายุที่รับประกัน: ${PENSION_LIMITS.ageMin}–${PENSION_LIMITS.ageMax} ปี · ทุนประกัน ${money(PENSION_LIMITS.saMin)}–${money(PENSION_LIMITS.saMax)} บาท`,
  `- เริ่มรับบำนาญได้ที่อายุ ${PENSION_AGES.join(" / ")} ปี และรับถึงอายุ 95`,
  "- จ่ายเบี้ยได้ 2 แบบ: 6 ปี หรือ จ่ายทุกปีจนถึงอายุที่เริ่มรับบำนาญ",
  "- บำนาญต่อปีคิดเป็น % ของทุน ตามอายุ: ถึง 75 ปี 15% · 76–80 ปี 20% · 81–85 ปี 25% · 86–95 ปี 30%",
  "- รับประกันจ่ายบำนาญ 15 ปีแรก",
  "- เสียชีวิตก่อนรับบำนาญ: ปีที่ 1–2 คืนเบี้ย 100% ปีที่ 3 ขึ้นไป 110% ของเบี้ยที่จ่ายมา หรือมูลค่าเวนคืน แล้วแต่อย่างไหนมากกว่า",
  "- เบี้ยใช้ลดหย่อนภาษีแบบบำนาญได้ตามเกณฑ์สรรพากร · หน้าเครื่องคิดพร้อมตารางรายปีและคำนวณภาษี: /bumnan95",
].join("\n");

/**
 * CI 123 as the agency sells it on its own page: the rider on the smallest Life Protect x 2.
 * The rider's own rules are in the plan sections above; this says only that it is priced here
 * and on what, so the model neither refuses a price the chat can give nor invents a base.
 */
const CI123_SECTION = [
  `## ${CI123_LABEL} แบบชุด (หน้า /ci123)`,
  "- คิดเบี้ยในแชทนี้ได้ — บอกอายุ เพศ และทุน CI 123 (เช่น “CI 123 ชาย 35 ทุน 1 ล้าน”)",
  "- CI 123 เป็นสัญญาเพิ่มเติม ซื้อเดี่ยวไม่ได้ ชุดนี้คู่กับประกันชีวิต Life Protect x 2 (ไลฟ์ โพรเทค x 2) ชำระเบี้ยถึงอายุ 99 ทุน 150,000 บาท เบี้ยที่คิดให้รวมทั้งสองสัญญา",
  "- รับอายุแรกเกิดถึง 75 ปี · หน้า /ci123 มีทุน 5 แสน 1 2 3 4 5 และ 10 ล้าน",
  "- จ่ายตามระยะ (% ของทุน CI 123): ระยะก่อนเริ่มต้น 20% สูงสุด 100,000 · ระยะเริ่มต้นถึงปานกลาง 25% · โรคเด็ก 25% · เงื่อนไขพิเศษ 10% · ภาวะวิกฤต 25% (นับรวมวงเงินเดียวกับระยะรุนแรง) · ระยะรุนแรง 100% แล้วสัญญาสิ้นสุด",
  "- ระยะเวลารอคอย 90 วัน · เบี้ยส่วน CI 123 คิดตามอายุจริง ปรับขึ้นทุกปี",
].join("\n");

/**
 * The cancer set on /cancer, which the owner has said is what "ประกันมะเร็ง" and "แพ็กเกจมะเร็ง"
 * mean. The packages and stages are read off the bundle and `cancer-benefits`, the same
 * sources the page draws, so the model and the page cannot describe two different products.
 */
function cancerSection(): string {
  const bundle = getBundle(CANCER_BUNDLE)!;
  const range = bundleAgeRange(bundle);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const packages = bundle.tiers.map((t) => {
    const sum = (code: string) => t.riders.find((r) => r.code === code)!.sumAssured!.toLocaleString("en-US");
    return `ทุน ${sum(CANCER_RIDER)} ชดเชยวันละ ${sum(CANCER_DAILY_RIDER)} (ทุนชีวิต ${t.sumAssured.toLocaleString("en-US")})`;
  });
  return [
    `## ${CANCER_LABEL} / แพ็กเกจมะเร็ง (หน้า /cancer)`,
    "- เมื่อลูกค้าพูดว่า “ประกันมะเร็ง” หรือ “แพ็กเกจมะเร็ง” หมายถึงชุดนี้เสมอ ไม่ใช่แบบอื่นที่คุ้มครองมะเร็งด้วย",
    "- คิดเบี้ยในแชทนี้ได้ — บอกอายุ เพศ และทุนมะเร็ง (เช่น “ประกันมะเร็ง ชาย 35 ทุน 1 ล้าน”) คิดได้เฉพาะ 8 แพ็กเกจข้างล่าง",
    "- ชุดนี้คือสัญญาเพิ่มเติม CPR (คุ้มครองโรคมะเร็ง จ่ายเงินก้อน) คู่กับ HIC (ค่าชดเชยรายวันเมื่อนอนโรงพยาบาลเพราะมะเร็ง) แนบกับประกันชีวิต Life Protect x 2 ชำระเบี้ยถึงอายุ 99 เบี้ยที่คิดให้รวมทั้งสามสัญญา",
    `- รับอายุ ${range.min}–${range.max} ปี · แพ็กเกจ: ${packages.join(" · ")}`,
    `- CPR จ่ายตามระยะ (% ของทุนมะเร็ง): ${CPR_STAGES.map((s) => `${s.label} ${pct(s.share)}${s.cap ? ` สูงสุด ${s.cap.toLocaleString("en-US")}` : ""}${s.major ? " หักส่วนที่จ่ายไปแล้ว" : ""}`).join(" · ")}`,
    `- ${CPR_STAGES.filter((s) => s.note).map((s) => `${s.label}: ${s.note}`).join(" · ")}`,
    `- ระยะเวลารอคอย (นับถึงวันเก็บชิ้นเนื้อตรวจ): ${CPR_STAGES.map((s) => `${s.label} ${s.waitingDays} วัน`).join(" · ")}`,
    `- HIC จ่ายรายวันเมื่อนอนโรงพยาบาลเพราะมะเร็ง สูงสุด ${HIC_MAX_DAYS} วัน ระยะลุกลามขยายอีก ${HIC_INVASIVE_EXTRA_DAYS} วัน`,
    "- CPR และ HIC เป็นสัญญาปีต่อปี ต่ออายุได้ถึงอายุ 84 ปี เบี้ยปีต่ออายุปรับตามอายุ · ข้อยกเว้น CPR 10 ข้อ HIC 16 ข้อ ตามกรมธรรม์",
    "- ต่างจากประกันสุขภาพ: ประกันสุขภาพจ่ายค่ารักษาให้โรงพยาบาล ประกันมะเร็งจ่ายเงินก้อนและเงินรายวันให้ลูกค้าเอง",
  ].join("\n");
}

/** One plan's rules as sentences. The shapes are the workbook's; the wording is for reading. */
function planSection(code: string, name: string, rules: PlanRules): string {
  const lines: string[] = [
    `## ${trimSuffix(name)} (รหัส ${code})`,
    PRICEABLE.has(code)
      ? "- คิดเบี้ยในแชทนี้ได้ — บอกอายุ เพศ ทุนประกัน (และระยะเวลาชำระเบี้ยถ้าแบบนี้มีให้เลือก)"
      : getPlan(code)?.rules.base.premiumBasis
        // its figures run the other way, and its own brain takes them that way round
        ? "- คิดเบี้ยในแชทนี้ได้ — บอกอายุ เพศ และเงินที่อยากจ่ายต่อเดือน (ระบบบอกทุนที่ได้) หรือทุนประกันที่ต้องการ"
        : "- **คิดเบี้ยในแชทนี้ไม่ได้** ตอบเรื่องเงื่อนไขได้อย่างเดียว เบี้ยต้องไปที่หน้าแบบประกันอื่นๆ (/other-plans)",
  ];
  const b = rules.base;

  lines.push(`- อายุที่รับประกัน: ${b.ageMin}–${b.ageMax} ปี`);
  lines.push(`- ทุนประกันขั้นต่ำ: ${money(b.saMin)} บาท${b.saMax ? ` สูงสุด ${money(b.saMax)} บาท` : ""}`);
  if (b.saMinByVariant && Object.keys(b.saMinByVariant).length) {
    const per = Object.entries(b.saMinByVariant).map(([v, n]) => `${v} ขั้นต่ำ ${money(n)}`).join(", ");
    lines.push(`- ทุนขั้นต่ำเฉพาะแบบ: ${per}`);
  }
  if (b.saExactVariants?.length) {
    lines.push(`- แบบที่รับเฉพาะทุนขั้นต่ำเท่านั้น ห้ามมากกว่านั้น: ${b.saExactVariants.join(", ")}`);
  }
  if (b.ageMaxByVariant && Object.keys(b.ageMaxByVariant).length) {
    const per = Object.entries(b.ageMaxByVariant).map(([v, n]) => `${v} ถึงอายุ ${n}`).join(", ");
    lines.push(`- อายุสูงสุดเฉพาะแบบ: ${per}`);
  }
  if (b.extraDeathBenefitBeforeAge) {
    lines.push(`- เสียชีวิตก่อนอายุ ${b.extraDeathBenefitBeforeAge} ปี ได้รับเพิ่มจากทุนประกันตามตัวคูณของแบบนั้น`);
  }
  /**
   * Worded away from the word "เบี้ย" on purpose. It is a floor on what may be paid monthly,
   * not a price, and a model that finds "เบี้ย… 1,000 บาท" in its prompt has been handed a
   * premium to read out — which is the one thing every prompt in this system forbids.
   */
  if (rules.minMonthlyTotal) {
    lines.push(`- ยอดชำระขั้นต่ำต่อเดือน รวมทุกสัญญา (เป็นข้อจำกัดการชำระ ไม่ใช่ราคาของแบบนี้): ${money(rules.minMonthlyTotal)} บาท`);
  }

  const riders = Object.entries(rules.riders ?? {});
  if (riders.length) {
    lines.push("", "### สัญญาเพิ่มเติมที่ซื้อกับแบบนี้ได้");
    for (const [rcode, r] of riders) {
      const parts = [`อายุ ${r.ageMin}–${r.ageMax} ปี`];
      if (r.saMin) parts.push(`ทุนขั้นต่ำ ${money(r.saMin)}`);
      if (r.saMaxCap) parts.push(`ทุนสูงสุด ${money(r.saMaxCap)}`);
      if (r.saMaxMultipleOfBase) parts.push(`ทุนไม่เกิน ${r.saMaxMultipleOfBase} เท่าของทุนหลัก`);
      if (r.coverToAge) parts.push(`คุ้มครองถึงอายุ ${r.coverToAge}`);
      if (r.paysOnDeath) parts.push("จ่ายเมื่อเสียชีวิตด้วย");
      lines.push(`- **${rcode}** ${r.name ?? ""} — ${parts.join(" · ")}`);
    }
  }

  /**
   * The rules about combinations, which is what an agent actually rings up to ask. Each
   * carries the company's own message where the workbook has one, because that sentence is
   * what the agent has to be able to repeat.
   */
  const pairs: string[] = [];
  for (const x of rules.exclusive ?? []) pairs.push(`- ${x.riders.join(" กับ ")} เลือกได้อย่างใดอย่างหนึ่งเท่านั้น${x.message ? ` — ${x.message}` : ""}`);
  for (const x of rules.requires ?? []) pairs.push(`- ${x.rider} ต้องซื้อคู่กับ ${x.needs.join(", ")}${x.message ? ` — ${x.message}` : ""}`);
  for (const x of rules.conflicts ?? []) pairs.push(`- ${x.rider} ห้ามซื้อคู่กับ ${x.with.join(", ")}${x.message ? ` — ${x.message}` : ""}`);
  for (const x of rules.combined ?? []) {
    // not every combined rule has both halves: DCI + CPR is a ceiling with no multiple, and
    // printing the missing half read "ไม่เกิน undefined เท่า" — a sentence about a limit
    // that names no limit, which is worse in a knowledge base than saying nothing
    const limits = [
      x.maxMultipleOfBase ? `ไม่เกิน ${x.maxMultipleOfBase} เท่าของทุนหลัก` : null,
      x.cap ? `ไม่เกิน ${money(x.cap)} บาท` : null,
    ].filter(Boolean);
    if (limits.length) pairs.push(`- ${x.riders.join(" + ")} รวมกัน${limits.join(" และ")}`);
  }
  if (pairs.length) lines.push("", "### กฎการซื้อคู่", ...pairs);

  return lines.join("\n");
}

/**
 * The illness lists, and which question reaches which of them.
 *
 * Every list declares the words that call it. That is a deliberate choice against searching
 * by similarity: the vocabulary here is closed — five plans and thirteen riders, all named —
 * so a declared index is testable where a nearest-neighbour is only inspectable. Every route
 * in this table has a test that presses it.
 */
export interface DiseaseList {
  /** the contract's own code, which is how anything outside this file asks for one */
  code: string;
  name: string;
  note: string;
  groups: { title: string; diseases: string[] }[];
  /** the words that name this rider in particular */
  re: RegExp;
}

function diseaseLists(): DiseaseList[] {
  const dci = riderDiseases("DCI");
  const shield = ishieldDiseases as { note: string; early: string[]; major: string[] };
  const ci = ci123Diseases as { name: string; note: string; groups: { title: string; diseases: string[] }[] };
  const rrss = rrssDiseases as { name: string; note: string; groups: { title: string; diseases: string[] }[] };
  return [
    ...(dci ? [{
      code: "DCI", name: dci.name, note: dci.note, re: /\bdci\b|ดีซีไอ/i,
      groups: [{ title: "รายชื่อ", diseases: dci.diseases }],
    }] : []),
    {
      code: "ISHIELD", name: "iShield", note: shield.note, re: /i\s*-?\s*shield|ไอ\s*ชิลด์/i,
      groups: [
        { title: "ระยะเริ่มต้น", diseases: shield.early },
        { title: "ระยะรุนแรง", diseases: shield.major },
      ],
    },
    { code: "CI123", name: ci.name, note: ci.note, groups: ci.groups, re: /\bci\s*-?\s*123\b|ซีไอ\s*123/i },
    { code: "RRSS", name: rrss.name, note: rrss.note, groups: rrss.groups, re: /\brrss\b|\bmci\b|โซชิลด์/i },
  ];
}

const listTotal = (l: DiseaseList) => l.groups.reduce((n, g) => n + g.diseases.length, 0);

/** The heading every list keeps in the knowledge whether or not its names are sent with it. */
function listHeading(l: DiseaseList): string {
  const total = listTotal(l);
  return l.groups.length === 1
    ? `### ${l.name} — ${total} โรค`
    : `### ${l.name} — รวม ${total} โรค (${l.groups.map((g) => `${g.title} ${g.diseases.length}`).join(", ")})`;
}

/**
 * What every question carries: how many illnesses each rider covers, and the groups they fall
 * into. It is the answer to the question people actually ask — "กี่โรค" — and it costs a few
 * hundred characters rather than ten thousand.
 *
 * The last line is the reason this can be split at all. Without it, a question whose names
 * were not fetched would be answered "ข้อมูลนี้ไม่มีในระบบ", which is a lie about a system
 * that has them. With it, the assistant knows the list exists and offers to fetch it.
 */
function diseaseSummary(lists: DiseaseList[]): string {
  return [
    "## โรคร้ายแรงที่สัญญาเพิ่มเติมคุ้มครอง — สรุปจำนวน",
    ...lists.map((l) => `- ${listHeading(l).replace(/^### /, "")}`),
    "- ชื่อโรคทุกโรคมีอยู่ในระบบ ถ้าผู้ใช้ขอรายชื่อเต็มแต่ไม่เห็นรายชื่อด้านล่าง ให้บอกว่า “ขอรายชื่อเต็มได้ครับ ระบุสัญญาที่ต้องการ” — ห้ามบอกว่าไม่มีในระบบ",
  ].join("\n");
}

/** The names themselves, for the lists this question actually asked about. */
function diseaseDetail(lists: DiseaseList[]): string {
  if (!lists.length) return "";
  return [
    "## รายชื่อโรค (ชื่อตามกรมธรรม์)",
    ...lists.flatMap((l) => [
      listHeading(l),
      `- ${l.note}`,
      ...l.groups.map((g) => `- ${g.title}: ${g.diseases.join(" / ")}`),
    ]),
    "- คำนิยามของแต่ละโรคเป็นไปตามที่ระบุในกรมธรรม์ ห้ามสรุปหรือย่อคำนิยามเอง",
  ].join("\n");
}

/**
 * Which lists this question opens: the rider it names, and nothing otherwise.
 *
 * "โรคร้ายแรงมีอะไรบ้าง" used to open all four, twelve thousand characters of illness names —
 * and it was the wrong answer as well as the expensive one. A customer asking that is asking
 * which products cover critical illness, not for two hundred and thirty-nine diagnoses; the
 * owner had to point this out, having watched it happen. That question is now answered by
 * the options table above, which travels on every question and costs a few hundred
 * characters.
 *
 * So the names come out only for a named contract. Someone who does want them says which —
 * and if they do not, the summary's own line tells the assistant to ask, which it has to do
 * regardless: there are four different lists and no way to guess which one is meant.
 */
/**
 * One contract's illnesses, by the code the contract is written under.
 *
 * Exported so the picture of a list and the words of one come from the same place. A card
 * drawn from a second copy of these names is a card that goes on saying fifty when the
 * benefit sheet has moved to fifty-two, and nothing would say which of the two was wrong.
 */
export function diseaseListFor(code: string): DiseaseList | undefined {
  return diseaseLists().find((l) => l.code === code);
}

/** Every list there is, for anything that offers a choice of them. */
export function diseaseListCodes(): { code: string; name: string; total: number }[] {
  return diseaseLists().map((l) => ({ code: l.code, name: l.name, total: listTotal(l) }));
}

export function listsFor(question: string): DiseaseList[] {
  const all = diseaseLists();
  if (!question) return all;
  return all.filter((l) => l.re.test(question));
}

/**
 * What the agency sells against critical illness, as products rather than as diagnoses.
 *
 * Built from the rules and the lists themselves, so a rider that gains a plan or changes its
 * ages is described correctly here without anyone remembering to come back.
 */
function criticalIllnessSection(lists: DiseaseList[]): string {
  const count = (re: RegExp) => {
    const hit = lists.find((l) => re.test(l.name) || re.test(l.re.source));
    return hit ? listTotal(hit) : undefined;
  };
  /** the plans that sell a rider, by the name a person would say */
  const soldWith = (code: string) => knowledgePlans()
    .filter((p) => getPlan(p.code)?.rules.riders?.[code])
    .map((p) => trimSuffix(p.name))
    .join(", ");

  const lines = ["## คุ้มครองโรคร้ายแรง — มีอะไรให้เลือกบ้าง (ตอบคำถามแนว “โรคร้ายแรงมีแบบไหนบ้าง”)"];

  const ishield = getPlan("ISHIELD");
  if (ishield) {
    const b = ishield.rules.base;
    lines.push(
      `- **iShield** — เป็น**แบบประกันหลัก** ไม่ใช่สัญญาเพิ่มเติม คุ้มครองโรคร้ายแรง ${count(/iShield/) ?? "?"} โรค`
      + ` (ระยะเริ่มต้นจ่าย 25% ของทุนต่อโรค ระยะรุนแรงสูงสุด 100%) · อายุ ${b.ageMin}–${b.ageMax} ปี`
      + " · แบบนี้กรอกเบี้ยที่อยากจ่ายแล้วได้ทุนกลับมา",
    );
  }

  for (const [code, extra] of [
    ["DCI", "จ่ายทั้งกรณีเสียชีวิตและกรณีเจ็บป่วยด้วยโรคร้ายแรง"],
    ["CI123", "แบ่งจ่ายตามระยะของโรค ตั้งแต่ระยะก่อนเริ่มต้นถึงระยะรุนแรง"],
    ["RRSS", "เป็นค่ารักษาพยาบาลสำหรับโรคร้ายแรง ไม่ใช่เงินก้อน"],
  ] as const) {
    const rules = knowledgePlans().map((p) => getPlan(p.code)?.rules.riders?.[code]).find(Boolean);
    if (!rules) continue;
    const total = count(code === "RRSS" ? /โซชิลด์|MCI/ : new RegExp(code === "CI123" ? "CI\\s*123" : code, "i"));
    const limits = [
      `อายุ ${rules.ageMin}–${rules.ageMax} ปี`,
      ...(rules.coverToAge ? [`คุ้มครองถึงอายุ ${rules.coverToAge}`] : []),
      ...(rules.saMin ? [`ทุนขั้นต่ำ ${money(rules.saMin)}`] : []),
    ].join(" · ");
    lines.push(
      `- **${rules.name}** — สัญญาเพิ่มเติม ซื้อพ่วงกับ ${soldWith(code)}`
      + `${total ? ` · คุ้มครอง ${total} โรค` : ""} · ${limits} · ${extra}`,
    );
  }

  lines.push("- ถ้าลูกค้าถามว่า “โรคร้ายแรงมีอะไรบ้าง” ให้ตอบด้วยรายการนี้ก่อน แล้วค่อยถามว่าอยากดูรายชื่อโรคของตัวไหน");
  return lines.join("\n");
}

/** The answers the agency already gives by hand, which are the house's own words. */
function faqSection(question: string): string {
  /**
   * Each entry carries the pattern that summons it — written by whoever wrote the answer,
   * and the same one the Messenger bot matches on to serve it. Asking that pattern is how
   * this stays in step: a rewritten answer brings its own new trigger with it, and there is
   * no second list of keywords here to fall out of date.
   */
  const all = [
    ...LIFE_FAQ.map((f) => ({ plan: "Life Protect x 2", key: f.key, match: f.match, answer: f.answer })),
    // the health entries hold a function, because two of them are read off the contract
    // sheet at the moment they are asked rather than typed into the file
    ...HEALTH_FAQ.map((f) => ({ plan: "iHealthy Ultra", key: f.key, match: f.match, answer: f.answer() })),
  ];
  const wanted = question ? all.filter((f) => f.match.test(question)) : all;
  if (!wanted.length) return "";
  return ["## คำตอบมาตรฐานที่เอเจนซี่ใช้อยู่",
    ...wanted.map((f) => `- [${f.plan} · ${f.key}] ${f.answer.replace(/\n+/g, " ")}`)].join("\n");
}

/** What the agent has typed in for themselves: objections, comparisons, anything else. */
async function ownNotesSection(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_faq").select("question, answer").eq("enabled", true).limit(300);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { question: string; answer: string }[];
    if (rows.length === 0) return "";
    return ["## บันทึกของตัวแทนเอง (พิมพ์ไว้ในหลังบ้าน ไม่ใช่เอกสารบริษัท)",
      ...rows.map((r) => `- ถาม: ${r.question}\n  ตอบ: ${r.answer.replace(/\n+/g, " ")}`)].join("\n");
  } catch (e) {
    // a note the assistant cannot read is a note it answers without; the plan rules are the
    // part that must never be missing, and they are not in the database
    console.error("อ่านบันทึกของตัวแทนไม่สำเร็จ:", e);
    return "";
  }
}

/** The plans this chat can price, by the names a person would use for them. */
function priceableNames(): string[] {
  return knowledgePlans().filter((p) => PRICEABLE.has(p.code)).map((p) => trimSuffix(p.name));
}

/** Which plans the assistant may speak about, newest question first in the caller's hands. */
export function knowledgePlans(): { code: string; name: string }[] {
  return listPlans().filter((p) => getPlan(p.code)?.rules);
}

/**
 * The whole knowledge base as one block of Thai.
 *
 * Pure but for the one database read, and that read fails soft: the rules are the part that
 * must never be missing and they come from files in this repository, not from a table.
 */
export async function assembleKnowledge(
  question = "",
  /**
   * The Life Protect brain passes `lifeProtect` because its customers ask "ยกเลิกบูสเตอร์ได้ไหม"
   * without naming the plan — the whole conversation already is the plan.
   */
  open: { lifeProtect?: boolean } = {},
): Promise<string> {
  const plans = knowledgePlans()
    .map((p) => planSection(p.code, p.name, getPlan(p.code)!.rules))
    .join("\n\n");
  const notes = await ownNotesSection();
  const all = diseaseLists();
  const opened = listsFor(question);
  const faq = faqSection(question);
  const healthDetail = healthKnowledgeDetail(question);

  const text = [
    "# คลังความรู้ของระบบนี้",
    "ทุกอย่างด้านล่างมาจากไฟล์กฎและตารางของระบบนี้เอง ไม่ได้มาจากที่อื่น",
    "",
    /**
     * Written from the same set the per-plan lines use. This sentence used to name two plans
     * by hand and forbid quoting any other — which outranked everything below it, so fixing
     * the per-plan lines alone would have left the assistant refusing anyway.
     */
    `**สำคัญ:** แชทนี้คิดเบี้ยให้ได้เฉพาะแบบเหล่านี้: ${priceableNames().join(", ")}, ${PENSION_LABEL}, ${CI123_LABEL} (แบบชุดคู่ Life Protect x 2), ${CANCER_LABEL} (แพ็กเกจมะเร็ง หน้า /cancer) และ iHealthy Ultra`,
    "แบบที่ไม่อยู่ในรายการนี้ ตอบได้แต่เรื่องเงื่อนไข ห้ามเสนอว่าจะคิดเบี้ยให้ และให้ชี้ไปที่หน้า /other-plans แทน",
    "",
    plans,
    // fetched by its name, like the illness lists: the spine above already says it exists and
    // can be priced, and every other question would pay for its rules without reading them
    ...(question === "" || pensionNamedIn(question) ? ["", PENSION_SECTION] : []),
    ...(question === "" || ci123NamedIn(question) ? ["", CI123_SECTION] : []),
    ...(question === "" || cancerNamedIn(question) ? ["", cancerSection()] : []),
    // fetched by name like the three above; it is the company's Q&A sheet and runs to 7,000
    // characters an iHealthy question would carry for nothing
    ...(question === "" || open.lifeProtect || lifeProtectNamedIn(question) ? ["", lifeProtectQaSection()] : []),
    /**
     * Group insurance, said in four lines and no more.
     *
     * It briefly had a section here — the risk classes, the six plans, the cover across all of
     * them — and the owner took it back out: group cover is sold to a company across a
     * meeting-room table, and they want a person in that conversation rather than a chat
     * window. `handOverGroup` is what a customer actually gets, written out and sent without
     * a model.
     *
     * What is left is for the two brains that carry this whole library inside their own
     * prompts. The dispatcher answers a group question before either of them sees it, but a
     * conversation already deep in a health quotation can still wander there, and the brain
     * holding it needs to know two things: that the product exists, so it does not deny one
     * the agency sells; and that it is not to be described, so it does not improvise one.
     *
     * The safety here is the absence, not the instruction. A model cannot leak a benefit
     * table that is not in its prompt, and this is the fourth time in this file that a figure
     * has been kept out of one rather than forbidden inside it.
     *
     * It sits before the illness blocks because `## รายชื่อโรค` is the last heading of the
     * document by design — `copilot-diseases` reads every heading after it to see which
     * illness lists a question opened, and a section arriving later was counted as four more.
     */
    "",
    GROUP_HANDOFF,
    "",
    /**
     * The health contract's own words, and the regulator's admission table.
     *
     * Split the same way the illness lists are, and placed here for the same reason the group
     * handoff is: these blocks head their sections with `### `, and `## รายชื่อโรค` has to
     * stay the last `##` of the document — `copilot-diseases` reads every `### ` after it to
     * see which illness lists a question opened, and a block arriving later was counted as
     * four more of them.
     */
    healthKnowledgeSummary(),
    ...(healthDetail ? ["", healthDetail] : []),
    "",
    criticalIllnessSection(all),
    "",
    diseaseSummary(all),
    ...(opened.length ? ["", diseaseDetail(opened)] : []),
    ...(faq ? ["", faq] : []),
    ...(notes ? ["", notes] : []),
  ].join("\n");

  /**
   * What was sent, in one line. A route that quietly fetches the wrong thing is the failure
   * this design can have, and the only way to find it is to be able to read afterwards which
   * blocks a question opened.
   */
  console.info(
    `[knowledge] ${text.length} ตัวอักษร · โรค: ${opened.length ? opened.map((l) => l.name.slice(0, 18)).join("+") : "สรุปเท่านั้น"}`
    + ` · สุขภาพ: ${healthTopicsFor(question).map((t) => t.code).join("+") || "สรุปเท่านั้น"}`
    + ` · faq: ${faq ? faq.split("\n").length - 1 : 0}`,
  );
  return text;
}
