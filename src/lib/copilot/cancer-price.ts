import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import { coverIn, peopleIn } from "@/lib/assistant/common";
import { cardPath } from "@/lib/card-link";
import {
  CANCER_DAILY_RIDER, CANCER_RIDER, CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS, cprStagePays,
} from "@/lib/cancer-benefits";
import { CANCER_BUNDLE } from "@/lib/cancer-table";
import { sumWords } from "@/lib/ci123-cta";
import type { GuideItem } from "./guide";
import type { PriceReply } from "./price";

/**
 * The cancer set in the chat, from one message.
 *
 * The owner's rule: "ประกันมะเร็ง" and "แพ็กเกจมะเร็ง" mean the set on /cancer — CPR and HIC on
 * Life Protect x 2 — and nothing else, whichever other plan happens to cover a cancer too.
 *
 * Unlike CI 123 it is priced at the eight packages only. The three parts move together — the
 * base is a fifth of CPR, HIC steps with it — so a sum between two packages is not a smaller
 * version of either, and inventing a base for it would be a quotation the page cannot show.
 * Every figure comes from `quoteBundle`, the call the page's own table is built from.
 */

export const CANCER_LABEL = "ประกันมะเร็ง";

const NAMED = /ประกัน\s*(?:โรค)?\s*มะเร็ง|แพ็?[กค]\s*เก[จต]\s*(?:โรค)?\s*มะเร็ง|ชุด\s*(?:โรค)?\s*มะเร็ง|\bcancer\b|แคนเซอร์/i;

export function cancerNamedIn(text: string): boolean {
  return NAMED.test(text);
}

/** The message with the product's name taken out, so nothing in the name is read as a figure. */
function withoutName(text: string): string {
  return text.replace(new RegExp(NAMED.source, "gi"), " ");
}

/** HIC's daily amount, as a customer writes it: "ชดเชยวันละ 4,000", "วันละ 2000". */
function dailyIn(text: string): number | undefined {
  const m = text.match(/วันละ\s*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : undefined;
}

/** Whether the message asks for a figure, rather than about the cover's rules. */
export function asksCancerPrice(text: string): boolean {
  const said = withoutName(text);
  return /เบี้ย|ราคา|กี่บาท|ค่างวด|คิดให้|premium|เดือนละ|ปีละ/i.test(said)
    || peopleIn(said).length > 0
    || coverIn(said) !== undefined;
}

const SEX_WORD = { M: "ชาย", F: "หญิง" } as const;

/** A whole question for a button, with the product named so it arrives here again. */
function ask(parts: string[]): string {
  return [CANCER_LABEL, ...parts].join(" ");
}

export function priceCancer(text: string, today: Date = new Date()): PriceReply {
  const bundle = getBundle(CANCER_BUNDLE)!;
  const range = bundleAgeRange(bundle);
  const packages = bundle.tiers.map((t) => ({
    no: t.no,
    base: t.sumAssured,
    cpr: t.riders.find((r) => r.code === CANCER_RIDER)!.sumAssured!,
    hic: t.riders.find((r) => r.code === CANCER_DAILY_RIDER)!.sumAssured!,
  }));
  const said = withoutName(text);
  const who = peopleIn(said)[0];
  const cover = coverIn(said);
  const daily = dailyIn(said);
  const person = who ? `${SEX_WORD[who.sex]} ${who.age}` : undefined;
  const pkg = cover !== undefined
    ? packages.find((p) => p.cpr === cover)
    : daily !== undefined ? packages.find((p) => p.hic === daily) : undefined;
  const sumButtons = (sums: number[]): GuideItem[] => (person
    ? sums.map((n) => ({ label: `ทุน ${sumWords(n)}`, ask: ask([person, `ทุน ${sumWords(n)}`]) }))
    : []);

  // a sum was named and it is not one of the eight: offer the packages either side of it
  if ((cover !== undefined || daily !== undefined) && !pkg) {
    const asked = cover ?? daily!;
    const key = cover !== undefined ? "cpr" : "hic";
    const near = [...packages]
      .sort((a, b) => Math.abs(a[key] - asked) - Math.abs(b[key] - asked))
      .slice(0, 3)
      .sort((a, b) => a.cpr - b.cpr);
    return {
      priced: false,
      text: `**${CANCER_LABEL}** มีให้เลือก ${packages.length} แพ็กเกจครับ ทุนมะเร็ง (เงินก้อน) คู่กับค่าชดเชยรายวัน\n\n`
        + packages.map((p) => `- ทุน ${sumWords(p.cpr)} · ชดเชยวันละ ${p.hic.toLocaleString("en-US")}`).join("\n")
        + (person ? "\n\nเลือกแพ็กเกจที่ใกล้เคียงได้เลยครับ" : "\n\nบอกอายุกับเพศมาด้วยนะครับ (เช่น “ชาย 35”)"),
      ...(person ? { guide: sumButtons(near.map((p) => p.cpr)) } : {}),
    };
  }

  if (!who || !pkg) {
    const missing: string[] = [];
    if (!who) missing.push("อายุกับเพศ (เช่น “ชาย 35”)");
    if (!pkg) missing.push(`ทุนมะเร็ง (${sumWords(packages[0].cpr)} – ${sumWords(packages[packages.length - 1].cpr)} เช่น “ทุน 1 ล้าน”)`);
    // sums are a choice and can be buttons; an age is not, so nobody is invented to price
    return {
      priced: false,
      text: `คิดเบี้ย **${CANCER_LABEL}** ให้ได้ครับ ขอเพิ่มอีกนิด:\n\n${missing.map((m) => `- ${m}`).join("\n")}`,
      ...(who ? { guide: sumButtons([500_000, 1_000_000, 2_000_000]) } : {}),
    };
  }

  const out = `**${CANCER_LABEL}** ${person} ทุน ${sumWords(pkg.cpr)}`;
  if (who.age < range.min || who.age > range.max) {
    return {
      priced: false,
      text: `${out} ยังคิดให้ไม่ได้ครับ\n\n- รับอายุ ${range.min}–${range.max} ปี`,
    };
  }
  const result = quoteBundle(bundle, pkg.no, { age: who.age, sex: who.sex, mode: "annual" }, today);
  if (!result || result.totalAnnual <= 0) {
    return { priced: false, text: `${out} ยังคิดให้ไม่ได้ครับ\n\n- อยู่นอกช่วงที่รับประกัน` };
  }
  // the page shows no price off a lapsed table, and neither does the chat
  if (result.meta.expired) {
    return {
      priced: false,
      text: `${out}\n\n⚠️ ตารางเบี้ยชุดนี้ (${result.meta.version}) หมดอายุ ${result.meta.expiresOn} แล้ว เดี๋ยวแอดมินเช็กราคาปัจจุบันให้ก่อนนะครับ`,
    };
  }

  const modes = bundleModePremiums(bundle, pkg.no, { age: who.age, sex: who.sex }, today) ?? [];
  const per = (m: string) => modes.find((x) => x.mode === m);
  const part = (code: string) => result.items.find((i) => i.code === code)?.annual ?? 0;

  const lines = [
    `**${CANCER_LABEL}** ทุน ${pkg.cpr.toLocaleString("en-US")} บาท · ชดเชยวันละ ${pkg.hic.toLocaleString("en-US")} · ${SEX_WORD[who.sex]} อายุ ${who.age} ปี`,
    "",
    `💰 เบี้ย**ปีแรก** **${formatBaht(result.totalAnnual)} บาท/ปี**`,
  ];
  const half = per("semi");
  const monthly = per("monthly");
  if (half && !half.belowMinimum) lines.push(`ราย 6 เดือน ${formatBaht(half.total)} บาท`);
  if (monthly && !monthly.belowMinimum) lines.push(`รายเดือน ${formatBaht(monthly.total)} บาท`);
  lines.push(
    `(มะเร็ง CPR ${formatBaht(part(CANCER_RIDER))} + ชดเชยรายวัน HIC ${formatBaht(part(CANCER_DAILY_RIDER))}`
      + ` + Life Protect x 2 ทุน ${pkg.base.toLocaleString("en-US")} ${formatBaht(part(bundle.variant))})`,
    "",
    "🎗 ตรวจพบมะเร็ง รับเงินก้อนตามระยะ",
    ...CPR_STAGES.map((s) => `- ${s.label} ${cprStagePays(s, pkg.cpr).toLocaleString("en-US")} บาท${s.major ? " (หักส่วนที่จ่ายไปแล้ว)" : ""}`),
    "",
    `🏥 นอนโรงพยาบาลเพราะมะเร็ง ชดเชยวันละ ${pkg.hic.toLocaleString("en-US")} บาท สูงสุด ${HIC_MAX_DAYS} วัน · ระยะลุกลามขยายอีก ${HIC_INVASIVE_EXTRA_DAYS} วัน`,
    "",
    "CPR และ HIC เป็นสัญญาปีต่อปี เบี้ยปีถัดไปขยับตามอายุครับ",
    `ดูเบี้ยทุกแพ็กเกจได้ที่ [หน้าประกันมะเร็ง](/cancer)`,
  );

  const cards = [cardPath({ kind: "bundle", bundleCode: CANCER_BUNDLE, tier: pkg.no, age: who.age, sex: who.sex, mode: "annual" })];
  const guide = sumButtons(
    [500_000, 1_000_000, 2_000_000, 3_000_000].filter((n) => n !== pkg.cpr).slice(0, 3),
  );
  return { priced: true, text: lines.join("\n"), cards, guide };
}
