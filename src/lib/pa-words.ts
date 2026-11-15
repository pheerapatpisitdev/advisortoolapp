import type { Lang } from "@/lib/ihealthy-lang";
import { sumWords } from "@/lib/ci123-cta";
import {
  PA_RENEWAL_MAX, PA_WEEKLY_MAX_WEEKS, paPerDay, paPremium, paQuoteText, paSumAfterRenewals,
  type PaFamilyId, type PaQuoteFacts, type PaRow,
} from "@/lib/pa-plans";

/**
 * The /pa page in the five languages iHealthy Ultra is read in (owner, 2026-11-15, ก ก on mockup
 * https://claude.ai/artifact/SZvzGB3ZFMdjHbCA2G3rzW): the same switch, every word of the page,
 * and the copied text in the page's language. Plan names and codes stay as the company prints
 * them in every language. Thai is the page as it was built; the Thai copied text is still
 * `paQuoteText` itself, so the bot and the Thai page say the same thing.
 */
export interface PaWords {
  metaTitle: string;
  metaDescription: string;
  kind: string;
  facts: [string, string, string];
  taglines: Record<PaFamilyId, string>;
  familyLabel: string;
  planLabel: string;
  ageLabel: string;
  classLabel: string;
  /** an age in the picker; 0 is "under one" */
  age: (a: number) => string;
  /** a family's accepted ages, under its buttons */
  ages: (min: number, max: number) => string;
  /** a plan button's sum: "2 ล้าน", "2M" */
  sum: (n: number) => string;
  classesTaken: (plan: string, classes: string) => string;
  class4None: string;
  ageNotOk: (age: number, family: string, min: number, max: number) => string;
  childHint: (min: number) => string;
  premiumHead: (plan: string, code: string, cls: number) => string;
  perYear: string;
  /** the words either side of the day rate, which the page sets in its figure type */
  perDay: [string, string];
  coverHead: string;
  rows: Record<Exclude<PaRow["key"], "weekly">, string> & { weekly: (weeks: number) => string };
  renewal: string;
  smallPrint: string;
  allPlans: (family: string) => string;
  coverColumn: string;
  premiumRow: (cls: number) => string;
  dashNote: string;
  /** the study-only notice across the table; Thai is the notice's own default */
  watermark?: [string, string];
  footer: [string, string, string];
  /** the quote as the agent pastes it into a chat; Thai is `paQuoteText` */
  quote: (f: PaQuoteFacts) => string | undefined;
}

const baht = (n: number) => n.toLocaleString("en-US");

/** the figures every translated quote is built from, or undefined where the quote cannot be sold */
function quoteFigures(f: PaQuoteFacts) {
  const premium = paPremium(f.plan, f.cls);
  if (premium === null || f.age < f.family.ageMin || f.age > f.family.ageMax) return undefined;
  return { premium, day: paPerDay(premium), sixth: paSumAfterRenewals(f.plan), p: f.plan };
}

const MAX_PERCENT = Math.round(PA_RENEWAL_MAX * 100);

/** год / года / лет after a number */
function ruYears(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "год";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "года";
  return "лет";
}

const th: PaWords = {
  metaTitle: "PA — ประกันอุบัติเหตุส่วนบุคคล",
  metaDescription:
    "PA Classic, PA Platinum และ PA Max คุ้มครองอุบัติเหตุ 24 ชั่วโมงทั่วโลก เลือกแผนและขั้นอาชีพ ดูเบี้ยรายปีได้ทันที",
  kind: "ประกันอุบัติเหตุส่วนบุคคล",
  facts: ["คุ้มครอง 24 ชม. ทั่วโลก", "สัญญาปีต่อปี", "เบี้ยตามขั้นอาชีพ"],
  taglines: {
    classic: "คุ้มครองครบครันเรื่องอุบัติเหตุ",
    platinum: "เพิ่มค่าชดเชยรายสัปดาห์",
    max: "ทุนชีวิตสูงสุด ไม่มีค่ารักษาพยาบาล",
  },
  familyLabel: "แบบ",
  planLabel: "แผน · ทุนอุบัติเหตุ",
  ageLabel: "อายุ",
  classLabel: "ขั้นอาชีพ",
  age: (a) => (a === 0 ? "ต่ำกว่า 1 ปี" : `${a} ปี`),
  ages: (min, max) => `รับอายุ ${min === 0 ? "แรกเกิด" : min}–${max} ปี`,
  sum: sumWords,
  classesTaken: (plan, classes) => `${plan} รับขั้นอาชีพ ${classes}`,
  class4None: "ขั้น 4 ไม่รับทุกแบบ",
  ageNotOk: (age, family, min, max) => `อายุ ${age} ปี ซื้อ ${family} ไม่ได้ แบบนี้รับอายุ ${min}–${max} ปี`,
  childHint: (min) => `เด็กอายุต่ำกว่า ${min} ปี ดู PA Classic`,
  premiumHead: (plan, code, cls) => `เบี้ยประกัน · PA ${plan} (${code}) · ขั้นอาชีพ ${cls}`,
  perYear: "บาท ต่อปี",
  perDay: ["ตกวันละ", "บาท"],
  coverHead: "ความคุ้มครองจากอุบัติเหตุ (บาท)",
  rows: {
    death: "เสียชีวิต สูญเสียอวัยวะ หรือทุพพลภาพถาวรสิ้นเชิง จากอุบัติเหตุ",
    murder: "ถูกฆาตกรรมหรือลอบทำร้าย",
    motorcycle: "ขับขี่หรือโดยสารรถจักรยานยนต์",
    medical: "ค่ารักษาพยาบาลต่ออุบัติเหตุ (รวมรถจักรยานยนต์)",
    weekly: (w) => `ชดเชยทุพพลภาพชั่วคราวสิ้นเชิง ต่อสัปดาห์ (สูงสุด ${w} สัปดาห์)`,
  },
  renewal: "ต่ออายุปีที่ 2–6 ทุนชีวิตเพิ่มปีละ 5% · ปีที่ 6 ได้",
  smallPrint: "คุ้มครอง 24 ชั่วโมง ทั่วโลก · สัญญา 1 ปี ต่ออายุปีต่อปี · เบี้ยกำหนดตามลักษณะอาชีพ ไม่ขึ้นกับอายุหรือเพศ",
  allPlans: (family) => `ทุกแผนใน ${family} (บาท) · แตะคอลัมน์เพื่อเลือกแผน`,
  coverColumn: "ความคุ้มครอง",
  premiumRow: (c) => `เบี้ยรายปี ขั้นอาชีพ ${c}`,
  dashNote: "— แผนนี้ไม่รับขั้นอาชีพนั้น · ขั้นอาชีพ 4 ไม่รับทุกแบบ",
  footer: [
    "(1) เพิ่มจำนวนเงินเอาประกันภัยในปีต่ออายุ ปีละ 5% ของจำนวนเงินเอาประกันภัยตั้งต้น ตั้งแต่ปีกรมธรรม์ที่ 2–6 รวมสูงสุด 25% ต่ออายุได้ภายใน 31 วันหลังวันครบกำหนดโดยยังได้สิทธิ์เพิ่ม 5% แต่ไม่ได้รับความคุ้มครองในช่วงนั้น ความคุ้มครองใหม่เริ่มวันที่ชำระเบี้ยต่ออายุ หากชำระเกินช่วงดังกล่าวถือเป็นการซื้อกรมธรรม์ใหม่และไม่ได้รับสิทธิ์เพิ่ม 5%",
    "สัญญาประกันภัยมีระยะเวลา 1 ปี ต่ออายุได้ปีต่อปี เบี้ยประกันภัยกำหนดตามลักษณะการประกอบอาชีพ ผู้ขอเอาประกันภัยมีหน้าที่แถลงข้อความจริง การปกปิดหรือแถลงเท็จอาจทำให้บริษัทบอกล้างสัญญาและปฏิเสธการจ่ายค่าสินไหมทดแทนได้",
    "ข้อมูลนี้เป็นข้อมูลเบื้องต้นเพื่อประกอบการนำเสนอเท่านั้น ผู้ขอเอาประกันภัยควรศึกษาและทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง",
  ],
  quote: paQuoteText,
};

const en: PaWords = {
  metaTitle: "PA — Personal Accident Insurance",
  metaDescription:
    "PA Classic, PA Platinum and PA Max: 24-hour worldwide accident cover. Pick a plan and occupation class and see the yearly premium at once.",
  kind: "Personal Accident Insurance",
  facts: ["24-hour worldwide cover", "Renewable yearly", "Premium by occupation class"],
  taglines: {
    classic: "All-round accident cover",
    platinum: "Adds weekly compensation",
    max: "Highest life cover, no medical expenses",
  },
  familyLabel: "Product",
  planLabel: "Plan · Accident sum",
  ageLabel: "Age",
  classLabel: "Occupation class",
  age: (a) => (a === 0 ? "Under 1" : `${a} year${a === 1 ? "" : "s"}`),
  ages: (min, max) => `Ages ${min === 0 ? "newborn" : min}–${max}`,
  sum: (n) => (n < 1_000_000 ? `${baht(n / 1_000)}K` : `${baht(n / 1_000_000)}M`),
  classesTaken: (plan, classes) => `${plan} accepts occupation classes ${classes}`,
  class4None: "Class 4 is not accepted by any plan",
  ageNotOk: (age, family, min, max) => `At age ${age}, ${family} cannot be bought. It accepts ages ${min}–${max}`,
  childHint: (min) => `For children under ${min}, see PA Classic`,
  premiumHead: (plan, code, cls) => `Premium · PA ${plan} (${code}) · Class ${cls}`,
  perYear: "THB / year",
  perDay: ["About", "THB a day"],
  coverHead: "Accident cover (THB)",
  rows: {
    death: "Accidental death, dismemberment or total permanent disability",
    murder: "Murder or assault",
    motorcycle: "Riding or travelling on a motorcycle",
    medical: "Medical expenses per accident (incl. motorcycle)",
    weekly: (w) => `Temporary total disability, per week (up to ${w} weeks)`,
  },
  renewal: "Renewal years 2–6: sum +5% a year · year 6",
  smallPrint: "24-hour worldwide cover · 1-year contract, renewable yearly · Premium set by occupation, not by age or sex",
  allPlans: (family) => `All ${family} plans (THB) · Tap a column to choose the plan`,
  coverColumn: "Cover",
  premiumRow: (c) => `Yearly premium, class ${c}`,
  dashNote: "— Plan does not accept that class · Class 4 is not accepted by any plan",
  watermark: ["For study only", "Not part of the policy"],
  footer: [
    "(1) On renewal the sum insured rises by 5% of the starting sum insured each year, in policy years 2–6, up to 25% in all. A policy renewed within 31 days after its due date keeps the 5% increase but has no cover during that gap; the new cover starts on the day the renewal premium is paid. A premium paid after that period counts as a new policy and does not get the 5% increase.",
    "The insurance contract runs for 1 year and is renewable yearly. The premium is set by the insured's occupation. The applicant must state the facts truthfully; concealment or false statements may let the company void the contract and refuse claims.",
    "This information is a summary for presentation only. Please study and understand the cover and conditions in full before deciding to buy insurance.",
  ],
  quote: (f) => {
    const q = quoteFigures(f);
    if (!q) return undefined;
    const { p } = q;
    return [
      `🛡️ Personal Accident: ${f.family.name}, plan ${p.name}`,
      `Age ${f.age} · Occupation class ${f.cls}`,
      `💰 Premium ${baht(q.premium)} THB/year (about ${baht(q.day)} THB a day)`,
      "",
      "✅ Cover",
      `- Accidental death, dismemberment or total permanent disability ${baht(p.death)} THB`,
      `- Murder or assault ${baht(p.murder)} THB`,
      `- Riding or travelling on a motorcycle ${baht(p.motorcycle)} THB`,
      ...(p.medical ? [`- Medical expenses per accident ${baht(p.medical)} THB`] : []),
      ...(p.weekly ? [`- Temporary total disability ${baht(p.weekly)} THB a week (up to ${PA_WEEKLY_MAX_WEEKS} weeks)`] : []),
      `- Renewal years 2–6: sum +5% a year, up to ${MAX_PERCENT}% (year 6 death sum ${baht(q.sixth)} THB)`,
      "",
      "📌 24-hour worldwide cover · 1-year contract, renewable yearly",
      "Premium depends on occupation class",
    ].join("\n");
  },
};

const zh: PaWords = {
  metaTitle: "PA — 个人意外保险",
  metaDescription: "PA Classic、PA Platinum 与 PA Max：全球 24 小时意外保障。选择计划和职业等级，立即查看年缴保费。",
  kind: "个人意外保险",
  facts: ["全球 24 小时保障", "一年一续", "保费按职业等级"],
  taglines: {
    classic: "全面的意外保障",
    platinum: "增加每周补偿",
    max: "最高身故保额，不含医疗费用",
  },
  familyLabel: "产品",
  planLabel: "计划 · 意外保额",
  ageLabel: "年龄",
  classLabel: "职业等级",
  age: (a) => (a === 0 ? "未满 1 岁" : `${a} 岁`),
  ages: (min, max) => `投保年龄 ${min === 0 ? "出生" : min}–${max} 岁`,
  sum: (n) => `${baht(n / 10_000)}万`,
  classesTaken: (plan, classes) => `${plan} 接受职业等级 ${classes}`,
  class4None: "职业等级 4 所有计划均不接受",
  ageNotOk: (age, family, min, max) => `${age} 岁不能投保 ${family}，该产品接受 ${min}–${max} 岁`,
  childHint: (min) => `未满 ${min} 岁的儿童请看 PA Classic`,
  premiumHead: (plan, code, cls) => `保费 · PA ${plan} (${code}) · 职业等级 ${cls}`,
  perYear: "泰铢 / 年",
  perDay: ["每天约", "泰铢"],
  coverHead: "意外保障（泰铢）",
  rows: {
    death: "意外身故、肢体丧失或完全永久残疾",
    murder: "遭谋杀或袭击",
    motorcycle: "驾驶或乘坐摩托车",
    medical: "每次意外医疗费用（含摩托车）",
    weekly: (w) => `暂时完全残疾补偿，每周（最多 ${w} 周）`,
  },
  renewal: "续保第 2–6 年保额每年增加 5% · 第 6 年",
  smallPrint: "全球 24 小时保障 · 合约 1 年，逐年续保 · 保费按职业确定，与年龄和性别无关",
  allPlans: (family) => `${family} 全部计划（泰铢）· 点击一列选择计划`,
  coverColumn: "保障项目",
  premiumRow: (c) => `年缴保费，职业等级 ${c}`,
  dashNote: "— 该计划不接受此职业等级 · 职业等级 4 所有计划均不接受",
  watermark: ["仅供学习参考", "不构成保单的一部分"],
  footer: [
    "(1) 续保时，自第 2 至第 6 保单年度，保额每年增加初始保额的 5%，累计最高 25%。在到期日后 31 天内续保仍可享有 5% 的增加，但该期间不提供保障；新的保障自缴纳续保保费之日起生效。超过该期间缴费视为购买新保单，不享有 5% 的增加。",
    "保险合约期限为 1 年，可逐年续保。保费按被保险人的职业确定。投保人有义务如实告知，隐瞒或虚假陈述可能导致公司解除合约并拒绝理赔。",
    "以上信息仅为简要介绍，供展示之用。投保前请仔细阅读并了解保障内容及条款。",
  ],
  quote: (f) => {
    const q = quoteFigures(f);
    if (!q) return undefined;
    const { p } = q;
    return [
      `🛡️ 个人意外保险 ${f.family.name}，计划 ${p.name}`,
      `年龄 ${f.age} 岁 · 职业等级 ${f.cls}`,
      `💰 保费 ${baht(q.premium)} 泰铢/年（每天约 ${baht(q.day)} 泰铢）`,
      "",
      "✅ 保障",
      `- 意外身故、肢体丧失或完全永久残疾 ${baht(p.death)} 泰铢`,
      `- 遭谋杀或袭击 ${baht(p.murder)} 泰铢`,
      `- 驾驶或乘坐摩托车 ${baht(p.motorcycle)} 泰铢`,
      ...(p.medical ? [`- 每次意外医疗费用 ${baht(p.medical)} 泰铢`] : []),
      ...(p.weekly ? [`- 暂时完全残疾补偿 每周 ${baht(p.weekly)} 泰铢（最多 ${PA_WEEKLY_MAX_WEEKS} 周）`] : []),
      `- 续保第 2–6 年保额每年增加 5%，最高 ${MAX_PERCENT}%（第 6 年身故保额 ${baht(q.sixth)} 泰铢）`,
      "",
      "📌 全球 24 小时保障 · 合约 1 年，逐年续保",
      "保费按职业等级确定",
    ].join("\n");
  },
};

const ru: PaWords = {
  metaTitle: "PA — страхование от несчастных случаев",
  metaDescription:
    "PA Classic, PA Platinum и PA Max: защита от несчастных случаев 24 часа в сутки по всему миру. Выберите план и класс профессии и сразу увидите годовой взнос.",
  kind: "Страхование от несчастных случаев",
  facts: ["24 часа по всему миру", "Продление ежегодно", "Взнос по классу профессии"],
  taglines: {
    classic: "Полная защита от несчастных случаев",
    platinum: "Плюс еженедельная компенсация",
    max: "Максимальная сумма, без медицинских расходов",
  },
  familyLabel: "Продукт",
  planLabel: "План · Страховая сумма",
  ageLabel: "Возраст",
  classLabel: "Класс профессии",
  age: (a) => (a === 0 ? "До 1 года" : `${a} ${ruYears(a)}`),
  ages: (min, max) => `Возраст от ${min === 0 ? "рождения" : min} до ${max} лет`,
  sum: (n) => (n < 1_000_000 ? `${baht(n / 1_000)} тыс.` : `${baht(n / 1_000_000)} млн`),
  classesTaken: (plan, classes) => `${plan} принимает классы профессии ${classes}`,
  class4None: "Класс 4 не принимается ни одним планом",
  ageNotOk: (age, family, min, max) =>
    `В ${age} ${ruYears(age)} ${family} оформить нельзя. Принимается возраст от ${min} до ${max} лет`,
  childHint: (min) => `Для детей до ${min} лет смотрите PA Classic`,
  premiumHead: (plan, code, cls) => `Взнос · PA ${plan} (${code}) · Класс ${cls}`,
  perYear: "бат / год",
  perDay: ["Около", "бат в день"],
  coverHead: "Покрытие при несчастном случае (бат)",
  rows: {
    death: "Смерть, потеря конечностей или полная постоянная нетрудоспособность в результате несчастного случая",
    murder: "Убийство или нападение",
    motorcycle: "Управление мотоциклом или поездка на нём",
    medical: "Медицинские расходы на один несчастный случай (вкл. мотоцикл)",
    weekly: (w) => `Временная полная нетрудоспособность, в неделю (до ${w} недель)`,
  },
  renewal: "Годы продления 2–6: сумма +5% в год · 6-й год",
  smallPrint: "Защита 24 часа по всему миру · договор на 1 год с ежегодным продлением · взнос зависит от профессии, а не от возраста или пола",
  allPlans: (family) => `Все планы ${family} (бат) · Нажмите на столбец, чтобы выбрать план`,
  coverColumn: "Покрытие",
  premiumRow: (c) => `Годовой взнос, класс ${c}`,
  dashNote: "— План не принимает этот класс · Класс 4 не принимается ни одним планом",
  watermark: ["Только для ознакомления", "Не является частью полиса"],
  footer: [
    "(1) При продлении страховая сумма увеличивается на 5% от начальной суммы каждый год, со 2-го по 6-й полисный год, всего не более чем на 25%. При продлении в течение 31 дня после даты окончания увеличение на 5% сохраняется, но в этот период покрытия нет; новое покрытие начинается в день оплаты взноса за продление. Оплата позже этого срока считается покупкой нового полиса без увеличения на 5%.",
    "Договор страхования заключается на 1 год и продлевается ежегодно. Взнос определяется по профессии застрахованного. Заявитель обязан сообщать достоверные сведения; сокрытие или ложные сведения могут дать компании право расторгнуть договор и отказать в выплате.",
    "Эта информация является кратким обзором только для презентации. Перед решением о страховании внимательно изучите покрытие и условия.",
  ],
  quote: (f) => {
    const q = quoteFigures(f);
    if (!q) return undefined;
    const { p } = q;
    return [
      `🛡️ Страхование от несчастных случаев ${f.family.name}, план ${p.name}`,
      `Возраст ${f.age} · Класс профессии ${f.cls}`,
      `💰 Взнос ${baht(q.premium)} бат/год (около ${baht(q.day)} бат в день)`,
      "",
      "✅ Покрытие",
      `- Смерть, потеря конечностей или полная постоянная нетрудоспособность ${baht(p.death)} бат`,
      `- Убийство или нападение ${baht(p.murder)} бат`,
      `- Управление мотоциклом или поездка на нём ${baht(p.motorcycle)} бат`,
      ...(p.medical ? [`- Медицинские расходы на один несчастный случай ${baht(p.medical)} бат`] : []),
      ...(p.weekly ? [`- Временная полная нетрудоспособность ${baht(p.weekly)} бат в неделю (до ${PA_WEEKLY_MAX_WEEKS} недель)`] : []),
      `- Годы продления 2–6: сумма +5% в год, до ${MAX_PERCENT}% (на 6-й год ${baht(q.sixth)} бат)`,
      "",
      "📌 Защита 24 часа по всему миру · договор на 1 год с ежегодным продлением",
      "Взнос зависит от класса профессии",
    ].join("\n");
  },
};

const my: PaWords = {
  metaTitle: "PA — ပုဂ္ဂိုလ်ရေး မတော်တဆ အာမခံ",
  metaDescription:
    "PA Classic၊ PA Platinum နှင့် PA Max — ကမ္ဘာတစ်ဝှမ်း 24 နာရီ မတော်တဆ အကာအကွယ်။ အစီအစဉ်နှင့် အလုပ်အကိုင်အဆင့်ကို ရွေးပြီး နှစ်စဉ်ပရီမီယံကို ချက်ချင်းကြည့်ပါ။",
  kind: "ပုဂ္ဂိုလ်ရေး မတော်တဆ အာမခံ",
  facts: ["ကမ္ဘာတစ်ဝှမ်း 24 နာရီ", "နှစ်စဉ် သက်တမ်းတိုး", "ပရီမီယံ အလုပ်အကိုင်အဆင့်အလိုက်"],
  taglines: {
    classic: "မတော်တဆမှုအတွက် ပြည့်စုံသော အကာအကွယ်",
    platinum: "အပတ်စဉ် လျော်ကြေး ထပ်ပေါင်း",
    max: "အမြင့်ဆုံး အသက်အာမခံငွေ၊ ဆေးကုသစရိတ် မပါ",
  },
  familyLabel: "ထုတ်ကုန်",
  planLabel: "အစီအစဉ် · မတော်တဆ အာမခံငွေ",
  ageLabel: "အသက်",
  classLabel: "အလုပ်အကိုင်အဆင့်",
  age: (a) => (a === 0 ? "1 နှစ်အောက်" : `${a} နှစ်`),
  ages: (min, max) => `လက်ခံသည့်အသက် ${min === 0 ? "မွေးကင်းစ" : min}–${max} နှစ်`,
  sum: (n) => (n < 1_000_000 ? `${baht(n / 100_000)} သိန်း` : `${baht(n / 1_000_000)} သန်း`),
  classesTaken: (plan, classes) => `${plan} သည် အလုပ်အကိုင်အဆင့် ${classes} ကို လက်ခံသည်`,
  class4None: "အဆင့် 4 ကို မည်သည့်အစီအစဉ်မှ လက်မခံပါ",
  ageNotOk: (age, family, min, max) => `အသက် ${age} နှစ်တွင် ${family} ကို ဝယ်၍မရပါ။ အသက် ${min}–${max} နှစ်ကိုသာ လက်ခံသည်`,
  childHint: (min) => `အသက် ${min} နှစ်အောက် ကလေးများအတွက် PA Classic ကို ကြည့်ပါ`,
  premiumHead: (plan, code, cls) => `ပရီမီယံ · PA ${plan} (${code}) · အဆင့် ${cls}`,
  perYear: "ဘတ် / နှစ်",
  perDay: ["တစ်ရက်လျှင်", "ဘတ်ခန့်"],
  coverHead: "မတော်တဆ အကာအကွယ် (ဘတ်)",
  rows: {
    death: "မတော်တဆ သေဆုံးခြင်း၊ ကိုယ်အင်္ဂါဆုံးရှုံးခြင်း သို့မဟုတ် အပြီးအပိုင် မသန်စွမ်းဖြစ်ခြင်း",
    murder: "လူသတ်ခံရခြင်း သို့မဟုတ် ရန်လိုတိုက်ခိုက်ခံရခြင်း",
    motorcycle: "ဆိုင်ကယ်မောင်းနှင်ခြင်း သို့မဟုတ် လိုက်စီးခြင်း",
    medical: "မတော်တဆမှုတစ်ကြိမ်လျှင် ဆေးကုသစရိတ် (ဆိုင်ကယ်အပါအဝင်)",
    weekly: (w) => `ယာယီ မသန်စွမ်းမှု လျော်ကြေး၊ တစ်ပတ်လျှင် (အများဆုံး ${w} ပတ်)`,
  },
  renewal: "သက်တမ်းတိုး 2–6 နှစ်: အာမခံငွေ နှစ်စဉ် +5% · 6 နှစ်မြောက်",
  smallPrint: "ကမ္ဘာတစ်ဝှမ်း 24 နာရီ အကာအကွယ် · 1 နှစ် စာချုပ်၊ နှစ်စဉ် သက်တမ်းတိုး · ပရီမီယံကို အလုပ်အကိုင်အလိုက် သတ်မှတ်ပြီး အသက် သို့မဟုတ် ကျား/မ နှင့် မသက်ဆိုင်ပါ",
  allPlans: (family) => `${family} အစီအစဉ်အားလုံး (ဘတ်) · အစီအစဉ်ရွေးရန် ကော်လံကို နှိပ်ပါ`,
  coverColumn: "အကာအကွယ်",
  premiumRow: (c) => `နှစ်စဉ်ပရီမီယံ၊ အဆင့် ${c}`,
  dashNote: "— ဤအစီအစဉ်သည် ထိုအဆင့်ကို လက်မခံပါ · အဆင့် 4 ကို မည်သည့်အစီအစဉ်မှ လက်မခံပါ",
  watermark: ["လေ့လာရန်အတွက်သာ", "ပေါ်လစီ၏ အစိတ်အပိုင်း မဟုတ်ပါ"],
  footer: [
    "(1) သက်တမ်းတိုးသည့်အခါ ပေါ်လစီနှစ် 2 မှ 6 အထိ မူလအာမခံငွေ၏ 5% ကို နှစ်စဉ် တိုးပေးပြီး စုစုပေါင်း အများဆုံး 25% ဖြစ်သည်။ သက်တမ်းကုန်ပြီး 31 ရက်အတွင်း သက်တမ်းတိုးပါက 5% တိုးခွင့် ရှိနေဆဲဖြစ်သော်လည်း ထိုကာလအတွင်း အကာအကွယ် မရှိပါ။ အကာအကွယ်အသစ်သည် သက်တမ်းတိုးပရီမီယံ ပေးသွင်းသည့်နေ့မှ စတင်သည်။ ထိုကာလကျော်မှ ပေးသွင်းပါက ပေါ်လစီအသစ်ဝယ်ယူခြင်းအဖြစ် သတ်မှတ်ပြီး 5% တိုးခွင့် မရပါ။",
    "အာမခံစာချုပ်သည် 1 နှစ် သက်တမ်းရှိပြီး နှစ်စဉ် သက်တမ်းတိုးနိုင်သည်။ ပရီမီယံကို အာမခံထားသူ၏ အလုပ်အကိုင်အလိုက် သတ်မှတ်သည်။ လျှောက်ထားသူသည် မှန်ကန်စွာ ထုတ်ဖော်ရမည်ဖြစ်ပြီး ဖုံးကွယ်ခြင်း သို့မဟုတ် မမှန်ကန်စွာ ဖော်ပြခြင်းကြောင့် ကုမ္ပဏီက စာချုပ်ကို ပယ်ဖျက်ပြီး လျော်ကြေးငြင်းပယ်နိုင်သည်။",
    "ဤအချက်အလက်သည် တင်ပြရန်အတွက် အကျဉ်းချုပ်သာ ဖြစ်သည်။ အာမခံမဝယ်မီ အကာအကွယ်နှင့် စည်းကမ်းချက်များကို သေချာ လေ့လာနားလည်ပါ။",
  ],
  quote: (f) => {
    const q = quoteFigures(f);
    if (!q) return undefined;
    const { p } = q;
    return [
      `🛡️ မတော်တဆ အာမခံ ${f.family.name}၊ အစီအစဉ် ${p.name}`,
      `အသက် ${f.age} · အလုပ်အကိုင်အဆင့် ${f.cls}`,
      `💰 ပရီမီယံ ${baht(q.premium)} ဘတ်/နှစ် (တစ်ရက်လျှင် ${baht(q.day)} ဘတ်ခန့်)`,
      "",
      "✅ အကာအကွယ်",
      `- မတော်တဆ သေဆုံးခြင်း၊ ကိုယ်အင်္ဂါဆုံးရှုံးခြင်း သို့မဟုတ် အပြီးအပိုင် မသန်စွမ်းဖြစ်ခြင်း ${baht(p.death)} ဘတ်`,
      `- လူသတ်ခံရခြင်း သို့မဟုတ် ရန်လိုတိုက်ခိုက်ခံရခြင်း ${baht(p.murder)} ဘတ်`,
      `- ဆိုင်ကယ်မောင်းနှင်ခြင်း သို့မဟုတ် လိုက်စီးခြင်း ${baht(p.motorcycle)} ဘတ်`,
      ...(p.medical ? [`- မတော်တဆမှုတစ်ကြိမ်လျှင် ဆေးကုသစရိတ် ${baht(p.medical)} ဘတ်`] : []),
      ...(p.weekly ? [`- ယာယီ မသန်စွမ်းမှု လျော်ကြေး တစ်ပတ်လျှင် ${baht(p.weekly)} ဘတ် (အများဆုံး ${PA_WEEKLY_MAX_WEEKS} ပတ်)`] : []),
      `- သက်တမ်းတိုး 2–6 နှစ်: အာမခံငွေ နှစ်စဉ် +5%၊ အများဆုံး ${MAX_PERCENT}% (6 နှစ်မြောက် ${baht(q.sixth)} ဘတ်)`,
      "",
      "📌 ကမ္ဘာတစ်ဝှမ်း 24 နာရီ အကာအကွယ် · 1 နှစ် စာချုပ်၊ နှစ်စဉ် သက်တမ်းတိုး",
      "ပရီမီယံသည် အလုပ်အကိုင်အဆင့်အလိုက် ဖြစ်သည်",
    ].join("\n");
  },
};

export const PA_WORDS: Record<Lang, PaWords> = { th, en, zh, ru, my };

/** a cover row's label in the page's language */
export function paRowLabel(w: PaWords, key: PaRow["key"]): string {
  return key === "weekly" ? w.rows.weekly(PA_WEEKLY_MAX_WEEKS) : w.rows[key];
}

/** the cookie the switch writes, scoped to /pa so iHealthy keeps its own choice */
export const PA_LANG_COOKIE = "pa-lang";
