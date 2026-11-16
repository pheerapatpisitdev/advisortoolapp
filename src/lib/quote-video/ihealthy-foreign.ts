import type { PayMode } from "@/calc/types";
import { figure } from "@/lib/ihealthy-lang";
import type { AllPlansFacts } from "./ihealthy-all-plans";
import type { QuoteVideoFacts, SceneScript } from "./script";
import type { VideoLang } from "./video-words";

/**
 * iHealthy Ultra's spoken lines in English, Chinese, Russian and Burmese (owner, 2026-10-15,
 * mockup https://claude.ai/artifact/H3HkP5iMpLD1rvEiCtdngb, option ก; translations approved),
 * and French and German (owner, 2026-11-16, ก on mockup https://claude.ai/artifact/L9eji4qWrFwkANrygUWj8b).
 *
 * The Thai clip's scenes and its figures, said in fixed sentences: no AI writes them, so a figure
 * can only be one the card states. The same rules as the Expat posts: no visa, never "worldwide".
 * Words are separated by single spaces because the subtitles light one piece at a time; Chinese
 * has no spaces of its own, so its sentences are cut into short phrases here. French groups a
 * figure's thousands with a narrow no-break space (3 500), which is not a space between words:
 * the figure lights as one piece and the French voice reads it as one number. German groups them
 * with a dot (3.500), as its screen does.
 */

type Foreign = Exclude<VideoLang, "th">;

const comma = (n: number) => n.toLocaleString("en-US");
const num = (s: string) => Number(s.replace(/[^\d]/g, ""));
/** "3 500" with the narrow no-break space French sets between thousands */
const frNum = (n: number) => n.toLocaleString("fr-FR").replace(/[\s\u00a0]/g, "\u202f");
const deNum = (n: number) => figure(n, "de");
/**
 * A figure inside the card's own words (a rider's "200,000") grouped as the voice reads it: a French
 * or German voice takes 200,000 for two hundred point zero.
 */
const regroup = (lang: Foreign, text: string) => (lang === "fr" || lang === "de"
  ? text.replace(/\d{1,3}(?:,\d{3})+/g, (m) => (lang === "fr" ? frNum : deNum)(Number(m.replace(/,/g, ""))))
  : text);

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
  if (lang === "fr") return `${frNum(m)} ${m < 2 ? "million" : "millions"} de bahts`;
  if (lang === "de") return `${deNum(m)} ${m === 1 ? "Million" : "Millionen"} Baht`;
  return `ဘတ် ${myNum(m)} သန်း`;
}

/** an ordinary sum said aloud */
function bahtSaid(lang: Foreign, n: number): string {
  if (lang === "en") return `${comma(n)} baht`;
  if (lang === "zh") return `${comma(n)}泰铢`;
  if (lang === "ru") return ruBaht(n);
  if (lang === "fr") return `${frNum(n)} ${n < 2 ? "baht" : "bahts"}`;
  if (lang === "de") return `${deNum(n)} Baht`;
  return `ဘတ် ${myNum(n)}`;
}

function list(lang: Foreign, items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const head = items.slice(0, -1);
  const last = items[items.length - 1];
  if (lang === "en") return `${head.join(", ")} and ${last}`;
  if (lang === "zh") return `${head.join("、")}和${last}`;
  if (lang === "ru") return `${head.join(", ")} и ${last}`;
  if (lang === "fr") return `${head.join(", ")} et ${last}`;
  if (lang === "de") return `${head.join(", ")} und ${last}`;
  return `${head.join("၊ ")} နဲ့ ${last}`;
}

/** the cover the voice names as paid as charged, by the card's Thai row */
const ACTUAL: Record<Foreign, Record<string, string>> = {
  en: { "Day Surgery": "day surgery", "อุบัติเหตุ OPD 24 ชม": "accident care", "มะเร็ง รังสีรักษา": "cancer treatment" },
  zh: { "Day Surgery": "日间手术", "อุบัติเหตุ OPD 24 ชม": "意外门诊", "มะเร็ง รังสีรักษา": "癌症治疗" },
  ru: { "Day Surgery": "дневная хирургия", "อุบัติเหตุ OPD 24 ชม": "лечение после несчастного случая", "มะเร็ง รังสีรักษา": "лечение рака" },
  my: { "Day Surgery": "နေ့ချင်းပြန် ခွဲစိတ်မှု", "อุบัติเหตุ OPD 24 ชม": "မတော်တဆ ကုသမှု", "มะเร็ง รังสีรักษา": "ကင်ဆာကုသမှု" },
  fr: { "Day Surgery": "la chirurgie ambulatoire", "อุบัติเหตุ OPD 24 ชม": "les soins après un accident", "มะเร็ง รังสีรักษา": "le traitement du cancer" },
  de: { "Day Surgery": "ambulante Operationen", "อุบัติเหตุ OPD 24 ชม": "die Behandlung nach Unfällen", "มะเร็ง รังสีรักษา": "die Krebsbehandlung" },
};

/** what the price is made of, by the Thai the card's lines give */
const INCLUDES: Record<Foreign, Record<string, string>> = {
  en: { ประกันชีวิต: "life cover", ค่าชดเชยรายวัน: "daily hospital cash", สัญญาเพิ่มเติม: "your riders" },
  zh: { ประกันชีวิต: "人寿保障", ค่าชดเชยรายวัน: "每日住院津贴", สัญญาเพิ่มเติม: "附加险" },
  ru: { ประกันชีวิต: "страхование жизни", ค่าชดเชยรายวัน: "ежедневную выплату при госпитализации", สัญญาเพิ่มเติม: "дополнительные договоры" },
  my: { ประกันชีวิต: "အသက်အာမခံ", ค่าชดเชยรายวัน: "ဆေးရုံတက် နေ့စဉ်ငွေ", สัญญาเพิ่มเติม: "ထပ်ဆောင်းအာမခံများ" },
  fr: { ประกันชีวิต: "l'assurance vie", ค่าชดเชยรายวัน: "l'indemnité journalière d'hospitalisation", สัญญาเพิ่มเติม: "vos garanties complémentaires" },
  de: { ประกันชีวิต: "die Lebensversicherung", ค่าชดเชยรายวัน: "das Krankenhaustagegeld", สัญญาเพิ่มเติม: "Ihre Zusatzversicherungen" },
};

/** the base plan's cover said with its sum (owner, 2026-10-20, ก), as the Thai "ประกันชีวิตทุน 150,000 บาท" */
function lifeWith(lang: Foreign, sum: string): string {
  if (lang === "en") return `life cover of ${sum}`;
  if (lang === "zh") return `${sum}人寿保障`;
  if (lang === "ru") return `страхование жизни на сумму ${sum}`;
  if (lang === "fr") return `l'assurance vie de ${sum}`;
  if (lang === "de") return `die Lebensversicherung über ${sum}`;
  return `${sum} အသက်အာမခံ`;
}

/** the opening's who: "a woman aged 35" */
function who(lang: Foreign, f: QuoteVideoFacts): string {
  const woman = f.sex === "F";
  if (lang === "en") return `For ${woman ? "a woman" : "a man"} aged ${f.age},`;
  if (lang === "zh") return `${f.age}岁${woman ? "女性" : "男性"}`;
  if (lang === "ru") return `Для ${woman ? "женщины" : "мужчины"} ${f.age} ${ruPlural(f.age, "года", "лет", "лет")}`;
  if (lang === "fr") return `Pour ${woman ? "une femme" : "un homme"} de ${f.age} ans,`;
  // German puts the verb straight after this, so it carries no comma: "Für eine 35-jährige Frau zahlt …"
  if (lang === "de") return `Für ${woman ? "eine" : "einen"} ${f.age}-jährige${woman ? "" : "n"} ${woman ? "Frau" : "Mann"}`;
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
  if (lang === "fr") return `Avec un budget de ${bahtSaid(lang, n)} par ${month ? "mois" : "an"},`;
  if (lang === "de") return `Mit einem Budget von ${bahtSaid(lang, n)} im ${month ? "Monat" : "Jahr"}`;
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
  } else if (lang === "fr") {
    if (room) parts.push(`Chambre et repas jusqu'à ${bahtSaid(lang, num(room.amount))} par jour.`);
    if (actual.length) parts.push(`Remboursement aux frais réels pour ${list(lang, actual)}.`);
    if (opd) parts.push(opdActual ? "Les soins ambulatoires sont aussi remboursés aux frais réels." : `Soins ambulatoires jusqu'à ${bahtSaid(lang, num(opd.amount))} par an.`);
    if (daily) parts.push(`En plus, ${bahtSaid(lang, num(daily.amount))} pour chaque jour passé à l'hôpital.`);
  } else if (lang === "de") {
    if (room) parts.push(`Zimmer und Verpflegung bis zu ${bahtSaid(lang, num(room.amount))} pro Tag.`);
    if (actual.length) parts.push(`${cap(list(lang, actual))} ${actual.length > 1 ? "werden" : "wird"} nach tatsächlichen Kosten erstattet.`);
    if (opd) parts.push(opdActual ? "Ambulante Behandlung wird ebenfalls nach tatsächlichen Kosten erstattet." : `Ambulante Behandlung bis zu ${bahtSaid(lang, num(opd.amount))} pro Jahr.`);
    if (daily) parts.push(`Dazu ${bahtSaid(lang, num(daily.amount))} für jeden Tag im Krankenhaus.`);
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
    // the agent hid the monthly instalment (ตั้งค่าส่วนตัว): each plan's yearly price instead
    const year = f.comparePer === "year";
    const m = bahtSaid(lang, num(year ? p.yearly ?? "" : p.monthly));
    if (lang === "en") return `the ${p.name} plan covers ${ceil} a year for ${m} ${year ? "a year" : "a month"}`;
    if (lang === "zh") return `${p.name}计划 每年 ${ceil} ${year ? "年缴" : "每月"} ${m}`;
    if (lang === "ru") return `план ${p.name} — ${ceil} в год за ${m} ${year ? "в год" : "в месяц"}`;
    if (lang === "fr") return `la formule ${p.name} couvre ${ceil} par an pour ${m} par ${year ? "an" : "mois"}`;
    if (lang === "de") return `der Tarif ${p.name} deckt ${ceil} pro Jahr für ${m} im ${year ? "Jahr" : "Monat"}`;
    return `${p.name} အစီအစဉ် တစ်နှစ် ${ceil} ${year ? "တစ်နှစ်" : "တစ်လ"} ${m}`;
  });
  const age = f.coverToAge;
  // no colon: after the voice's own instruction it takes a second one for another, and says nothing (2026-10-15)
  if (lang === "en") return `If you'd like to compare, ${each.join("; and ")}. Every plan renews up to age ${age}.`;
  if (lang === "zh") return `如果想对比， ${each.join("； ")}。 所有计划 都可续保至 ${age}岁。`;
  if (lang === "ru") return `Для сравнения, ${each.join("; ")}. Все планы продлеваются до ${age} лет.`;
  if (lang === "fr") return `Pour comparer, ${each.join("; et ")}. Toutes les formules sont renouvelables jusqu'à ${age} ans.`;
  if (lang === "de") return `Zum Vergleich, ${each.join("; und ")}. Alle Tarife lassen sich bis zum Alter von ${age} Jahren verlängern.`;
  return `နှိုင်းယှဉ်ရရင် ${each.join("၊ ")}။ အစီအစဉ်အားလုံး အသက် ${myNum(age)} အထိ သက်တမ်းတိုးနိုင်ပါတယ်။`;
}

/** the ceiling sentence the opening ends on, with or without a budget before it */
function ceilingLine(lang: Foreign, f: QuoteVideoFacts, short: boolean): string {
  const big = bigSaid(lang, f.lead.baht);
  const plan = f.planName ?? "";
  if (lang === "en") return short ? `pays medical bills up to ${big} a year.` : `the ${plan} plan pays medical bills up to ${big} a year.`;
  if (lang === "zh") return short ? `每年医疗费用 最高可报销 ${big}。` : `${plan}计划 每年医疗费用 最高可报销 ${big}。`;
  if (lang === "ru") return short ? `покрывает лечение до ${big} в год.` : `план ${plan} покрывает лечение до ${big} в год.`;
  if (lang === "fr") return short ? `rembourse les frais médicaux jusqu'à ${big} par an.` : `la formule ${plan} rembourse les frais médicaux jusqu'à ${big} par an.`;
  // German: the verb first after an opening phrase ("Mit einem Budget von … zahlt der Tarif …")
  if (lang === "de") return short ? `zahlt Behandlungskosten bis zu ${big} pro Jahr.` : `zahlt der Tarif ${plan} Behandlungskosten bis zu ${big} pro Jahr.`;
  return short ? `တစ်နှစ်ကို ဆေးကုသစရိတ် ${big}အထိ ပေးပါတယ်။` : `${plan} အစီအစဉ်က တစ်နှစ်ကို ဆေးကုသစရိတ် ${big}အထိ ပေးပါတယ်။`;
}

export function foreignScript(f: QuoteVideoFacts, lang: Foreign, name: string, short: boolean): SceneScript[] {
  const monthly = bahtSaid(lang, num(f.spokenPrice.amount));
  // the longer clip names each rider and its sum (owner, 2026-10-17, ก); the 15-second one says "your riders"
  const included = (f.includes ?? ["ประกันชีวิต"])
    .flatMap((x) => (!short && x === "สัญญาเพิ่มเติม" && f.riderNames?.length
      // mid-sentence: "critical illness DCI", not "Critical illness DCI"
      ? f.riderNames.map((n) => regroup(lang, lang === "en" || lang === "ru" || lang === "fr" ? n.replace(/^(\p{Lu})(?=\p{Ll})/u, (c) => c.toLowerCase()) : n))
      : x === "ประกันชีวิต" && f.lifeSum ? [lifeWith(lang, bahtSaid(lang, f.lifeSum))]
      : [INCLUDES[lang][x] ?? x]));
  const inc = list(lang, included);
  const b = budget(lang, f);
  const join = (...xs: string[]) => xs.filter(Boolean).join(" ");
  // German agrees the verb with what is included: "Darin ist die Lebensversicherung …", "Darin sind …"
  const deIs = included.length > 1 ? "sind" : "ist";

  // the yearly price where the agent hid the monthly instalment (ตั้งค่าส่วนตัว; script.ts iHealthyFacts)
  const price = f.spokenPrice.per === "ปีละ" ? {
    en: `In the first year it's ${monthly} a year, with ${inc} already included.`,
    zh: `第一年 每年 ${monthly}， 已包含 ${inc}。`,
    ru: `В первый год — ${monthly} в год, уже включая ${inc}.`,
    my: `ပထမနှစ်မှာ တစ်နှစ်ကို ${monthly} ပါ။ ${inc} ပါဝင်ပြီးသားပါ။`,
    fr: `La première année, c'est ${monthly} par an, en incluant déjà ${inc}.`,
    de: `Im ersten Jahr sind es ${monthly} im Jahr. Darin ${deIs} ${inc} bereits enthalten.`,
  }[lang] : {
    en: `In the first year it's ${monthly} a month, with ${inc} already included.`,
    zh: `第一年 每月 ${monthly}， 已包含 ${inc}。`,
    ru: `В первый год — ${monthly} в месяц, уже включая ${inc}.`,
    my: `ပထမနှစ်မှာ တစ်လကို ${monthly} ပါ။ ${inc} ပါဝင်ပြီးသားပါ။`,
    fr: `La première année, c'est ${monthly} par mois, en incluant déjà ${inc}.`,
    de: `Im ersten Jahr sind es ${monthly} im Monat. Darin ${deIs} ${inc} bereits enthalten.`,
  }[lang];

  if (short) {
    const ask = { en: "Message me for a quote.", zh: "有兴趣的话， 欢迎给我留言 索取报价。", ru: "Напишите мне за расчётом.", my: "ဈေးနှုန်းသိချင်ရင် မက်ဆေ့ချ် ပို့ပါ။", fr: "Écrivez-moi pour un devis.", de: "Schreiben Sie mir für ein Angebot." }[lang];
    // German: "Mit einem Budget von … zahlt iHealthy Ultra …", the verb before the plan
    const lead = lang === "de" && b
      ? `${b} ${ceilingLine(lang, f, true).replace(/^zahlt /, "zahlt iHealthy Ultra ")}`
      : join(b, `iHealthy Ultra ${ceilingLine(lang, f, true)}`);
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
    fr: name ? `Bonjour ${name} ! Voici un aperçu rapide de cette assurance santé.` : "Bonjour ! Voici un aperçu rapide de cette assurance santé.",
    de: name ? `Hallo ${name}! Hier ein kurzer Überblick über diese Krankenversicherung.` : "Hallo! Hier ein kurzer Überblick über diese Krankenversicherung.",
  }[lang];
  // a named clip greets the customer and leaves out who the plan is for, as the Thai does
  const whom = name ? "" : who(lang, f);
  let opening: string;
  if (lang === "en" || lang === "fr") {
    const intro = b || whom;
    opening = join(hello, intro ? `${b || whom} ${ceilingLine(lang, f, false)}` : cap(ceilingLine(lang, f, false)));
  } else if (lang === "de") {
    // "Für eine 35-jährige Frau zahlt der Tarif …", or with no opening phrase "Der Tarif … zahlt …"
    const intro = b || whom;
    opening = join(hello, intro
      ? `${intro} ${ceilingLine(lang, f, false)}`
      : `Der Tarif ${f.planName ?? ""} zahlt Behandlungskosten bis zu ${bigSaid(lang, f.lead.baht)} pro Jahr.`);
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
    fr: "Ça vous intéresse ? Écrivez-moi quand vous voulez. Je vous aiderai volontiers à choisir une formule.",
    de: "Interesse? Schreiben Sie mir jederzeit. Ich helfe Ihnen gern, den passenden Tarif zu finden.",
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

/**
 * one space between words, and none before a full stop or comma; never a colon (see compareLine).
 * The narrow no-break space inside a French figure is kept: it is not a gap between two words.
 */
const tidy = (s: string) => s.replace(/[^\S\u202f]+/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/[:：]/g, ",").trim();

/**
 * วิดีโอเทียบ 4 แผน in English, Chinese, Russian and Burmese (owner chose ข, 2026-11-11), and in
 * French and German (2026-11-16): the Thai
 * clip's six lines (ihealthy-all-plans-script.ts), said in fixed sentences from the page's figures.
 */
const SAME_SAID: Record<Foreign, Record<string, string>> = {
  en: { "2": "hospital care", "4": "surgery", "9": "dialysis", "10": "cancer treatment", "11": "cancer treatment", "12": "the ambulance" },
  zh: { "2": "住院治疗", "4": "手术", "9": "透析", "10": "癌症治疗", "11": "癌症治疗", "12": "急救车" },
  ru: { "2": "лечение в больнице", "4": "операции", "9": "диализ", "10": "лечение рака", "11": "лечение рака", "12": "скорая помощь" },
  my: { "2": "ဆေးရုံ ကုသမှု", "4": "ခွဲစိတ်မှု", "9": "ကျောက်ကပ်ဆေးကြောခြင်း", "10": "ကင်ဆာကုသမှု", "11": "ကင်ဆာကုသမှု", "12": "လူနာတင်ယာဉ်" },
  fr: { "2": "l'hospitalisation", "4": "la chirurgie", "9": "la dialyse", "10": "le traitement du cancer", "11": "le traitement du cancer", "12": "l'ambulance" },
  de: { "2": "Krankenhausbehandlung", "4": "Operationen", "9": "Dialyse", "10": "Krebsbehandlung", "11": "Krebsbehandlung", "12": "Krankentransport" },
};
const EXTRA_SAID: Record<Foreign, Record<string, string>> = {
  en: { "14": "a private nurse", "15": "accidental dental care", "16": "oral surgery", "17": "pregnancy complications" },
  zh: { "14": "特别护理", "15": "意外牙科", "16": "口腔外科手术", "17": "妊娠并发症" },
  ru: { "14": "сиделка", "15": "стоматология при травме", "16": "хирургия полости рта", "17": "осложнения беременности" },
  my: { "14": "အထူးသူနာပြု", "15": "မတော်တဆ သွားကုသမှု", "16": "ပါးစပ်ခွဲစိတ်မှု", "17": "ကိုယ်ဝန်ဆောင် နောက်ဆက်တွဲ" },
  fr: { "14": "une infirmière privée", "15": "les soins dentaires après un accident", "16": "la chirurgie buccale", "17": "les complications de grossesse" },
  de: { "14": "eine private Pflegekraft", "15": "Zahnbehandlung nach Unfällen", "16": "Kieferchirurgie", "17": "Schwangerschaftskomplikationen" },
};
const MODE_SAID: Record<Foreign, Record<PayMode, string>> = {
  en: { annual: "paying yearly", semi: "paying every six months", monthly: "paying monthly" },
  zh: { annual: "年缴", semi: "半年缴", monthly: "月缴" },
  ru: { annual: "при оплате раз в год", semi: "при оплате раз в полгода", monthly: "при ежемесячной оплате" },
  my: { annual: "နှစ်စဉ်ပေးရင်", semi: "ခြောက်လတစ်ကြိမ်ပေးရင်", monthly: "လစဉ်ပေးရင်" },
  fr: { annual: "en paiement annuel", semi: "en paiement semestriel", monthly: "en paiement mensuel" },
  de: { annual: "bei jährlicher Zahlung", semi: "bei halbjährlicher Zahlung", monthly: "bei monatlicher Zahlung" },
};
const uniq = (keys: string[], said: Record<string, string>) => [...new Set(keys.flatMap((k) => (said[k] ? [said[k]] : [])))];

export function allPlansForeign(f: QuoteVideoFacts, a: AllPlansFacts, lang: Foreign, name: string): SceneScript[] {
  const n = a.plans.length;
  const first = a.plans[0];
  const last = a.plans[n - 1];
  const prices = a.plans.map((p) => `${p.name} ${bahtSaid(lang, p.premium)}`);
  const life = lifeWith(lang, bahtSaid(lang, a.lifeSum));
  const cash = a.dailyCash !== null ? INCLUDES[lang].ค่าชดเชยรายวัน : "";
  const inc = list(lang, [life, ...(cash ? [cash] : [])]);
  const same = uniq(a.same.map((r) => r.key), SAME_SAID[lang]);
  const whom = name ? "" : who(lang, f);
  const room = (x: typeof first) => num(x.room);

  const hello = {
    en: name ? `Hello, ${name}!` : "Hello!",
    zh: name ? `${name}，您好！` : "您好！",
    ru: name ? `Здравствуйте, ${name}!` : "Здравствуйте!",
    my: name ? `မင်္ဂလာပါ ${name}။` : "မင်္ဂလာပါ။",
    fr: name ? `Bonjour ${name} !` : "Bonjour !",
    de: name ? `Hallo ${name}!` : "Hallo!",
  }[lang];
  const lead = {
    en: `${hello} Here are all ${n} iHealthy Ultra plans side by side in one clip${whom ? `, ${whom.replace(/^For/, "for").replace(/,$/, "")}` : ""}.`,
    zh: `${hello} 今天 用一个视频 为您对比 iHealthy Ultra 全部 ${n}个方案${whom ? `， 适合 ${whom}` : ""}。`,
    ru: `${hello} Сравним все ${n} плана iHealthy Ultra в одном видео${whom ? ` ${whom.replace(/^Для/, "для")}` : ""}.`,
    my: `${hello} ${whom} iHealthy Ultra အစီအစဉ် ${myNum(n)} ခုလုံးကို ဗီဒီယိုတစ်ခုတည်းမှာ နှိုင်းယှဉ်ပြပါမယ်။`,
    fr: `${hello} Voici les ${n} formules iHealthy Ultra côte à côte dans une seule vidéo${whom ? `, ${whom.replace(/^Pour/, "pour").replace(/,$/, "")}` : ""}.`,
    de: `${hello} Hier sind alle ${n} Tarife von iHealthy Ultra nebeneinander in einem Video${whom ? `, ${whom.replace(/^Für/, "für")}` : ""}.`,
  }[lang];
  const price = {
    en: `In the first year, ${MODE_SAID.en[a.mode]}, ${list(lang, prices)}, with ${inc} already included.`,
    zh: `首年 ${MODE_SAID.zh[a.mode]}保费 ${prices.join("， ")}， 已包含 ${inc}。`,
    ru: `В первый год ${MODE_SAID.ru[a.mode]} ${list(lang, prices)}, уже включая ${inc}.`,
    my: `ပထမနှစ် ${MODE_SAID.my[a.mode]} ${prices.join("၊ ")} ပါ။ ${inc} ပါဝင်ပြီးသားပါ။`,
    fr: `La première année, ${MODE_SAID.fr[a.mode]}, ${list(lang, prices)}, en incluant déjà ${inc}.`,
    de: `Im ersten Jahr kosten die Tarife ${MODE_SAID.de[a.mode]} ${list(lang, prices)}. Darin ${cash ? "sind" : "ist"} ${inc} bereits enthalten.`,
  }[lang];
  const cover = {
    en: `The yearly limit runs from ${bigSaid(lang, first.ceilingBaht).replace(/ baht$/, "")} to ${bigSaid(lang, last.ceilingBaht)}, and the room from ${comma(room(first))} to ${bahtSaid(lang, room(last))} a day.`,
    zh: `每年保障额度 从 ${bigSaid(lang, first.ceilingBaht)} 到 ${bigSaid(lang, last.ceilingBaht)}， 房费 每天 ${bahtSaid(lang, room(first))} 到 ${bahtSaid(lang, room(last))}。`,
    ru: `Годовой лимит — ${a.plans.map((p) => `${p.name} ${bigSaid(lang, p.ceilingBaht)}`).join(", ")}. Палата — от ${room(first)} до ${ruBaht(room(last))} в день.`,
    my: `တစ်နှစ် ကန့်သတ်ငွေ ${bigSaid(lang, first.ceilingBaht)} ကနေ ${bigSaid(lang, last.ceilingBaht)} အထိ၊ အခန်း တစ်ရက်ကို ${bahtSaid(lang, room(first))} ကနေ ${bahtSaid(lang, room(last))} အထိ ပါ။`,
    fr: `Le plafond annuel va de ${bigSaid(lang, first.ceilingBaht).replace(/ de bahts$/, "")} à ${bigSaid(lang, last.ceilingBaht)}, et la chambre de ${frNum(room(first))} à ${bahtSaid(lang, room(last))} par jour.`,
    de: `Das Jahreslimit reicht von ${bigSaid(lang, first.ceilingBaht).replace(/ Baht$/, "")} bis ${bigSaid(lang, last.ceilingBaht)}, das Zimmer von ${deNum(room(first))} bis ${bahtSaid(lang, room(last))} pro Tag.`,
  }[lang];
  const sameLine = same.length ? {
    en: `Every plan pays ${list(lang, same)} as charged, with no deductible.`,
    zh: `所有方案 ${list(lang, same)} 都按实际费用支付， 无免赔额。`,
    ru: `Во всех планах ${list(lang, same)} — по фактическим расходам, без франшизы.`,
    my: `အစီအစဉ်တိုင်းမှာ ${list(lang, same)}ကို ကုန်ကျသလောက် ပေးပါတယ်။`,
    fr: `Toutes les formules remboursent ${list(lang, same)} aux frais réels, sans franchise.`,
    de: `Alle Tarife erstatten ${list(lang, same)} nach tatsächlichen Kosten, ohne Selbstbehalt.`,
  }[lang] : "";
  const extras = a.extras.map((g) => {
    const rows = uniq(g.rows.map((r) => r.key as string).filter((k) => k !== "17" || f.sex === "F"), EXTRA_SAID[lang]);
    const opd = g.opd?.amounts ?? [];
    const opdEach = (fmt: (x: { name: string; baht: number }) => string, sep: string) => opd.map((x) => fmt({ name: x.name, baht: num(x.amount) })).join(sep);
    if (lang === "en") {
      const parts = [...rows, ...(opd.length ? [`outpatient care of ${opdEach((x) => `${bahtSaid(lang, x.baht)} a year on ${x.name}`, " and ")}`] : [])];
      return `Choose ${g.plans.join(" or ")} and you also get ${list(lang, parts)}.`;
    }
    if (lang === "zh") {
      const parts = [...rows, ...(opd.length ? [`门诊 每年 ${opdEach((x) => `${x.name} ${bahtSaid(lang, x.baht)}`, "、")}`] : [])];
      return `选择 ${g.plans.join("或")}， 还可获得 ${list(lang, parts)}。`;
    }
    if (lang === "ru") {
      const parts = [...rows, ...(opd.length ? [`амбулаторное лечение — ${opdEach((x) => `${x.name} до ${ruBaht(x.baht)}`, ", ")} в год`] : [])];
      return `В планах ${g.plans.join(" и ")} есть ещё ${list(lang, parts)}.`;
    }
    if (lang === "fr") {
      const parts = [...rows, ...(opd.length ? [`des soins ambulatoires de ${opdEach((x) => `${bahtSaid(lang, x.baht)} par an avec ${x.name}`, " et ")}`] : [])];
      return `Avec ${g.plans.join(" ou ")}, vous avez aussi ${list(lang, parts)}.`;
    }
    if (lang === "de") {
      const parts = [...rows, ...(opd.length ? [`ambulante Behandlung mit ${opdEach((x) => `${bahtSaid(lang, x.baht)} pro Jahr bei ${x.name}`, " und ")}`] : [])];
      return `Mit ${g.plans.join(" oder ")} erhalten Sie außerdem ${list(lang, parts)}.`;
    }
    const parts = [...rows, ...(opd.length ? [`ပြင်ပလူနာ တစ်နှစ်ကို ${opdEach((x) => `${x.name} ${bahtSaid(lang, x.baht)}`, "၊ ")}`] : [])];
    return `${g.plans.join(" ဒါမှမဟုတ် ")} ကို ရွေးရင် ${list(lang, parts)} ထပ်ရပါတယ်။`;
  });
  const contact = {
    en: "Interested in a plan? Send me a message any time. I'm happy to help you choose.",
    zh: "对哪个方案 感兴趣， 欢迎随时 给我留言， 我很乐意 帮您挑选。",
    ru: "Если какой-то план интересен, напишите мне в любое время. С удовольствием помогу выбрать.",
    my: "စိတ်ဝင်စားတဲ့ အစီအစဉ် ရှိရင် အချိန်မရွေး မက်ဆေ့ချ် ပို့ပါ။ ရွေးချယ်ဖို့ ဝမ်းသာစွာ ကူညီပါမယ်။",
    fr: "Une formule vous intéresse ? Écrivez-moi quand vous voulez. Je vous aiderai volontiers à choisir.",
    de: "Interessiert Sie ein Tarif? Schreiben Sie mir jederzeit. Ich helfe Ihnen gern bei der Auswahl.",
  }[lang];
  return [
    { key: "lead", voice: tidy(lead) },
    { key: "price", voice: tidy(price) },
    { key: "cover", voice: tidy(cover) },
    ...(sameLine ? [{ key: "value" as const, voice: tidy(sameLine) }] : []),
    ...(extras.length ? [{ key: "compare" as const, voice: tidy(extras.join(" ")) }] : []),
    { key: "contact", voice: tidy(contact) },
  ];
}
