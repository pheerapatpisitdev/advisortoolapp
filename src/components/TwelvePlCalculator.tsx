"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { markPdfReady } from "@/lib/quote-pdf/prepare";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { showModes } from "@/lib/pay-prefs";
import { formatBaht, formatSatang } from "@/calc/money";
import { displayPremium, perDayText } from "@/lib/legacy-cta";
import type { LifeProtectIllness, LifeProtectRider } from "@/lib/lifeprotect-table";
import {
  accidentOverCap, addModes, illnessModes, illnessSaMax, illnessWhyNot, riderDueByYear, lifeProtectModes, medicalModes, medicalPlansAt, needsParent,
  payYears, pickedRider, riderModes, riderSoldAt, riderWaiveYears, termAt, totalModes, type Payer, type RiderPick,
} from "@/lib/lifeprotect-quote";
import { cashProjection } from "@/lib/cash-projection";
import { OCCUPATION_NOTE } from "@/calc/riders/rate-per-thousand";
import {
  childPriceNote, illnessDeathLine, illnessLabel, lifeProtectFootnote, payerWords as payerWordsFor,
  riderWords, waiverNote, type LifeProtectAge,
} from "@/lib/lifeprotect-cta";
import { cardPath, valueTablePath, type CardRiders } from "@/lib/card-link";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { TWELVEPL_SUMS, planInitialFromTable, twelvePlLinkSum, twelvePlTypedSum } from "@/lib/quote-pdf/pages";
import { Highlighted } from "@/components/Highlighted";
import { PanelPhoto } from "@/components/sales/PanelPhoto";
import { LegacyHeadline, PremiumSummary } from "@/components/sales/PremiumSummary";
import { legacyLevel } from "@/lib/legacy-headline";
import type { TwelvePlTable } from "@/lib/twelvepl-table";
import { excelRound, twelvePlTotals, twelvePlYears } from "@/lib/twelvepl-benefits";
import { twelvePlQuoteText } from "@/lib/twelvepl-cta";
import { TwelvePlValueTable } from "@/components/twelvepl/TwelvePlValueTable";

/** The workbook's own sample opens the page: 3 million, a woman of 44 (12PL_A2026-1). */
const SUM_START = 3_000_000;
const SUM_START_INDEX = TWELVEPL_SUMS.indexOf(SUM_START);
const AGE_START = 44;
const SEX_START: Sex = "F";
const VARIANT = "12PL";
/** what a tax-deductible life premium may take off income each year */
const TAX_CAP = 100_000;
/** "5.8 ล้าน", "8.5 แสน" */
const sumShort = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(2)} ล้าน` : `${+(n / 100_000).toFixed(1)} แสน`);
const AGE_START_PAYER = 35;
const PAYER_START: Payer = { sex: "M", age: AGE_START_PAYER };
/** The sums a critical-illness rider offers as buttons; any other is typed in the fourth box (owner, 2026-10-28) */
const ILLNESS_SUMS = [500_000, 1_000_000, 2_000_000];
/** A typed critical-illness sum lands on a step of this size, inside what the rider is written for. */
const ILLNESS_STEP = 10_000;
const illnessTypedSum = (r: LifeProtectIllness, max: number, n: number) =>
  Math.min(max, Math.max(r.saMin, Math.round(n / ILLNESS_STEP) * ILLNESS_STEP));
/** The two groups of riders with a sum of their own, as the page lists them (owner, 2026-11-18, ก ก); the same as Life Protect's. */
const ILLNESS_GROUPS: { group: LifeProtectIllness["group"]; title: string; renew: string }[] = [
  { group: "illness", title: "โรคร้ายแรง", renew: "เป็นเบี้ยปีนี้ ปรับตามอายุเมื่อต่อสัญญา" },
  { group: "accident", title: "อุบัติเหตุ", renew: `${OCCUPATION_NOTE} · ต่ออายุปีต่อปี คุ้มครองถึงอายุ 65 · ทุนรวมกันไม่เกิน 5 เท่าของทุนหลัก` },
];
/** "5 แสน", "1 ล้าน" on a quarter of a phone screen */
const sumWord = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000} ล้าน` : `${n / 100_000} แสน`);

/**
 * The ages a rider is sold at, as the button and its popup say them. A rider a parent can
 * also buy for a child has two windows with a gap between them, and both are said.
 */
function riderAges(r: LifeProtectRider): string {
  return r.child ? `0-${r.child.ageMax}, ${r.ageMin}-${r.ageMax} ปี` : `${r.ageMin}-${r.ageMax} ปี`;
}

/** A flavour's name with the contract's own name taken off the front: "ฟิต", "บียอนด์". */
function optionWord(riderName: string, optionName: string): string {
  return optionName.replace(riderName.split(" (")[0], "").trim() || optionName;
}

/**
 * What a button means, shown while the pointer rests on it.
 *
 * A rider's name is four syllables that tell a stranger nothing, and the panel has no room
 * for the sentence that would. On a mouse there is a spare gesture for exactly this, so the
 * explanation lives here rather than as prose nobody reads before they have a question.
 *
 * From `sm` up only: a phone has no hover, and a popup opened by the tap that picks the
 * rider would cover the flavours it is asking about. A phone is left with the line under the
 * price, which says the one thing it would be costly to assume — that none of this money
 * reaches the family.
 *
 * It is anchored to whichever edge of the button keeps it inside the panel, and takes no
 * pointer events, so it can never sit between the cursor and the button underneath it.
 */
function Hint({ align, children }: { align: "left" | "right"; children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-full z-20 mt-2 hidden w-64 rounded-sm border border-[var(--lg-hair)]
        bg-[var(--lg-raise)] p-3 text-left shadow-xl sm:group-hover:block sm:group-focus-within:block ${
        align === "left" ? "left-0" : "right-0"
      }`}
    >
      {children}
    </span>
  );
}

export interface TwelvePlCalculatorProps {
  table: TwelvePlTable;
  sticky?: boolean;
  hide?: PayMode[];
  /** ข้อความส่งให้ลูกค้า: not offered for this plan yet, so the standard text is copied */
  pen?: boolean;
}

/**
 * The 12 พีแอล calculator: sum, age, sex and the riders the Life Protect page sells, priced in
 * the browser from the table; then what the plan hands back — a cash back every year from the
 * second, 115% at 85 — and the company's dividend examples in a table with a switch (owner
 * chose ก ก ก, 2026-11-18).
 */
export function TwelvePlCalculator({ table, sticky = false, hide = [] }: TwelvePlCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sums, setSums] = useState<readonly number[]>(TWELVEPL_SUMS);
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  const [sumTyped, setSumTyped] = useState<string | null>(null);
  const settleSum = () => {
    const digits = sumTyped?.replace(/\D/g, "") ?? "";
    if (digits !== "") {
      const sum = twelvePlTypedSum(Number(digits));
      const stops = sums.includes(sum) ? sums : [...sums, sum].sort((a, b) => a - b);
      setSums(stops);
      setSumIndex(stops.indexOf(sum));
    }
    setSumTyped(null);
  };
  const variant = VARIANT;
  const [age, setAge] = useState<LifeProtectAge>(AGE_START);
  const [sex, setSex] = useState<Sex>(SEX_START);
  /** which dividend example the table shows; ตัวอย่างที่ 2 (index 1) to start, as the mockup did */
  const [example, setExample] = useState<number | null>(1);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const initial = planInitialFromTable(new URLSearchParams(window.location.search), {
      sums: twelvePlLinkSum, variants: [VARIANT], ageMin: table.ageMin, ageMax: table.ageMax,
    });
    if (initial) {
      const stops = TWELVEPL_SUMS.includes(initial.sumAssured)
        ? TWELVEPL_SUMS
        : [...TWELVEPL_SUMS, initial.sumAssured].sort((a, b) => a - b);
      setSums(stops);
      setSumIndex(stops.indexOf(initial.sumAssured));
      setAge(initial.age as typeof age);
      setSex(initial.sex);
    }
    setSeeded(true);
  }, [table]);
  useEffect(() => {
    if (seeded) markPdfReady();
  }, [seeded]);
  const [pick, setPick] = useState<RiderPick | null>(null);
  const [payer, setPayer] = useState<Payer>(PAYER_START);
  const [medicalPlan, setMedicalPlan] = useState<number | null>(null);
  const [illnessOn, setIllnessOn] = useState<Record<string, boolean>>({});
  const [illnessSum, setIllnessSum] = useState<Record<string, number>>({});
  const [illnessTyped, setIllnessTyped] = useState<Record<string, string>>({});

  const term = termAt(table, variant);
  const ageNum = typeof age === "number" ? age : undefined;
  const sumAssured = sums[sumIndex];
  const who = ageNum !== undefined ? { sex, age: ageNum, sumAssured } : undefined;

  const modes = who ? lifeProtectModes(table, term, who) : undefined;
  const annual = modes?.find((m) => m.mode === "annual");

  const riderOffered = (r: LifeProtectRider) => ageNum !== undefined && riderSoldAt(r, ageNum);
  const chosen = pickedRider(table, pick ?? undefined);
  const picked = chosen && riderOffered(chosen.rider) ? chosen : undefined;
  const askPayer = picked !== undefined && ageNum !== undefined && needsParent(picked.rider, ageNum);
  const payerFor = askPayer ? payer : undefined;
  const riderPrice = who && picked && annual && !table.expired
    ? riderModes(table, term, who, picked, annual.total, payerFor)
    : undefined;

  const medical = table.medical;
  const medicalPlans = medical && ageNum !== undefined ? medicalPlansAt(table, medical, ageNum) : [];
  const medicalAt = medicalPlan === null ? undefined : [...medicalPlans].reverse().find((p) => p <= medicalPlan);
  const medicalPrice = medical && ageNum !== undefined && medicalAt !== undefined && !table.expired
    ? medicalModes(table, medical, ageNum, medicalAt)
    : undefined;
  const medicalName = medical && medicalAt !== undefined
    ? `${medical.name} แผน ${medicalAt.toLocaleString("en-US")}`
    : undefined;

  const illnessEach = table.illness.map((rider) => {
    const on = illnessOn[rider.code] === true;
    // AP and ECARE are held to a multiple of the plan's sum as well as their own cap
    const max = illnessSaMax(rider, ageNum ?? AGE_START, sumAssured);
    const sum = illnessSum[rider.code] ?? Math.min(max, Math.max(rider.saMin, sumAssured));
    const insured = who ? { sex, age: who.age, sumAssured: sum } : undefined;
    const price = on && insured && !table.expired ? illnessModes(table, rider, insured, sumAssured) : undefined;
    const whyNot = on && insured ? illnessWhyNot(table, rider, insured, sumAssured) : undefined;
    return { rider, on, sum, max, price, whyNot };
  });
  /** AP and ECARE together past 5 times the plan's sum: both stay picked, neither is priced, and it is said why */
  const accidentOver = accidentOverCap(
    table, illnessEach.filter((i) => i.price).map((i) => ({ code: i.rider.code, sumAssured: i.sum })), sumAssured,
  );
  const illness = accidentOver
    ? illnessEach.map((i) => (i.rider.group === "accident" && i.price ? { ...i, price: undefined, whyNot: accidentOver } : i))
    : illnessEach;
  const illnessPriced = illness.filter((i) => i.price);
  const renewing = [...(medicalPrice && medical ? [medical.code] : []), ...illnessPriced.map((i) => i.rider.short)];

  const paid = showModes(
    modes ? totalModes(table, modes, addModes(riderPrice, medicalPrice, ...illnessPriced.map((i) => i.price))) : undefined,
    hide,
  );
  const headline = displayPremium(paid, table.expired);
  const paidAnnual = paid?.find((m) => m.mode === "annual");
  const basePart = headline && modes ? modes.find((m) => m.mode === headline.mode) : undefined;
  const riderPart = headline && riderPrice ? riderPrice.find((m) => m.mode === headline.mode) : undefined;
  const medicalPart = headline && medicalPrice ? medicalPrice.find((m) => m.mode === headline.mode) : undefined;
  const riderLines = [
    ...(picked && riderPart ? [{ name: picked.option.name, own: riderPart }] : []),
    ...(medicalName && medicalPart ? [{ name: medicalName, own: medicalPart }] : []),
    ...(headline ? illnessPriced.flatMap((i) => {
      const own = i.price!.find((m) => m.mode === headline.mode);
      return own ? [{ name: illnessLabel(i.rider, i.sum), own }] : [];
    }) : []),
  ];
  const others = (paid ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total);

  /** what the plan hands back, year by year and in total, from the company's sheets */
  const years = who ? twelvePlYears(table.benefits, who.age, table.ageMin, sumAssured) : [];
  const totals = years.length ? twelvePlTotals(years, table.benefits.maturityPer1000, sumAssured) : undefined;
  const examples = table.benefits.dividendShares
    .map((share, index) => ({ index, share, label: `ปันผล ตัวอย่างที่ ${index + 1}` }))
    .filter((e) => e.share > 0);
  const basePaidTotal = annual && who && !table.expired ? annual.total * payYears(term, who.age) : null;

  const factors = who ? term.schedule[sex][who.age - table.ageMin] : null;
  const riderAnnual = riderPrice?.find((m) => m.mode === "annual")?.total;
  const projection = who && factors
    ? cashProjection({
        factors, age: who.age, sumAssured,
        annualSatang: table.expired || !annual ? null : annual.total,
        payYears: payYears(term, who.age),
        death: { beforeAge: 0, sumBefore: sumAssured, sumFrom: sumAssured, alreadyPastAge: true },
        topUp: table.topUp,
        riderDue: riderDueByYear(
          table, term, who.age, factors.length,
          picked && riderAnnual !== undefined ? { rider: picked.rider, annual: riderAnnual } : undefined,
          medicalPrice && medicalAt !== undefined ? { plan: medicalAt } : undefined,
          illnessPriced.length > 0
            ? { sex, picks: illnessPriced.map((i) => ({ code: i.rider.code, sumAssured: i.sum })) }
            : undefined,
        ),
      })
    : undefined;
  const tableCaption = who
    ? `ทุนประกัน ${sumAssured.toLocaleString("en-US")} บาท · ${sex === "M" ? "ชาย" : "หญิง"} `
      + `${who.age === 0 ? "แรกเกิด" : `${who.age} ปี`} · ชำระเบี้ย 12 ปี · คุ้มครองถึงอายุ ${table.coverToAge}`
      + (annual && paidAnnual && !table.expired
        ? ` · เบี้ย ${formatBaht(annual.total)} บาท/ปี`
          + (paidAnnual.total > annual.total
            ? ` · สัญญาเพิ่มเติมปีแรก ${formatBaht(paidAnnual.total - annual.total)} บาท` : "")
          + (renewing.length > 0 ? ` · เบี้ย ${renewing.join(", ")} ตามอัตราปัจจุบันของแต่ละอายุ` : "")
        : "")
      + (example !== null ? ` · ปันผลตัวอย่างที่ ${example + 1} (ไม่รับรอง)` : "")
    : "";

  const cardRiders: CardRiders | undefined = picked && riderPart || medicalPart || illnessPriced.length > 0
    ? {
        ...(picked && riderPart ? { waiver: { code: picked.rider.code, option: picked.option.code } } : {}),
        ...(picked && riderPart && payerFor ? { payer: payerFor } : {}),
        ...(medicalPart && medicalAt !== undefined ? { medical: medicalAt } : {}),
        ...(illnessPriced.length > 0 ? { illness: illnessPriced.map((i) => ({ code: i.rider.code, sumAssured: i.sum })) } : {}),
      }
    : undefined;
  const card = who && headline
    ? cardPath({
        kind: "plan", planCode: table.planCode, variant, age: who.age, sex, sumAssured, mode: headline.mode, hide,
        ...(cardRiders ? { riders: cardRiders } : {}),
      })
    : undefined;
  const tableCard = who && projection
    ? valueTablePath({
        kind: "plan", planCode: table.planCode, variant, age: who.age, sex, sumAssured, hide, pen: false,
        ...(cardRiders ? { riders: cardRiders } : {}),
      })
    : undefined;
  const payerWords = payerWordsFor(payerFor);
  const deathExtra = illnessPriced.filter((i) => i.rider.paysOnDeath)
    .map((i) => illnessDeathLine(i.rider.short, i.sum, i.rider.coverToAge));
  const quoteText = who && headline && totals && annual && basePaidTotal !== null
    ? twelvePlQuoteText({
        sumAssured, age: who.age, sex, coverToAge: table.coverToAge, modes: [headline, ...others],
        parts: basePart && riderLines.length > 0
          ? {
              base: basePart,
              riders: riderLines.map((l, i) => (i === 0 && picked && riderPart ? { ...l, name: l.name + payerWords } : l)),
            }
          : undefined,
        annualBase: annual.total, totalBase: basePaidTotal,
        cashBacks: totals.cashBacks, maturity: totals.maturity,
        ...(example !== null ? { dividend: { example: example + 1, total: totals.dividends[example] } } : {}),
        renewing, deathExtra,
      })
    : undefined;

  const waiveYears = (r: LifeProtectRider) => (ageNum !== undefined ? riderWaiveYears(r, term, ageNum) : undefined);

  const summary = paid && headline ? (
    <PremiumSummary modes={paid} main={headline.mode}>
      {basePart && riderLines.length > 0 && (
        <>
          <div className="text-xs text-[var(--bot-navy)] opacity-80">แยกตามสัญญา · {PAY_MODE_LABEL[headline.mode]}</div>
          <div className="mt-1.5 space-y-1">
            {[{ name: "สัญญาหลัก", own: basePart }, ...riderLines].map((l, i) => (
              <div key={l.name} className="flex items-baseline justify-between gap-3 text-sm text-[var(--bot-navy)]">
                <span className="min-w-0">{l.name}{i === 1 && picked && riderPart ? payerWords : ""}</span>
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {i > 0 ? "+" : ""}{formatSatang(l.own.total)} บาท
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </PremiumSummary>
  ) : null;

  /** one line of the facts block: what it is on the left, the figure on the right */
  const fact = (label: ReactNode, value: ReactNode, strong = false, key?: string) => (
    <div key={key} className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-[var(--lg-mute)]">{label}</dt>
      <dd className={`lg-figure shrink-0 whitespace-nowrap text-lg tabular-nums ${strong ? "text-[var(--lg-gold)]" : "text-[var(--lg-white)]"}`}>
        {value}
      </dd>
    </div>
  );

  return (
    <div className="calc-split flex flex-col gap-6" data-sex={sex}>
      <div className="calc-side contents">
        <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
          <div>
            <label htmlFor="tp-sum-typed" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
            <div className="lg-figure mt-1.5 flex items-baseline gap-2 text-3xl tabular-nums">
              <input
                id="tp-sum-typed" type="text" inputMode="numeric" autoComplete="off"
                value={sumTyped ?? sumAssured.toLocaleString("en-US")}
                placeholder={sumAssured.toLocaleString("en-US")}
                onFocus={() => setSumTyped("")}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setSumTyped(digits === "" ? "" : Number(digits).toLocaleString("en-US"));
                }}
                onBlur={settleSum}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="lg-metal-text w-[11ch] border-b border-dashed border-[var(--lg-hair)] bg-transparent outline-none focus:border-[var(--lg-gold)]"
              />
              <span className="text-lg text-[var(--lg-mute)]">บาท</span>
            </div>
            <p className="mt-1 text-xs text-[var(--lg-mute)] opacity-70">แตะตัวเลขเพื่อพิมพ์ทุนเท่าไหร่ก็ได้ · 100,000 – 50 ล้าน</p>
            <input
              id="tp-sum" aria-label="ทุนประกัน" type="range" min={0} max={sums.length - 1} step={1} value={sumIndex}
              onChange={(e) => setSumIndex(Number(e.target.value))}
              className="mt-4 w-full accent-[var(--lg-gold)]"
            />
            <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
              <span>{sumShort(sums[0])}</span>
              <span>50 ล้าน</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
              ชำระเบี้ย 12 ปี · คุ้มครองถึงอายุ {table.coverToAge} · เงินคืนทุกปีตั้งแต่ปีที่ 2
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tp-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
              <select
                id="tp-age" value={age}
                onChange={(e) => setAge(e.target.value === "over" ? "over" : Number(e.target.value))}
                className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
              >
                {AGES.map((a) => <option key={a} value={a}>{a === 0 ? "แรกเกิด" : `${a} ปี`}</option>)}
                <option value="over">{table.ageMax + 1} ปีขึ้นไป</option>
              </select>
            </div>
            <div>
              <span className="block text-sm text-[var(--lg-mute)]">เพศ</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["M", "F"] as Sex[]).map((s) => (
                  <button
                    key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s}
                    className={`rounded-sm border py-2.5 text-sm transition-colors ${
                      sex === s ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                    }`}
                  >
                    {s === "M" ? "ชาย" : "หญิง"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {table.riders.length > 0 && (
            <div>
              <span className="block text-sm text-[var(--lg-mute)]">
                สัญญาเพิ่มเติม · {table.riders.length > 1 ? "เลือกได้อย่างใดอย่างหนึ่ง" : "ยกเว้นเบี้ย"}
              </span>
              <div className={`mt-1.5 grid gap-2 ${table.riders.length > 1 ? "grid-cols-3" : "grid-cols-2"}`}>
                <button
                  type="button" onClick={() => setPick(null)} aria-pressed={pick === null}
                  className={`rounded-sm border px-2 py-2.5 text-center transition-colors ${
                    pick === null ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  <span className="block text-sm">ไม่เอา</span>
                  <span className="mt-0.5 block text-xs opacity-70">เฉพาะแบบหลัก</span>
                </button>
                {table.riders.map((r, i) => {
                  const on = pick?.code === r.code;
                  const offered = riderOffered(r);
                  const words = riderWords(r.name);
                  return (
                    <div key={r.code} className="group relative">
                      <button
                        type="button" disabled={!offered} aria-pressed={on}
                        onClick={() => setPick({ code: r.code, option: r.options[0].code })}
                        className={`h-full w-full rounded-sm border px-2 py-2.5 text-center transition-colors ${
                          on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                        }${offered ? "" : " opacity-40"}`}
                      >
                        <span className="block text-sm">{words.short}</span>
                        {/* what the contract does, or the ages it is written over when this one is not */}
                        <span className="mt-0.5 block text-xs opacity-70">
                          {offered ? words.what : riderAges(r)}
                        </span>
                      </button>
                      <Hint align={i === 0 ? "left" : "right"}>
                        <span className="block text-sm font-medium text-[var(--lg-white)]">{r.name}</span>
                        {r.what && (
                          <span className="mt-1 block text-xs leading-relaxed text-[var(--lg-mute)]">{r.what}</span>
                        )}
                        {r.options.map((o) => o.covers && (
                          <span key={o.code} className="mt-1.5 block text-xs leading-relaxed text-[var(--lg-mute)]">
                            <span className="text-[var(--lg-gold)]">{optionWord(r.name, o.name)}</span> · {o.covers}
                          </span>
                        ))}
                        <span className="mt-2 block border-t border-[var(--lg-panel-line)] pt-2 text-xs text-[var(--lg-mute)]">
                          รับอายุ {riderAges(r)}
                          {offered && waiveYears(r) ? ` · ยกเว้นเบี้ยที่เหลืออีก ${waiveYears(r)} ปี` : ""}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--lg-mute)] opacity-75">
                          ช่วยเรื่องการชำระเบี้ย ไม่ได้เพิ่มทุนที่ครอบครัวได้รับ
                        </span>
                      </Hint>
                    </div>
                  );
                })}
              </div>
              {chosen && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {chosen.rider.options.map((o, i) => {
                    const on = pick?.option === o.code;
                    return (
                      <div key={o.code} className="group relative">
                        <button
                          type="button" aria-pressed={on}
                          onClick={() => setPick({ code: chosen.rider.code, option: o.code })}
                          className={`h-full w-full rounded-sm border px-2 py-2 text-center text-sm transition-colors ${
                            on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                          }`}
                        >
                          {optionWord(chosen.rider.name, o.name)}
                        </button>
                        {o.covers && (
                          <Hint align={i === 0 ? "left" : "right"}>
                            <span className="block text-sm font-medium text-[var(--lg-white)]">{o.name}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-[var(--lg-mute)]">คุ้มครอง{o.covers}</span>
                          </Hint>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {askPayer && picked.rider.child && (
                <div className="mt-3">
                  <label htmlFor="tp-payer-age" className="block text-sm text-[var(--lg-mute)]">
                    ผู้ชำระเบี้ย (พ่อหรือแม่)
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-3">
                    <select
                      id="tp-payer-age" value={payer.age}
                      onChange={(e) => setPayer({ ...payer, age: Number(e.target.value) })}
                      className="w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
                    >
                      {Array.from(
                        { length: picked.rider.child.payerMax - picked.rider.child.payerMin + 1 },
                        (_, i) => picked.rider.child!.payerMin + i,
                      ).map((a) => <option key={a} value={a}>{a} ปี</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      {(["M", "F"] as Sex[]).map((s) => (
                        <button
                          key={s} type="button" onClick={() => setPayer({ ...payer, sex: s })} aria-pressed={payer.sex === s}
                          className={`rounded-sm border py-2.5 text-sm transition-colors ${
                            payer.sex === s ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                          }`}
                        >
                          {s === "M" ? "ชาย" : "หญิง"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                    ราคาพีบีคิดจากอายุและเพศของผู้ชำระเบี้ย · ยกเว้นเบี้ยจนเด็กอายุ 25
                  </p>
                </div>
              )}
              {chosen && !picked && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">
                  {riderWords(chosen.rider.name).short} รับอายุ {riderAges(chosen.rider)}
                  {" "}· อายุนี้จึงยังไม่ได้รวมอยู่ในราคา
                </p>
              )}
            </div>
          )}
  
          {medical && (
            <div>
              <span className="block text-sm text-[var(--lg-mute)]">ค่ารักษาพยาบาล (MEB) · เลือกแผน</span>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {[null, ...medical.plans].map((p) => {
                  const on = p === null ? medicalPlan === null : medicalAt === p;
                  const offered = p === null || medicalPlans.includes(p);
                  return (
                    <button
                      key={p ?? "none"} type="button" disabled={!offered} aria-pressed={on}
                      onClick={() => setMedicalPlan(p)}
                      className={`rounded-sm border px-1 py-2.5 text-center text-sm tabular-nums transition-colors ${
                        on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                      }${offered ? "" : " opacity-40"}`}
                    >
                      {p === null ? "ไม่เอา" : p.toLocaleString("en-US")}
                    </button>
                  );
                })}
              </div>
              {medicalPlan !== null && medicalAt === undefined && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">
                  MEB รับอายุ {medical.ageMin} - {medical.ageMax} ปี · อายุนี้จึงยังไม่ได้รวมอยู่ในราคา
                </p>
              )}
              {medicalAt !== undefined && medicalAt !== medicalPlan && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">
                  อายุนี้ซื้อได้สูงสุดแผน {medicalAt.toLocaleString("en-US")}
                </p>
              )}
              {medicalAt !== undefined && (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                  เบี้ย MEB เป็นเบี้ยปีนี้ ต่ออายุปีต่อปีและปรับตามอายุ
                </p>
              )}
            </div>
          )}

          {ILLNESS_GROUPS.map(({ group, title, renew }) => {
            const list = illness.filter((i) => i.rider.group === group);
            const listPriced = list.filter((i) => i.price);
            return list.length > 0 && (
            <div key={group}>
              <span className="block text-sm text-[var(--lg-mute)]">{title} · เลือกได้ทั้ง {list.length} สัญญา</span>
              <div className="mt-1.5 space-y-4">
                {list.map(({ rider, on, sum, max, whyNot }) => {
                  const sold = ageNum === undefined || (ageNum >= rider.ageMin && ageNum <= rider.ageMax);
                  const typed = illnessTyped[rider.code];
                  const settle = () => {
                    const digits = typed?.replace(/\D/g, "") ?? "";
                    if (digits !== "") setIllnessSum((o) => ({ ...o, [rider.code]: illnessTypedSum(rider, max, Number(digits)) }));
                    setIllnessTyped((t) => Object.fromEntries(Object.entries(t).filter(([code]) => code !== rider.code)));
                  };
                  const choice = (label: string, active: boolean, onClick: () => void, disabled = false) => (
                    <button
                      type="button" onClick={onClick} aria-pressed={active} disabled={disabled}
                      className={`rounded-sm border py-1.5 text-sm transition-colors ${
                        active ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                      }${disabled ? " opacity-40" : ""}`}
                    >
                      {label}
                    </button>
                  );
                  return (
                    <div key={rider.code}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 text-sm font-medium text-[var(--lg-white)]">{rider.short}</span>
                        <div className="grid w-36 shrink-0 grid-cols-2 gap-2">
                          {choice("ไม่เอา", !on || !sold, () => setIllnessOn((o) => ({ ...o, [rider.code]: false })))}
                          {choice("เอา", on && sold, () => setIllnessOn((o) => ({ ...o, [rider.code]: true })), !sold)}
                        </div>
                      </div>
                      {on && sold && (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {ILLNESS_SUMS.filter((s) => s >= rider.saMin && s <= max).map((s) => (
                            <button
                              key={s} type="button" onClick={() => setIllnessSum((o) => ({ ...o, [rider.code]: s }))}
                              aria-pressed={sum === s}
                              className={`rounded-sm border px-1 py-2 text-center text-sm transition-colors ${
                                sum === s ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                              }`}
                            >
                              {sumWord(s)}
                            </button>
                          ))}
                          {/* any other sum is typed; it shows here whenever it is not one of the buttons */}
                          <input
                            id={`tp-ci-${rider.code}`} aria-label={`ทุน ${rider.short}`} type="text" inputMode="numeric" autoComplete="off"
                            value={typed ?? (ILLNESS_SUMS.includes(sum) ? "" : sumShort(sum))}
                            placeholder="พิมพ์เอง"
                            onFocus={() => setIllnessTyped((o) => ({ ...o, [rider.code]: "" }))}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                              setIllnessTyped((o) => ({ ...o, [rider.code]: digits === "" ? "" : Number(digits).toLocaleString("en-US") }));
                            }}
                            onBlur={settle}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                            className={`w-full min-w-0 rounded-sm border px-1 py-2 text-center text-sm tabular-nums outline-none ${
                              !ILLNESS_SUMS.includes(sum) && typed === undefined
                                ? "lg-metal-face border-[var(--lg-gold)] font-medium"
                                : "border-[var(--lg-panel-line)] bg-transparent text-[var(--lg-white)] focus:border-[var(--lg-gold)]"
                            }`}
                          />
                        </div>
                      )}
                      {whyNot ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-[var(--lg-gold)]">{whyNot}</p>
                      ) : (
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                          {rider.what} · รับอายุ {rider.ageMin === 0 ? "แรกเกิด" : rider.ageMin}–{rider.ageMax} ปี
                          {rider.coverToAge !== undefined ? ` · คุ้มครองถึงอายุ ${rider.coverToAge}` : ""}
                          {` · ทุน ${sumWord(rider.saMin)} – ${sumWord(max)}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {listPriced.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                  เบี้ย {listPriced.map((i) => i.rider.short).join(" และ ")} {renew}
                </p>
              )}
            </div>
            );
          })}
        </div>
        <div className="order-2">
          <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} />
        </div>
      </div>

      {!who || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          แบบนี้รับถึงอายุ {table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="relative space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          <PanelPhoto sex={sex} age={ageNum} />
          {headline && annual && basePart ? (
            <div>
              <LegacyHeadline
                legacy={legacyLevel(sumAssured, `ทุกช่วงอายุ ถึงอายุ ${table.coverToAge}`)}
                perDay={paidAnnual ? perDayText(paidAnnual.total) : undefined}
              />
              {deathExtra.map((line) => (
                <p key={line} className="mt-2 text-sm leading-relaxed text-[var(--lg-gold)]">{line}</p>
              ))}
              <div className="mt-3">{summary}</div>
              {picked && riderPart && (
                <p className="mt-2.5 text-xs leading-relaxed text-[var(--lg-mute)] opacity-80">
                  {waiverNote(picked.rider.name)}
                </p>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          {totals && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">ผลประโยชน์ตลอดสัญญา</div>
              <dl className="mt-2 space-y-2">
                {basePaidTotal !== null && fact("เบี้ยสัญญาหลักรวม 12 ปี", `${formatBaht(basePaidTotal)} บาท`)}
                {fact(`เงินคืนทุกปี (ปีที่ 2–${years.length - 1})`, `${excelRound(totals.cashBacks).toLocaleString("en-US")} บาท`)}
                {fact(`เงินครบกำหนด อายุ ${table.coverToAge}`, `${excelRound(totals.maturity).toLocaleString("en-US")} บาท`)}
                {fact(<Highlighted>รวมผลประโยชน์รับรอง</Highlighted>, <Highlighted>{`${excelRound(totals.guaranteed).toLocaleString("en-US")} บาท`}</Highlighted>, true)}
                {examples.map((e) => fact(
                  `+ ปันผลตัวอย่างที่ ${e.index + 1} (ไม่รับรอง)`,
                  `${excelRound(totals.dividends[e.index]).toLocaleString("en-US")} บาท`, false, `div-${e.index}`,
                ))}
                {fact(`คุ้มครองชีวิต ถึงอายุ ${table.coverToAge}`, `${sumAssured.toLocaleString("en-US")} บาท`)}
                {annual && fact("ลดหย่อนภาษีได้", `${Math.min(TAX_CAP, Math.round(annual.total / 100)).toLocaleString("en-US")} บาท/ปี`)}
              </dl>
              <p className="mt-2 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
                เงินคืนปีที่ 2 = 0.25% ของทุน เพิ่มปีละ 0.05% จนถึง 1% ตั้งแต่ปีที่ 17 · ครบกำหนดรับ 115% ของทุน
                พร้อมเงินคืนปีสุดท้าย · เสียชีวิตรับทุนประกัน หรือมูลค่าเวนคืน หากมากกว่า
              </p>
            </div>
          )}

          {projection && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <TwelvePlValueTable
                rows={projection.rows}
                years={years}
                example={example}
                examples={examples}
                onExample={setExample}
                caption={tableCaption}
                cardPath={tableCard}
                planName="12 พีแอล (12PL)"
              />
            </div>
          )}

          {ageNum !== undefined && childPriceNote(ageNum) && (
            <p className="text-sm leading-relaxed text-[var(--lg-gold)]">{childPriceNote(ageNum)}</p>
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            {lifeProtectFootnote(renewing)} · ทุนขั้นต่ำ 100,000 บาท
          </p>
        </div>
      )}

      {sticky && (quoteText || card) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons copyText={quoteText} cardPath={card} tableCardPath={tableCard} compact />
        </div>
      )}
    </div>
  );
}
