import contract from "../../../data/riders/ihealthy-ultra-contract.json";
import claims from "../../../data/claims/admission-criteria.json";
import { iShieldTable } from "@/lib/ishield-table";
import { planName, termShort } from "@/lib/story/plans";
import { THAI_MONTHS, type Festival } from "@/lib/story/topics";
import type { StoryFigure, StoryVideoInput } from "./story";
import { big, n, small, withBaht, type KnowScene, type KnowShow, type NoteLine, type PicIcon } from "./story-knowledge";

/**
 * หลังการขาย (owner, 2026-10-15, mockup https://claude.ai/artifact/7V5MfG21asotVJm9TCJojc): clips
 * for a customer who has bought, on the same scene keys and drawing as ความรู้ประกัน 1 นาที.
 *
 * - ส่งมอบกรมธรรม์: thanks, what the plan covers and costs, when cover starts, keeping the policy safe.
 * - วิธีเคลม: in hospital on iHealthy Ultra, from its contract and claim rules in data/; a critical
 *   illness on iShield, from its illness table. No document list: the owner has not given one, so
 *   the steps stay at "tell your agent, send the doctor's diagnosis".
 * - Short clips, two scenes and the card: a premium falling due, a birthday, a festival.
 *
 * Every number here comes from data/ or the plan's table, or from what the agent typed. The
 * free-look period is left out until the owner confirms the company's days (2026-10-15).
 */

export type AfterTopic = "deliver" | "claimihu" | "claimish" | "remind" | "birthday" | "festival";

/** each clip's closing: the card's button, and the voice under it */
export const AFTER_CLOSE: Record<AfterTopic, { cta: string; voice: string }> = {
  deliver: { cta: "มีอะไรทักมาได้ตลอด", voice: "เคลม จ่ายเบี้ย หรือเปลี่ยนข้อมูล ทักมาได้ตลอดนะคะ" },
  claimihu: { cta: "ป่วยเมื่อไร ทักก่อนเข้าโรงพยาบาล", voice: "ป่วยเมื่อไร ทักมาก่อนเข้าโรงพยาบาลนะคะ จะช่วยดูให้ค่ะ" },
  claimish: { cta: "เคลมเมื่อไร ทักมาได้เลย", voice: "เคลมเมื่อไร ทักมาได้เลยนะคะ" },
  remind: { cta: "ติดขัดอะไร ทักมาได้เลย", voice: "ติดขัดอะไร ทักมาได้เลยนะคะ" },
  birthday: { cta: "ด้วยความห่วงใย", voice: "ด้วยความห่วงใยค่ะ" },
  festival: { cta: "ด้วยความห่วงใย", voice: "ด้วยความห่วงใยค่ะ" },
};

/** iHealthy Ultra's own days, from its contract and the claim rules (data/riders, data/claims) */
export const IHU = {
  evidenceDays: contract.claimEvidenceDays,
  payoutDays: contract.payoutDays,
  /** when each kind of cover starts: วันที่ 1, 30 วัน, 90 วัน, 120 วัน */
  starts: claims.timeline.steps.map((s) => s.when),
};

const scene = (key: KnowScene["key"], show: KnowShow, voice: string): KnowScene => ({ key, show, voice });

function deliver(input: StoryVideoInput, name: string): KnowScene[] {
  const f = input.figure as StoryFigure;
  const who = name ? `คุณ${name}` : "คุณ";
  const shield = f.plan === "ISHIELD";
  const ill = iShieldTable().illness;
  const cover: NoteLine[] = shield
    ? [
      small(`${planName(f.plan)} ทุน ${n(f.sumAssured)} บาท`),
      big(`ระยะเริ่มต้น ${ill.earlyCount} โรค`),
      small(`จ่าย ${ill.earlyPercent}% = ${n((f.sumAssured * ill.earlyPercent) / 100)} บาท ต่อโรค`),
      big(`ระยะรุนแรง ${ill.majorCount} โรค`),
      small(`จ่ายสูงสุด ${ill.majorPercent}% = ${n((f.sumAssured * ill.majorPercent) / 100)} บาท`),
    ]
    : [small(planName(f.plan)), big("คุ้มครองชีวิต"), big(`ทุน ${n(f.sumAssured)} บาท`), small("เงินถึงมือผู้รับประโยชน์ที่ระบุไว้")];
  return [
    scene("knowAsk", { layout: "kin", title: ["ขอบคุณ", "ที่ไว้วางใจ"], people: [{ id: input.faces.hero, size: "hero" }, { id: input.faces.narrator, size: "adult" }], hearts: true },
      `${name ? `คุณ${name}คะ ` : ""}ขอบคุณที่ไว้วางใจให้ดูแลนะคะ วันนี้กรมธรรม์ของ${who}มาถึงแล้วค่ะ`),
    scene("knowOne", { layout: "pic", title: [`สิ่งที่${who}ได้`, ""], icon: "policy", note: cover },
      shield
        ? `${planName(f.plan)} ของ${who} คุ้มครองโรคร้ายแรง ทุน ${withBaht(f.sumAssured)} ระยะเริ่มต้น ${ill.earlyCount} โรค จ่าย ${ill.earlyPercent} เปอร์เซ็นต์ต่อโรค ระยะรุนแรง ${ill.majorCount} โรค จ่ายสูงสุดเต็มทุนค่ะ`
        : `${planName(f.plan)} ของ${who} คุ้มครองชีวิต ทุน ${withBaht(f.sumAssured)} เงินก้อนนี้จะถึงมือผู้รับประโยชน์ที่ระบุไว้ค่ะ`),
    scene("knowTwo", { layout: "pic", title: ["เบี้ยที่ต้องจ่าย", ""], icon: "calendar", note: [small("ปีละ"), big(`${n(f.annual)} บาท`), small(termShort(f)), small(`หรือแบ่งจ่ายเดือนละ ${n(f.monthly)} บาท`)] },
      `เบี้ยปีละ ${n(f.annual)} บาท ${termShort(f)}ค่ะ จ่ายให้ตรงเวลา ความคุ้มครองจะได้ต่อเนื่องนะคะ`),
    shield
      ? scene("knowThree", { layout: "timeline", title: ["เริ่มคุ้มครอง", "เมื่อไร"], rows: [{ at: "วันนี้", label: "กรมธรรม์มีผล" }, { at: `${ill.waitingDays} วัน`, label: "เริ่มคุ้มครองโรคร้ายแรง" }] },
        `ความคุ้มครองโรคร้ายแรง เริ่มหลังกรมธรรม์มีผล ${ill.waitingDays} วันค่ะ`)
      : scene("knowThree", { layout: "list", title: ["ผู้รับประโยชน์", ""], mark: "check", items: ["ตรวจชื่อให้ถูกต้อง", "บอกให้เขารู้ว่ามีกรมธรรม์นี้"] },
        "เงินก้อนนี้จะถึงมือผู้รับประโยชน์ที่ระบุไว้ในกรมธรรม์ ตรวจชื่อให้ถูก และบอกให้เขารู้ไว้นะคะ"),
    scene("knowRecap", { layout: "list", title: ["เก็บไว้ให้ดี", ""], mark: "check", items: ["เก็บกรมธรรม์ไว้ที่ปลอดภัย", "บอกคนในบ้านว่าเก็บที่ไหน", "บันทึกเบอร์ตัวแทนไว้"] },
      "เก็บกรมธรรม์ไว้ที่ปลอดภัย บอกคนในบ้านว่าเก็บไว้ที่ไหน และบันทึกเบอร์ตัวแทนไว้นะคะ"),
  ];
}

function claimIhu(): KnowScene[] {
  const [day1, illness, fax, special] = IHU.starts;
  return [
    scene("knowAsk", { layout: "ask", title: ["ต้องนอนโรงพยาบาล", "เคลมยังไง?"] }, "ถ้าป่วยต้องนอนโรงพยาบาล ใช้ประกันสุขภาพยังไงคะ"),
    scene("knowOne", { layout: "card", title: ["โรงพยาบาลคู่สัญญา", ""], lines: [small("ยื่นบัตรประกัน"), big("ไม่ต้องสำรองจ่าย", "green"), small(`ใช้ได้หลังกรมธรรม์มีผล ${fax}`)] },
      `ที่โรงพยาบาลคู่สัญญา ยื่นบัตรประกัน ไม่ต้องสำรองจ่ายค่ะ ใช้ได้หลังกรมธรรม์มีผล ${fax}`),
    scene("knowTwo", { layout: "list", title: ["ต้องสำรองจ่ายก่อน", "เมื่อ"], mark: "warn", items: ["ยังไม่พ้นระยะรอคอย", "ไม่ใช่โรงพยาบาลคู่สัญญา", "ตรวจพบโรคใหม่ครั้งแรก", "จ่ายเบี้ยล่าช้า"] },
      "บางกรณีต้องสำรองจ่ายก่อน เช่น ยังไม่พ้นระยะรอคอย ไม่ใช่โรงพยาบาลคู่สัญญา หรือตรวจพบโรคใหม่ครั้งแรกค่ะ"),
    scene("knowThree", { layout: "timeline", title: ["สำรองจ่ายแล้ว", "เบิกคืน"], rows: [{ at: "1", label: "เก็บใบเสร็จ เอกสารแพทย์" }, { at: `${IHU.evidenceDays} วัน`, label: "ยื่นเอกสารภายใน" }, { at: `${IHU.payoutDays} วัน`, label: "บริษัทจ่ายภายใน" }] },
      `สำรองจ่ายแล้ว ยื่นใบเสร็จและเอกสารแพทย์ภายใน ${IHU.evidenceDays} วัน บริษัทจ่ายภายใน ${IHU.payoutDays} วัน หลังได้รับเอกสารครบค่ะ`),
    scene("knowRecap", { layout: "timeline", title: ["เริ่มคุ้มครอง", "เมื่อไร"], rows: [{ at: day1.replace("วันที่ 1", "วันแรก"), label: "อุบัติเหตุ" }, { at: illness, label: "เจ็บป่วยทั่วไป" }, { at: fax, label: "ไม่ต้องสำรองจ่าย" }, { at: special, label: "8 กลุ่มโรค" }] },
      `อุบัติเหตุคุ้มครองวันแรก เจ็บป่วยทั่วไปหลัง ${illness} และ 8 กลุ่มโรคหลัง ${special}ค่ะ`),
  ];
}

function claimIshield(input: StoryVideoInput): KnowScene[] {
  const ill = iShieldTable().illness;
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "ask", title: ["ตรวจเจอโรคร้ายแรง", "เคลมยังไง?"] }, "ถ้าตรวจเจอโรคร้ายแรง เคลม iShield ยังไงคะ"),
    scene("knowOne", { layout: "list", title: ["จ่ายตามระยะของโรค", ""], mark: "check", items: [`ระยะเริ่มต้น ${ill.earlyCount} โรค · ${ill.earlyPercent}% ต่อโรค`, `ระยะรุนแรง ${ill.majorCount} โรค · สูงสุด ${ill.majorPercent}%`] },
      `iShield จ่ายตามระยะของโรค ระยะเริ่มต้นจ่าย ${ill.earlyPercent} เปอร์เซ็นต์ของทุนต่อโรค ระยะรุนแรงจ่ายสูงสุดเต็มทุนค่ะ`),
    f
      ? scene("knowTwo", { layout: "pic", title: [`ทุน ${n(f.sumAssured)} บาท`, "ได้เท่าไร"], icon: "bag", note: [small("ระยะเริ่มต้น"), big(`${n((f.sumAssured * ill.earlyPercent) / 100)} บาท`), small("ระยะรุนแรง สูงสุด"), big(`${n((f.sumAssured * ill.majorPercent) / 100)} บาท`)] },
        `ถ้าทุน ${withBaht(f.sumAssured)} ระยะเริ่มต้นได้ ${n((f.sumAssured * ill.earlyPercent) / 100)} บาท ระยะรุนแรงได้สูงสุด ${withBaht((f.sumAssured * ill.majorPercent) / 100)}ค่ะ`)
      : scene("knowTwo", { layout: "card", title: ["ได้เท่าไร", ""], lines: [small("ระยะเริ่มต้น"), big("หนึ่งในสี่ของทุน"), small("ระยะรุนแรง"), big("สูงสุดเต็มทุน")] },
        "ระยะเริ่มต้นได้หนึ่งในสี่ของทุน ระยะรุนแรงได้สูงสุดเต็มทุนค่ะ"),
    scene("knowThree", { layout: "timeline", title: ["ยื่นเคลม", ""], rows: [{ at: "1", label: "ทักตัวแทน" }, { at: "2", label: "ผลวินิจฉัยจากแพทย์" }, { at: "3", label: "บริษัทพิจารณาตามคำนิยาม" }] },
      "ตรวจเจอเมื่อไร ทักตัวแทน ส่งผลวินิจฉัยจากแพทย์ บริษัทพิจารณาตามคำนิยามในกรมธรรม์ค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("เจอเมื่อไร"), big("ทักตัวแทนทันที"), small(`โรคร้ายแรงเริ่มคุ้มครองหลัง ${ill.waitingDays} วัน`)] },
      "จำง่าย ๆ ค่ะ เจอเมื่อไร ทักตัวแทนทันที"),
  ];
}

/** "15 พฤศจิกายน" from YYYY-MM-DD */
export const thaiDay = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return { day: String(d), said: `${d} ${THAI_MONTHS[m - 1]}` };
};

function remind(input: StoryVideoInput, name: string): KnowScene[] {
  const due = input.due!;
  const d = thaiDay(due.date);
  return [
    scene("knowAsk", { layout: "pic", title: ["ใกล้ครบกำหนด", "ชำระเบี้ย"], icon: "calendar", day: d.day, face: input.faces.hero, note: [small(d.said), ...(due.amount ? [big(`${n(due.amount)} บาท`)] : [])] },
      `${name ? `คุณ${name}คะ ` : ""}เบี้ยประกันครบกำหนดวันที่ ${d.said}${due.amount ? ` ยอด ${n(due.amount)} บาท` : ""}ค่ะ`),
    scene("knowOne", { layout: "card", title: ["จ่ายตรงเวลา", ""], lines: [big("ความคุ้มครอง", "green"), big("ต่อเนื่อง", "green")] },
      "จ่ายให้ตรงเวลา ความคุ้มครองจะได้ต่อเนื่องนะคะ"),
  ];
}

function birthday(input: StoryVideoInput, name: string): KnowScene[] {
  return [
    scene("knowAsk", { layout: "pic", title: ["สุขสันต์วันเกิด", name ? `คุณ${name}` : ""], icon: "cake", face: input.faces.hero, hearts: true },
      `สุขสันต์วันเกิดนะคะ${name ? ` คุณ${name}` : ""}`),
    scene("knowOne", { layout: "card", title: ["ขอให้", ""], lines: [big("สุขภาพแข็งแรง"), big("มีความสุขมาก ๆ"), small("ตลอดปีนี้ และตลอดไป")] },
      "ขอให้สุขภาพแข็งแรง มีความสุขมาก ๆ ตลอดปีนี้นะคะ"),
  ];
}

/** what each festival's clip says and shows */
export function festivalGreeting(f: Festival): { title: [string, string]; icon: PicIcon; said: string; wish: string; lines: NoteLine[] } {
  return {
    newyear: { title: ["สวัสดีปีใหม่", ""] as [string, string], icon: "fireworks" as const, said: "สวัสดีปีใหม่ค่ะ", wish: "ขอให้ทุกคนสุขภาพแข็งแรง ปลอดภัยตลอดปีนะคะ", lines: [big("สุขภาพแข็งแรง"), big("ปลอดภัยตลอดปี")] },
    cny: { title: ["ซินเจียยู่อี่", "ซินนี้ฮวดไช้"] as [string, string], icon: "lantern" as const, said: "ซินเจียยู่อี่ ซินนี้ฮวดไช้ค่ะ", wish: "ขอให้ร่ำรวย สุขภาพแข็งแรงตลอดปีนะคะ", lines: [big("ร่ำรวย"), big("สุขภาพแข็งแรง")] },
    songkran: { title: ["สุขสันต์", "วันสงกรานต์"] as [string, string], icon: "water" as const, said: "สุขสันต์วันสงกรานต์ค่ะ", wish: "ขอให้เดินทางปลอดภัย มีความสุขกับครอบครัวนะคะ", lines: [big("เดินทางปลอดภัย"), big("สุขกับครอบครัว")] },
    mother: { title: ["สุขสันต์วันแม่", ""] as [string, string], icon: "jasmine" as const, said: "สุขสันต์วันแม่ค่ะ", wish: "ขอให้คุณแม่ทุกท่านสุขภาพแข็งแรง อยู่กับลูกหลานไปนาน ๆ นะคะ", lines: [big("สุขภาพแข็งแรง"), big("อยู่กับลูกหลานไปนาน ๆ")] },
    father: { title: ["สุขสันต์วันพ่อ", ""] as [string, string], icon: "canna" as const, said: "สุขสันต์วันพ่อค่ะ", wish: "ขอให้คุณพ่อทุกท่านสุขภาพแข็งแรง อยู่กับลูกหลานไปนาน ๆ นะคะ", lines: [big("สุขภาพแข็งแรง"), big("อยู่กับลูกหลานไปนาน ๆ")] },
    yearend: { title: ["ขอบคุณ", "ที่อยู่ด้วยกันตลอดปี"] as [string, string], icon: "gift" as const, said: "ขอบคุณที่ไว้วางใจกันตลอดปีนะคะ", wish: "ขอให้ปีหน้าเป็นปีที่ดีของทุกคนค่ะ", lines: [big("ปีหน้า"), big("เป็นปีที่ดีของทุกคน")] },
  }[f];
}

function festival(input: StoryVideoInput): KnowScene[] {
  const g = festivalGreeting(input.festival ?? "newyear");
  return [
    scene("knowAsk", { layout: "pic", title: g.title, icon: g.icon, face: input.faces.narrator }, g.said),
    scene("knowOne", { layout: "card", title: ["ขอให้", ""], lines: g.lines }, g.wish),
  ];
}

/** an after-sale clip's scenes, before the narrator's endings (knowEpisode adds them) */
export function afterScenes(topic: AfterTopic, input: StoryVideoInput, name: string): KnowScene[] {
  return {
    deliver: () => deliver(input, name),
    claimihu: claimIhu,
    claimish: () => claimIshield(input),
    remind: () => remind(input, name),
    birthday: () => birthday(input, name),
    festival: () => festival(input),
  }[topic]();
}
