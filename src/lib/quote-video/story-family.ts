import { BABY, familyOf } from "@/lib/story/faces";
import { planName, termShort } from "@/lib/story/plans";
import { GRADUATE_AGE } from "@/lib/story/topics";
import type { StoryFigure, StoryVideoInput } from "./story";
import { askerSex, big, n, partnerFace, small, withBaht, type Kin, type KnowScene, type KnowShow, type NoteLine } from "./story-knowledge";

/**
 * เรื่องครอบครัว (owner, 2026-10-15, mockup https://claude.ai/artifact/CeobBBQKLvtnZuDw1ETLtM):
 * five episodes in คลิปเล่าเรื่อง told through the hero's family, each five scenes and the
 * agent's card, on the same scene keys and drawing as ความรู้ประกัน 1 นาที (story-knowledge-motion.tsx).
 *
 * The household's own numbers (input.home) and a plan's real premium (input.figure) are shown
 * where the agent gave them; without them each scene says the same thing in words. A life plan
 * pays the family; a critical-illness plan pays the one who falls ill, so ใครดูแลพ่อแม่ตอนแก่ is
 * told on iShield and the other three on Life Protect (topics.ts holds them to it).
 */

export type FamilyTopic = "pillar" | "mompillar" | "tuition" | "prebaby" | "eldercare";

/** each episode's closing: what the card's button says, and the voice under it */
export const FAMILY_CLOSE: Record<FamilyTopic, string> = {
  pillar: "อยากรู้ว่าบ้านคุณควรมีทุนเท่าไร ทักมาได้เลย",
  mompillar: "อยากดูทุนประกันให้แม่ ทักมาได้เลย",
  tuition: "อยากคำนวณค่าเรียนลูกด้วยกัน ทักมาได้เลย",
  prebaby: "อยากวางแผนก่อนมีลูก ทักมาคุยกันได้เลย",
  eldercare: "อยากวางแผนเผื่อพ่อแม่ ทักมาได้เลย",
};

/** the people a family episode draws, by the hero: their partner, two children, the baby, a grandfather and grandmother */
export function familyCast(input: StoryVideoInput) {
  const f = familyOf(input.faces.hero);
  return { hero: input.faces.hero, partner: partnerFace(input), kids: f.kids, baby: BABY, grandpa: f.grandpa, grandma: f.grandma };
}

const kin = (id: string, size: Kin["size"], state?: Kin["state"]): Kin => ({ id, size, ...(state ? { state } : {}) });
const sexWord = (f: StoryFigure) => (f.sex === "M" ? "ผู้ชาย" : "ผู้หญิง");
/** a premium on a note: the plan and sum, the year's premium, whose it is */
const figureNote = (f: StoryFigure): NoteLine[] => [
  small(`${planName(f.plan)} ทุน ${n(f.sumAssured)} บาท`),
  big(`เบี้ยปีละ ${n(f.annual)} บาท`),
  small(`${f.sex === "M" ? "ชาย" : "หญิง"} ${f.age} ปี · ${termShort(f)}`),
];
const scene = (key: KnowScene["key"], show: KnowShow, voice: string): KnowScene => ({ key, show, voice });

function pillar(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const who = name ? `คุณ${name}` : askerSex(input) === "M" ? "พ่อ" : "แม่";
  const row = (state?: Kin["state"]) => [kin(c.partner, "adult"), kin(c.hero, "hero", state), kin(c.kids[0], "kid"), kin(c.kids[1], "kid")];
  const bills = ["ค่าบ้าน", "ค่าเทอมลูก", "ค่ากินค่าใช้"];
  const h = input.home?.kind === "spend" ? input.home : undefined;
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "kin", title: ["บ้านนี้มีเสาหลัก", ""], people: row() },
      `นี่คือครอบครัว${name ? `ของคุณ${name}` : "หนึ่ง"} รายได้หลักของบ้าน มาจาก${who}คนเดียวค่ะ`),
    scene("knowOne", { layout: "kin", title: ["ทุกเดือน", "บ้านนี้ต้องจ่าย"], people: row(), tags: { items: bills } },
      "ทุกเดือน บ้านนี้มีค่าบ้าน ค่าเทอมลูก และค่ากินค่าใช้ ที่ต้องจ่ายค่ะ"),
    scene("knowTwo", { layout: "kin", title: ["ถ้าวันหนึ่ง", "เสาหลักหายไป"], people: row("gone"), tags: { items: bills, red: true } },
      `ถ้าวันหนึ่ง${who}ไม่อยู่ รายได้หายไปในวันเดียว แต่ค่าใช้จ่ายทุกอย่างยังอยู่ค่ะ`),
    h
      ? scene("knowThree", { layout: "card", title: ["ต้องมีเท่าไร", ""], lines: [small(`เดือนละ ${n(h.monthly)} บาท`), small(`× 12 เดือน × ${h.years} ปี`), big(`= ${n(h.monthly * 12 * h.years)} บาท`), small(`${h.years} ปี ที่ลูกยังต้องพึ่ง`)] },
        `ถ้าบ้านนี้ใช้เดือนละ ${n(h.monthly)} บาท และลูกยังต้องพึ่งอีก ${h.years} ปี ครอบครัวต้องมีเงินราว ${withBaht(h.monthly * 12 * h.years)}ค่ะ`)
      : scene("knowThree", { layout: "card", title: ["ต้องมีเท่าไร", ""], lines: [small("ค่าใช้จ่ายทุกเดือน"), small("× จำนวนปีที่ลูกยังต้องพึ่ง"), big("= เงินที่ครอบครัวต้องมี")] },
        "ลองคิดดูค่ะ ค่าใช้จ่ายทุกเดือน คูณจำนวนปีที่ลูกยังต้องพึ่ง เป็นเงินเท่าไร"),
    f
      ? scene("knowRecap", { layout: "kin", title: ["ประกันชีวิต", "ทำหน้าที่แทนเสาหลัก"], people: [kin(c.partner, "adult"), kin(c.kids[0], "kid"), kin(c.kids[1], "kid")], bag: true, note: figureNote(f) },
        `ประกันชีวิตทำหน้าที่แทนเสาหลัก เงินก้อนถึงมือครอบครัว เช่น ทุน ${withBaht(f.sumAssured)} ${sexWord(f)}อายุ ${f.age} จ่ายเบี้ยปีละ ${n(f.annual)} บาทค่ะ`)
      : scene("knowRecap", { layout: "kin", title: ["ประกันชีวิต", "ทำหน้าที่แทนเสาหลัก"], people: [kin(c.partner, "adult"), kin(c.kids[0], "kid"), kin(c.kids[1], "kid")], bag: true, note: [small("เงินก้อน"), big("ถึงมือครอบครัว", "green")] },
        "ประกันชีวิตทำหน้าที่แทนเสาหลัก เงินก้อนถึงมือครอบครัว ลูกได้เรียนต่อค่ะ"),
  ];
}

function momPillar(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "kin", title: ["แม่ก็เป็นเสาหลัก", ""], people: [kin(c.partner, "adult"), kin(c.hero, "hero"), kin(c.kids[0], "kid"), kin(c.kids[1], "kid")] },
      `หลายบ้านคิดว่า คนที่ต้องมีประกันคือพ่อ แต่${name ? `แม่อย่างคุณ${name}` : "แม่"}ก็เป็นเสาหลักอีกต้นค่ะ`),
    scene("knowOne", { layout: "list", title: ["แม่ทำอะไรบ้าง", ""], mark: "check", items: ["รายได้อีกทาง", "รับส่งลูก ดูการบ้าน", "ทำอาหารทุกมื้อ", "ดูแลยายที่บ้าน"] },
      "แม่มีรายได้อีกทาง และยังรับส่งลูก ดูการบ้าน ทำอาหาร ดูแลยายที่บ้านด้วยค่ะ"),
    scene("knowTwo", { layout: "kin", title: ["ถ้าแม่ไม่อยู่", ""], people: [kin(c.partner, "adult"), kin(c.hero, "hero", "gone"), kin(c.kids[0], "kid"), kin(c.kids[1], "kid"), kin(c.grandma, "old")], note: [small("รายได้ส่วนนี้หายไป"), big("งานดูแล ต้องจ้างคนทำแทน", "red")] },
      "ถ้าแม่ไม่อยู่ รายได้ส่วนนี้หายไป และงานดูแลที่แม่ทำ อาจต้องจ้างคนมาทำแทนค่ะ"),
    scene("knowThree", { layout: "list", title: ["ทุนของแม่", "คิดจาก 2 อย่าง"], mark: "check", items: ["รายได้ของแม่ × จำนวนปี", "ค่าดูแลลูกจนโต"] },
      "ทุนประกันของแม่ จึงควรคิดทั้งรายได้ และค่าดูแลลูกจนโตค่ะ"),
    f
      ? scene("knowRecap", { layout: "note", title: ["ตัวอย่าง", ""], note: figureNote(f) },
        `เช่น ${sexWord(f)}อายุ ${f.age} ทุน ${withBaht(f.sumAssured)} จ่ายเบี้ยปีละ ${n(f.annual)} บาทค่ะ`)
      : scene("knowRecap", { layout: "kin", title: ["ประกันชีวิตของแม่", ""], people: [kin(c.hero, "hero"), kin(c.kids[0], "kid"), kin(c.kids[1], "kid")], note: [small("ลูกยังมีคนดูแล"), big("อย่างที่แม่ตั้งใจ", "green")] },
        "ประกันชีวิตของแม่ ทำให้ลูกยังมีคนดูแลอย่างที่แม่ตั้งใจค่ะ"),
  ];
}

/** the stage a child of this age is at */
const stageAt = (age: number) => (age < 6 ? "อนุบาล" : age < 12 ? "ประถม" : age < 18 ? "มัธยม" : "มหาวิทยาลัย");
const MILESTONES = [{ age: 6, label: "ประถม" }, { age: 12, label: "มัธยม" }, { age: 18, label: "มหาวิทยาลัย" }, { age: GRADUATE_AGE, label: "เรียนจบ" }];

function tuition(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const kid = c.kids[0];
  const h = input.home?.kind === "school" ? input.home : undefined;
  const f = input.figure;
  const whose = name ? `ของคุณ${name}` : "";
  const years = h ? GRADUATE_AGE - h.childAge : 0;
  const ageWord = (age: number) => `${age} ${age <= 12 ? "ขวบ" : "ปี"}`;
  return [
    h
      ? scene("knowAsk", { layout: "kin", title: [`ลูกอายุ ${ageWord(h.childAge)}`, ""], people: [kin(c.hero, "hero"), kin(kid, "adult")] },
        `ลูก${whose}ตอนนี้อายุ ${ageWord(h.childAge)}ค่ะ`)
      : scene("knowAsk", { layout: "kin", title: ["ลูกยังต้องเรียน", "อีกหลายปี"], people: [kin(c.hero, "hero"), kin(kid, "adult")] },
        `ลูก${whose}ยังต้องเรียนอีกหลายปีค่ะ`),
    h
      ? scene("knowOne", { layout: "timeline", title: [`อีก ${years} ปี`, "กว่าจะเรียนจบ"], rows: [{ age: h.childAge, label: stageAt(h.childAge) }, ...MILESTONES.filter((m) => m.age > h.childAge)] },
        `กว่าจะเรียนจบปริญญาตรีตอนอายุ ${GRADUATE_AGE} ลูกยังต้องเรียนอีก ${years} ปีค่ะ`)
      : scene("knowOne", { layout: "timeline", title: ["กว่าจะเรียนจบ", ""], rows: MILESTONES },
        "ตั้งแต่ประถม มัธยม จนจบมหาวิทยาลัย ยังต้องเรียนอีกหลายปีค่ะ"),
    h
      ? scene("knowTwo", { layout: "card", title: ["ค่าเรียน", "รวมทั้งหมด"], lines: [small(`ปีละ ${n(h.tuition)} บาท`), small(`× ${years} ปี`), big(`= ${n(h.tuition * years)} บาท`)] },
        `ถ้าค่าเรียนเฉลี่ยปีละ ${n(h.tuition)} บาท รวม ${years} ปี เป็นเงิน ${withBaht(h.tuition * years)}ค่ะ`)
      : scene("knowTwo", { layout: "card", title: ["ค่าเรียน", "รวมทั้งหมด"], lines: [small("ค่าเรียนทุกปี"), small("รวมกัน"), big("อาจเป็นเงินหลักล้าน")] },
        "ค่าเรียนทุกปีรวมกัน อาจเป็นเงินหลักล้านค่ะ"),
    scene("knowThree", { layout: "kin", title: ["ถ้าวันหนึ่ง", "พ่อแม่ไม่อยู่"], people: [kin(c.hero, "hero", "gone"), kin(kid, "adult")], marks: true },
      "ถ้าวันหนึ่งพ่อแม่ไม่อยู่ ค่าเรียนก้อนนี้ใครจะจ่ายคะ"),
    f
      ? scene("knowRecap", { layout: "kin", title: ["ทุนเท่าค่าเรียน", ""], people: [kin(kid, "adult")], bag: true, note: figureNote(f) },
        `ประกันชีวิตทุนเท่าค่าเรียน ช่วยให้ลูกเรียนจนจบ เช่น ${sexWord(f)}อายุ ${f.age} ทุน ${withBaht(f.sumAssured)} จ่ายเบี้ยปีละ ${n(f.annual)} บาทค่ะ`)
      : scene("knowRecap", { layout: "kin", title: ["ทุนเท่าค่าเรียน", ""], people: [kin(kid, "adult")], bag: true, note: [small("ลูกได้เรียน"), big("จนจบ", "green")] },
        "ประกันชีวิตทุนเท่าค่าเรียน ช่วยให้ลูกเรียนจนจบ ตามที่พ่อแม่ตั้งใจค่ะ"),
  ];
}

function preBaby(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const mother = askerSex(input) === "F" ? c.hero : c.partner;
  const couple = [kin(c.hero, "adult"), kin(c.partner, "adult")];
  return [
    scene("knowAsk", { layout: "kin", title: ["กำลังจะมี", "เจ้าตัวเล็ก"], people: [...couple, kin(c.baby, "kid", "dash")] },
      `${name ? `คุณ${name}กับแฟน` : "คู่รักคู่นี้"} กำลังวางแผนมีเจ้าตัวเล็กค่ะ ก่อนมีลูก มีสามเรื่องที่ควรเตรียม`),
    scene("knowOne", { layout: "kin", title: ["ข้อ 1", "ประกันสุขภาพแม่"], people: [kin(mother, "hero")], note: [big("ทำก่อนตั้งครรภ์"), small("ตั้งครรภ์แล้ว บางแผนอาจรับทำไม่ได้"), small("หรือมีข้อยกเว้น")] },
      "ข้อหนึ่ง ประกันสุขภาพของแม่ ควรทำก่อนตั้งครรภ์ เพราะเมื่อตั้งครรภ์แล้ว บางแผนอาจรับทำไม่ได้ หรือมีข้อยกเว้นค่ะ"),
    scene("knowTwo", { layout: "kin", title: ["ข้อ 2", "ประกันชีวิตพ่อแม่"], people: couple, note: [small("ทุน"), big("พอเลี้ยงลูกจนโต")] },
      "ข้อสอง ประกันชีวิตของพ่อและแม่ ให้มีทุนพอเลี้ยงลูกจนโตค่ะ"),
    scene("knowThree", { layout: "list", title: ["ข้อ 3", "เงินสำรอง"], mark: "check", items: ["ค่าฝากครรภ์", "ค่าคลอด", "ช่วงที่ต้องลางาน"] },
      "ข้อสาม เงินสำรอง สำหรับค่าฝากครรภ์ ค่าคลอด และช่วงที่ต้องลางานค่ะ"),
    scene("knowRecap", { layout: "kin", title: ["จำง่าย ๆ", ""], people: [...couple, kin(c.baby, "kid")], note: [big("สุขภาพแม่"), big("ชีวิตพ่อแม่"), big("เงินสำรอง")] },
      "จำง่าย ๆ ค่ะ สุขภาพแม่ ชีวิตพ่อแม่ เงินสำรอง เตรียมก่อน อุ่นใจกว่า"),
  ];
}

function elderCare(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const row = (state?: Kin["state"]) => [kin(c.grandpa, "old"), kin(c.hero, "hero", state), kin(c.grandma, "old")];
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "kin", title: ["คนดูแลพ่อแม่", ""], people: row(), tags: { items: ["ค่ายา", "ค่าหมอ", "ค่ากิน"] } },
      `${name ? `คุณ${name}` : "หลายคน"}เป็นคนดูแลพ่อแม่ที่อายุมากแล้ว ทั้งค่ากิน ค่าหมอ ค่ายา ทุกเดือนค่ะ`),
    scene("knowOne", { layout: "kin", title: ["ถ้าคนดูแล", "ป่วยเสียเอง"], people: row("sick"), marks: true },
      `แต่ถ้าวันหนึ่ง ${name ? `คุณ${name}` : "คนดูแล"}ป่วยเป็นโรคร้ายแรงเสียเองล่ะคะ`),
    scene("knowTwo", { layout: "list", title: ["ภาระ 3 ก้อน", ""], mark: "warn", items: ["ค่ารักษาของตัวเอง", "รายได้ที่อาจหยุด", "ค่าดูแลพ่อแม่ ยังต้องจ่าย"] },
      "ค่ารักษาของตัวเองก็ต้องจ่าย รายได้อาจหยุดไป แต่ค่าดูแลพ่อแม่ยังต้องจ่ายทุกเดือนค่ะ"),
    scene("knowThree", { layout: "kin", title: ["ประกันโรคร้ายแรง", ""], people: row(), bag: true, note: [small("ตรวจพบโรคที่คุ้มครอง"), big("ได้เงินก้อน"), small("ตามเงื่อนไขในกรมธรรม์")] },
      "ประกันโรคร้ายแรง จ่ายเงินก้อนเมื่อตรวจพบโรคที่คุ้มครอง ตามเงื่อนไขในกรมธรรม์ ใช้รักษาตัว และดูแลพ่อแม่ต่อได้ค่ะ"),
    f
      ? scene("knowRecap", { layout: "note", title: ["ตัวอย่าง", ""], note: figureNote(f) },
        `เช่น ${sexWord(f)}อายุ ${f.age} ทุน ${withBaht(f.sumAssured)} ${termShort(f)} เบี้ยปีละ ${n(f.annual)} บาทค่ะ`)
      : scene("knowRecap", { layout: "recap", lines: [big("ดูแลตัวเองไว้ก่อน"), big("= ดูแลพ่อแม่ไปด้วย")] },
        "จำง่าย ๆ ค่ะ ดูแลตัวเองไว้ก่อน ก็คือดูแลพ่อแม่ไปด้วย"),
  ];
}

/** a family episode's five scenes, before the narrator's endings (knowEpisode adds them) */
export function familyScenes(topic: FamilyTopic, input: StoryVideoInput, name: string): KnowScene[] {
  return { pillar, mompillar: momPillar, tuition, prebaby: preBaby, eldercare: elderCare }[topic](input, name);
}

/** the faces a family episode draws, besides the hero and narrator */
export function familyFaces(input: StoryVideoInput): string[] {
  const c = familyCast(input);
  return [c.partner, ...c.kids, c.baby, c.grandpa, c.grandma];
}
