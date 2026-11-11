import type { PayMode, Sex } from "@/calc/types";
import { compareCells, comparePlans, visibleLines, type CompareLine } from "@/lib/ihealthy-compare";
import { compareLines } from "@/lib/ihealthy-compare-card";
import { compareDailyCash, comparePremium } from "@/lib/ihealthy-compare-premiums";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { FULL_ROW_LABEL, type FullRowKey } from "@/lib/ihealthy-full-rows";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { MODES, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { WORDS } from "@/lib/ihealthy-words";
import type { VideoLang } from "./video-words";

/**
 * วิดีโอเทียบ 4 แผน (owner chose ข, 2026-11-11, mockup https://claude.ai/artifact/LBAU1dE46qCwQk8weQYiJY):
 * the iHealthy Ultra Package page (/ihealthy-ultra/compare) told as one clip — every plan's price
 * in the page's instalment, the yearly ceiling and the room, what every plan pays as charged, and
 * what the higher plans add.
 *
 * The figures are the page's own: its premiums (ihealthy-compare-premiums.ts, the owner's folder
 * table, not the rate tables), its plans for the age, its rows. A child's age has two plans and
 * no extras; from the age the page's premiums carry no daily cash, the clip does not say it.
 */

const NO_COVER = "-";
/** what the Thai sheet prints for a benefit paid in full */
const AS_CHARGED = "ตามที่จ่ายจริง";

export interface AllPlansPlan {
  code: string;
  name: string;
  /** whole baht in the page's instalment */
  premium: number;
  /** "3 ล้าน" */
  ceiling: string;
  ceilingBaht: number;
  /** the room's figure a day, without its unit: "1,500" */
  room: string;
}

export interface AllPlansFacts {
  mode: PayMode;
  plans: AllPlansPlan[];
  /** the rows every plan pays as charged, named short */
  same: { key: FullRowKey; label: string }[];
  /** what only some plans pay: each group's plans and heading, its rows paid as charged, and the OPD limit by plan */
  extras: { plans: string[]; title: string; rows: { key: FullRowKey; label: string }[]; opd?: { label: string; amounts: { name: string; amount: string }[] } }[];
  /** baht a day where the page's premiums pay for it */
  dailyCash: number | null;
  lifeSum: number;
  /** the screen's words, in the clip's language */
  words: {
    lead: string;
    leadSub: string;
    who: string;
    priceTitle: string;
    priceNote: string;
    coverTitle: string;
    roomLabel: string;
    sameTitle: string;
    sameBig: string;
    sameNote: string;
    asCharged: string;
    opdLabel: string;
  };
}

/** the screen's words; the facts carry them worked out, since the drawing reads only the facts */
interface ScreenWords {
  lead: (n: number) => string;
  leadSub: string;
  priceTitle: (mode: string) => string;
  priceNote: (sum: string, cash: boolean) => string;
  coverTitle: string;
  roomLabel: string;
  sameTitle: string;
  sameBig: string;
  sameNote: string;
  extraTitle: (names: string[]) => string;
  asCharged: string;
  opdLabel: string;
}

export const ALL_PLANS_WORDS: Record<VideoLang, ScreenWords> = {
  th: {
    lead: (n) => `เทียบ ${n} แผน`,
    leadSub: "ในคลิปเดียว",
    priceTitle: (mode) => `ค่าใช้จ่ายปีแรก · ${mode}`,
    priceNote: (sum, cash) => `รวมทุนชีวิต ${sum}${cash ? " + ค่าชดเชยรายวัน" : ""} · ปีต่อไปคิดตามอายุ`,
    coverTitle: "วงเงินค่ารักษาต่อปี",
    roomLabel: "ค่าห้อง/วัน",
    sameTitle: "เหมือนกันทุกแผน",
    sameBig: "จ่ายตามจริง",
    sameNote: "ไม่มีค่าใช้จ่ายส่วนแรก",
    extraTitle: (names) => `${names.join(" · ")} ได้เพิ่ม`,
    asCharged: "ตามจริง",
    opdLabel: "OPD ต่อปี",
  },
  en: {
    lead: (n) => `${n} plans`,
    leadSub: "side by side",
    priceTitle: (mode) => `First year · ${mode}`,
    priceNote: (sum, cash) => `Includes ${sum} life cover${cash ? " + daily cash" : ""} · later years by age`,
    coverTitle: "Yearly limit",
    roomLabel: "Room/day",
    sameTitle: "Every plan",
    sameBig: "As charged",
    sameNote: "No deductible",
    extraTitle: (names) => `${names.join(" · ")} add`,
    asCharged: "As charged",
    opdLabel: "OPD a year",
  },
  zh: {
    lead: (n) => `${n}个方案对比`,
    leadSub: "一个视频看完",
    priceTitle: (mode) => `首年保费 · ${mode}`,
    priceNote: (sum, cash) => `含寿险保额 ${sum}${cash ? " + 每日津贴" : ""} · 次年起按年龄计`,
    coverTitle: "每年保障额度",
    roomLabel: "房费/天",
    sameTitle: "所有方案相同",
    sameBig: "按实际费用",
    sameNote: "无免赔额",
    extraTitle: (names) => `${names.join("·")} 额外保障`,
    asCharged: "按实际",
    opdLabel: "门诊/年",
  },
  ru: {
    lead: (n) => `${n} плана рядом`,
    leadSub: "в одном видео",
    priceTitle: (mode) => `Первый год · ${mode}`,
    priceNote: (sum, cash) => `Включая жизнь ${sum}${cash ? " + ежедневная выплата" : ""} · далее по возрасту`,
    coverTitle: "Лимит в год",
    roomLabel: "Палата/день",
    sameTitle: "Во всех планах",
    sameBig: "По факту",
    sameNote: "Без франшизы",
    extraTitle: (names) => `${names.join(" · ")} добавляют`,
    asCharged: "По факту",
    opdLabel: "Амбулаторно/год",
  },
  my: {
    lead: (n) => `အစီအစဉ် ${n} ခု နှိုင်းယှဉ်`,
    leadSub: "ဗီဒီယိုတစ်ခုတည်းမှာ",
    priceTitle: (mode) => `ပထမနှစ် · ${mode}`,
    priceNote: (sum, cash) => `အသက်အာမခံ ${sum}${cash ? " + နေ့စဉ်ငွေ" : ""} ပါဝင် · နောက်နှစ်များ အသက်အလိုက်`,
    coverTitle: "တစ်နှစ် ကန့်သတ်ငွေ",
    roomLabel: "အခန်း/ရက်",
    sameTitle: "အစီအစဉ်တိုင်း တူညီ",
    sameBig: "ကုန်ကျသလောက်",
    sameNote: "ကိုယ်ထူကိုယ်ထ ပေးရန် မရှိ",
    extraTitle: (names) => `${names.join(" · ")} ထပ်ရ`,
    asCharged: "ကုန်ကျသလောက်",
    opdLabel: "ပြင်ပလူနာ/နှစ်",
  },
};

/** "2. ค่าบริการ…" → "ค่าบริการ…": the screen lists them without the sheet's numbers */
const unnumbered = (label: string) => label.replace(/^\d+(\.\d+)?\.?\s*/, "");

/** a line's key, by its label in that language's short names */
function keyOf(label: string, lang: VideoLang): FullRowKey | undefined {
  const names = FULL_ROW_LABEL[lang];
  return (Object.keys(names) as FullRowKey[]).find((k) => names[k] === label);
}

export const isAllPlansMode = (v: unknown): v is PayMode => (MODES as unknown[]).includes(v);

/**
 * The page's table for this person and instalment, in the clip's language; undefined where the
 * page could not price it (a lapsed table, an age it does not sell, a figure its premiums lack).
 */
export function allPlansFacts(sex: Sex, age: number, mode: PayMode, lang: VideoLang, today: Date = new Date()): AllPlansFacts | undefined {
  const table = iHealthyTable(today);
  if (table.expired || age < table.ageMin || age > table.ageMax) return undefined;
  const codes = comparePlans(plansFor(table, age).map((p) => p.code));
  if (codes.length < 2) return undefined;
  const w = WORDS[lang];
  const sw = ALL_PLANS_WORDS[lang];
  const sheet = iHealthyFacts().plans;
  // the logic reads the Thai sheet's cells, the screen the clip language's names: the two lists
  // are the same lines in the same order (compareLines translates, it does not reorder)
  const rowsOf = (ls: CompareLine[]) => ls.flatMap((l): Extract<CompareLine, { kind: "row" }>[] => (l.kind === "row" ? [l] : []));
  const rows = rowsOf(visibleLines(compareLines(lang), codes, age));
  const thai = rowsOf(visibleLines(compareLines("th"), codes, age));
  if (rows.length !== thai.length) return undefined;
  const cells = (i: number) => compareCells(thai[i].entry, codes, age).map((c) => c.text);
  const shownCells = (i: number) => compareCells(rows[i].entry, codes, age).map((c) => c.text);
  const perDay = new RegExp(`\\s*${w.perDay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`);

  if (!rows.length) return undefined;
  const roomCells = shownCells(0);
  const plans: AllPlansPlan[] = [];
  for (const [i, code] of codes.entries()) {
    const premium = comparePremium(code, sex, age, mode);
    const ceilingBaht = sheet.find((p) => p.code === code)?.annualMax ?? 0;
    if (premium === undefined || !ceilingBaht) return undefined;
    const big = w.big(ceilingBaht);
    plans.push({ code, name: planLabel(code), premium, ceiling: `${big.num} ${big.unit}`, ceilingBaht, room: roomCells[i].replace(perDay, "") });
  }

  const charged = (t: string) => t === AS_CHARGED;
  const same: AllPlansFacts["same"] = [];
  const groups = new Map<string, AllPlansFacts["extras"][number]>();
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    const key = keyOf(thai[i].label, "th");
    const c = cells(i);
    if (!key) continue;
    if (c.every((t) => t === c[0]) && charged(c[0])) {
      same.push({ key, label: unnumbered(line.label) });
      continue;
    }
    const has = codes.filter((_, k) => c[k] !== NO_COVER);
    if (has.length === 0 || has.length === codes.length) continue;
    const id = has.join(",");
    const g = groups.get(id) ?? { plans: has.map(planLabel), title: sw.extraTitle(has.map(planLabel)), rows: [] };
    if (line.pair) {
      const shown = shownCells(i);
      g.opd = {
        label: line.pair.lines.map(unnumbered).join(" · "),
        amounts: codes.flatMap((code, k) => (c[k] === NO_COVER ? [] : [{ name: planLabel(code), amount: shown[k] }])),
      };
    } else if (has.every((code) => charged(c[codes.indexOf(code)]))) {
      g.rows.push({ key, label: unnumbered(line.label) });
    }
    groups.set(id, g);
  }

  const dailyCash = compareDailyCash(table.standard.plan[age - table.ageMin] ?? null, age, table.juvenileBelowAge);
  const lifeSum = IHEALTHY_OPENING.sumAssured;
  return {
    mode,
    plans,
    same,
    extras: [...groups.values()].filter((g) => g.rows.length || g.opd),
    dailyCash,
    lifeSum,
    words: {
      lead: sw.lead(plans.length),
      leadSub: sw.leadSub,
      who: `${w.sex[sex]} ${w.years(age)}`,
      priceTitle: sw.priceTitle(w.mode[mode]),
      priceNote: sw.priceNote(lifeSum.toLocaleString("en-US"), dailyCash !== null),
      coverTitle: sw.coverTitle,
      roomLabel: sw.roomLabel,
      sameTitle: sw.sameTitle,
      sameBig: sw.sameBig,
      sameNote: sw.sameNote,
      asCharged: sw.asCharged,
      opdLabel: sw.opdLabel,
    },
  };
}
