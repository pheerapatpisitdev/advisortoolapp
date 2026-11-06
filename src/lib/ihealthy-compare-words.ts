import type { Lang } from "@/lib/ihealthy-lang";

/**
 * The compare page's own words. Beside WORDS rather than inside it because ihealthy-words.ts
 * is part of the drawing code the clips' Remotion image is built from.
 */
export interface CompareWords {
  /** what the page is called, after "iHealthy Ultra" */
  title: string;
  metaDescription: string;
  /** the form's label over the three instalments */
  paymentLabel: string;
  /** the premium row's name, given the instalment */
  premiumRow: (mode: string) => string;
  /** what the premium is made of */
  note: (base: string, sum: string, withDailyCash: boolean) => string;
  /** said over the table when an age cannot buy all four */
  agePlans: (plans: number) => string;
  /** the link to /ihealthy-ultra, which has the rest */
  morePlans: string;
  /** what the send panel calls the picture */
  picture: string;
  summaryTitle: string;
  maxBenefit: string;
  room: string;
  perYear: string;
  opdNone: string;
  /** after the OPD figure: it is one limit with physiotherapy */
  opdShared: string;
  lifeAll: (sum: string) => string;
}

export const COMPARE_WORDS: Record<Lang, CompareWords> = {
  th: {
    title: "เทียบแผน",
    paymentLabel: "งวดชำระ",
    metaDescription: "เทียบเบี้ยและความคุ้มครอง iHealthy Ultra ทุกแผนในตารางเดียว",
    premiumRow: (mode) => `เบี้ย${mode}`,
    note: (base, sum, cash) => `เบี้ยรวม ${base} ทุนชีวิต ${sum} บาท, iHealthy Ultra${cash ? " และค่าชดเชยรายวัน" : ""} · คุ้มครองในประเทศไทย ไม่มีค่าใช้จ่ายส่วนแรก`,
    agePlans: (n) => `อายุนี้ซื้อได้ ${n} แผน`,
    morePlans: "ดูแผนไดมอนด์ แพลทินัม และตั้งค่าอื่น ๆ",
    picture: "ตารางเทียบแผน",
    summaryTitle: "สรุปแผนประกันสุขภาพ iHealthy Ultra",
    maxBenefit: "ผลประโยชน์รวมสูงสุด",
    room: "ค่าห้องและอาหาร",
    perYear: "/ปี",
    opdNone: "ไม่มี",
    opdShared: "(รวมกายภาพบำบัด)",
    lifeAll: (sum) => `ทุกแผนทุนประกันชีวิต ${sum}`,
  },
  en: {
    title: "Plan comparison",
    paymentLabel: "Payment",
    metaDescription: "Compare every iHealthy Ultra plan's premium and cover in one table.",
    premiumRow: (mode) => `${mode} premium`,
    note: (base, sum, cash) => `Total of ${base} with ${sum} baht life cover, iHealthy Ultra${cash ? " and daily cash" : ""} · Cover in Thailand, no deductible`,
    agePlans: (n) => `${n} plans are available at this age`,
    morePlans: "See Diamond, Platinum and other options",
    picture: "Plan comparison table",
    summaryTitle: "iHealthy Ultra plan summary",
    maxBenefit: "Maximum benefit",
    room: "Room and board",
    perYear: "/year",
    opdNone: "None",
    opdShared: "(shared with physiotherapy)",
    lifeAll: (sum) => `Life cover on every plan: ${sum}`,
  },
  zh: {
    title: "方案对比",
    paymentLabel: "缴费方式",
    metaDescription: "在一张表中比较 iHealthy Ultra 各方案的保费与保障。",
    premiumRow: (mode) => `${mode}保费`,
    note: (base, sum, cash) => `保费合计：${base}（寿险保额 ${sum} 泰铢）、iHealthy Ultra${cash ? "及每日津贴" : ""} · 保障范围泰国，无免赔额`,
    agePlans: (n) => `此年龄可投保 ${n} 个方案`,
    morePlans: "查看钻石、铂金方案及其他选项",
    picture: "方案对比表",
    summaryTitle: "iHealthy Ultra 方案摘要",
    maxBenefit: "最高保障",
    room: "住院房费及餐费",
    perYear: "/年",
    opdNone: "无",
    opdShared: "（与物理治疗合计）",
    lifeAll: (sum) => `所有方案寿险保额 ${sum}`,
  },
  ru: {
    title: "Сравнение планов",
    paymentLabel: "Периодичность",
    metaDescription: "Сравните взносы и покрытие всех планов iHealthy Ultra в одной таблице.",
    premiumRow: (mode) => `Взнос: ${mode}`,
    note: (base, sum, cash) => `Итог: ${base} со страховой суммой ${sum} бат, iHealthy Ultra${cash ? " и суточные выплаты" : ""} · Покрытие в Таиланде, без франшизы`,
    agePlans: (n) => `В этом возрасте доступно планов: ${n}`,
    morePlans: "Diamond, Platinum и другие настройки",
    picture: "Таблица сравнения планов",
    summaryTitle: "Сводка планов iHealthy Ultra",
    maxBenefit: "Максимальная выплата",
    room: "Палата и питание",
    perYear: "/год",
    opdNone: "нет",
    opdShared: "(общий лимит с физиотерапией)",
    lifeAll: (sum) => `Страховая сумма по всем планам: ${sum}`,
  },
  my: {
    title: "အစီအစဉ်နှိုင်းယှဉ်ချက်",
    paymentLabel: "ပေးချေမှု",
    metaDescription: "iHealthy Ultra အစီအစဉ်အားလုံး၏ ပရီမီယံနှင့် အကာအကွယ်ကို ဇယားတစ်ခုတည်းတွင် နှိုင်းယှဉ်ပါ။",
    premiumRow: (mode) => `${mode} ပရီမီယံ`,
    note: (base, sum, cash) => `စုစုပေါင်း: ${base} (အသက်အာမခံ ${sum} ဘတ်), iHealthy Ultra${cash ? " နှင့် နေ့စဉ်ထောက်ပံ့ကြေး" : ""} · ထိုင်းနိုင်ငံအတွင်း အကာအကွယ်`,
    agePlans: (n) => `ဤအသက်အတွက် အစီအစဉ် ${n} ခု ဝယ်ယူနိုင်သည်`,
    morePlans: "Diamond၊ Platinum နှင့် အခြားရွေးချယ်စရာများ ကြည့်ရန်",
    picture: "အစီအစဉ်နှိုင်းယှဉ်ဇယား",
    summaryTitle: "iHealthy Ultra အစီအစဉ်အကျဉ်းချုပ်",
    maxBenefit: "အများဆုံးအကျိုးခံစားခွင့်",
    room: "အခန်းနှင့် အစားအသောက်",
    perYear: "/နှစ်",
    opdNone: "မရှိ",
    opdShared: "(ကိုယ်လက်လေ့ကျင့်ကုထုံးနှင့် စုပေါင်း)",
    lifeAll: (sum) => `အစီအစဉ်အားလုံး အသက်အာမခံ ${sum}`,
  },
};
