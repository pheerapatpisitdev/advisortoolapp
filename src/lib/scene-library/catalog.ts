import { DEVICES } from "./devices";
import { promptLibraryHref, storyLibraryHref } from "./links";
import { PROMPT_FORMATS } from "@/lib/prompt-story/types";
import { MUSIC_MOODS } from "@/lib/quote-video/fx";
import { THEME_LABELS } from "@/lib/quote-video/theme-keys";
import type { HealthLayout } from "@/lib/quote-video/story-knowledge";
import { INFO_SHELVES, infoArt, topicOf, type StoryTopic } from "@/lib/story/topics";

/**
 * คลังแอนิเมชัน: every clip building block the Studio has, or has planned, in one list (owner-approved
 * mockup v5, 2026-11-14). Browser-safe: names, links and notes only; no rate tables, nothing server-side.
 * `ready` = the Studio can make it today; an unbuilt item has no uses and no preview.
 */
export type LibraryType = "format" | "device" | "look" | "fx";
export type LibraryProduct = "all" | "health" | "life" | "saving";
export type LibraryTool = "quote-video" | "story-clip" | "prompt-story";

export interface LibraryUse { tool: LibraryTool; label: string; href: string }
/** one of a device's looks: its still, and the links that open the forms in that look */
export interface LibraryLook { id: string; name: string; preview: string; uses: LibraryUse[] }
export interface LibraryItem {
  id: string;
  type: LibraryType;
  name: string;
  tells: string;
  product: LibraryProduct;
  ready: boolean;
  uses: LibraryUse[];
  preview?: string;
  looks?: LibraryLook[];
}

export const TYPE_NAME: Record<LibraryType, string> = { format: "รูปแบบรายการ", device: "อุปกรณ์ภาพ", look: "สไตล์ภาพ", fx: "ลูกเล่น" };
/** the product chips as the spec words them; `all` names the chip that shows every piece (a piece for every product has no tag) */
export const PRODUCT_NAME: Record<LibraryProduct, string> = { all: "ทุกสินค้า", health: "สุขภาพ", life: "ชีวิต", saving: "ออม บำนาญ มรดก" };

export { storyLibraryHref, promptLibraryHref } from "./links";

const QUOTE = "/studio/quote-video";
const quoteUse = (label = "ทำคลิปขายแผน"): LibraryUse => ({ tool: "quote-video", label, href: QUOTE });
const storyUse = (label: string, p: { topic?: string; look?: string } = {}): LibraryUse => ({ tool: "story-clip", label, href: storyLibraryHref(p) });
const promptUse = (label: string, p: { format?: string; style?: string } = {}): LibraryUse => ({ tool: "prompt-story", label, href: promptLibraryHref(p) });

/** the seven story looks: story-clip art id, prompt-story style id (it calls แสงอุ่น "warm"), shown name */
const STORY_LOOKS = [
  { art: "paper", style: "paper", name: "สต็อปโมชันกระดาษ", tells: "ฉากเป็นกระดาษตัดแปะถ่ายทีละเฟรม" },
  { art: "minimal", style: "warm", name: "แสงอุ่น", tells: "ฉากกระดาษใต้แสงอุ่น อบอุ่นอ่านง่าย" },
  { art: "plot", style: "plot", name: "ปากกาพล็อตเตอร์", tells: "เส้นหมึกบางๆ บนกระดาษ เหมือนเครื่องวาดแผนภาพ" },
  { art: "line", style: "line", name: "การ์ตูนลายเส้น", tells: "ตัวการ์ตูนเส้นหนา สีเรียบ" },
  // ไวต์บอร์ด นีออน บลูพริ้นท์ (owner, 2026-11-14, spec 2026-11-14-story-looks-board-neon-blueprint): drawn as plot is
  { art: "board", style: "board", name: "ไวต์บอร์ด", tells: "เขียนอธิบายบนไวต์บอร์ดทีละเส้น" },
  { art: "neon", style: "neon", name: "นีออน", tells: "ตัวอักษรและเส้นเรืองแสงบนพื้นมืด" },
  { art: "blueprint", style: "blueprint", name: "บลูพริ้นท์", tells: "เส้นขาวบนพื้นน้ำเงินแบบแปลนวิศวกร" },
] as const;
/** ปากกาพล็อตเตอร์, ไวต์บอร์ด, นีออน and บลูพริ้นท์ draw only the shelves told in points (INFO_SHELVES); their links open on one of them */
const PLOT_TOPIC: StoryTopic = "sumvspremium";
const DEVICE_LOOK_ORDER = ["paper", "minimal", "line", "plot", "board", "neon", "blueprint"] as const;

/** the story topic that shows each health device */
const DEVICE_TOPIC: Record<HealthLayout, StoryTopic> = {
  split: "lumpsum", limit: "lumpsum", room: "roomcost", overflow: "roomcost",
  waiting: "waiting", cashless: "waiting", groupgap: "groupins", agecost: "agecost",
};

/** what a viewer reads under each device (the DEVICES `when` lines are for the script writer) */
const DEVICE_TELLS: Record<HealthLayout, string> = {
  split: "เทียบแผนเหมาจ่ายกับแผนแยกจ่ายที่มีเพดานแต่ละหมวด",
  limit: "วงเงินค่ารักษาต่อปีเป็นหลอดที่ค่อยๆ ลดลงตามที่ใช้",
  room: "ค่าห้องจริงต่อคืนเทียบกับที่แผนจ่าย",
  overflow: "บิลที่เกินวงเงิน แล้วส่วนต่างที่ต้องจ่ายเอง",
  waiting: "ช่วงรอคอยหลังเริ่มสัญญา ก่อนเคลมโรคบางกลุ่มได้",
  cashless: "เข้าโรงพยาบาลในเครือข่ายแล้วไม่ต้องสำรองจ่าย ตามเงื่อนไขของแผน",
  groupgap: "สวัสดิการประกันกลุ่มจากที่ทำงานที่จ่ายได้ไม่พอ",
  agecost: "เบี้ยสุขภาพต่อปีที่สูงขึ้นตามช่วงอายุ",
};
/** whether คลิปเล่าเรื่อง keeps this look on this topic: the info-route looks (INFO_ARTS) only on the shelves told in points */
const lookFits = (topic: StoryTopic, look: string): boolean => !infoArt(look) || INFO_SHELVES.includes(topicOf(topic)!.shelf);
const readyDevices: LibraryItem[] = DEVICES.map((d) => {
  const topic = DEVICE_TOPIC[d.key];
  return {
    id: d.key, type: "device", name: d.name, tells: DEVICE_TELLS[d.key], product: "health", ready: true,
    uses: [storyUse("ทำคลิปเล่าเรื่อง", { topic }), promptUse("ทำคลิปตามโจทย์")],
    preview: `/library/${d.key}-paper.jpg`,
    // the look shown in the detail goes with its links; a look the topic cannot keep is left out of the link, not sent to be dropped
    looks: DEVICE_LOOK_ORDER.map((id): LibraryLook => {
      const look = STORY_LOOKS.find((l) => l.art === id)!;
      return {
        id, name: look.name, preview: `/library/${d.key}-${id}.jpg`,
        uses: [storyUse("ทำคลิปเล่าเรื่อง", { topic, ...(lookFits(topic, id) ? { look: id } : {}) }), promptUse("ทำคลิปตามโจทย์", { style: look.style })],
      };
    }),
  };
});

const readyFormats: LibraryItem[] = [
  { id: "format-quote", type: "format", name: "คลิปขายแผน", tells: "จากใบเสนอ เปิดด้วยตัวเลข ราคา ทุน เงื่อนไข ติดต่อ", product: "all", ready: true, uses: [quoteUse()] },
  { id: "format-story", type: "format", name: "เล่าเรื่องความรู้", tells: "คำถาม อธิบาย ตัวอย่าง สรุป เล่าความรู้ประกันให้เข้าใจง่าย", product: "all", ready: true, uses: [storyUse("ทำคลิปเล่าเรื่อง")] },
  ...PROMPT_FORMATS.map((f): LibraryItem => ({
    id: f.id, type: "format", name: f.name, product: "all", ready: true,
    tells: f.id === "free" ? "ตามบทที่ AI เขียน 4–12 ฉาก ภาพ AI ทุกฉาก"
      : f.id === "drama3" ? "ชีวิตปกติ เหตุไม่คาดฝัน ทางออก ใน 3 ฉาก"
      : "อาการ ค่ารักษา ประกันจ่าย ส่วนที่จ่ายเอง ไม่ระบุชื่อลูกค้า",
    uses: [promptUse("ทำคลิปตามโจทย์", { format: f.id })],
  })),
];

const readyLooks: LibraryItem[] = [
  ...STORY_LOOKS.map((l): LibraryItem => ({
    id: `look-${l.art}`, type: "look", name: l.name, tells: l.tells, product: "all", ready: true,
    uses: [storyUse("ทำคลิปเล่าเรื่อง", { look: l.art, ...(infoArt(l.art) ? { topic: PLOT_TOPIC } : {}) }), promptUse("ทำคลิปตามโจทย์", { style: l.style })],
    preview: `/library/look-${l.art}.jpg`,
  })),
  { id: "look-glass", type: "look", name: THEME_LABELS.glass.name, tells: "การ์ดโปร่งแสงซ้อนกัน หน้าตาทันสมัย", product: "all", ready: true, uses: [quoteUse()] },
  { id: "look-sticky", type: "look", name: THEME_LABELS.sticky.name, tells: "ข้อความเป็นโน้ตกระดาษแปะบนโต๊ะ", product: "all", ready: true, uses: [quoteUse()] },
];

const MOOD_NAME: Record<(typeof MUSIC_MOODS)[number], string> = { warm: "อบอุ่น", bright: "สดใส", calm: "สงบ" };
const readyFx: LibraryItem[] = [
  ...MUSIC_MOODS.map((m): LibraryItem => ({
    id: `fx-music-${m}`, type: "fx", name: `เพลงพื้นหลัง ${MOOD_NAME[m]}`, tells: "เพลงตามอารมณ์ของคลิป เลือกให้ตามสินค้า", product: "all", ready: true, uses: [quoteUse()],
  })),
  { id: "fx-sound-beats", type: "fx", name: "เสียงเอฟเฟกต์ตรงจังหวะสำคัญ", tells: "เสียงตอนตัวเลขเด้งและจังหวะเปลี่ยนฉาก", product: "all", ready: true, uses: [quoteUse()] },
];

const n = (type: LibraryType, product: LibraryProduct, id: string, name: string, tells: string): LibraryItem =>
  ({ id, type, name, tells, product, ready: false, uses: [] });
const dev = (product: LibraryProduct, id: string, name: string, tells: string) => n("device", product, `device-${id}`, name, tells);

/** planned, not built: from the mockup's "new" marks */
const unbuilt: LibraryItem[] = [
  // formats
  n("format", "all", "format-news", "ข่าวด่วน", "พาดหัว ตัวเลข ความเห็นตัวแทน สรุป แถบข่าววิ่ง"),
  n("format", "all", "format-quiz", "เกมตอบคำถาม", "คำถาม 3 ตัวเลือก นับถอยหลัง เฉลย ชวนคอมเมนต์"),
  n("format", "all", "format-top5", "ท็อป 5", "นับอันดับ 5 ถึง 1 เช่น 5 โรคที่ค่ารักษาแพงที่สุด"),
  n("format", "all", "format-pov", "ก่อน–หลัง / POV", "ก่อนมีประกัน จุดเปลี่ยน หลังมีประกัน แบบสั้นตามเทรนด์"),
  n("format", "all", "format-day-in-life", "วันหนึ่งของ…", "เช้า เที่ยง เย็น เหตุการณ์ บทเรียน เช่น วันหนึ่งของพยาบาล"),
  n("format", "all", "format-podcast", "พอดแคสต์สองคน", "ถามตอบสองเสียง สองหน้า คำบรรยายเต็ม"),
  n("format", "all", "format-agent-talk", "ตัวแทนพูดหน้ากล้อง + กราฟิก", "ตัวแทนพูด มีกราฟิกเด้งประกอบ แล้วปิดด้วยการติดต่อ"),
  n("format", "all", "format-mascot-series", "ซีรีส์น้องโล่", "ตอนสั้นที่มีมาสคอตเป็นตัวละครประจำ"),
  n("format", "all", "format-long-infographic", "อินโฟกราฟิกยาว", "บทนำ 3–5 ช่วง สรุป ความยาว 3–5 นาที สำหรับ YouTube"),
  // looks: AI picture styles (the system-drawn ไวต์บอร์ด นีออน บลูพริ้นท์ are built, in STORY_LOOKS)
  n("look", "all", "ai-style-3d", "การ์ตูน 3D", "ภาพ AI ตัวการ์ตูนสามมิติสีสด"),
  n("look", "all", "ai-style-clay", "ดินเคลย์", "ภาพ AI เหมือนปั้นจากดินน้ำมัน"),
  n("look", "all", "ai-style-anime", "อนิเมะ", "ภาพ AI สไตล์อนิเมะญี่ปุ่น"),
  n("look", "all", "ai-style-watercolor", "สีน้ำ", "ภาพ AI สีน้ำนุ่มๆ"),
  n("look", "all", "ai-style-isometric", "ไอโซเมตริก", "ภาพ AI มุมมองสามมิติแบบเมืองจำลอง"),
  n("look", "all", "ai-style-magazine-collage", "ตัดแปะนิตยสาร", "ภาพ AI แบบตัดแปะจากนิตยสาร"),
  n("look", "all", "ai-style-thai-pattern", "ลายไทยร่วมสมัย", "ภาพ AI ลายไทยในโทนสมัยใหม่"),
  n("look", "all", "ai-style-pixel", "พิกเซล", "ภาพ AI แบบเกมพิกเซล"),
  // devices: general (family)
  dev("all", "doctor-patient", "หมอ–คนไข้", "ฉากหมอคุยกับคนไข้ในห้องตรวจ"),
  dev("all", "agent-with-client", "ตัวแทนนั่งคุยกับลูกค้า", "ตัวแทนนั่งอธิบายแผนกับลูกค้าที่โต๊ะ"),
  dev("all", "emotions", "อารมณ์: กังวล ยิ้ม ป่วย กอด", "ตัวละครเปลี่ยนสีหน้าตามเรื่อง"),
  dev("saving", "flip-calendar", "ปฏิทินพลิก", "ปฏิทินพลิกให้เห็นเวลาเดิน"),
  dev("all", "ticking-clock", "นาฬิกาเดิน", "เข็มนาฬิกาหมุนตามเสียงเล่า"),
  dev("all", "before-after-days", "ก่อน–หลัง สลับวัน", "สลับวันธรรมดากับวันที่เกิดเหตุ"),
  dev("all", "rewind", "ย้อนเวลากลับไป", "ภาพย้อนกลับไปก่อนเกิดเหตุ"),
  dev("all", "big-number-count", "ตัวเลขใหญ่นับขึ้น", "ตัวเลขสำคัญนับขึ้นกลางจอ"),
  dev("all", "long-receipt", "ใบเสร็จค่ารักษายาว", "ใบเสร็จยาวไหลลงให้เห็นว่าค่ารักษาบวม"),
  dev("all", "growing-jar", "กระปุกโตทุกปี", "กระปุกเงินที่ใหญ่ขึ้นทุกปี"),
  dev("all", "inflation-eats", "เงินเฟ้อกินเงินเก็บ", "เงินก้อนเดิมซื้อของได้น้อยลง"),
  dev("all", "cross-tick-sides", "✗/✓ สองฝั่ง", "สองฝั่ง ฝั่งที่ไม่ผ่านกากบาท ฝั่งที่ผ่านติ๊กถูก"),
  dev("all", "fork-paths", "ทางแยกสองเส้นทาง", "ทางแยกสองทาง ผลลัพธ์ต่างกัน"),
  dev("all", "balance-scale", "ตาชั่ง", "ตาชั่งเทียบสองข้าง"),
  dev("all", "checklist-ticks", "เช็กลิสต์ติ๊กตามเสียง", "รายการติ๊กถูกทีละข้อตามที่พูด"),
  dev("all", "policy-highlight", "กรมธรรม์ไฮไลต์", "หน้ากรมธรรม์ที่ไฮไลต์ข้อสำคัญ"),
  dev("all", "flip-term-card", "การ์ดคำศัพท์พลิก", "การ์ดพลิกจากคำศัพท์เป็นความหมาย"),
  dev("all", "umbrella", "ร่มกันฝน", "เปรียบประกันกับร่มที่กางกันฝน"),
  dev("all", "house-pillar", "เสาหลักของบ้าน", "เปรียบผู้หาเลี้ยงครอบครัวกับเสาบ้าน"),
  dev("all", "arrow-shield", "โล่กันลูกศร", "โล่รับลูกศรแทนเจ้าของ"),
  dev("all", "life-ring", "ห่วงชูชีพ", "ห่วงชูชีพโยนให้ตอนจมน้ำ"),
  dev("all", "safety-net", "ตาข่ายนิรภัย", "ตาข่ายรองรับตอนตกลงมา"),
  dev("all", "seed-to-tree", "เมล็ดโตเป็นต้นไม้", "เมล็ดเล็กๆ โตเป็นต้นไม้ใหญ่"),
  dev("all", "bridge", "สะพานข้ามช่วงยาก", "สะพานข้ามช่วงเวลาที่ลำบาก"),
  dev("all", "place-hospital", "โรงพยาบาล", "ฉากหลังโรงพยาบาลที่ระบบวาด"),
  dev("all", "place-or-icu", "ห้องผ่าตัด / ICU", "ฉากหลังห้องผ่าตัดหรือ ICU ที่ระบบวาด"),
  dev("all", "place-office", "ออฟฟิศ", "ฉากหลังที่ทำงานที่ระบบวาด"),
  dev("all", "place-school", "โรงเรียน", "ฉากหลังโรงเรียนที่ระบบวาด"),
  dev("all", "place-road", "ถนน (ไม่แสดงความรุนแรง)", "ฉากหลังถนน ไม่แสดงภาพอุบัติเหตุรุนแรง"),
  dev("all", "text-chat", "แชตข้อความ", "ข้อความแชตเด้งขึ้นทีละบับเบิล"),
  dev("all", "word-by-word", "คำโผล่ทีละคำ", "คำบนจอโผล่ตามเสียงพูด"),
  dev("all", "word-highlighter", "ปากกาไฮไลต์คำ", "ปากกาขีดไฮไลต์คำสำคัญ"),
  dev("all", "news-headline", "พาดหัวข่าว", "ข้อความพาดหัวข่าวเด้งขึ้นเต็มจอ เหมือนข่าวด่วน"),
  dev("all", "social-post", "โพสต์โซเชียล", "โพสต์แบบโซเชียลมีเดียบนจอ"),
  dev("all", "camera-pan", "แพนข้ามภาพ", "กล้องเลื่อนข้ามภาพนิ่ง"),
  dev("all", "camera-spotlight", "โฟกัสวงกลม", "วงกลมโฟกัสจุดสำคัญในภาพ"),
  dev("all", "camera-depth", "ภาพแยกชั้นลึก", "ภาพนิ่งแยกชั้นหน้าหลังขยับต่างกัน"),
  dev("all", "split-two-pictures", "สองภาพครึ่งจอ", "สองภาพเทียบกันครึ่งจอ"),
  dev("all", "day-night", "สลับวัน–คืน", "ภาพเดียวกันสลับกลางวันกลางคืน"),
  dev("all", "cta-chat-button", "ปุ่มชวนทัก", "ปุ่มชวนทักแชตตอนจบคลิป"),
  dev("all", "countdown-open", "นับถอยหลังเปิดคลิป", "นับถอยหลังก่อนเริ่มเรื่อง"),
  // devices: health
  dev("health", "ipd-opd", "IPD กับ OPD สองประตู", "ผู้ป่วยในกับผู้ป่วยนอก คนละประตู คนละวงเงิน"),
  dev("health", "copay", "Co-payment แบ่งบิล", "บิลแบ่งกันจ่าย ลูกค้าส่วนหนึ่ง ประกันส่วนหนึ่ง"),
  dev("health", "deductible", "ส่วนรับผิดชอบแรก (Deductible)", "ส่วนแรกที่ลูกค้าจ่ายก่อน ประกันจ่ายส่วนที่เกิน"),
  dev("health", "medical-inflation", "ค่ารักษาแพงขึ้นทุกปี", "เส้นราคาค่ารักษาที่ไต่ขึ้นทุกปี ทำให้ทุนเดิมไม่พอ"),
  dev("health", "renewable-to-age", "ต่ออายุได้ถึงอายุ…", "เส้นเวลาที่ต่ออายุได้ถึงอายุที่กำหนด"),
  dev("health", "preexisting", "โรคที่เป็นมาก่อน / ข้อยกเว้น", "โรคที่เป็นก่อนทำประกัน และข้อยกเว้นหลัก"),
  dev("health", "hospital-map", "แผนที่ รพ. ในเครือ", "แผนที่โรงพยาบาลในเครือข่าย"),
  dev("health", "tax-health-premium", "ลดหย่อนภาษีค่าเบี้ยสุขภาพ", "เบี้ยที่จ่ายแล้วนำไปลดหย่อนภาษีได้เท่าไร"),
  dev("health", "health-for-parents", "ประกันสุขภาพให้พ่อแม่", "ซื้อประกันสุขภาพให้พ่อแม่ ลูกเป็นผู้จ่าย"),
  dev("health", "ci-lump-sum", "เงินก้อนตอนวินิจฉัย", "เงินก้อนเข้ามาทันทีที่แพทย์วินิจฉัย"),
  dev("health", "ci-income-stops", "รายได้หยุดระหว่างรักษา", "รายได้หายไประหว่างพักรักษาตัว"),
  dev("health", "ci-uncovered-costs", "ค่าใช้จ่ายที่ประกันสุขภาพไม่จ่าย", "ค่าใช้จ่ายนอกบิลโรงพยาบาลที่ประกันสุขภาพไม่จ่าย"),
  dev("health", "group-cost-per-head", "ต้นทุนต่อหัวต่อเดือน", "ต้นทุนประกันกลุ่มต่อพนักงานต่อเดือน"),
  dev("health", "pa-cost-per-visit", "ค่ารักษาอุบัติเหตุต่อครั้ง", "ค่ารักษาอุบัติเหตุแต่ละครั้งที่ PA จ่าย"),
  dev("health", "pa-daily-benefit", "ชดเชยรายวัน", "เงินชดเชยรายวันระหว่างนอนโรงพยาบาล"),
  // devices: life
  dev("life", "beneficiary", "ผู้รับประโยชน์", "ใครได้รับเงินเมื่อเกิดเหตุ"),
  dev("life", "life-sum-needed", "ทุนชีวิตที่ควรมี (หนี้ + ค่าใช้จ่าย)", "รวมหนี้และค่าใช้จ่ายครอบครัวเป็นทุนที่ควรมี"),
  // devices: saving
  dev("saving", "split-money-home", "แบ่งเงินให้คนในบ้าน", "เงินก้อนแบ่งไปถึงคนในครอบครัว"),
  dev("saving", "three-generations", "ส่งต่อสามรุ่น", "ส่งต่อเงินจากรุ่นสู่รุ่นสามรุ่น"),
  dev("saving", "pension-inflation", "เงินเฟ้อกับเงินบำนาญ", "บำนาญเท่าเดิมซื้อของได้น้อยลง"),
  dev("saving", "irr-per-year", "ผลตอบแทนเฉลี่ยต่อปี (IRR)", "ผลตอบแทนเฉลี่ยต่อปีของแผน เทียบกับฝากธนาคาร"),
  dev("saving", "past-returns-chart", "กราฟผลตอบแทนย้อนหลัง", "เส้นกราฟผลตอบแทนของกองทุนในอดีต"),
  dev("saving", "fund-risk-1-8", "ระดับความเสี่ยงกองทุน 1–8", "สเกลความเสี่ยงกองทุนตั้งแต่ 1 ถึง 8"),
  dev("saving", "portfolio-mix", "สัดส่วนการลงทุน", "วงกลมสัดส่วนการลงทุนในแต่ละกอง"),
  dev("saving", "tax-cap-total", "เพดานลดหย่อนรวม", "เพดานลดหย่อนภาษีรวมของเบี้ยประกัน"),
  dev("saving", "tax-refund-by-bracket", "ภาษีที่ได้คืนตามฐาน", "ภาษีที่ได้คืนตามฐานภาษีของลูกค้า"),
  // fx
  n("fx", "all", "fx-transition-circle", "ทรานสิชัน วงกลมขยาย", "เปลี่ยนฉากด้วยวงกลมที่ขยายออก"),
  n("fx", "all", "fx-transition-flip", "ทรานสิชัน พลิกการ์ด", "ฉากพลิกเหมือนการ์ด"),
  n("fx", "all", "fx-transition-zoom", "ทรานสิชัน ซูมทะลุ", "ซูมทะลุเข้าไปในฉากถัดไป"),
  n("fx", "all", "fx-transition-torn", "ทรานสิชัน กระดาษฉีก", "ฉากฉีกเหมือนกระดาษ"),
  n("fx", "all", "fx-transition-ink", "ทรานสิชัน หมึกซึม", "ฉากถัดไปซึมเข้ามาเหมือนหมึก"),
  n("fx", "all", "fx-transition-shake", "ทรานสิชัน สั่นจอตอนช็อก", "จอสั่นตอนตัวเลขช็อก"),
  n("fx", "all", "fx-coin-rain", "เหรียญโปรย", "เหรียญทองโปรยลงมาเมื่อพูดถึงเงินคืนหรือผลตอบแทน"),
  n("fx", "all", "fx-hearts", "หัวใจลอย", "หัวใจลอยขึ้นบนจอ"),
  n("fx", "all", "fx-fireworks", "พลุฉลอง", "พลุระเบิดตอนฉลอง"),
  n("fx", "all", "fx-rain", "ฝนตก", "เม็ดฝนโปรยลงมาในฉากเหตุไม่คาดฝัน"),
  n("fx", "all", "fx-leaves", "ใบไม้ปลิว", "ใบไม้ปลิวผ่านฉากแห่งกาลเวลา"),
  n("fx", "all", "fx-sparkle", "ประกายวิบวับ", "ประกายวิบวับเน้นตัวเลขหรือคำสำคัญ"),
  n("fx", "all", "fx-sound-tick", "เสียงติ๊กเช็กลิสต์", "เสียงติ๊กตอนติ๊กถูกรายการ"),
  n("fx", "all", "fx-sound-money-in", "เสียงเงินเข้า", "เสียงเหรียญตอนเงินเข้า"),
  n("fx", "all", "fx-sound-heartbeat", "เสียงเครื่องวัดหัวใจ", "เสียงปี๊บของเครื่องวัดหัวใจ"),
  n("fx", "all", "fx-sound-chat-pop", "เสียงป๊อปบับเบิลแชต", "เสียงป๊อปตอนข้อความแชตขึ้น"),
  n("fx", "all", "fx-sound-whoosh", "เสียงวูชตอนเปลี่ยนฉาก", "เสียงลมวูบตอนฉากเปลี่ยน"),
  n("fx", "all", "fx-sound-typing", "เสียงกดแป้นพิมพ์", "เสียงกดแป้นพิมพ์ตอนข้อความขึ้น"),
  n("fx", "all", "fx-music-tense", "เพลงลุ้นตื่นเต้น", "เพลงจังหวะลุ้น"),
  n("fx", "all", "fx-music-hopeful", "เพลงเศร้าแล้วมีหวัง", "เพลงเริ่มเศร้าแล้วค่อยมีหวัง"),
  n("fx", "all", "fx-music-gameshow", "เพลงเกมโชว์", "เพลงสไตล์เกมโชว์"),
  n("fx", "all", "fx-music-news", "เพลงข่าว", "เพลงเปิดข่าว"),
  n("fx", "all", "fx-cut-hook", "ฮุก 3 วินาทีแรก", "เปิดคลิปด้วยประโยคดึงคนดูใน 3 วินาทีแรก"),
  n("fx", "all", "fx-cut-on-beat", "ตัดตามบีตเพลง", "จังหวะตัดฉากตรงกับบีตเพลง"),
  n("fx", "all", "fx-cut-punch-zoom", "ซูมกระแทก", "ซูมเข้าแรงๆ ตอนเน้นคำ"),
  n("fx", "all", "fx-cut-countdown", "ตัวเลขนับถอยหลัง", "ตัวเลข 3 2 1 นับถอยหลังเพิ่มความลุ้น"),
  n("fx", "all", "fx-cut-pov-text", "ข้อความ POV", "ข้อความ POV แบบคลิปสั้น"),
  n("fx", "all", "fx-cut-speed-ramp", "สปีดช้า–เร็ว", "ภาพช้าลงแล้วเร็วขึ้นตามจังหวะ"),
];

export const LIBRARY: LibraryItem[] = [...readyFormats, ...readyDevices, ...readyLooks, ...readyFx, ...unbuilt];

const BY_ID = new Map(LIBRARY.map((i) => [i.id, i]));
export const libraryItem = (id: string): LibraryItem | undefined => BY_ID.get(id);

/** the uses a viewer may follow, of a piece or one of its looks: those whose tool is open to them */
export const usesFor = (item: { uses: readonly LibraryUse[] }, open: Record<LibraryTool, boolean>): LibraryUse[] => item.uses.filter((u) => open[u.tool]);
