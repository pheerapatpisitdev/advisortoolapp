import { planName, termShort } from "@/lib/story/plans";
import { LIVE_TO, RETIRE_AGE } from "@/lib/story/topics";
import { PENSION_NAME } from "./pension";
import type { StoryFigure, StoryVideoInput } from "./story";
import { familyCast } from "./story-family";
import { big, n, small, withBaht, type Kin, type KnowScene, type KnowShow, type NoteLine } from "./story-knowledge";

/**
 * ช่วงชีวิต (owner, 2026-10-16, mockup https://claude.ai/artifact/RiKE8s8a3tAPBW4sfygMaR):
 * five episodes in คลิปเล่าเรื่อง told through a turn in the hero's life — the first pay, a
 * wedding, a home on a loan, working for oneself, retiring — each five scenes and the agent's
 * card, drawn as เรื่องครอบครัว is (story-knowledge-motion.tsx), its family from familyCast.
 *
 * The home loan and the spending once retired are the agent's numbers (input.home); a plan's
 * premium (input.figure) or บำนาญ 95's (input.pension) the tables'. Without them each scene says
 * the same thing in words. A life plan pays the family, a critical-illness plan the one who falls
 * ill, so the stories that tell of illness are held to iShield and the others to Life Protect.
 */

export type LifeTopic = "firstjob" | "wedding" | "mortgage" | "selfemployed" | "preretire";

export const LIFE_CLOSE: Record<LifeTopic, string> = {
  firstjob: "เริ่มต้นเท่าไหร่ดี ทักมาคุยได้เลย",
  wedding: "อยากวางแผนให้ทั้งคู่ ทักมาได้เลย",
  mortgage: "อยากรู้ว่าทุนเท่าไรถึงปิดหนี้บ้านได้ ทักมาได้เลย",
  selfemployed: "อยากสร้างสวัสดิการของตัวเอง ทักมาได้เลย",
  preretire: "อยากรู้ว่าต้องเตรียมเท่าไร ทักมาได้เลย",
};

const scene = (key: KnowScene["key"], show: KnowShow, voice: string): KnowScene => ({ key, show, voice });
const kin = (id: string, size: Kin["size"], state?: Kin["state"]): Kin => ({ id, size, ...(state ? { state } : {}) });
const sexWord = (f: { sex: "M" | "F" }) => (f.sex === "M" ? "ผู้ชาย" : "ผู้หญิง");
const sexShort = (f: { sex: "M" | "F" }) => (f.sex === "M" ? "ชาย" : "หญิง");
/** a premium on a note: whose, the year's premium, the sum it buys, the plan */
const figureNote = (f: StoryFigure): NoteLine[] => [
  small(`${sexShort(f)} ${f.age} ปี`), big(`ปีละ ${n(f.annual)} บาท`), small("↓"), big(`ทุน ${n(f.sumAssured)} บาท`, "green"), small(`${planName(f.plan)} ${termShort(f)}`),
];
/** what a critical-illness plan's figure says: who pays what, and the sum paid on an illness */
const illnessVoice = (f: StoryFigure) =>
  `${sexWord(f)}อายุ ${f.age} จ่ายปีละ ${n(f.annual)} บาท ป่วยเป็นโรคร้ายแรงตามเงื่อนไข ได้เงินก้อน ${withBaht(f.sumAssured)}ค่ะ`;

function firstJob(input: StoryVideoInput, name: string): KnowScene[] {
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "ask", title: ["เงินเดือนแรก", "แบ่งไปไหนบ้าง?"] }, `${name ? `คุณ${name} ` : ""}ได้เงินเดือนแรกแล้ว แบ่งไปไหนบ้างคะ`),
    scene("knowOne", { layout: "list", title: ["ทุกเดือน", "ต้องจ่าย"], mark: "box", items: ["ค่าห้อง ค่ากิน", "ส่งพ่อแม่", "ผ่อนมือถือ", "เก็บออม"] },
      "ค่าห้อง ค่ากิน ส่งพ่อแม่ ผ่อนมือถือ แล้วเก็บออมอีกนิดค่ะ"),
    scene("knowTwo", { layout: "note", title: ["ถ้าป่วยหนัก", "ตอนนี้"], dim: true, note: [small("รายได้หยุด"), big("แต่ทุกช่อง", "red"), big("ยังต้องจ่าย", "red")] },
      "แต่ถ้าป่วยหนักตอนนี้ รายได้หยุด ทุกช่องที่ว่ามา ยังต้องจ่ายเหมือนเดิมค่ะ"),
    f
      ? scene("knowThree", { layout: "note", title: ["เริ่มตอนนี้", "เบี้ยถูกที่สุด"], note: figureNote(f) }, `เริ่มตอนอายุน้อย เบี้ยถูกที่สุด เช่น ${illnessVoice(f)}`)
      : scene("knowThree", { layout: "note", title: ["เริ่มตอนนี้", "เบี้ยถูกที่สุด"], note: [small("อายุน้อย สุขภาพดี"), big("เบี้ยถูก", "green"), big("สมัครง่าย", "green")] },
        "เริ่มตอนอายุน้อย สุขภาพยังดี เบี้ยถูก และสมัครง่ายที่สุดค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("เงินเดือนแรก"), big("แบ่งให้ตัวเอง"), small("ในอนาคตด้วย")] }, "จำง่าย ๆ ค่ะ เงินเดือนแรก แบ่งให้ตัวเองในอนาคตด้วย"),
  ];
}

function wedding(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "kin", title: ["จากหนึ่ง", "เป็นสอง"], people: [kin(c.hero, "hero"), kin(c.partner, "adult")], tags: { items: ["ผ่อนรถ", "ค่าบ้าน", "แผนมีลูก"] } },
      `${name ? `คุณ${name}` : "คู่นี้"}แต่งงานแล้ว จากหนึ่งเป็นสอง เริ่มผ่อนรถ ค่าบ้าน และวางแผนมีลูกด้วยกันค่ะ`),
    scene("knowOne", { layout: "kin", title: ["ถ้าวันหนึ่ง", "คนหนึ่งไม่อยู่"], people: [kin(c.hero, "hero", "gone"), kin(c.partner, "adult")], tags: { items: ["ภาระทั้งหมด", "ตกที่อีกคน"], red: true } },
      "ถ้าวันหนึ่งคนหนึ่งจากไปไม่ทันตั้งตัว ภาระทั้งหมดจะตกอยู่กับอีกคนค่ะ"),
    f
      ? scene("knowTwo", { layout: "note", title: ["ทุนชีวิต", "ของกันและกัน"], note: figureNote(f) },
        `เช่น ${sexWord(f)}อายุ ${f.age} จ่ายปีละ ${n(f.annual)} บาท ทุนชีวิต ${withBaht(f.sumAssured)} ไปถึงคู่ชีวิตทั้งก้อนค่ะ`)
      : scene("knowTwo", { layout: "note", title: ["ทุนชีวิต", "ของกันและกัน"], note: [small("เงินก้อน"), big("ไปถึงคู่ชีวิต", "green"), small("ภาระไม่ตกที่ใครคนเดียว")] },
        "ทุนประกันชีวิตของกันและกัน ทำให้เงินก้อนไปถึงคู่ชีวิต ภาระไม่ตกที่ใครคนเดียวค่ะ"),
    scene("knowThree", { layout: "list", title: ["เช็กลิสต์", "คู่แต่งงานใหม่"], mark: "check", items: ["ทุนชีวิตของทั้งคู่", "ผู้รับประโยชน์เป็นคู่ชีวิต", "ประกันสุขภาพทั้งสองคน"] },
      "เช็กลิสต์คู่แต่งงานใหม่ ทุนชีวิตของทั้งคู่ เปลี่ยนผู้รับประโยชน์เป็นคู่ชีวิต และประกันสุขภาพของทั้งสองคนค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("รักกัน"), big("ดูแลกัน"), small("ถึงวันที่ไม่อยู่")] }, "จำง่าย ๆ ค่ะ รักกัน ก็ดูแลกันไปถึงวันที่ไม่อยู่"),
  ];
}

function mortgage(input: StoryVideoInput, name: string): KnowScene[] {
  const c = familyCast(input);
  const loan = input.home?.kind === "loan" ? input.home : undefined;
  const f = input.figure;
  const row = (state?: Kin["state"]) => [kin(c.partner, "adult"), kin(c.hero, "hero", state), kin(c.kids[0], "kid")];
  const whose = name ? `ของคุณ${name}` : "ของครอบครัว";
  return [
    loan
      ? scene("knowAsk", { layout: "kin", title: ["บ้านหลังแรก", whose], people: row(), tags: { items: [`หนี้บ้าน ${n(loan.debt)}`, `อีก ${loan.years} ปี`] } },
        `บ้านหลังแรก${whose} ยังมีหนี้อีก ${withBaht(loan.debt)} ต้องผ่อนอีก ${loan.years} ปีค่ะ`)
      : scene("knowAsk", { layout: "kin", title: ["บ้านหลังแรก", whose], people: row(), tags: { items: ["ผ่อนบ้าน", "อีกหลายปี"] } },
        `บ้านหลังแรก${whose} ยังต้องผ่อนอีกหลายปีค่ะ`),
    scene("knowOne", { layout: "kin", title: ["ถ้าคนผ่อน", "ไม่อยู่"], people: row("gone"), tags: { items: ["หนี้ไม่ได้หายไปพร้อมคน"], red: true } },
      "ถ้าวันหนึ่งคนผ่อนจากไปไม่ทันตั้งตัว หนี้บ้านไม่ได้หายไปด้วย ธนาคารยังเรียกเก็บจากกองมรดก ครอบครัวอาจต้องเสียบ้านค่ะ"),
    loan
      ? scene("knowTwo", { layout: "card", title: ["ทุนที่ควรมี", ""], lines: [small(`หนี้บ้านคงเหลือ ${n(loan.debt)}`), small("↓"), big(`ทุนอย่างน้อย ${n(loan.debt)}`, "green")] },
        `ทุนประกันชีวิต ควรมีอย่างน้อยเท่าหนี้บ้านที่เหลือ คือ ${withBaht(loan.debt)}ค่ะ`)
      : scene("knowTwo", { layout: "card", title: ["ทุนที่ควรมี", ""], lines: [small("หนี้บ้านที่เหลือ"), small("↓"), big("ทุนอย่างน้อยเท่ากัน", "green")] },
        "ทุนประกันชีวิต ควรมีอย่างน้อยเท่าหนี้บ้านที่เหลือค่ะ"),
    f
      ? scene("knowThree", { layout: "note", title: ["ตัวอย่าง", ""], note: figureNote(f) },
        `เช่น ${sexWord(f)}อายุ ${f.age} จ่ายปีละ ${n(f.annual)} บาท ทุน ${withBaht(f.sumAssured)} ${!loan || f.sumAssured >= loan.debt ? "พอปิดหนี้บ้าน บ้านยังเป็นของครอบครัวค่ะ" : "ช่วยปิดหนี้บ้านได้ส่วนใหญ่ค่ะ"}`)
      : scene("knowThree", { layout: "kin", title: ["บ้านยังเป็น", "ของครอบครัว"], people: [kin(c.partner, "adult"), kin(c.kids[0], "kid")], bag: true, note: [small("เงินก้อนปิดหนี้บ้าน"), big("บ้านไม่ต้องเสีย", "green")] },
        "เงินก้อนจากประกันชีวิตปิดหนี้บ้านได้ บ้านยังเป็นของครอบครัวค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("ผ่อนบ้านได้"), big("ต้องปิดหนี้ได้ด้วย")] }, "จำง่าย ๆ ค่ะ ผ่อนบ้านได้ ต้องปิดหนี้ได้ด้วย"),
  ];
}

function selfEmployed(input: StoryVideoInput, name: string): KnowScene[] {
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "ask", title: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"] }, `${name ? `คุณ${name} ` : ""}ทำงานของตัวเอง ไม่มีเจ้านาย แล้วสวัสดิการล่ะคะ`),
    scene("knowOne", { layout: "list", title: ["ที่มนุษย์เงินเดือนมี", "แต่เราไม่มี"], mark: "cross", items: ["ประกันกลุ่มจากบริษัท", "ลาป่วยแล้วเงินเดือนยังเข้า"] },
      "ประกันกลุ่มจากบริษัท ลาป่วยแล้วเงินเดือนยังเข้า สองอย่างนี้ เราไม่มีค่ะ"),
    scene("knowTwo", { layout: "note", title: ["หยุดงาน", ""], dim: true, note: [big("= หยุดรายได้", "red"), small("แต่ค่าใช้จ่ายไม่หยุด")] },
      "วันไหนป่วยจนทำงานไม่ได้ รายได้ก็หยุดทันที แต่ค่าใช้จ่ายไม่หยุดตามค่ะ"),
    f
      ? scene("knowThree", { layout: "note", title: ["สวัสดิการ", "ที่สร้างเอง"], note: figureNote(f) }, `เช่น ${illnessVoice(f)}`)
      : scene("knowThree", { layout: "note", title: ["สวัสดิการ", "ที่สร้างเอง"], note: [small("ประกันโรคร้ายแรง"), big("เงินก้อนตอนป่วยหนัก", "green"), small("ใช้แทนรายได้ที่หยุดไป")] },
        "ประกันโรคร้ายแรง จ่ายเงินก้อนเมื่อป่วยหนักตามเงื่อนไข ใช้แทนรายได้ที่หยุดไปค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("สวัสดิการของเรา"), big("เราสร้างเอง")] }, "จำง่าย ๆ ค่ะ สวัสดิการของเรา เราสร้างเองได้"),
  ];
}

function preRetire(input: StoryVideoInput, name: string): KnowScene[] {
  const p = input.pension;
  const spend = input.home?.kind === "retire" ? input.home : undefined;
  const start = p?.annuityAge ?? RETIRE_AGE;
  const years = LIVE_TO - start;
  return [
    scene("knowAsk", { layout: "ask", title: ["เกษียณแล้ว", "เงินพอไหม?"] }, `${name ? `คุณ${name} ` : ""}เกษียณแล้ว เงินจะพอใช้ไหมคะ`),
    scene("knowOne", { layout: "timeline", title: ["ชีวิตหลังเกษียณ", ""], rows: [{ at: String(p?.age ?? 45), label: "ยังมีรายได้" }, { at: String(start), label: "เกษียณ เงินเดือนหยุด" }, { at: String(LIVE_TO), label: `ยังต้องใช้เงินอีก ${years} ปี` }] },
      `อายุ ${start} เกษียณ เงินเดือนหยุด แต่ถ้าอยู่ถึง ${LIVE_TO} เรายังต้องใช้เงินอีก ${years} ปีค่ะ`),
    spend
      ? scene("knowTwo", { layout: "card", title: ["ลองคิดเร็ว ๆ", ""], lines: [small(`ใช้เดือนละ ${n(spend.monthly)}`), small(`× 12 เดือน × ${years} ปี`), big(`= ${n(spend.monthly * 12 * years)} บาท`, "red")] },
        `ถ้าใช้เดือนละ ${n(spend.monthly)} บาท ${years} ปี ต้องมีเงิน ${withBaht(spend.monthly * 12 * years)}ค่ะ`)
      : scene("knowTwo", { layout: "card", title: ["ลองคิดเร็ว ๆ", ""], lines: [small("ค่าใช้จ่ายต่อเดือน"), small(`× 12 เดือน × ${years} ปี`), big("= เงินที่ต้องเตรียม", "red")] },
        `ลองคิดดูค่ะ ค่าใช้จ่ายต่อเดือน คูณ 12 เดือน คูณ ${years} ปี คือเงินที่ต้องเตรียมไว้`),
    p
      ? scene("knowThree", { layout: "note", title: ["บำนาญ", "รับทุกเดือน"], note: [small(`${sexShort(p)} ${p.age} ปี · จ่ายเบี้ย ${p.payYears} ปี`), big(`ออมปีละ ${n(p.annual)} บาท`), small("↓"), big(`รับเดือนละ ${n(p.monthlyPension)} บาท`, "green"), small(`ตั้งแต่อายุ ${start} · ${PENSION_NAME}`)] },
        `เช่น ${sexWord(p)}อายุ ${p.age} ออมปีละ ${n(p.annual)} บาท ตั้งแต่อายุ ${start} เริ่มรับบำนาญเดือนละ ${n(p.monthlyPension)} บาทค่ะ`)
      : scene("knowThree", { layout: "list", title: ["เตรียมได้จาก", ""], mark: "check", items: ["เงินออม", "กองทุนสำรองเลี้ยงชีพ", "ประกันบำนาญ รับรายเดือน"] },
        "เตรียมได้จากเงินออม กองทุนสำรองเลี้ยงชีพ และประกันบำนาญที่จ่ายเป็นรายเดือนหลังเกษียณค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("เกษียณสบาย"), big("เริ่มเตรียม"), small("ก่อนวันเกษียณ")] }, "จำง่าย ๆ ค่ะ อยากเกษียณสบาย ต้องเริ่มเตรียมก่อนวันเกษียณ"),
  ];
}

/** an episode of ช่วงชีวิต: its five scenes */
export function lifeScenes(topic: LifeTopic, input: StoryVideoInput, name: string): KnowScene[] {
  return { firstjob: firstJob, wedding, mortgage, selfemployed: selfEmployed, preretire: preRetire }[topic](input, name);
}
