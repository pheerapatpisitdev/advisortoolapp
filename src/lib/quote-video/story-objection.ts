import { planName, termShort } from "@/lib/story/plans";
import type { StoryFigure, StoryVideoInput } from "./story";
import { big, n, small, withBaht, type KnowScene, type KnowShow, type NoteLine } from "./story-knowledge";

/**
 * ตอบข้อโต้แย้ง (owner, 2026-10-16, mockup https://claude.ai/artifact/RiKE8s8a3tAPBW4sfygMaR):
 * five episodes in คลิปเล่าเรื่อง, each answering a thing customers say, politely and without
 * pressing — the belief, the fact, the reasons, a line to remember, then the agent's card. Drawn
 * as ความรู้ประกัน 1 นาที is (story-knowledge-motion.tsx).
 *
 * A plan's premium shows only where the agent asked for one; without it each scene says the same
 * thing in words. Nothing here claims what a welfare scheme or a group policy does or does not
 * pay: only that cover tied to a job ends with the job, and that a hospital's bill is not the
 * household's whole cost.
 */

export type ObjectionTopic = "thinkfirst" | "groupins" | "welfare" | "bank" | "pricey";

export const OBJECTION_CLOSE: Record<ObjectionTopic, string> = {
  thinkfirst: "อยากได้ข้อมูลไปคิดต่อ ทักมาได้เลย",
  groupins: "อยากเช็กว่าประกันกลุ่มยังขาดอะไร ทักมาได้เลย",
  welfare: "อยากรู้ว่าควรมีเงินก้อนเท่าไร ทักมาได้เลย",
  bank: "อยากวางแผนทั้งออมทั้งคุ้มครอง ทักมาได้เลย",
  pricey: "บอกงบมาได้ เดี๋ยวช่วยจัดให้ ทักมาได้เลย",
};

const scene = (key: KnowScene["key"], show: KnowShow, voice: string): KnowScene => ({ key, show, voice });
const sexWord = (f: { sex: "M" | "F" }) => (f.sex === "M" ? "ผู้ชาย" : "ผู้หญิง");
const sexShort = (f: { sex: "M" | "F" }) => (f.sex === "M" ? "ชาย" : "หญิง");
/** a premium on a note: whose, the year's premium, the sum it buys, the plan */
const figureNote = (f: StoryFigure): NoteLine[] => [
  small(`${sexShort(f)} ${f.age} ปี`), big(`เบี้ยปีละ ${n(f.annual)} บาท`), small("↓"), big(`ทุน ${n(f.sumAssured)} บาท`, "green"), small(`ตัวอย่างจาก ${planName(f.plan)} ${termShort(f)}`),
];

function thinkFirst(input: StoryVideoInput): KnowScene[] {
  const l = input.ladder;
  const first = l?.rows[0];
  const last = l?.rows[l.rows.length - 1];
  return [
    scene("knowAsk", { layout: "myth", quote: ["“ขอคิดดู", "ก่อนนะ”"] }, "ขอคิดดูก่อนนะ คำนี้ได้ยินบ่อยที่สุดค่ะ และคิดก่อนตัดสินใจ ก็เป็นเรื่องดีจริง ๆ"),
    scene("knowOne", { layout: "list", title: ["ระหว่างที่คิด", "มีสามอย่างที่ไม่รอ"], mark: "warn", items: ["อายุเพิ่มทุกวันเกิด", "สุขภาพอาจเปลี่ยน", "เรื่องไม่คาดฝัน ไม่นัดล่วงหน้า"] },
      "แต่ระหว่างที่คิด มีสามอย่างที่ไม่รอเราค่ะ อายุเพิ่มทุกวันเกิด สุขภาพอาจเปลี่ยน และเรื่องไม่คาดฝันไม่เคยนัดล่วงหน้า"),
    l && first && last
      ? scene("knowTwo", { layout: "bars", lead: ["ยิ่งรอ", "เบี้ยยิ่งขึ้น"], rows: l.rows.map((r) => ({ label: `อายุ ${r.age}`, value: r.annual, text: n(r.annual) })), source: `บาท/ปี · ${sexShort(l)} ทุน 1 ล้าน · Life Protect จ่ายถึงอายุ 99` },
        `${sexWord(l)}อายุ ${first.age} จ่ายปีละ ${n(first.annual)} บาท แต่ถ้ารอถึง ${last.age} จ่ายปีละ ${n(last.annual)} บาทค่ะ`)
      : scene("knowTwo", { layout: "note", title: ["ยิ่งรอ", "เบี้ยยิ่งขึ้น"], note: [small("เบี้ยคิดตามอายุตอนสมัคร"), big("อายุมากขึ้น"), big("เบี้ยก็มากขึ้น", "red")] },
        "เบี้ยประกันคิดตามอายุตอนสมัคร ยิ่งรอ อายุยิ่งมาก เบี้ยก็ยิ่งขึ้นค่ะ"),
    scene("knowThree", { layout: "list", title: ["คิดให้จบเร็ว", "ถามตัวเอง 3 ข้อ"], mark: "box", items: ["ถ้าพรุ่งนี้ป่วยหนัก ใครจ่าย", "บ้านพึ่งรายได้เราแค่ไหน", "จ่ายได้เดือนละเท่าไรไม่เดือดร้อน"] },
      "ลองถามตัวเองสามข้อค่ะ ถ้าพรุ่งนี้ป่วยหนัก ใครจ่าย บ้านพึ่งรายได้เราแค่ไหน และเราจ่ายได้เดือนละเท่าไรโดยไม่เดือดร้อน"),
    scene("knowRecap", { layout: "recap", lines: [big("คิดได้"), big("แต่อย่ารอ"), small("จนสมัครไม่ได้")] }, "จำง่าย ๆ ค่ะ คิดได้ แต่อย่ารอจนสมัครไม่ได้"),
  ];
}

const groupIns = (): KnowScene[] => [
  scene("knowAsk", { layout: "myth", quote: ["“มีประกันกลุ่ม", "บริษัทแล้ว”"] }, "มีประกันกลุ่มของบริษัทแล้ว ไม่ต้องทำเพิ่มหรอก จริงไหมคะ"),
  scene("knowOne", { layout: "fact", crossed: "พอแล้ว", note: [small("ประกันกลุ่มดีจริง"), big("แต่ผูกกับงาน")] }, "ประกันกลุ่มดีจริงค่ะ แต่เป็นสวัสดิการของบริษัท ผูกอยู่กับงานที่เราทำ"),
  scene("knowTwo", { layout: "list", title: ["ความคุ้มครองหายไป", "เมื่อ"], mark: "warn", items: ["ลาออก หรือเปลี่ยนงาน", "เกษียณ", "บริษัทปรับสวัสดิการ"] },
    "ถ้าลาออก เปลี่ยนงาน เกษียณ หรือบริษัทปรับสวัสดิการ ความคุ้มครองนั้นก็หายไปด้วยค่ะ"),
  scene("knowThree", { layout: "note", title: ["วันที่ต้อง", "สมัครเอง"], dim: true, note: [small("อายุมากขึ้น อาจมีโรคประจำตัว"), big("สมัครยากขึ้น", "red")] },
    "และวันที่ต้องสมัครเอง อายุเรามากขึ้น อาจมีโรคประจำตัวแล้ว สมัครยากขึ้นค่ะ"),
  scene("knowRecap", { layout: "recap", lines: [big("ประกันกลุ่ม = ของบริษัท"), big("ประกันตัวเอง = ของเรา")] }, "จำง่าย ๆ ค่ะ ประกันกลุ่มเป็นของบริษัท ประกันของตัวเอง อยู่กับเราตลอด"),
];

function welfare(input: StoryVideoInput): KnowScene[] {
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "myth", quote: ["“มีบัตรทอง", "ประกันสังคมแล้ว”"] }, "มีบัตรทอง มีประกันสังคมแล้ว พอแล้วหรือเปล่าคะ"),
    scene("knowOne", { layout: "fact", crossed: "พอแล้ว", note: [small("สิทธิรักษามีอยู่จริง"), big("ช่วยเรื่องค่ารักษา", "green")] }, "สิทธิรักษาพยาบาลช่วยเรื่องค่ารักษาได้มากจริง ๆ ค่ะ"),
    scene("knowTwo", { layout: "list", title: ["แต่ระหว่างรักษา", "ยังมี"], mark: "box", items: ["รายได้ที่หยุดไป", "ค่ากินอยู่ของบ้าน", "ค่าเดินทาง ค่าคนดูแล"] },
      "แต่ระหว่างที่ป่วย รายได้อาจหยุด ส่วนค่ากินอยู่ของบ้าน ค่าเดินทาง ค่าคนดูแล ไม่ได้หยุดตามค่ะ"),
    f
      ? scene("knowThree", { layout: "note", title: ["เงินก้อน", "จากประกันโรคร้ายแรง"], note: figureNote(f) },
        `เช่น ${sexWord(f)}อายุ ${f.age} จ่ายเบี้ยปีละ ${n(f.annual)} บาท เมื่อป่วยเป็นโรคร้ายแรงตามเงื่อนไข ได้เงินก้อน ${withBaht(f.sumAssured)} ไว้ใช้ระหว่างพักรักษาตัวค่ะ`)
      : scene("knowThree", { layout: "note", title: ["เงินก้อน", "จากประกันโรคร้ายแรง"], note: [small("ป่วยเป็นโรคร้ายแรงตามเงื่อนไข"), big("ได้เงินก้อน", "green"), small("ไว้ใช้ระหว่างพักรักษาตัว")] },
        "ประกันโรคร้ายแรง จ่ายเงินก้อนเมื่อป่วยตามเงื่อนไข ไว้ใช้ระหว่างพักรักษาตัวค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("สวัสดิการ = ค่ารักษา"), big("ประกัน = เงินให้ชีวิตไปต่อ")] }, "จำง่าย ๆ ค่ะ สวัสดิการช่วยค่ารักษา ประกันช่วยให้ชีวิตไปต่อได้"),
  ];
}

function bank(input: StoryVideoInput): KnowScene[] {
  const f = input.figure;
  const myth = scene("knowAsk", { layout: "myth", quote: ["“ฝากธนาคาร", "ดีกว่า”"] }, "เอาเงินไปฝากธนาคารดีกว่า ไม่ต้องทำประกันหรอก จริงไหมคะ");
  const recap = scene("knowRecap", { layout: "recap", lines: [big("ออม = เงินไว้ใช้"), big("ประกัน = กันเรื่องใหญ่"), small("ควรมีทั้งสองอย่าง")] }, "จำง่าย ๆ ค่ะ ออมไว้ใช้ ประกันไว้กันเรื่องใหญ่ ควรมีทั้งสองอย่าง");
  if (!f) {
    return [
      myth,
      scene("knowOne", { layout: "card", title: ["ฝากธนาคาร", ""], lines: [small("เงินโตทีละนิด"), big("ได้เท่าที่ฝาก"), small("กับดอกเบี้ย")] }, "ฝากธนาคาร เงินโตทีละนิด เราได้เท่าที่ฝาก กับดอกเบี้ยค่ะ"),
      scene("knowTwo", { layout: "card", title: ["ทำประกัน", ""], lines: [small("จ่ายเบี้ยไม่มาก"), big("ได้ทุนก้อนใหญ่", "green"), small("คุ้มครองตามเงื่อนไขตั้งแต่ปีแรก")] }, "ทำประกัน จ่ายเบี้ยไม่มาก แต่ได้ความคุ้มครองเป็นทุนก้อนใหญ่ ตั้งแต่ปีแรกค่ะ"),
      scene("knowThree", { layout: "note", title: ["ถ้าเรื่องใหญ่", "มาเร็วกว่าที่คิด"], note: [small("เงินฝาก"), big("ยังมีไม่พอ", "red"), small("ประกัน"), big("มีทุนรออยู่แล้ว", "green")] }, "ถ้าเรื่องใหญ่มาเร็วกว่าที่คิด เงินฝากอาจยังมีไม่พอ แต่ประกันมีทุนรออยู่แล้วค่ะ"),
      recap,
    ];
  }
  const who = `${sexShort(f)} ${f.age} · ${planName(f.plan)} ${termShort(f)}`;
  return [
    myth,
    scene("knowOne", { layout: "card", title: ["ฝากธนาคาร", ""], lines: [small(`ฝากปีละ ${n(f.annual)} บาท`), small("ครบปีแรก มีเงิน"), big(`${n(f.annual)} บาท`), small("กับดอกเบี้ยอีกเล็กน้อย")] },
      `ถ้าฝากธนาคารปีละ ${n(f.annual)} บาท ครบปีแรกเราจะมีเงิน ${n(f.annual)} บาท กับดอกเบี้ยอีกเล็กน้อยค่ะ`),
    scene("knowTwo", { layout: "card", title: ["ทำประกัน", ""], lines: [small(`จ่ายปีละ ${n(f.annual)} บาท`), small("คุ้มครองตามเงื่อนไขตั้งแต่ปีแรก"), big(`ทุน ${n(f.sumAssured)} บาท`, "green"), small(who)] },
      `แต่ถ้าเงินก้อนเดียวกันจ่ายเป็นเบี้ย ${sexWord(f)}อายุ ${f.age} ได้ความคุ้มครองชีวิต ทุน ${withBaht(f.sumAssured)} ตั้งแต่ปีแรกค่ะ`),
    scene("knowThree", { layout: "note", title: ["ถ้าเรื่องใหญ่", "มาในปีแรก"], note: [small("เงินฝาก"), big(n(f.annual)), small("ประกัน"), big(n(f.sumAssured), "green")] },
      `ถ้าเรื่องใหญ่มาในปีแรก เงินฝากมี ${n(f.annual)} บาท ประกันมี ${withBaht(f.sumAssured)} ต่างกันมากค่ะ`),
    recap,
  ];
}

function pricey(input: StoryVideoInput): KnowScene[] {
  const f = input.figure;
  return [
    scene("knowAsk", { layout: "myth", quote: ["“เบี้ยแพง", "ไม่มีงบ”"] }, "ประกันแพง ตอนนี้ยังไม่มีงบ หลายคนคิดแบบนี้ค่ะ"),
    f
      ? scene("knowOne", { layout: "fact", crossed: "แพง", note: [small(`${sexShort(f)} ${f.age} ทุน ${n(f.sumAssured)}`), big(`เดือนละ ${n(f.monthly)} บาท`), small(`เฉลี่ยวันละราว ${n(f.annual / 365)} บาท`)] },
        `${sexWord(f)}อายุ ${f.age} ทุนชีวิต ${withBaht(f.sumAssured)} จ่ายเดือนละ ${n(f.monthly)} บาท เฉลี่ยวันละราว ${n(f.annual / 365)} บาทค่ะ`)
      : scene("knowOne", { layout: "fact", crossed: "แพง", note: [small("แบ่งเบี้ยเป็นรายวัน"), big("อาจน้อยกว่า"), big("ค่ากาแฟแก้วเดียว")] },
        "ลองแบ่งเบี้ยเป็นรายวันดูค่ะ หลายแบบน้อยกว่าค่ากาแฟแก้วเดียว"),
    scene("knowTwo", { layout: "list", title: ["เริ่มเล็ก", "ก่อนได้"], mark: "check", items: ["เลือกทุนที่จ่ายไหว", "แบ่งจ่ายรายเดือน", "ทำเพิ่มทีหลังเมื่อรายได้โต"] },
      "เริ่มเล็กก่อนได้ค่ะ เลือกทุนที่จ่ายไหว แบ่งจ่ายรายเดือน แล้วค่อยทำเพิ่มเมื่อรายได้โตขึ้น"),
    scene("knowThree", { layout: "note", title: ["สิ่งที่แพงกว่าเบี้ย", ""], dim: true, note: [big("วันที่ไม่มีอะไร", "red"), big("รองรับ", "red")] },
      "สิ่งที่แพงกว่าเบี้ย คือวันที่เกิดเรื่องแล้วไม่มีอะไรรองรับค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("เริ่มเท่าที่ไหว"), big("ดีกว่าไม่เริ่ม")] }, "จำง่าย ๆ ค่ะ เริ่มเท่าที่ไหว ดีกว่าไม่เริ่ม"),
  ];
}

/** an episode of ตอบข้อโต้แย้ง: its five scenes */
export function objectionScenes(topic: ObjectionTopic, input: StoryVideoInput): KnowScene[] {
  return { thinkfirst: thinkFirst, groupins: groupIns, welfare, bank, pricey }[topic](input);
}
