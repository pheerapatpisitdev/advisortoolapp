import { LANGS, type Lang } from "@/lib/ihealthy-lang";

/**
 * The clip's own words on screen, in the language it is told in (owner, 2026-10-15, mockup
 * https://claude.ai/artifact/H3HkP5iMpLD1rvEiCtdngb, option ก): iHealthy Ultra in the page's
 * five languages. The plan's rows, the instalments and who it is for come from the iHealthy
 * card read in that language (ihealthy-card.ts `l=`); these are the words the clip adds.
 *
 * The Thai is what every clip said before, word for word, and stays the words of every other
 * product: only an iHealthy clip carries a language.
 */

export type VideoLang = Lang;
export const VIDEO_LANGS = LANGS;

/** what a clip's input says, or Thai: anything else, and every clip made before there was a choice */
export const readVideoLang = (v: unknown): VideoLang => ((LANGS as readonly unknown[]).includes(v) ? (v as VideoLang) : "th");

export interface VideoWords {
  /** after a figure on screen */
  baht: string;
  /** the customer's name as it is shown and greeted: คุณ<ชื่อ> in Thai, the name alone elsewhere */
  customer: (name: string) => string;
  /** over the opening, before the name */
  preparedFor: string;
  /** the closing card's heading */
  contactFor: (name: string) => string;
  contactMore: string;
  /** the closing card's two large lines; Thai ends as the narrator does */
  contactLines: (narrator: "F" | "M") => [string, string];
  phone: string;
  /** the price scene's heading and the line over its big figure */
  priceTitle: string;
  firstYearMonthly: string;
  /** the highlighted line under the opening figure */
  leadMark: (monthly: string) => string;
  coverTitle: (plan: string) => string;
  compareHeader: string;
  compareTitle: string;
  /** the comparison's rows: the yearly limit, the room, outpatients, the monthly price */
  compareRows: [string, string, string, string];
  /** the Motion comparison's last label, over the monthly price */
  perMonth: string;
  renewNote: (age: number) => string;
  /** "paid as charged" short enough for a row of the clip, where the card's own words run long */
  asCharged: string;
  /** the large lines' spacing: Burmese stacks marks above and below its letters */
  lineHeight: number;
}

const TH: VideoWords = {
  baht: "บาท",
  customer: (name) => `คุณ${name}`,
  preparedFor: "จัดทำสำหรับ",
  contactFor: (name) => `สำหรับ คุณ${name}`,
  contactMore: "สนใจรายละเอียดเพิ่มเติม",
  contactLines: (narrator) => ["ทักมาคุยกันได้เลย", narrator === "M" ? "ยินดีช่วยดูแผนให้ครับ" : "ยินดีช่วยดูแผนให้ค่ะ"],
  phone: "โทร",
  priceTitle: "เบี้ยประกันปีแรก",
  firstYearMonthly: "ปีแรก เดือนละ",
  leadMark: (m) => `เบี้ยปีแรก เดือนละ ${m} บาท`,
  coverTitle: (plan) => `แผน ${plan} คุ้มครอง`,
  compareHeader: "เลือกแผนที่ใช่",
  compareTitle: "เทียบแผน iHealthy Ultra",
  compareRows: ["วงเงิน/ปี", "ค่าห้อง/วัน", "ผู้ป่วยนอก/ปี", "รายเดือน"],
  perMonth: "เดือนละ",
  renewNote: (age) => `ต่ออายุได้ถึงอายุ ${age} · เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น`,
  asCharged: "ตามที่จ่ายจริง",
  lineHeight: 1.3,
};

const EN: VideoWords = {
  baht: "baht",
  customer: (name) => name,
  preparedFor: "Prepared for",
  contactFor: (name) => `For ${name}`,
  contactMore: "Want to know more?",
  contactLines: () => ["Message me any time", "Happy to help you choose"],
  phone: "Tel",
  priceTitle: "First-year premium",
  firstYearMonthly: "First year, per month",
  leadMark: (m) => `First year ${m} baht a month`,
  coverTitle: (plan) => `What the ${plan} plan covers`,
  compareHeader: "Find the right plan",
  compareTitle: "Compare iHealthy Ultra plans",
  compareRows: ["Limit / year", "Room / day", "Outpatient / year", "Monthly"],
  perMonth: "Per month",
  renewNote: (age) => `Renewable to age ${age} · first-year premium; later years are priced on the higher age`,
  asCharged: "As charged",
  lineHeight: 1.3,
};

const ZH: VideoWords = {
  baht: "泰铢",
  customer: (name) => name,
  preparedFor: "专为",
  contactFor: (name) => `${name} 专属`,
  contactMore: "想了解更多？",
  contactLines: () => ["欢迎随时留言", "乐意帮您挑选计划"],
  phone: "电话",
  priceTitle: "首年保费",
  firstYearMonthly: "首年 每月",
  leadMark: (m) => `首年每月 ${m} 泰铢`,
  coverTitle: (plan) => `${plan} 计划保障`,
  compareHeader: "选择适合的计划",
  compareTitle: "iHealthy Ultra 计划对比",
  compareRows: ["每年额度", "房费/天", "门诊/年", "月缴"],
  perMonth: "每月",
  renewNote: (age) => `可续保至 ${age} 岁 · 首年保费，之后按增长的年龄计算`,
  asCharged: "按实际费用",
  lineHeight: 1.3,
};

const RU: VideoWords = {
  baht: "бат",
  customer: (name) => name,
  preparedFor: "Для",
  contactFor: (name) => `Для ${name}`,
  contactMore: "Хотите узнать больше?",
  contactLines: () => ["Напишите мне", "Помогу выбрать план"],
  phone: "Тел.",
  priceTitle: "Взнос за первый год",
  firstYearMonthly: "Первый год, в месяц",
  leadMark: (m) => `Первый год ${m} бат в месяц`,
  coverTitle: (plan) => `Что покрывает план ${plan}`,
  compareHeader: "Выберите свой план",
  compareTitle: "Сравнение планов iHealthy Ultra",
  compareRows: ["Лимит в год", "Палата в день", "Амбулаторно в год", "В месяц"],
  perMonth: "В месяц",
  renewNote: (age) => `Продление до ${age} лет · взнос за первый год, далее по возрасту`,
  asCharged: "По факту",
  lineHeight: 1.3,
};

const MY: VideoWords = {
  baht: "ဘတ်",
  customer: (name) => name,
  preparedFor: "အတွက်",
  contactFor: (name) => `${name} အတွက်`,
  contactMore: "အသေးစိတ် သိချင်ပါသလား",
  contactLines: () => ["အချိန်မရွေး မက်ဆေ့ချ်ပို့ပါ", "အစီအစဉ်ရွေးဖို့ ကူညီပါမယ်"],
  phone: "ဖုန်း",
  priceTitle: "ပထမနှစ် ပရီမီယံ",
  firstYearMonthly: "ပထမနှစ် တစ်လ",
  leadMark: (m) => `ပထမနှစ် တစ်လ ${m} ဘတ်`,
  coverTitle: (plan) => `${plan} အစီအစဉ် အကာအကွယ်`,
  compareHeader: "သင့်တော်သော အစီအစဉ် ရွေးပါ",
  compareTitle: "iHealthy Ultra အစီအစဉ် နှိုင်းယှဉ်ချက်",
  compareRows: ["တစ်နှစ် ကန့်သတ်ငွေ", "အခန်းခ/ရက်", "ပြင်ပလူနာ/နှစ်", "လစဉ်"],
  perMonth: "တစ်လ",
  renewNote: (age) => `အသက် ${age} အထိ သက်တမ်းတိုးနိုင် · ပထမနှစ် ပရီမီယံ၊ နောက်နှစ်များ အသက်အလိုက်`,
  asCharged: "ကုန်ကျသလောက်",
  lineHeight: 1.6,
};

export const VIDEO_WORDS: Record<VideoLang, VideoWords> = { th: TH, en: EN, zh: ZH, ru: RU, my: MY };

/**
 * The Google face a language's letters need beyond Plex, which has Thai and Latin: the same
 * three the iHealthy card draws with (src/app/api/ihealthy-card/draw.tsx).
 */
export const SCRIPT_FAMILY: Partial<Record<VideoLang, string>> = {
  zh: "Noto Sans SC",
  ru: "Noto Sans",
  my: "Noto Sans Myanmar",
};

/** every letter the clip's own words can put on screen in a language, for cutting its face down */
export function wordsLetters(lang: VideoLang): string {
  return Object.values(VIDEO_WORDS[lang]).map((v) => (typeof v === "function" ? String(v) : JSON.stringify(v))).join("");
}

/** the words of the language a clip's facts were read in */
export const wordsOf = (f: { lang?: VideoLang }): VideoWords => VIDEO_WORDS[f.lang ?? "th"];

/** "Prepared for Anna" in its two pieces, the name marked: after the words, except in Burmese, where it comes first */
export function preparedLine(w: VideoWords, name: string): { text: string; name: boolean }[] {
  const who = { text: w.customer(name), name: true };
  const words = { text: w.preparedFor, name: false };
  return w === MY ? [who, words] : [words, who];
}
