import type { QuoteVideoFacts, SceneScript } from "./script";
import type { VideoLang } from "./video-words";

/**
 * iHealthy Ultra's spoken lines in English, Chinese, Russian and Burmese (owner, 2026-10-15,
 * mockup https://claude.ai/artifact/H3HkP5iMpLD1rvEiCtdngb, option ก; translations approved).
 *
 * The Thai clip's scenes and its figures, said in fixed sentences: no AI writes them, so a figure
 * can only be one the card states. The same rules as the Expat posts: no visa, never "worldwide".
 * Words are separated by single spaces because the subtitles light one piece at a time; Chinese
 * has no spaces of its own, so its sentences are cut into short phrases here.
 */

type Foreign = Exclude<VideoLang, "th">;

const comma = (n: number) => n.toLocaleString("en-US");
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** Burmese digits, which a Burmese voice reads as Burmese */
const MY_DIGITS = "၀၁၂၃၄၅၆၇၈၉";
const myNum = (n: number) => comma(n).replace(/\d/g, (d) => MY_DIGITS[+d]);

/** Russian: 1 бат, 2–4 бата, 5+ бат (and 11–14 бат) */
function ruPlural(n: number, one: string, few: string, many: string): string {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}
const ruBaht = (n: number) => `${n} ${ruPlural(n, "бат", "бата", "бат")}`;

/** a large sum said aloud: "15 million baht", "1500万泰铢", "15 миллионов бат", "ဘတ် ၁၅ သန်း" */
function bigSaid(lang: Foreign, baht: number): string {
  const m = baht / 1_000_000;
  if (lang === "en") return `${comma(m)} million baht`;
  if (lang === "zh") return baht >= 100_000_000 ? `${baht / 100_000_000}亿泰铢` : `${baht / 10_000}万泰铢`;
  if (lang === "ru") return `${m} ${ruPlural(m, "миллион", "миллиона", "миллионов")} бат`;
  return `ဘတ် ${myNum(m)} သန်း`;
}

/** an ordinary sum said aloud */
function bahtSaid(lang: Foreign, n: number): string {
  if (lang === "en") return `${comma(n)} baht`;
  if (lang === "zh") return `${comma(n)}泰铢`;
  if (lang === "ru") return ruBaht(n);
  return `ဘတ် ${myNum(n)}`;
}

function list(lang: Foreign, items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const head = items.slice(0, -1);
  const last = items[items.length - 1];
  if (lang === "en") return `${head.join(", ")} and ${last}`;
  if (lang === "zh") return `${head.join("、")}和${last}`;
  if (lang === "ru") return `${head.join(", ")} и ${last}`;
  return `${head.join("၊ ")} နဲ့ ${last}`;
}

/** the cover the voice names as paid as charged, by the card's Thai row */
const ACTUAL: Record<Foreign, Record<string, string>> = {
  en: { "Day Surgery": "day surgery", "อุบัติเหตุ OPD 24 ชม": "accident care", "มะเร็ง รังสีรักษา": "cancer treatment" },
  zh: { "Day Surgery": "日间手术", "อุบัติเหตุ OPD 24 ชม": "意外门诊", "มะเร็ง รังสีรักษา": "癌症治疗" },
  ru: { "Day Surgery": "дневная хирургия", "อุบัติเหตุ OPD 24 ชม": "лечение после несчастного случая", "มะเร็ง รังสีรักษา": "лечение рака" },
  my: { "Day Surgery": "နေ့ချင်းပြန် ခွဲစိတ်မှု", "อุบัติเหตุ OPD 24 ชม": "မတော်တဆ ကုသမှု", "มะเร็ง รังสีรักษา": "ကင်ဆာကုသမှု" },
};

/** what the price is made of, by the Thai the card's lines give */
const INCLUDES: Record<Foreign, Record<string, string>> = {
  en: { ประกันชีวิต: "life cover", ค่าชดเชยรายวัน: "daily hospital cash", สัญญาเพิ่มเติม: "your riders" },
  zh: { ประกันชีวิต: "人寿保障", ค่าชดเชยรายวัน: "每日住院津贴", สัญญาเพิ่มเติม: "附加险" },
  ru: { ประกันชีวิต: "страхование жизни", ค่าชดเชยรายวัน: "ежедневную выплату при госпитализации", สัญญาเพิ่มเติม: "дополнительные договоры" },
  my: { ประกันชีวิต: "အသက်အာမခံ", ค่าชดเชยรายวัน: "ဆေးရုံတက် နေ့စဉ်ငွေ", สัญญาเพิ่มเติม: "ထပ်ဆောင်းအာမခံများ" },
};

/** the base plan's cover said with its sum (owner, 2026-10-20, ก), as the Thai "ประกันชีวิตทุน 150,000 บาท" */
function lifeWith(lang: Foreign, sum: string): string {
  if (lang === "en") return `life cover of ${sum}`;
  if (lang === "zh") return `${sum}人寿保障`;
  if (lang === "ru") return `страхование жизни на сумму ${sum}`;
  return `${sum} အသက်အာမခံ`;
}

/** the opening's who: "a woman aged 35" */
function who(lang: Foreign, f: QuoteVideoFacts): string {
  const woman = f.sex === "F";
  if (lang === "en") return `For ${woman ? "a woman" : "a man"} aged ${f.age},`;
  if (lang === "zh") return `${f.age}岁${woman ? "女性" : "男性"}`;
  if (lang === "ru") return `Для ${woman ? "женщины" : "мужчины"} ${f.age} ${ruPlural(f.age, "года", "лет", "лет")}`;
  return `အသက် ${myNum(f.age)} နှစ် ${woman ? "အမျိုးသမီး" : "အမျိုးသား"}အတွက်`;
}

/** "With a budget of 3,500 baht a month," — when the clip began from a budget */
function budget(lang: Foreign, f: QuoteVideoFacts): string {
  if (!f.budget) return "";
  const n = num(f.budget.amount);
  const month = f.budget.per === "month";
  if (lang === "en") return `With a budget of ${bahtSaid(lang, n)} a ${month ? "month" : "year"},`;
  if (lang === "zh") return `${month ? "每月" : "每年"}预算 ${bahtSaid(lang, n)}，`;
  if (lang === "ru") return `При бюджете ${bahtSaid(lang, n)} в ${month ? "месяц" : "год"}`;
  return `${month ? "တစ်လ" : "တစ်နှစ်"} ${bahtSaid(lang, n)} ဘတ်ဂျက်နဲ့`;
}

function coverLine(lang: Foreign, f: QuoteVideoFacts): string {
  const b = f.benefits ?? [];
  const room = b.find((x) => x.label === "ค่าห้องและค่าอาหาร");
  const actual = b.filter((x) => x.amount === "ตามที่จ่ายจริง" && ACTUAL[lang][x.label]).map((x) => ACTUAL[lang][x.label]);
  const opd = b.find((x) => x.label === "ผู้ป่วยนอก OPD");
  const daily = b.find((x) => x.label === "ค่าชดเชยรายวัน");
  const opdActual = opd?.amount === "ตามที่จ่ายจริง";
  const parts: string[] = [];
  if (lang === "en") {
    if (room) parts.push(`Room and board up to ${bahtSaid(lang, num(room.amount))} a day.`);
    if (actual.length) parts.push(`${cap(list(lang, actual))} ${actual.length > 1 ? "are" : "is"} paid as charged.`);
    if (opd) parts.push(opdActual ? "Outpatient care is paid as charged too." : `Outpatient care up to ${bahtSaid(lang, num(opd.amount))} a year.`);
    if (daily) parts.push(`Plus ${bahtSaid(lang, num(daily.amount))} for every day you stay in hospital.`);
  } else if (lang === "zh") {
    if (room) parts.push(`房间及膳食 每天最高 ${bahtSaid(lang, num(room.amount))}；`);
    if (actual.length) parts.push(`${list(lang, actual)} 按实际费用支付；`);
    if (opd) parts.push(opdActual ? "门诊 也按实际费用支付；" : `门诊 每年 ${bahtSaid(lang, num(opd.amount))}；`);
    if (daily) parts.push(`住院 每天另得 ${bahtSaid(lang, num(daily.amount))}。`);
  } else if (lang === "ru") {
    if (room) parts.push(`Палата и питание — до ${bahtSaid(lang, num(room.amount))} в день.`);
    if (actual.length) parts.push(`${cap(list(lang, actual))} — по фактическим расходам.`);
    if (opd) parts.push(opdActual ? "Амбулаторно — тоже по фактическим расходам." : `Амбулаторно — до ${bahtSaid(lang, num(opd.amount))} в год,`);
    if (daily) parts.push(`${opd && !opdActual ? "плюс" : "Плюс"} ${bahtSaid(lang, num(daily.amount))} за каждый день в больнице.`);
  } else {
    if (room) parts.push(`အခန်းနဲ့ အစားအသောက် တစ်ရက်ကို ${bahtSaid(lang, num(room.amount))} အထိ။`);
    if (actual.length) parts.push(`${list(lang, actual)}ကို ကုန်ကျသလောက် ပေးပါတယ်။`);
    if (opd) parts.push(opdActual ? "ပြင်ပလူနာလည်း ကုန်ကျသလောက် ပေးပါတယ်။" : `ပြင်ပလူနာ တစ်နှစ်ကို ${bahtSaid(lang, num(opd.amount))}၊`);
    if (daily) parts.push(`ဆေးရုံတက်တဲ့ နေ့တိုင်း ${bahtSaid(lang, num(daily.amount))} ထပ်ရပါတယ်။`);
  }
  // a sentence the next part would have finished, when there is no next part
  return parts.join(" ").replace(/[,，；၊]$/, lang === "zh" ? "。" : lang === "my" ? "။" : ".");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function compareLine(lang: Foreign, f: QuoteVideoFacts): string | undefined {
  const others = (f.compare ?? []).filter((p) => !p.main && p.ceilingBaht);
  if (!others.length) return undefined;
  const each = others.map((p) => {
    const ceil = bigSaid(lang, p.ceilingBaht!);
    const m = bahtSaid(lang, num(p.monthly));
    if (lang === "en") return `the ${p.name} plan covers ${ceil} a year for ${m} a month`;
    if (lang === "zh") return `${p.name}计划 每年 ${ceil} 每月 ${m}`;
    if (lang === "ru") return `план ${p.name} — ${ceil} в год за ${m} в месяц`;
    return `${p.name} အစီအစဉ် တစ်နှစ် ${ceil} တစ်လ ${m}`;
  });
  const age = f.coverToAge;
  // no colon: after the voice's own instruction it takes a second one for another, and says nothing (2026-10-15)
  if (lang === "en") return `If you'd like to compare, ${each.join("; and ")}. Every plan renews up to age ${age}.`;
  if (lang === "zh") return `如果想对比， ${each.join("； ")}。 所有计划 都可续保至 ${age}岁。`;
  if (lang === "ru") return `Для сравнения, ${each.join("; ")}. Все планы продлеваются до ${age} лет.`;
  return `နှိုင်းယှဉ်ရရင် ${each.join("၊ ")}။ အစီအစဉ်အားလုံး အသက် ${myNum(age)} အထိ သက်တမ်းတိုးနိုင်ပါတယ်။`;
}

/** the ceiling sentence the opening ends on, with or without a budget before it */
function ceilingLine(lang: Foreign, f: QuoteVideoFacts, short: boolean): string {
  const big = bigSaid(lang, f.lead.baht);
  const plan = f.planName ?? "";
  if (lang === "en") return short ? `pays medical bills up to ${big} a year.` : `the ${plan} plan pays medical bills up to ${big} a year.`;
  if (lang === "zh") return short ? `每年医疗费用 最高可报销 ${big}。` : `${plan}计划 每年医疗费用 最高可报销 ${big}。`;
  if (lang === "ru") return short ? `покрывает лечение до ${big} в год.` : `план ${plan} покрывает лечение до ${big} в год.`;
  return short ? `တစ်နှစ်ကို ဆေးကုသစရိတ် ${big}အထိ ပေးပါတယ်။` : `${plan} အစီအစဉ်က တစ်နှစ်ကို ဆေးကုသစရိတ် ${big}အထိ ပေးပါတယ်။`;
}

export function foreignScript(f: QuoteVideoFacts, lang: Foreign, name: string, short: boolean): SceneScript[] {
  const monthly = bahtSaid(lang, num(f.spokenPrice.amount));
  // the longer clip names each rider and its sum (owner, 2026-10-17, ก); the 15-second one says "your riders"
  const included = (f.includes ?? ["ประกันชีวิต"])
    .flatMap((x) => (!short && x === "สัญญาเพิ่มเติม" && f.riderNames?.length
      // mid-sentence: "critical illness DCI", not "Critical illness DCI"
      ? f.riderNames.map((n) => (lang === "en" || lang === "ru" ? n.replace(/^(\p{Lu})(?=\p{Ll})/u, (c) => c.toLowerCase()) : n))
      : x === "ประกันชีวิต" && f.lifeSum ? [lifeWith(lang, bahtSaid(lang, f.lifeSum))]
      : [INCLUDES[lang][x] ?? x]));
  const inc = list(lang, included);
  const b = budget(lang, f);
  const join = (...xs: string[]) => xs.filter(Boolean).join(" ");

  const price = {
    en: `In the first year it's ${monthly} a month, with ${inc} already included.`,
    zh: `第一年 每月 ${monthly}， 已包含 ${inc}。`,
    ru: `В первый год — ${monthly} в месяц, уже включая ${inc}.`,
    my: `ပထမနှစ်မှာ တစ်လကို ${monthly} ပါ။ ${inc} ပါဝင်ပြီးသားပါ။`,
  }[lang];

  if (short) {
    const ask = { en: "Message me for a quote.", zh: "有兴趣的话， 欢迎给我留言 索取报价。", ru: "Напишите мне за расчётом.", my: "ဈေးနှုန်းသိချင်ရင် မက်ဆေ့ချ် ပို့ပါ။" }[lang];
    const lead = join(b, `iHealthy Ultra ${ceilingLine(lang, f, true)}`);
    return [
      { key: "lead", voice: tidy(lead) },
      { key: "price", voice: tidy(price) },
      { key: "contact", voice: ask },
    ];
  }

  const hello = {
    en: name ? `Hello, ${name}! Here's a quick look at this health plan.` : "Hello! Here's a quick look at this health plan.",
    zh: name ? `${name}，您好！ 简单为您介绍 这份健康保险。` : "您好！ 简单为您介绍 这份健康保险。",
    ru: name ? `Здравствуйте, ${name}! Коротко расскажу об этом плане медицинского страхования.` : "Здравствуйте! Коротко расскажу об этом плане медицинского страхования.",
    my: name ? `မင်္ဂလာပါ ${name}။ ဒီကျန်းမာရေးအာမခံ အစီအစဉ်ကို အတိုချုပ် ပြောပြပါမယ်။` : "မင်္ဂလာပါ။ ဒီကျန်းမာရေးအာမခံ အစီအစဉ်ကို အတိုချုပ် ပြောပြပါမယ်။",
  }[lang];
  // a named clip greets the customer and leaves out who the plan is for, as the Thai does
  const whom = name ? "" : who(lang, f);
  let opening: string;
  if (lang === "en") {
    const intro = b || whom;
    opening = join(hello, intro ? `${b || whom} ${ceilingLine(lang, f, false)}` : cap(ceilingLine(lang, f, false)));
  } else if (lang === "ru") {
    // a budget names the plan's price already; who it is for would make the sentence run on
    const intro = b || whom;
    opening = join(hello, intro ? `${intro} ${ceilingLine(lang, f, false)}` : cap(ceilingLine(lang, f, false)));
  } else {
    opening = join(hello, b, whom, ceilingLine(lang, f, false));
  }
  const contact = {
    en: "Interested? Send me a message any time. I'm happy to help you choose a plan.",
    zh: "有兴趣的话， 欢迎随时 给我留言， 我很乐意 帮您挑选 合适的计划。",
    ru: "Если интересно, напишите мне в любое время. С удовольствием помогу подобрать план.",
    my: "စိတ်ဝင်စားရင် အချိန်မရွေး မက်ဆေ့ချ် ပို့ပါ။ သင့်တော်တဲ့ အစီအစဉ် ရွေးဖို့ ဝမ်းသာစွာ ကူညီပါမယ်။",
  }[lang];
  const compare = compareLine(lang, f);
  return [
    { key: "lead", voice: tidy(opening) },
    { key: "price", voice: tidy(price) },
    { key: "cover", voice: tidy(coverLine(lang, f)) },
    ...(compare ? [{ key: "compare" as const, voice: tidy(compare) }] : []),
    { key: "contact", voice: tidy(contact) },
  ];
}

/** one space between words, and none before a full stop or comma; never a colon (see compareLine) */
const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/[:：]/g, ",").trim();
