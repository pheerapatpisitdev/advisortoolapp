import type { DeviceLayout, HealthLayout, LifeLayout, MetaLayout, SaveLayout } from "@/lib/quote-video/story-knowledge";

/** One system-drawn device (a story-scene layout). Browser-safe: names and fields only. */
export interface DeviceInfo {
  key: DeviceLayout;
  name: string;
  /** when a script should pick it: one line the คลิปตามโจทย์ writer reads */
  when: string;
  /** สุขภาพ: round 1's health devices; ชีวิต ภาษี มรดก: round 2's; อุปมา: round 3's metaphors; ออมเงิน: round 4's saving devices */
  family: "สุขภาพ" | "ชีวิต ภาษี มรดก" | "อุปมา" | "ออมเงิน";
  /** the catalogue's product ("all": a metaphor is for any product) */
  product: "health" | "life" | "saving" | "all";
  clips: ("story" | "prompt")[];
  /** fields that hold a number: each is checked against its source before it is drawn */
  numberFields: string[];
  wordFields: string[];
}

const both: ("story" | "prompt")[] = ["story", "prompt"];
const dev = (key: HealthLayout, name: string, when: string, numberFields: string[], wordFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "สุขภาพ", product: "health", clips: both, numberFields, wordFields });
const dev2 = (key: LifeLayout, name: string, product: DeviceInfo["product"], when: string, numberFields: string[], wordFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "ชีวิต ภาษี มรดก", product, clips: both, numberFields, wordFields });

/** a metaphor carries words only: no number field, never a figure (checkDevice refuses a digit in any word) */
const dev3 = (key: MetaLayout, name: string, when: string, wordFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "อุปมา", product: "all", clips: both, numberFields: [], wordFields });

/** a saving device (round 4): figures in baht only, never a percent or a return word */
const dev4 = (key: SaveLayout, name: string, when: string, numberFields: string[]): DeviceInfo =>
  ({ key, name, when, family: "ออมเงิน", product: "saving", clips: both, numberFields, wordFields: ["title", "note"] });

export const DEVICES: DeviceInfo[] = [
  dev("split", "เหมาจ่าย vs แยกจ่าย", "เทียบแผนแยกจ่ายที่มีเพดานแต่ละหมวด กับแผนเหมาจ่ายที่จ่ายตามจริงในวงเงินเดียว", [], ["title", "parts", "whole"]),
  dev("limit", "วงเงินต่อปีเติมหลอด", "พูดถึงวงเงินค่ารักษาต่อปีของแผน และใช้ไปแล้วเท่าไร", ["limit", "used"], ["title", "planName"]),
  dev("room", "ค่าห้องต่อคืน", "เทียบค่าห้องจริงต่อคืนกับค่าห้องที่แผนจ่าย", ["plan", "real"], ["title", "planName"]),
  dev("overflow", "ส่วนต่างที่จ่ายเอง", "บิลค่ารักษาเกินวงเงิน ส่วนที่เกินต้องจ่ายเอง", ["bill", "limit"], ["title"]),
  dev("waiting", "ระยะรอคอย", "อธิบายระยะรอคอยหลังเริ่มสัญญา ก่อนเคลมโรคบางกลุ่มได้", [], ["title", "rows"]),
  dev("cashless", "เคลมไม่ต้องสำรองจ่าย", "เล่าว่าเข้าโรงพยาบาลในเครือข่ายแล้วไม่ต้องสำรองจ่ายเอง", [], ["title", "note"]),
  dev("groupgap", "ประกันกลุ่มไม่พอ", "สวัสดิการประกันกลุ่มจากที่ทำงานจ่ายได้ไม่พอค่ารักษาจริง", ["bill", "group"], ["title"]),
  dev("agecost", "เบี้ยขึ้นตามอายุ", "เล่าว่าค่าประกันสุขภาพต่อปีสูงขึ้นตามช่วงอายุ", ["rows"], ["title", "source"]),
  // ชีวิต โรคร้าย ภาษี มรดก (round 2, spec 2026-11-14-devices-life-tax-design.md); no `when` line says a word no script may (FORBIDDEN)
  dev2("lifeneed", "ทุนชีวิตที่ควรมี", "life", "คิดว่าครอบครัวควรมีทุนประกันชีวิตเท่าไร จากหนี้ ค่าใช้จ่ายครอบครัวต่อปี จำนวนปี และค่าการศึกษาลูก เทียบกับทุนที่มีอยู่",
    ["debts", "expenses", "years", "education", "have"], ["title"]),
  dev2("beneficiary", "ผู้รับประโยชน์", "life", "อธิบายการระบุชื่อผู้รับประโยชน์และสัดส่วนของแต่ละคนในกรมธรรม์", ["rows"], ["title", "rows"]),
  dev2("cilump", "เงินก้อนตอนวินิจฉัย", "health", "เล่าว่าประกันโรคร้ายแรงจ่ายเป็นเงินก้อนเมื่อแพทย์วินิจฉัยตามเงื่อนไข", ["sum"], ["title", "note"]),
  dev2("incomestop", "รายได้หยุดระหว่างรักษา", "health", "ป่วยหนักต้องหยุดงานรักษาตัวหลายเดือน รายได้ที่หายไประหว่างนั้น", ["monthly", "months"], ["title"]),
  dev2("taxback", "ภาษีที่ได้คืนตามฐาน", "saving", "ค่าประกันชีวิตที่จ่ายต่อปีนำไปลดหย่อนภาษีได้ แล้วได้ภาษีคืนเท่าไรตามฐานภาษี", ["premium", "bracket"], ["title"]),
  dev2("taxcap", "เพดานลดหย่อนรวม", "saving", "สรุปเพดานลดหย่อนภาษีของประกันชีวิต ประกันสุขภาพ และประกันแบบบำนาญ", [], ["title"]),
  dev2("moneysplit", "แบ่งเงินให้คนในบ้าน", "life", "เงินก้อนจากประกันแบ่งให้คนในบ้าน 2–3 คน แต่ละคนได้เท่าไร", ["total", "parts"], ["title", "parts"]),
  dev2("threegen", "ส่งต่อสามรุ่น", "life", "วางแผนส่งต่อเงินก้อนเป็นมรดกจากรุ่นหนึ่งไปอีกรุ่น สามรุ่นในครอบครัว", [], ["title", "rows", "note"]),
  // อุปมาเล่าเรื่อง (round 3, spec 2026-11-15-devices-metaphor-design.md); no `when` line says a FORBIDDEN word
  dev3("umbrella", "ร่มกันฝน", "เปรียบประกันกับร่มที่กางไว้ก่อนฝนตก ใช้กับความเชื่อว่าซื้อประกันเหมือนแช่งตัวเอง หรือเตรียมไว้ก่อนเกิดเรื่อง", ["title", "note"]),
  dev3("housepillar", "เสาหลักของบ้าน", "เปรียบคนหารายได้หลักกับเสาหลักของบ้าน ถ้าเสาล้มทั้งบ้านรับไม่ไหว ใส่เสาสำรองได้เมื่ออยากให้เห็นว่ามีอะไรมาแทน", ["title", "note", "label", "spare"]),
  dev3("lifering", "ห่วงชูชีพ", "เปรียบเงินก้อนที่มาทันเวลากับห่วงชูชีพที่โยนให้คนที่กำลังจมน้ำ ใช้กับตอนที่รายได้หายไปกะทันหัน", ["title", "note"]),
  dev3("safetynet", "ตาข่ายนิรภัย", "เปรียบการเตรียมไว้ก่อนกับตาข่ายใต้เชือกที่คอยรับตอนพลาด ใช้กับคนทำงานอิสระที่ไม่มีสวัสดิการจากที่ทำงาน", ["title", "note"]),
  dev3("seedtree", "เมล็ดโตเป็นต้นไม้", "เปรียบการเริ่มทีละน้อยกับเมล็ดที่โตเป็นต้นไม้ใหญ่ ใช้กับคนที่ลังเลเพราะรู้สึกว่าเริ่มตอนนี้ไม่ไหว", ["title", "note", "from", "to"]),
  dev3("balance", "ตาชั่ง", "เทียบสองสิ่งบนตาชั่ง เช่น ออมกับประกัน ว่าแต่ละอย่างทำหน้าที่ต่างกันและควรมีทั้งคู่", ["title", "note", "sides", "tilt"]),
  dev3("bridge", "สะพานข้ามช่วงยาก", "เปรียบสิ่งที่ช่วยให้ข้ามช่วงลำบากกับสะพาน ใช้กับตอนป่วยแล้วรายได้หายที่สวัสดิการอื่นรับไม่ครบ", ["title", "note"]),
  dev3("shield", "โล่กันลูกศร", "เปรียบเรื่องร้ายที่อาจมาถึงกับลูกศร และกรมธรรม์กับโล่ที่รับแทน ใส่เรื่องที่อยากพูดถึงได้หนึ่งถึงห้าเรื่อง", ["title", "note", "arrows"]),
  // ออมเงินและเกษียณ (round 4, spec 2026-11-15-devices-saving-design.md); no `when` line says a FORBIDDEN or a return word
  dev4("savejar", "กระปุกโตทุกปี", "เล่าว่าเงินที่ส่งเข้าแผนบำนาญสะสมทีละปี ใช้ตัวเลขจากโจทย์เท่านั้น", ["years", "paid"]),
  dev4("paidgot", "ส่งเท่าไร ได้คืนเท่าไร", "เทียบเงินที่ส่งรวมกับบำนาญรวมที่ได้รับ ต้องมีทั้งสองยอดในโจทย์ ใช้ตัวเลขจากโจทย์เท่านั้น", ["paid", "got", "payFrom", "payTo", "getFrom", "getTo"]),
  dev4("pricerise", "เงินเท่าเดิม ซื้อได้น้อยลง", "เล่าว่าของแพงขึ้นทุกปี เงินก้อนเดิมซื้อของได้น้อยลง ไม่มีตัวเลขบนภาพ", []),
  dev4("pensionsteps", "บำนาญขั้นบันได", "เล่าว่าบำนาญที่ได้รับเป็นขั้น ตามช่วงอายุ ต้องมีช่วงอายุและบำนาญต่อปีจากโจทย์ ไม่เกินห้าช่วง", ["rows"]),
];

export const deviceInfo = (key: string): DeviceInfo | undefined => DEVICES.find((d) => d.key === key);

/** a round-1 health device (family สุขภาพ); every consumer lists all sixteen since round 2 */
export const isHealthDevice = (d: DeviceInfo): d is DeviceInfo & { key: HealthLayout } => d.family === "สุขภาพ";

/** an อุปมา device (round 3); the registry lists all twenty-four since round 3 */
export const isMetaDevice = (d: DeviceInfo): d is DeviceInfo & { key: MetaLayout } => d.family === "อุปมา";

/** an ออมเงิน device (round 4); the registry lists all twenty-eight since round 4 */
export const isSaveDevice = (d: DeviceInfo): d is DeviceInfo & { key: SaveLayout } => d.family === "ออมเงิน";
