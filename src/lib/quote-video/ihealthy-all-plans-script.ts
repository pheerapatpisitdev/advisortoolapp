import type { PayMode } from "@/calc/types";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { WORDS } from "@/lib/ihealthy-words";
import { allPlansFacts, type AllPlansFacts } from "./ihealthy-all-plans";
import { allPlansForeign } from "./ihealthy-foreign";
import { cleanCustomerName, spokenBy, type QuoteVideoFacts, type SceneScript, type VideoInput } from "./script";

/**
 * วิดีโอเทียบ 4 แผน's facts and lines (owner chose ข, 2026-11-11, mockup
 * https://claude.ai/artifact/LBAU1dE46qCwQk8weQYiJY): six scenes — the plans for whom, every
 * plan's first-year price in the page's instalment, the yearly limits and the room, what every
 * plan pays as charged, what the higher plans add, the contact. Every figure is the
 * page's (ihealthy-all-plans.ts); the wording is iHealthy's own: ค่าใช้จ่าย, ปีแรก, no per-day price.
 */

const comma = (n: number) => n.toLocaleString("en-US");
const SEX_WHO = { M: "คุณผู้ชาย", F: "คุณผู้หญิง" } as const;

/** what every plan pays as charged, said short, by the sheet's category (the Thai voice) */
const SAME_SAID: Record<string, string> = { "2": "ค่ารักษาในโรงพยาบาล", "4": "ผ่าตัด", "9": "ล้างไต", "10": "มะเร็ง", "11": "มะเร็ง", "12": "รถพยาบาล" };
/** what the higher plans add, said short; complications of childbirth only to a woman */
const EXTRA_SAID: Record<string, string> = { "14": "พยาบาลพิเศษ", "15": "ทันตกรรมจากอุบัติเหตุ", "16": "ศัลยกรรมในช่องปาก", "17": "ภาวะแทรกซ้อนจากการคลอด" };

/** the categories a voice names, each once, in the sheet's order */
export function saidOf(keys: string[], said: Record<string, string>): string[] {
  return [...new Set(keys.flatMap((k) => (said[k] ? [said[k]] : [])))];
}
/** what the voice names as an extra: row 17 only to a woman */
export const extraKeys = (g: AllPlansFacts["extras"][number], sex: "M" | "F") =>
  g.rows.map((r) => r.key as string).filter((k) => k !== "17" || sex === "F");

/** "ก ข และ ค" */
const thaiList = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(" ")} และ${xs[xs.length - 1]}`);

/** The clip's facts: the page's table, set in the shape the other scenes and the post read. */
export function allPlansVideoFacts(
  v: Extract<VideoInput, { product: "IHEALTHY" }> & { allPlans: PayMode },
  today: Date = new Date(),
): QuoteVideoFacts | undefined {
  const lang = v.lang ?? "th";
  const a = allPlansFacts(v.sex, v.age, v.allPlans, lang, today);
  if (!a) return undefined;
  const top = a.plans[a.plans.length - 1];
  return {
    product: "IHEALTHY",
    ...(lang !== "th" ? { lang } : {}),
    planLine: "iHealthy Ultra Package",
    insuredWho: a.words.who,
    insuredLine: a.words.who,
    sex: v.sex,
    age: v.age,
    planName: "iHealthy Ultra Package",
    lead: { label: a.words.coverTitle, amount: comma(top.ceilingBaht), baht: top.ceilingBaht },
    leadMark: a.words.lead,
    priceTitle: a.words.priceTitle,
    prices: a.plans.map((p) => ({ label: p.name, amount: comma(p.premium), main: false })),
    spokenPrice: { per: WORDS.th.mode[v.allPlans], amount: comma(a.plans[0].premium) },
    pills: [],
    priceNotes: [a.words.priceNote],
    coverTitle: a.words.coverTitle,
    cover: a.plans.map((p) => ({ label: p.name, amount: p.ceiling, mark: true })),
    coverStyle: "rows",
    coverToAge: iHealthyFacts().terms.renewalToAge,
    lifeSum: a.lifeSum,
    allPlans: a,
  };
}

/** the six lines (five where no plan adds anything, as for a child), in the clip's language */
export function allPlansScript(f: QuoteVideoFacts, a: AllPlansFacts, customer: string | undefined, narrator: "F" | "M"): SceneScript[] {
  const name = cleanCustomerName(customer);
  if (f.lang && f.lang !== "th") return allPlansForeign(f, a, f.lang, name);
  const n = a.plans.length;
  const first = a.plans[0];
  const last = a.plans[n - 1];
  const hello = name ? `สวัสดีค่ะ คุณ${name}` : "สวัสดีค่ะ";
  const who = name ? `อายุ ${f.age} ปี` : `${SEX_WHO[f.sex]}อายุ ${f.age} ปี`;
  const prices = a.plans.map((p, i) => `${i === n - 1 && n > 1 ? "และ " : ""}${p.name} ${comma(p.premium)} บาท`).join(" ");
  const same = saidOf(a.same.map((r) => r.key), SAME_SAID);
  const extras = a.extras.map((g) => {
    const rows = saidOf(extraKeys(g, f.sex), EXTRA_SAID);
    const opd = g.opd ? `ค่าหมอค่ายา OPD ${g.opd.amounts.map((x) => `${x.name} ปีละ ${x.amount} บาท`).join(" ")}` : "";
    const all = opd ? [...rows, opd] : rows;
    return `ถ้าเลือก ${g.plans.join(" หรือ ")} จะได้เพิ่ม ${thaiList(all)}`;
  });
  const lines: SceneScript[] = [
    { key: "lead", voice: `${hello} วันนี้ขอเทียบแผนประกันสุขภาพ iHealthy Ultra ทั้ง ${n} แผนให้ดูในคลิปเดียวนะคะ สำหรับ${who}ค่ะ` },
    { key: "price", voice: `ปีแรก ค่าใช้จ่าย${WORDS.th.mode[a.mode]} ${prices} รวมประกันชีวิตทุน ${comma(a.lifeSum)} บาท${a.dailyCash !== null ? " กับค่าชดเชยรายวัน" : ""}ไว้แล้วค่ะ` },
    { key: "cover", voice: `วงเงินค่ารักษาต่อปี ตั้งแต่ ${first.ceiling} ไปจนถึง ${last.ceiling}บาท ค่าห้องวันละ ${first.room} ไปจนถึง ${last.room} บาทค่ะ` },
    ...(same.length ? [{ key: "value" as const, voice: `ที่เหมือนกันทุกแผน คือ${thaiList(same)} จ่ายตามจริงทั้งหมด ไม่มีค่าใช้จ่ายส่วนแรกค่ะ` }] : []),
    ...(extras.length ? [{ key: "compare" as const, voice: `${extras.join(" ")}ค่ะ` }] : []),
    { key: "contact", voice: name ? `คุณ${name}สนใจแผนไหน ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ` : "สนใจแผนไหน ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ" },
  ];
  return lines.map((s) => ({ key: s.key, voice: spokenBy(s.voice.replace(/\s+/g, " ").trim(), narrator) }));
}

/** the words the clip goes up to a Page with: its own figures, never a name */
export function allPlansCaption(f: QuoteVideoFacts, a: AllPlansFacts): string {
  const who = `${SEX_WHO[f.sex]}อายุ ${f.age}`;
  return [
    `เทียบประกันสุขภาพ iHealthy Ultra ${a.plans.length} แผน · ${who}`,
    `ค่าใช้จ่ายปีแรก ${WORDS.th.mode[a.mode]}: ${a.plans.map((p) => `${p.name} ${comma(p.premium)} บาท`).join(" · ")}`,
    `วงเงินต่อปี ${a.plans[0].ceiling} ถึง ${a.plans[a.plans.length - 1].ceiling}บาท · ต่ออายุได้ถึงอายุ ${f.coverToAge}`,
    "",
    "ทักแชทขอใบเสนอของคุณได้เลย",
  ].join("\n");
}
