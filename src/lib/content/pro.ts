import type { Format, Length } from "./prompt";

/**
 * สูตรคอนเทนต์โปร (owner, 2026-09-29): thirteen ideas on holding a viewer, taken from a Reel
 * the owner studied (August Vee, "Content Creator IQ"), put to work as rules for the writers
 * when the owner ticks the box. Off by default and remembered per browser, like คลิปวนลูป.
 *
 * Every writer reads it — the planner and writer of a round, รีวิวเคลม's and หาทีม's — for
 * posts and scripts; an ad's lengths are Ads Manager's, so an ad is written as before.
 * Nothing here overrides the rules that cannot be broken or Facebook's: the hook speaks of a
 * group in the third person, never to the reader as one of them, and a save is the only thing
 * asked for mid-piece — no "comment X", no tagging.
 */

export const PRO_NAME = "สูตรคอนเทนต์โปร";

/** the thirteen, as the box lists them; `ai` false: the owner's to do, the writer cannot */
export const PRO_PRINCIPLES: { name: string; what: string; ai: boolean }[] = [
  { name: "Spoken Hook", what: "ประโยคแรกดึงคนไว้ใน 3 วินาที", ai: true },
  { name: "Visual Hook", what: "ภาพแรกทำให้หยุดเลื่อน (สคริปต์: ภาพเปิด · โพสต์: หัวข้อบนรูป)", ai: true },
  { name: "Text Hook", what: "ข้อความบนจอไม่เกิน 2 บรรทัด อ่านจบใน 1 วินาที", ai: true },
  { name: "Re-Hook", what: "ดึงคนกลับกลางเรื่อง ตอนที่เริ่มหลุด", ai: true },
  { name: "Hook Stacking", what: "ประโยคเปิดซ้อน 3 ชั้น: สำหรับใคร · สวนความเชื่อ · ทิ้งปม", ai: true },
  { name: "Jump Cut", what: "ตัดคำเกริ่นและช่วงพูดวน เหลือแต่ใจความ", ai: true },
  { name: "B-roll", what: "แนะนำภาพแทรกทุกช่วงของคลิป", ai: true },
  { name: "Mid-CTA", what: "ชวนเซฟกลางเรื่อง ตอนที่คนยังดูอยู่", ai: true },
  { name: "IVP", what: "เขียนให้คนดูที่ตั้งไว้ในช่อง “คนอ่าน” (สิ่งที่สนใจ ปัญหา สิ่งที่อยากได้)", ai: true },
  { name: "ICP", what: "ข้อเสนอท้ายเรื่องตรงกับคนที่จะตัดสินใจจริง", ai: true },
  { name: "Content Funnel", what: "โทนตามเป้าหมาย: ให้คนเห็นเยอะ = รู้จัก · ให้คอมเมนต์ = เชื่อใจ · ให้ทักแชท = ขาย", ai: true },
  { name: "Graph Retention", what: "หลังโพสต์ ดูกราฟคนดูใน Meta Business Suite: ตกใน 3 วิแรก = hook อ่อน · ตกกลางคลิป = ช่วงนั้นน่าเบื่อ", ai: false },
  { name: "CTA", what: "ปิดด้วยสิ่งที่ให้ทำต่อ ตามช่อง “เป้าหมาย”", ai: true },
];

/**
 * Two seconds of Thai, read or said. Measured 2026-09-29: the planner's hooks ran 174–184
 * characters with the goal's "ทักแชท…" folded in, and 110–132 under the first draft of these
 * rules that said "one line" without a number.
 */
export const PRO_HOOK_MAX = 60;

/** The hook, wherever one is written: the planner's, and the one-call writers' (รีวิวเคลม, หาทีม). */
export const PRO_HOOK_RULES = [
  `${PRO_NAME} — hook (กฎนี้แทนเรื่องความยาวของ hook ด้านบน แต่กฎที่ห้ามละเมิดและกฎ Facebook มาก่อนเสมอ):`,
  "- Hook Stacking: ซ้อน 3 ชั้นในประโยคเดียว (1) บอกว่าเรื่องนี้สำหรับใคร โดยพูดถึงกลุ่มคนแบบบุคคลที่สาม เช่น “มนุษย์เงินเดือนหลายคน…” ห้ามทักคนอ่านว่าเป็นคนกลุ่มนั้น (2) พูดสวนความเชื่อที่คนกลุ่มนั้นมีอยู่ (3) ทิ้งปมให้อยากรู้ต่อ",
  `- สั้นมาก: ไม่เกิน ${PRO_HOOK_MAX} ตัวอักษร อ่านหรือพูดจบใน 2 วินาที ถ้าซ้อนครบ 3 ชั้นแล้วยาวเกิน ให้ตัดชั้นแรกออก`,
  "- hook มีแค่ปม ห้ามมีคำชวน (ทักแชท คอมเมนต์ กดติดตาม) ห้ามใส่ชื่อแบบประกัน และใส่ตัวเลขได้ไม่เกิน 1 ตัว — ที่เหลือเก็บไว้เล่าในเนื้อหา",
  "- ความเชื่อที่สวนต้องแก้ได้ด้วยข้อมูลผลิตภัณฑ์ที่ให้มาเท่านั้น (เช่น เงื่อนไขหรือความคุ้มครองที่เขียนไว้) ห้ามอ้างว่าสวัสดิการ ประกันกลุ่ม หรือแบบประกันอื่นให้หรือไม่ให้อะไร ห้ามแต่งตัวเลข ห้ามขายด้วยความกลัว",
].join("\n");

const LENGTH_SECONDS: Record<Length, number> = { "30": 30, "60": 60, "180": 150 };

/** The rest of the thirteen, for the one writing the body. `loop`: a คลิปวนลูป asks mid-clip already. */
export function proRules(format: Format, length: Length | null = null, loop = false): string {
  if (format === "ad") return "";
  const head = [
    `${PRO_NAME} (เจ้าของเพจเลือกใช้ กฎที่ห้ามละเมิดและกฎ Facebook มาก่อนเสมอ):`,
    // seen 2026-09-29: "(Re-Hook)" and "(Mid-CTA)" written in as if they were actions to film
    "- ชื่อเทคนิคด้านล่าง (Re-Hook, Mid-CTA, B-roll ฯลฯ) เป็นคำสั่งให้คุณ ห้ามเขียนชื่อเทคนิคลงในชิ้นงาน ยกเว้นคำว่า B-roll: ที่ขึ้นต้นวงเล็บภาพแทรก",
  ].join("\n");
  const shared = [
    "- Jump Cut: ประโยคละใจความเดียว ไม่มีคำเกริ่นหรือทักทาย ไม่พูดวน บรรทัดไหนตัดแล้วเรื่องยังเหมือนเดิมให้ตัดทิ้ง",
    "- IVP/ICP: เขียนให้ “คนอ่าน” ที่บอกไว้เข้าใจง่ายและเห็นตัวเองในเรื่อง แต่ข้อเสนอหรือการชวนท้ายเรื่องต้องตรงกับคนที่จะตัดสินใจจริง",
    "- Content Funnel: ถ้ามี “เป้าหมาย” ให้โทนตามนั้น — ให้คนเห็นเยอะ = ให้คนรู้จัก (อิน เอาไปใช้ได้ ขายน้อย) · ให้คอมเมนต์ = ให้คนเชื่อใจ (สอน มีเหตุผล) · ให้ทักแชท = ปิดการขาย (ข้อเสนอชัดว่าทักมาได้อะไร)",
  ];
  if (format === "post") {
    return [
      head,
      "- ช่วงก่อน “ดูเพิ่มเติม”: hook กับ 2 บรรทัดแรกของ body (ราว 125 ตัวอักษร) คือทั้งหมดที่คนเห็นก่อนกด ต้องทำให้อยากกดอ่านต่อ",
      "- Visual Hook: headline บนภาพไปทางเดียวกับ hook แต่ไม่ซ้ำคำ ภาพกับข้อความต้องช่วยกันหยุดคนเลื่อน",
      "- Re-Hook: ถ้า body ยาวเกิน 6 บรรทัด ให้มีประโยคดึงความสนใจกลางโพสต์ 1 ประโยค เช่น บอกว่าข้อถัดไปสำคัญที่สุด (ต้องจริงตามเนื้อหา)",
      "- Mid-CTA: ถ้าเป็นความรู้ที่เก็บไว้ใช้ได้ (ลิสต์ เช็กลิสต์ คำถามที่เจอบ่อย) ให้มีประโยคชวนเซฟสั้นๆ 1 ประโยคกลาง body — ชวนได้แค่เซฟ ห้ามชวนคอมเมนต์คำเฉพาะหรือแท็กเพื่อน",
      ...shared,
    ].join("\n");
  }
  const secs = LENGTH_SECONDS[length ?? "60"];
  return [
    head,
    "- 3 วินาทีแรกต้องมีครบ: hook ที่พูด · Text Hook เป็น {จอ: …} ไม่เกิน 2 บรรทัด อ่านจบใน 1 วินาที · Visual Hook เป็นภาพหรือท่าทางเปิดในวงเล็บที่ทำให้หยุดเลื่อน — ขึ้นต้น body ด้วย [0–3 วิ] ที่มีแค่ {จอ: …} กับ (ภาพเปิด) ห้ามพูด hook ซ้ำ",
    "- Re-Hook: กลางคลิป ตอนที่คนเริ่มหลุด ให้มีประโยคดึงกลับ 1 ประโยค เช่น บอกว่าข้อต่อไปสำคัญที่สุด (ต้องจริงตามเนื้อหา)",
    ...(!loop && secs >= 60 ? ["- Mid-CTA: ชวนเซฟหรือติดตามสั้นๆ 1 ประโยคช่วงกลางคลิป ก่อนเนื้อหาช่วงหลัง"] : []),
    "- B-roll: ทุกช่วงเวลาให้แนะนำภาพแทรกที่ถ่ายได้จริง 1 อย่าง เขียนในวงเล็บขึ้นต้นด้วย B-roll: เช่น (B-roll: ถ่ายใบเสร็จโรงพยาบาลใกล้ๆ)",
    ...shared,
  ].join("\n");
}
