import { getPlan, listChatPlans } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";

/**
 * Questions offered as buttons, so that nobody has to guess what this can be asked.
 *
 * An empty box with a cursor in it is itself a question — what does this thing know? — and
 * most people who arrive here are customers rather than agents, who do not know the plans by
 * name and will not invent "iHealthy มีระยะเวลารอคอยกี่วัน" on their own.
 *
 * The rule the whole file is built around: **a button must lead somewhere**. One that comes
 * back "ข้อมูลนี้ไม่มีในระบบ" is worse than no button at all, because the reader learns the
 * assistant is useless from the one question the page itself put in their hand. So every
 * button here is exercised by a test that asserts a real answer comes back, and everything
 * that can be read off the registry — the plan names, the packages, the minimum sums — is
 * read off it rather than typed out, so that adding a plan cannot leave a stale button behind.
 */

export interface GuideItem {
  /** what the button says */
  label: string;
  /** what pressing it asks, which is always a whole question */
  ask: string;
}

export interface GuideGroup {
  title: string;
  /** a money question the engine prices, or a rule the library answers */
  kind: "price" | "rule";
  /** on the screen before anything is pressed; the rest wait behind one more press */
  open?: boolean;
  items: GuideItem[];
}

const SEX_WORD = { M: "ชาย", F: "หญิง" } as const;

/** A sum written the way the buttons say it, in millions where that reads better. */
function millions(sum: number): string {
  return `${(sum / 1_000_000).toLocaleString("en-US")} ล้าน`;
}

/** The years a package is paid for, off the company's own label. */
function yearsOf(label: string | undefined): number | undefined {
  const m = label?.match(/ชำระเบี้ย\s*(\d{1,2})\s*ปี/);
  return m ? Number(m[1]) : undefined;
}

/**
 * An example that this plan will actually accept.
 *
 * Life Treasure starts at ten million, so the one-million example every plan used to carry
 * sent the reader straight into a refusal — from a button the page offered them.
 */
function exampleSum(code: string, variant: string): number {
  const plan = getPlan(code);
  if (!plan) return 1_000_000;
  const { min } = baseSumAssuredLimits(plan.rules, variant);
  return min && min > 1_000_000 ? min : 1_000_000;
}

/** The whole question a priced example is asked as, so the button needs no memory behind it. */
function priceAsk(
  code: string, label: string, age: number, sex: "M" | "F", sum: number, years?: number,
): string {
  const term = years ? ` จ่าย ${years} ปี` : "";
  return `${label} ${SEX_WORD[sex]} ${age} ทุน ${millions(sum)}${term} เบี้ยเท่าไหร่`;
}

/**
 * The four things people come for, asked the way a customer would ask them.
 *
 * The page used to open on the plans by their company names — "iSmart 80/6 · ชาย 35 ทุน 1
 * ล้าน" — which is how an agent thinks and not how a customer does. A customer knows they
 * want life cover, or their hospital bills paid, or a pension; so the open buttons are one
 * per need, and the plan behind each is named in the question only where the router needs
 * the name to find it (CI 123 has no everyday word that points at it alone).
 *
 * Written out by hand, unlike the registry buttons below, because each of them lands on a
 * different machine. `copilot-guide-buttons` presses every one and checks a figure comes back.
 */
const NEEDS: GuideItem[] = [
  { label: "ผู้ชาย 35 อยากมีประกันชีวิต 1 ล้าน จ่ายปีละเท่าไหร่", ask: "ผู้ชาย 35 อยากมีประกันชีวิต 1 ล้าน จ่ายปีละเท่าไหร่" },
  // a ceiling the plan list really has, which is what makes the health brain quote rather than chat
  { label: "ผู้หญิง 30 ประกันสุขภาพ วงเงิน 3 ล้าน เบี้ยเท่าไหร่", ask: "ผู้หญิง 30 ประกันสุขภาพ วงเงิน 3 ล้าน เบี้ยเท่าไหร่" },
  { label: "ผู้ชาย 35 ประกันโรคร้าย ทุน 1 ล้าน เบี้ยเท่าไหร่", ask: "ผู้ชาย 35 ประกันโรคร้าย CI 123 ทุน 1 ล้าน เบี้ยเท่าไหร่" },
  // "ประกันมะเร็ง" is the /cancer set by the owner's rule, priced at one of its eight packages
  { label: "ผู้หญิง 35 ประกันมะเร็ง ทุน 1 ล้าน เบี้ยเท่าไหร่", ask: "ผู้หญิง 35 ประกันมะเร็ง ทุน 1 ล้าน เบี้ยเท่าไหร่" },
  // the pension age and paying term said outright, or the answer is a question back instead
  // of a figure; the label leaves them off to fit a phone on one line, and the answer states both
  { label: "ผู้ชาย 40 อยากมีบำนาญเดือนละ 10,000", ask: "ผู้ชาย 40 อยากได้บำนาญเดือนละ 10,000 ตอนอายุ 60 จ่ายเบี้ยจนเกษียณ" },
];

/**
 * What people ask once they have cover, or before they trust it.
 *
 * Every one of these opens a block of `health-knowledge` or lands on a written answer in the
 * health brain's FAQ — the library holds the claim timeline, the pay-first cases, the คปภ.
 * admission rules and the twenty-one exclusions, so none of them can come back "ไม่มีในระบบ".
 * None names a money word, or the pricing path would take it and ask for an age.
 */
const CLAIMS: GuideItem[] = [
  { label: "เคลมยังไง ต้องสำรองจ่ายก่อนไหม", ask: "เคลมยังไง ต้องสำรองจ่ายก่อนไหม" },
  { label: "นอนโรงพยาบาลแบบไหนถึงเคลมได้", ask: "นอนโรงพยาบาลแบบไหนถึงเคลมได้" },
  { label: "กรณีไหนบ้างที่เคลมไม่ได้", ask: "กรณีไหนบ้างที่เคลมไม่ได้" },
];

/**
 * The buttons shown before anything has been asked.
 *
 * Grouped by what the reader wants rather than by how the system is built. Two groups are
 * open — the needs and the claims, eight buttons, which still leaves the box you type in on
 * a phone screen — and the plans by name and the finer rules wait behind one press.
 */
export function openingGuide(): GuideGroup[] {
  const priceItems: GuideItem[] = [];
  for (const { code, name } of listChatPlans()) {
    const plan = getPlan(code);
    if (!plan) continue;
    // already the first open button, asked as ประกันชีวิต
    if (code === "LIFEPROTECT") continue;

    /**
     * iShield is asked the other way round — a saving in, the cover it buys back — so its
     * example is a monthly saving, which its own brain prices. It used to be "คิดเบี้ยยังไง",
     * answered by sending the reader to another page.
     */
    if (plan.rules.base.premiumBasis) {
      priceItems.push({
        label: `${name} · ชาย 35 ออมเดือนละ 3,000`,
        ask: `${name} ชาย 35 จ่ายเบี้ยเดือนละ 3,000 ได้ทุนเท่าไหร่`,
      });
      continue;
    }

    const variants = plan.rates.base.variants ?? [];
    const variant = plan.defaultVariant ?? variants[0];
    if (!variant) continue;
    const sum = exampleSum(code, variant);
    /** the age the example is for; inside every plan's range, and the one agents quote most */
    const age = code === "LIFETREASURE" ? 40 : 35;
    const years = variants.length > 1 ? yearsOf(plan.variantLabels[variant]) : undefined;
    // 12 พีแอล opens on the company's own sample, as its page does: a woman of 44, 3 million
    if (code === "12PL") {
      priceItems.push({ label: "12PL · หญิง 44 ทุน 3 ล้าน", ask: priceAsk(code, name, 44, "F", 3_000_000, undefined) });
      continue;
    }
    priceItems.push({
      label: `${name} · ชาย ${age} ทุน ${millions(sum)}`,
      ask: priceAsk(code, name, age, "M", sum, years),
    });
  }

  return [
    { title: "อยากรู้เบี้ย — เลือกตามที่อยากได้", kind: "price", open: true, items: NEEDS },
    { title: "เรื่องเคลม", kind: "rule", open: true, items: CLAIMS },
    { title: "แบบประกันอื่น", kind: "price", items: priceItems },
    {
      title: "เงื่อนไขแบบประกัน",
      kind: "rule",
      items: [
        { label: "Life Protect ทุนขั้นต่ำเท่าไหร่", ask: "Life Protect ทุนขั้นต่ำเท่าไหร่" },
        { label: "Life Protect รับประกันถึงอายุเท่าไหร่", ask: "Life Protect รับประกันถึงอายุเท่าไหร่" },
        { label: "iHealthy Ultra คุ้มครองอะไรบ้าง", ask: "iHealthy Ultra คุ้มครองอะไรบ้าง" },
        { label: "ยื่นเคลมแล้วได้เงินภายในกี่วัน", ask: "ยื่นเคลมแล้วได้เงินภายในกี่วัน" },
        { label: "ซื้อประกันสุขภาพแล้วเคลมได้เลยไหม", ask: "ซื้อประกันสุขภาพแล้วเคลมได้เลยไหม" },
        // no "ประกันสุขภาพ" in it, or the health brain takes a question the cancer section answers
        { label: "ประกันมะเร็งจ่ายเงินตอนไหนบ้าง", ask: "ประกันมะเร็งจ่ายเงินตอนไหนบ้าง" },
        { label: "DCI ซื้อได้ถึงอายุเท่าไหร่", ask: "DCI ซื้อได้ถึงอายุเท่าไหร่" },
        { label: "HIC ซื้อคู่กับ MEB ได้ไหม", ask: "HIC ซื้อคู่กับ MEB ได้ไหม" },
      ],
    },
  ];
}

/** What the pricing path could not work out from the message, so the buttons can supply it. */
export interface PriceGap {
  planCode: string;
  planLabel: string;
  /** the package, once it is known */
  variant?: string;
  age?: number;
  sex?: "M" | "F";
  sumAssured?: number;
  needs: ("person" | "sum" | "term")[];
}

/**
 * The next questions worth asking, given where a quotation got to.
 *
 * Each button carries the whole question rather than the missing piece alone, because a plan
 * without a brain keeps nothing between turns: "10 ปี" on its own is a sentence about
 * nothing. Rebuilding the question from the facts also means the reader's own phrasing —
 * however they wrote it — cannot carry a mistake forward.
 */
export function priceFollowUps(gap: PriceGap): GuideItem[] {
  const plan = getPlan(gap.planCode);
  if (!plan) return [];
  const variants = plan.rates.base.variants ?? [];

  const asked = (over: Partial<PriceGap>) => {
    const g = { ...gap, ...over };
    const years = g.variant ? yearsOf(plan.variantLabels[g.variant]) : undefined;
    return priceAsk(
      g.planCode, g.planLabel, g.age ?? 35, g.sex ?? "M",
      g.sumAssured ?? exampleSum(g.planCode, g.variant ?? variants[0] ?? ""),
      variants.length > 1 ? years : undefined,
    );
  };

  // one gap at a time, in the order the quotation needs them: who, then how much, then how long
  if (gap.needs.includes("person")) {
    return [35, 45].flatMap((age) => (["M", "F"] as const).map((sex) => ({
      label: `${SEX_WORD[sex]} ${age} ปี`,
      ask: asked({ age, sex }),
    })));
  }

  if (gap.needs.includes("sum")) {
    const base = exampleSum(gap.planCode, gap.variant ?? variants[0] ?? "");
    return [base, base * 2, base * 5].map((sumAssured) => ({
      label: `ทุน ${millions(sumAssured)}`,
      ask: asked({ sumAssured }),
    }));
  }

  if (gap.needs.includes("term")) {
    return variants
      .map((v) => ({ v, years: yearsOf(plan.variantLabels[v]) }))
      .filter((x): x is { v: string; years: number } => x.years !== undefined)
      .map(({ v, years }) => ({ label: `ชำระเบี้ย ${years} ปี`, ask: asked({ variant: v }) }));
  }

  /**
   * Nothing is missing, so the quotation is on the screen. What a person wants next is the
   * same contract at the other lengths — the single comparison that changes the number most.
   */
  return variants
    .filter((v) => v !== gap.variant)
    .map((v) => ({ v, years: yearsOf(plan.variantLabels[v]) }))
    .filter((x): x is { v: string; years: number } => x.years !== undefined)
    .map(({ v, years }) => ({ label: `ถ้าจ่าย ${years} ปีล่ะ`, ask: asked({ variant: v }) }));
}

/**
 * After the dispatcher has priced something.
 *
 * Only questions the brains recognise themselves — these are the exact phrasings their own
 * readers match, which is what keeps a button from landing on a model that cannot draw a
 * table.
 */
export const PRICED_FOLLOW_UPS: GuideItem[] = [
  { label: "ขอตารางมูลค่า", ask: "ขอดูตารางมูลค่าหน่อย" },
  { label: "มีแบบถูกกว่านี้ไหม", ask: "มีแบบถูกกว่านี้ไหม" },
];
