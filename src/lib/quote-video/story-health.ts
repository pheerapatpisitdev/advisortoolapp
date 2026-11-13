import type { StoryVideoInput } from "./story";
import { big, small, withBaht, type KnowScene, type KnowShow } from "./story-knowledge";

/**
 * ประกันสุขภาพ (scene library phase 1, owner's spec docs/superpowers/specs/2026-11-13-health-devices-design.md):
 * four fixed episodes in คลิปเล่าเรื่อง, no AI, each five scenes and the agent's card. They are drawn by
 * the health devices (split, limit, room, overflow, waiting, cashless, agecost), so every number on screen
 * is the iHealthy sheet's (input.health.figures) or one the agent typed (room, bill); a scene with
 * no number to show says the same thing in words. Nothing here promises what a claim will pay.
 */

export type HealthTopic = "lumpsum" | "roomcost" | "waiting" | "agecost";

export const HEALTH_CLOSE: Record<HealthTopic, string> = {
  lumpsum: "อยากให้ช่วยเลือกวงเงินที่พอ ทักมาได้เลย",
  roomcost: "อยากรู้ว่าห้องแบบไหนแผนไหนพอ ทักมาได้เลย",
  waiting: "อยากรู้ว่าสมัครแล้วเริ่มคุ้มครองเมื่อไหร่ ทักมาได้เลย",
  agecost: "อยากรู้ว่าอายุคุณจ่ายเท่าไร ทักมาได้เลย",
};

const scene = (key: KnowScene["key"], show: KnowShow, voice: string): KnowScene => ({ key, show, voice });
const sexShort = (sex: "M" | "F") => (sex === "M" ? "ชาย" : "หญิง");

const lumpsum = (input: StoryVideoInput): KnowScene[] => {
  const h = input.health!, f = h.figures, plan = `iHealthy ${f.planName}`;
  return [
    scene("knowAsk", { layout: "ask", title: ["เหมาจ่าย", "กับ แยกจ่าย"] }, "เคยได้ยินคำว่าเหมาจ่าย กับแยกจ่ายไหมคะ สองคำนี้ต่างกันนะคะ"),
    scene("knowOne", { layout: "split", title: ["เหมาจ่าย", "ต่างจากแยกจ่าย"], parts: ["ค่ายา", "ค่าผ่าตัด", "ค่าแพทย์", "ค่าตรวจ"], whole: "จ่ายตามจริง ภายใน วงเงินต่อปี" },
      "แยกจ่าย คือแต่ละรายการมีเพดานของตัวเอง ส่วนเหมาจ่าย คือจ่ายตามจริง ภายในวงเงินต่อปี ตามเงื่อนไขของแต่ละแผนค่ะ ส่วนค่าห้อง ยังมีวงเงินต่อคืนของมันเอง"),
    scene("knowTwo", { layout: "room", title: ["ค่าห้องต่อคืน", "ของแผนนี้"], plan: f.roomPerDay, ...(h.room ? { real: h.room } : {}), planName: plan },
      h.room
        ? `ห้องที่ใช้อยู่ ${withBaht(h.room)}ต่อคืน แผน ${plan} จ่ายค่าห้องต่อคืน ${withBaht(f.roomPerDay)}ค่ะ${h.room > f.roomPerDay ? " ส่วนที่เกินวงเงินค่าห้อง เราจ่ายเอง ตามเงื่อนไขของแผนค่ะ" : " อยู่ในวงเงินค่ะ"}`
        : `แผน ${plan} จ่ายค่าห้องต่อคืน ${withBaht(f.roomPerDay)}ค่ะ`),
    scene("knowThree", { layout: "limit", title: ["วงเงินรักษา", "ต่อปี"], limit: f.annualMax, planName: plan },
      `วงเงินรักษาต่อปีของแผนนี้ ${withBaht(f.annualMax)}ค่ะ ใช้ได้ทั้งปีรวมกัน`),
    scene("knowRecap", { layout: "recap", lines: [big("เหมาจ่าย = จ่ายตามจริง"), big("ภายในวงเงินต่อปี", "green"), small("ตามเงื่อนไขของแผน")] },
      "จำง่าย ๆ ค่ะ เหมาจ่ายคือจ่ายตามจริง ภายในวงเงินต่อปี เลือกวงเงินให้พอกับที่เราใช้จริง"),
  ];
};

const roomcost = (input: StoryVideoInput): KnowScene[] => {
  const h = input.health!, f = h.figures, plan = `iHealthy ${f.planName}`;
  const over = h.bill !== undefined && h.bill > f.annualMax;
  return [
    scene("knowAsk", { layout: "ask", title: ["ค่าห้องเกิน", "ใครจ่าย"] }, "ถ้าห้องที่เราเลือก แพงกว่าที่แผนจ่าย ส่วนต่างใครจ่ายคะ"),
    scene("knowOne", { layout: "room", title: ["ค่าห้องต่อคืน", "ของแผนนี้"], plan: f.roomPerDay, ...(h.room ? { real: h.room } : {}), planName: plan },
      h.room
        ? `ห้องที่ใช้อยู่ ${withBaht(h.room)}ต่อคืน แผน ${plan} จ่ายค่าห้องต่อคืน ${withBaht(f.roomPerDay)}ค่ะ${h.room > f.roomPerDay ? " ส่วนที่เกินวงเงินค่าห้อง เราจ่ายเอง ตามเงื่อนไขของแผนค่ะ" : " อยู่ในวงเงินค่ะ"}`
        : `แผน ${plan} จ่ายค่าห้องต่อคืน ${withBaht(f.roomPerDay)}ค่ะ ค่าห้องโรงพยาบาลเอกชนมักเกินวงเงินของแผนเล็ก`),
    scene("knowTwo", { layout: "overflow", title: ["บิลเกินวงเงิน", "ใครจ่าย"], ...(h.bill ? { bill: h.bill, limit: f.annualMax } : {}) },
      h.bill
        ? over
          ? `ถ้าบิลรักษา ${withBaht(h.bill)} วงเงินต่อปี ${withBaht(f.annualMax)} ส่วนที่เกิน ${withBaht(h.bill - f.annualMax)} เราจ่ายเอง ตามเงื่อนไขของแผนค่ะ`
          : `ถ้าบิลรักษา ${withBaht(h.bill)} ยังอยู่ในวงเงินต่อปี ${withBaht(f.annualMax)} ค่ะ แต่ถ้าเกิน ส่วนที่เกินเราจ่ายเอง ตามเงื่อนไขของแผน`
        : "ถ้าบิลรักษาเกินวงเงินของแผน ส่วนที่เกินเราต้องจ่ายเอง ตามเงื่อนไขของแผนค่ะ"),
    scene("knowThree", { layout: "list", title: ["เลือกวงเงิน", "ให้พอ"], mark: "check", items: ["ดูค่าห้องต่อคืนของแผน", "ดูวงเงินรักษาต่อปี", "เทียบกับโรงพยาบาลที่ใช้"] },
      "ก่อนเลือกแผน ดูค่าห้องต่อคืน ดูวงเงินรักษาต่อปี แล้วเทียบกับโรงพยาบาลที่เราใช้จริงค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("ห้องแพงกว่า วงเงินห้อง"), big("ส่วนเกินวงเงินห้อง เราจ่ายเอง ตามเงื่อนไข", "red"), small("เลือกวงเงินให้พอ")] },
      "จำง่าย ๆ ค่ะ ห้องแพงกว่าวงเงินค่าห้อง ส่วนที่เกินเราจ่ายเอง ตามเงื่อนไขของแผน เลือกให้พอตั้งแต่แรก"),
  ];
};

const waiting = (input: StoryVideoInput): KnowScene[] => {
  const f = input.health!.figures;
  return [
    scene("knowAsk", { layout: "ask", title: ["สมัครวันนี้", "คุ้มครองเมื่อไหร่"] }, "สมัครวันนี้ จะคุ้มครองเลยไหมคะ"),
    scene("knowOne", { layout: "waiting", title: ["สมัครวันนี้", "คุ้มครองเมื่อไหร่"], rows: [
      { at: "วันนี้", label: "กรมธรรม์มีผล" }, { at: `${f.waitingDays} วัน`, label: "ป่วยทั่วไป" }, { at: `${f.specialWaitingDays} วัน`, label: "บางโรค" },
    ] }, `นับจากวันที่กรมธรรม์มีผล ป่วยทั่วไปมีช่วงรอ ${f.waitingDays} วัน บางโรครอ ${f.specialWaitingDays} วัน ตามเงื่อนไขของแผนค่ะ`),
    scene("knowTwo", { layout: "note", title: ["ข้อควรรู้", "ก่อนสมัคร"], dim: true, note: [small("โรคที่เป็นมาก่อนสมัคร"), big("ปกติไม่คุ้มครอง ตามเงื่อนไข", "red"), small("แถลงสุขภาพให้ครบ")] },
      "ส่วนโรคที่เป็นมาก่อนสมัคร ปกติไม่คุ้มครองนะคะ ตามเงื่อนไข จึงต้องแถลงสุขภาพให้ครบค่ะ"),
    scene("knowThree", { layout: "cashless", title: ["ยื่นบัตร", "ไม่ต้องสำรองจ่าย"], note: "ตามเงื่อนไขการเคลม" },
      "ถ้าใช้โรงพยาบาลในเครือข่าย ยื่นบัตรได้เลย ไม่ต้องสำรองจ่าย ตามเงื่อนไขการเคลมค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("สมัครเร็ว"), big("เริ่มนับช่วงรอเร็ว", "green"), small("แถลงสุขภาพให้ครบ")] },
      "จำง่าย ๆ ค่ะ สมัครเร็ว ช่วงรอก็เริ่มนับเร็ว และอย่าลืมแถลงสุขภาพให้ครบ"),
  ];
};

const agecost = (input: StoryVideoInput): KnowScene[] => {
  const h = input.health!, f = h.figures, plan = `iHealthy ${f.planName} ${sexShort(h.sex)}`;
  // the rider renews every year and its premium follows the age it renews at (the sheet's terms.premiumChanges):
  // joining young is told for what it truly gives, never as a price that stays (controller ruling R11)
  const ask = scene("knowAsk", { layout: "ask", title: ["ทำตอนอายุน้อย", "เบี้ยถูกกว่าจริงไหม"] }, "ทำประกันสุขภาพตอนอายุน้อย เบี้ยถูกกว่าจริงไหมคะ");
  const second: KnowScene = f.ages.length >= 2
    ? scene("knowOne", {
      layout: "agecost", title: ["เบี้ยสุขภาพ", "ขึ้นตามอายุ"], rows: f.ages,
      source: `เบี้ยสัญญาเพิ่มเติมสุขภาพต่อปี ไม่รวมสัญญาหลัก (${plan}) อัตราปัจจุบัน เบี้ยปีต่ออายุอาจเปลี่ยนแปลง`,
    }, `เบี้ยสุขภาพต่อปีของแผนนี้ ${f.ages.map((a) => `อายุ ${a.age} ปี ${withBaht(a.annual)}`).join(" ")}ค่ะ นี่คือเบี้ยของสัญญาเพิ่มเติมสุขภาพ ไม่รวมสัญญาหลัก เป็นอัตราปัจจุบัน เบี้ยปีต่ออายุอาจเปลี่ยนแปลงได้ค่ะ`)
    : scene("knowOne", { layout: "note", title: ["เบี้ยสุขภาพ", "ขึ้นตามอายุ"], note: [small("อายุมากขึ้น"), big("เบี้ยสูงขึ้น", "red"), small("ปรับตามอายุทุกปีที่ต่อสัญญา")] },
      "เบี้ยสุขภาพปรับตามอายุทุกปีที่ต่อสัญญาค่ะ อายุมากขึ้น เบี้ยก็สูงขึ้น");
  return [
    ask,
    second,
    scene("knowTwo", { layout: "note", title: ["สมัครตอนสุขภาพดี", "ได้อะไร"], note: [small("สมัครตอนสุขภาพดี"), big("ยังไม่มีโรคเดิม ให้ยกเว้น", "green"), small("มีโรคก่อนสมัคร อาจถูกยกเว้นหรือสมัครไม่ได้")] },
      "สมัครตอนสุขภาพยังดี ก็ยังไม่มีโรคเดิมให้ยกเว้นค่ะ ถ้ารอจนมีโรคแล้วค่อยสมัคร โรคนั้นอาจถูกยกเว้น หรืออาจสมัครไม่ได้เลย"),
    scene("knowThree", { layout: "list", title: ["ทำตอนอายุน้อย", "ดีกว่ายังไง"], mark: "check", items: ["ยังไม่มีโรคเดิมให้ยกเว้น", "เบี้ยอัตราช่วงอายุน้อย", "มีเวลาเลือกแผนที่เหมาะ"] },
      "สมัครตอนสุขภาพดี ยังไม่มีโรคเดิมให้ยกเว้น ระหว่างที่อายุยังน้อย ก็จ่ายเบี้ยอัตราของช่วงอายุนั้น ซึ่งต่ำกว่าตอนอายุมาก และมีเวลาเลือกแผนที่เหมาะกับเราค่ะ"),
    scene("knowRecap", { layout: "recap", lines: [big("สมัครตอนสุขภาพดี"), big("ยังไม่มีโรคเดิม ให้ยกเว้น", "green"), small("เบี้ยปรับตามอายุ ทุกปีที่ต่อสัญญา")] },
      "จำง่าย ๆ ค่ะ สมัครตอนสุขภาพดี ยังไม่มีโรคเดิมให้ยกเว้น ส่วนเบี้ยปรับตามอายุทุกปีที่ต่อสัญญา ช่วงอายุน้อยจึงจ่ายในอัตราที่ต่ำกว่า"),
  ];
};

/** an episode of ประกันสุขภาพ: its five scenes; the plan's figures come from input.health */
export function healthScenes(topic: HealthTopic, input: StoryVideoInput, _name: string): KnowScene[] {
  if (!input.health) throw new Error("เรื่องประกันสุขภาพต้องมีแผน iHealthy");
  return { lumpsum, roomcost, waiting, agecost }[topic](input);
}
