import { ageIn, coverIn } from "@/lib/assistant/common";
import { sumWords } from "@/lib/ci123-cta";
import {
  PA_FAMILIES, PA_WEEKLY_MAX_WEEKS, paClassesOf, paFamily, paPerDay, paPremium, paSumAfterRenewals,
  type PaFamily, type PaFamilyId, type PaPlan,
} from "@/lib/pa-plans";
import type { GuideItem } from "./guide";
import type { PriceReply } from "./price";

/**
 * PA (Krungthai-AXA's Personal Accident) in the LINE and Messenger chats, without a model.
 * Owner, 2026-11-14, ก ก ก on mockup https://claude.ai/artifact/1ax81iJFMjK7tG4dAX95sk:
 *  1ก prices for occupation class 1 and 2 side by side; the company sets the class on applying,
 *     so the bot never guesses one from a job, and a risky job goes to แอดมิน;
 *  2ก a sum alone is answered with the three families at that sum;
 *  3ก PA stays out of the greeting menu: it is answered when the customer asks for it.
 *
 * Every figure comes from `pa-plans`, the table the /pa page is built from. Questions about the
 * cover's rules ("มอไซค์ล้มเองจ่ายไหม") are not answered here: they go on to the library, which
 * carries `PA_SECTION` below.
 */

export const PA_LABEL = "ประกันอุบัติเหตุ PA";

const NAMED = /ประกัน\s*อุบัติเหตุ|อุบัติเหตุ\s*ส่วน\s*บุคคล|\bPA\b|พีเอ|personal\s*accident/i;

export function paNamedIn(text: string): boolean {
  return NAMED.test(text);
}

/** a family by its brochure name or the way it is typed in Thai */
const FAMILY_WORDS: [PaFamilyId, RegExp][] = [
  ["classic", /classic|คลาส(?:สิ|ซิ)[กค]/i],
  ["platinum", /platinum|แพล?ทติ?นั[มั่]/i],
  ["max", /\bmax\b|แม็?[กค]ซ์/i],
];

function familyIn(text: string): PaFamily | undefined {
  const hit = FAMILY_WORDS.find(([, re]) => re.test(text));
  return hit ? paFamily(hit[0]) : undefined;
}

/** "Classic A", "Platinum 02", "Max 10", "PAP03" — a plan named by its own name or code */
function planNamedIn(text: string, family: PaFamily | undefined): PaPlan | undefined {
  const code = text.match(/\bPA([CPM])(\d{2})\b/i);
  if (code) {
    return PA_FAMILIES.flatMap((f) => f.plans).find((p) => p.code.toUpperCase() === `PA${code[1].toUpperCase()}${code[2]}`);
  }
  if (!family) return undefined;
  if (family.id === "classic") {
    const ab = text.match(/(?:classic|คลาส(?:สิ|ซิ)[กค])\s*([AB])\b/i);
    return ab ? family.plans.find((p) => p.name.endsWith(ab[1].toUpperCase())) : undefined;
  }
  // "Max 01", "Platinum 2" — a number of one or two digits right after the name, not a sum
  const n = text.match(new RegExp(`(?:${FAMILY_WORDS.find(([id]) => id === family.id)![1].source})\\s*0?(\\d{1,2})(?!\\s*(?:ล้าน|แสน|,|\\d))`, "i"));
  if (!n) return undefined;
  return family.plans[Number(n[1]) - 1];
}

/** "8 ขวบ", "ลูกอายุ 5" — the young ages `ageIn` leaves to the sentence */
function childAgeIn(text: string): number | undefined {
  const m = text.match(/(\d{1,2})\s*ขวบ/);
  return m ? Number(m[1]) : undefined;
}

/**
 * Jobs the company classes case by case (class 3–4 or refused): riding or driving for hire,
 * building work, heights, uniformed and rescue work, the sea, mines, factories, sport.
 */
const RISKY = /วิน(?:มอ|จักรยานยนต์)?|ไรเดอร์|rider|ส่ง(?:ของ|อาหาร|พัสดุ)|ขับ(?:รถ)?\s*(?:รับจ้าง|แท็กซี่|แท๊กซี่|สิบล้อ|บรรทุก|รถส่ง)|แท็กซี่|ก่อสร้าง|ช่าง(?:ไฟ|เชื่อม|ก่อ|ปูน|ซ่อม)|ที่สูง|นั่งร้าน|ทหาร|ตำรวจ|กู้ภัย|ดับเพลิง|รปภ|ยาม|ประมง|ชาวเรือ|เหมือง|โรงงาน|นักมวย|นักกีฬา|สตันท์|นักบิน/i;
/** jobs nearly always class 1, said so as a likelihood, never as the class */
const DESK = /ออฟฟิศ|office|พนักงานบริษัท|ข้าราชการ|ครู|อาจารย์|แม่บ้าน|นักเรียน|นักศึกษา|ธุรการ|บัญชี|ทำงานบริษัท|เจ้าของกิจการ|ค้าขาย|ขายของออนไลน์/i;

/** a question about the cover's rules, which the library answers better than a price list */
const ABOUT_RULES = /จ่าย(?:ไหม|มั้ย|หรือเปล่า|รึเปล่า)|คุ้มครอง(?:ไหม|มั้ย|อะไร|กรณี|ถึง)|เคลม|ยกเว้น|ครอบคลุม|ต่างกัน|ต่าง(?:ยังไง|อย่างไร)|เงื่อนไข|ระยะ\s*รอคอย|ต่างประเทศ|ทั่วโลก|ต่ออายุ|ตรวจสุขภาพ|แถลง/;

/** whether the bot's last message was a PA answer, so "32 ปี ทุน 1 ล้าน" after it is PA too */
export function lastWasPa(lastSaid: string | undefined): boolean {
  return Boolean(lastSaid && /PA (?:Classic|Platinum|Max)/.test(lastSaid));
}

/** a follow-up to a PA answer: carries an age, a sum, a family, a plan or a job */
export function continuesPa(text: string): boolean {
  return ageIn(text) !== undefined || childAgeIn(text) !== undefined || coverIn(text) !== undefined
    || familyIn(text) !== undefined || /\bPA[CPM]\d{2}\b/i.test(text) || RISKY.test(text) || DESK.test(text);
}

const baht = (n: number) => n.toLocaleString("en-US");
/** "Platinum", "02" — the two halves of a plan's name, for buttons that name it again */
const familyWord = (f: PaFamily) => f.name.replace("PA ", "");
const planWord = (p: PaPlan) => p.name.split(" ")[1];

/** "4,500 / 5,500" for classes 1 and 2; Classic A's class 3 as well, "—" where a class is refused */
function classPrices(p: PaPlan): string {
  const one = paPremium(p, 1)!;
  const two = paPremium(p, 2);
  const three = paPremium(p, 3);
  return `**${baht(one)}** / ${two === null ? "—" : baht(two)} บาท${three !== null ? ` (ขั้น 3: ${baht(three)})` : ""}`;
}

/** the few lines that tell one plan from another, in the brochure's order */
function coverLines(p: PaPlan, short = false): string[] {
  return [
    `• อุบัติเหตุเสียชีวิต/ทุพพลภาพถาวร ${baht(p.death)}`,
    short ? `• ถูกฆาตกรรม ${baht(p.murder)} · มอเตอร์ไซค์ ${baht(p.motorcycle)}` : `• ถูกฆาตกรรมหรือลอบทำร้าย ${baht(p.murder)}`,
    ...(short ? [] : [`• ขับขี่/โดยสารมอเตอร์ไซค์ ${baht(p.motorcycle)}`]),
    p.medical ? `• ค่ารักษาต่ออุบัติเหตุ ${baht(p.medical)}` : "• ไม่มีค่ารักษา",
    ...(p.weekly ? [`• ชดเชยรายสัปดาห์ ${baht(p.weekly)} (สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์)`] : []),
  ];
}

const CLASS_NOTE = "ขั้นอาชีพจริงบริษัทเป็นผู้กำหนดตอนสมัครครับ";
const DESK_NOTE = "งานออฟฟิศส่วนใหญ่อยู่ขั้น 1 ส่วนขั้นอาชีพจริงบริษัทเป็นผู้กำหนดตอนสมัครครับ";
const RENEW_NOTE = "ทุกแบบต่ออายุแล้วทุนเพิ่มปีละ 5% สูงสุด 25%";

/** a button that asks a whole question with PA in it, so it comes back here */
function button(label: string, parts: (string | undefined)[]): GuideItem {
  return { label, ask: ["PA", ...parts.filter(Boolean)].join(" ") };
}

/** each family's plan at this sum, or the nearest it has; Classic only where the sum is its own */
function atSum(sum: number, families: PaFamily[]): { family: PaFamily; plan: PaPlan; exact: boolean }[] {
  return families.flatMap((family) => {
    const exact = family.plans.find((p) => p.death === sum);
    if (exact) return [{ family, plan: exact, exact: true }];
    if (family.id === "classic") return [];
    const near = [...family.plans].sort((a, b) => Math.abs(a.death - sum) - Math.abs(b.death - sum))[0];
    return [{ family, plan: near, exact: false }];
  }).sort((a, b) => paPremium(a.plan, 1)! - paPremium(b.plan, 1)!);
}

/** families a customer of this age can buy */
function openTo(age: number | undefined): PaFamily[] {
  return age === undefined ? PA_FAMILIES : PA_FAMILIES.filter((f) => age >= f.ageMin && age <= f.ageMax);
}

function overview(): PriceReply {
  return {
    priced: false,
    text: [
      "มีครับ 🙏 ประกันอุบัติเหตุส่วนบุคคล (PA) ของกรุงไทย-แอกซ่า คุ้มครอง 24 ชม. ทั่วโลก สัญญาปีต่อปี มี 3 แบบครับ",
      "",
      "**PA Classic** ทุน 7 แสน – 1 ล้าน มีค่ารักษาต่ออุบัติเหตุ · รับแรกเกิด–64 ปี",
      "**PA Platinum** ทุน 1–10 ล้าน มีค่ารักษา + ชดเชยรายสัปดาห์ · รับ 16–64 ปี",
      "**PA Max** ทุน 1–10 ล้าน เบี้ยถูกสุด ไม่มีค่ารักษา · รับ 16–64 ปี",
      "",
      "ขอทราบอายุ อาชีพ และทุนที่อยากได้คร่าวๆ แอดมินคิดเบี้ยให้ได้เลยครับ",
    ].join("\n"),
  };
}

/** one plan in full, the same lines the /pa page copies */
function quote(family: PaFamily, plan: PaPlan, age: number | undefined, desk: boolean): PriceReply {
  const one = paPremium(plan, 1)!;
  const two = paPremium(plan, 2);
  const three = paPremium(plan, 3);
  const others = [two !== null ? `ขั้น 2: ${baht(two)}` : undefined, three !== null ? `ขั้น 3: ${baht(three)}` : undefined].filter(Boolean);
  const text = [
    `🛡️ **${family.name.replace(/ (Classic|Platinum|Max)$/, "")} ${plan.name}**${age !== undefined ? ` · อายุ ${age} ปี` : ""}`,
    `💰 เบี้ย **${baht(one)} บาท/ปี** (ขั้นอาชีพ 1 · ตกวันละ ${baht(paPerDay(one))} บาท)`,
    ...(others.length ? [`${others.join(" · ")} บาท/ปี`] : []),
    "",
    "✅ ความคุ้มครอง",
    `- อุบัติเหตุเสียชีวิต สูญเสียอวัยวะ ทุพพลภาพถาวร ${baht(plan.death)}`,
    `- ถูกฆาตกรรมหรือลอบทำร้าย ${baht(plan.murder)}`,
    `- ขับขี่/โดยสารมอเตอร์ไซค์ ${baht(plan.motorcycle)}`,
    ...(plan.medical ? [`- ค่ารักษาต่ออุบัติเหตุ ${baht(plan.medical)}`] : ["- ไม่มีค่ารักษาพยาบาล"]),
    ...(plan.weekly ? [`- ชดเชยทุพพลภาพชั่วคราว สัปดาห์ละ ${baht(plan.weekly)} (สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์)`] : []),
    `- ต่ออายุปีที่ 2–6 ทุนเพิ่มปีละ 5% (ปีที่ 6 ทุนชีวิต ${baht(paSumAfterRenewals(plan))})`,
    "",
    `📌 คุ้มครอง 24 ชม. ทั่วโลก · สัญญา 1 ปี ต่ออายุปีต่อปี${age === undefined ? ` · รับอายุ ${family.ageMin}–${family.ageMax} ปี` : ""}`,
    desk ? DESK_NOTE : CLASS_NOTE,
  ].join("\n");
  const at = family.plans.indexOf(plan);
  const next = family.plans.slice(at + 1, at + 3);
  const who = age !== undefined ? `อายุ ${age}` : undefined;
  return {
    priced: true,
    text,
    guide: [
      ...next.map((p) => button(`ทุน ${sumWords(p.death)}`, [familyWord(family), planWord(p), who])),
      { label: "สนใจสมัคร", ask: "สนใจสมัคร PA" },
    ],
  };
}

/** the three families side by side at one sum (2ก) */
function compare(sum: number, age: number | undefined, desk: boolean, sample: boolean): PriceReply {
  const rows = atSum(sum, openTo(age));
  const head = `**PA ทุน ${sumWords(sum)}**${age !== undefined ? ` · อายุ ${age} ปี` : ""}${sample ? " (ยกตัวอย่าง)" : ""}`;
  const who = age !== undefined ? `อายุ ${age}` : undefined;
  const text = [
    head,
    "เบี้ยรายปี (ขั้นอาชีพ 1 / ขั้น 2)",
    ...rows.flatMap(({ family, plan, exact }) => [
      "",
      `**${family.name.replace(/ (Classic|Platinum|Max)$/, "")} ${plan.name}**${exact ? "" : ` (ทุน ${sumWords(plan.death)} ใกล้สุด)`} — ${classPrices(plan)}`,
      ...coverLines(plan, true),
    ]),
    "",
    desk ? DESK_NOTE : CLASS_NOTE,
    RENEW_NOTE,
    ...(age !== undefined && age < 16 ? ["PA Platinum และ PA Max รับตั้งแต่อายุ 16 ปีครับ"] : []),
  ].join("\n");
  const bigger = [1_000_000, 2_000_000, 3_000_000, 5_000_000].filter((n) => n !== sum && (age === undefined || age >= 16 || n <= 1_000_000)).slice(0, 2);
  return {
    priced: true,
    text,
    guide: [
      ...rows.map(({ family, plan }) => button(plan.name, [familyWord(family), planWord(plan), who])),
      ...bigger.map((n) => button(`ทุน ${sumWords(n)}`, [`ทุน ${sumWords(n)}`, who])),
    ].slice(0, 5),
  };
}

/** a family named without a sum: its plans, one line each */
function familyList(family: PaFamily, age: number | undefined, note?: string): PriceReply {
  const who = age !== undefined ? `อายุ ${age}` : undefined;
  const text = [
    `**${family.name}** ${family.tagline} · รับอายุ ${family.ageMin === 0 ? "แรกเกิด" : family.ageMin}–${family.ageMax} ปี`,
    `เบี้ยรายปี (ขั้นอาชีพ ${paClassesOf(family).join(" / ")})`,
    "",
    ...family.plans.map((p) => `- ${p.name} ทุน ${sumWords(p.death)} — ${classPrices(p)}`),
    "",
    CLASS_NOTE,
    ...(note ? [note] : []),
    "เลือกแผนมาได้เลย แอดมินส่งรายละเอียดความคุ้มครองให้ครับ",
  ].join("\n");
  return {
    priced: true,
    text,
    guide: family.plans.slice(0, 4).map((p) => button(p.name, [familyWord(family), planWord(p), who])),
  };
}

/** a job the company classes case by case: แอดมิน checks, with the ranges meanwhile */
function risky(sum: number | undefined, age: number | undefined): PriceReply {
  const at = sum ?? 1_000_000;
  const rows = atSum(at, openTo(age));
  return {
    priced: false,
    text: [
      "ขอบคุณที่บอกอาชีพมาครับ 🙏 อาชีพนี้บริษัทจะพิจารณาขั้นอาชีพเป็นรายคน เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้นะครับ",
      "",
      `ระหว่างนี้ดูช่วงเบี้ยคร่าวๆ ทุน ${sumWords(at)}:`,
      ...rows.map(({ family, plan }) => {
        const prices = paClassesOf(family).map((c) => paPremium(plan, c)).filter((v): v is number => v !== null);
        const lo = Math.min(...prices);
        const hi = Math.max(...prices);
        return `• ${family.name.replace(/ (Classic|Platinum|Max)$/, "")} ${plan.name} ${lo === hi ? baht(lo) : `${baht(lo)}–${baht(hi)}`} บาท/ปี`;
      }),
      "ถ้าบริษัทจัดเป็นขั้น 4 จะซื้อ PA ทั้ง 3 แบบไม่ได้ครับ",
    ].join("\n"),
  };
}

/**
 * The PA answer to one message, or undefined when it is a rules question for the library.
 * `earlier` is what the customer said before, for an age given one message back.
 */
export function pricePa(text: string, earlier: string[] = []): PriceReply | undefined {
  const said = text.replace(new RegExp(NAMED.source, "gi"), " ");
  const family = familyIn(said);
  const plan = planNamedIn(said, family);
  const ageNow = ageIn(said) ?? childAgeIn(said);
  const sum = coverIn(said);
  const isRisky = RISKY.test(said);
  const deskNow = DESK.test(said);
  const fresh = ageNow !== undefined || sum !== undefined || family !== undefined || plan !== undefined || isRisky || deskNow;

  // a rules question about PA is the library's, even with an age said earlier in the chat
  if (!fresh && ABOUT_RULES.test(said)) return undefined;

  const age = ageNow ?? earlier.map((t) => ageIn(t) ?? childAgeIn(t)).find((a) => a !== undefined);
  const desk = deskNow || earlier.some((t) => DESK.test(t));
  const child = age !== undefined && age < 16;
  const childNote = "PA Platinum และ PA Max รับตั้งแต่อายุ 16 ปีครับ";

  if (isRisky) return risky(sum, age);
  if (age !== undefined && age > 64) {
    return { priced: false, text: `ขออภัยครับ PA ทั้ง 3 แบบรับอายุไม่เกิน 64 ปี อายุ ${age} ปีจึงสมัครไม่ได้ครับ` };
  }

  const chosen = plan ?? (family && sum !== undefined ? family.plans.find((p) => p.death === sum) : undefined);
  if (chosen) {
    const owner = PA_FAMILIES.find((f) => f.plans.includes(chosen))!;
    if (age !== undefined && age < owner.ageMin) return familyList(paFamily("classic"), age, childNote);
    return quote(owner, chosen, age, desk);
  }
  if (child) return familyList(paFamily("classic"), age, childNote);
  if (family) return familyList(family, age);
  if (sum !== undefined) return compare(sum, age, desk, false);
  if (ageNow !== undefined || deskNow) return compare(1_000_000, age, desk, true);
  if (/เบี้ย|ราคา|กี่บาท|ค่างวด|คิดให้|premium|ปีละ/i.test(said) && age !== undefined) return compare(1_000_000, age, desk, true);
  return overview();
}

/**
 * PA in the library, for rules questions ("มอไซค์ล้มเองจ่ายไหม", "คุ้มครองต่างประเทศไหม").
 * Fetched by name like the cancer set; prices are left to `pricePa`, which answers them first.
 */
export function paSection(): string {
  const line = (f: PaFamily) => {
    const p = f.plans;
    const range = (k: keyof PaPlan) => {
      const v = p.map((x) => x[k] as number | undefined).filter((x): x is number => typeof x === "number");
      if (!v.length) return "ไม่มี";
      const lo = Math.min(...v);
      const hi = Math.max(...v);
      return lo === hi ? baht(lo) : `${baht(lo)}–${baht(hi)}`;
    };
    return [
      `### ${f.name} (รับอายุ ${f.ageMin}–${f.ageMax} ปี · ขั้นอาชีพ ${paClassesOf(f).join(", ")})`,
      `- อุบัติเหตุเสียชีวิต สูญเสียอวัยวะ หรือทุพพลภาพถาวรสิ้นเชิง: ${range("death")} บาท`,
      `- ถูกฆาตกรรมหรือลอบทำร้าย: ${range("murder")} บาท`,
      `- ขับขี่หรือโดยสารรถจักรยานยนต์ (เสียชีวิต/ทุพพลภาพ): ${range("motorcycle")} บาท`,
      `- ค่ารักษาพยาบาลต่ออุบัติเหตุ รวมการบาดเจ็บจากการขับขี่หรือโดยสารมอเตอร์ไซค์: ${range("medical")} บาท`,
      `- ค่าชดเชยทุพพลภาพชั่วคราวสิ้นเชิง รายสัปดาห์ สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์: ${range("weekly")} บาท`,
    ].join("\n");
  };
  return [
    `## ${PA_LABEL} (กรุงไทย-แอกซ่า · ประกันอุบัติเหตุส่วนบุคคล)`,
    "คุ้มครองอุบัติเหตุ 24 ชั่วโมง ทุกที่ทั่วโลก สัญญา 1 ปี ต่ออายุปีต่อปี เบี้ยกำหนดตามขั้นอาชีพ ไม่ขึ้นกับอายุหรือเพศ ขั้นอาชีพ 4 ไม่รับทุกแบบ",
    "ผลประโยชน์พิเศษ: เพิ่มทุนเสียชีวิต/ทุพพลภาพในปีต่ออายุ ปีละ 5% ของทุนตั้งต้น ตั้งแต่ปีกรมธรรม์ที่ 2–6 รวมสูงสุด 25% ต่ออายุได้ภายใน 31 วันหลังครบกำหนดยังได้สิทธิ์ 5% แต่ไม่คุ้มครองช่วงนั้น ชำระเกินช่วงนี้ถือเป็นการซื้อใหม่",
    "ขั้นอาชีพบริษัทเป็นผู้กำหนดตอนสมัคร ห้ามเดาขั้นจากชื่ออาชีพ ข้อยกเว้นและรายละเอียดเป็นไปตามกรมธรรม์",
    "",
    ...PA_FAMILIES.map(line),
  ].join("\n");
}
