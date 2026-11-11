"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PayMode, Sex } from "@/calc/types";
import { cellRuns } from "@/components/ihealthy/BenefitTable";
import { PdfButton } from "@/components/ihealthy/PdfButton";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { VIDEO_LABEL } from "@/components/sales/video-label";
import { IHEALTHY_OPENING, resolveArrangement, type IHealthyInitial } from "@/lib/ihealthy-choice";
import {
  compareCells, comparePlans, compareText, visibleLines, type CompareLine, type ComparePlanFacts,
} from "@/lib/ihealthy-compare";
import { compareCardPath, comparePdfPath } from "@/lib/ihealthy-compare-link";
import { compareDailyCash, comparePremium } from "@/lib/ihealthy-compare-premiums";
import { COMPARE_WORDS } from "@/lib/ihealthy-compare-words";
import { planLabel, type IHealthyFacts } from "@/lib/ihealthy-facts";
import { HTML_LANG, type Lang } from "@/lib/ihealthy-lang";
import { queryFrom } from "@/lib/ihealthy-link";
import { MODES, plansFor } from "@/lib/ihealthy-quote";
import { SEND_WORDS } from "@/lib/ihealthy-send-words";
import type { IHealthyTable } from "@/lib/ihealthy-table";
import { baseWords, WORDS } from "@/lib/ihealthy-words";
import { markPdfReady, registerPrepare } from "@/lib/quote-pdf/prepare";
import { videoStartHref } from "@/lib/quote-video/link";

const label = "block text-sm text-[var(--lg-mute)]";
const chip = (on: boolean) =>
  `rounded-sm border px-1 py-2.5 text-center text-sm transition-colors ${
    on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
  }`;

/** The company's colour for a plan, from the sheet (theme.css `--ihu-*`). */
const planHue = (code: string) => `var(--ihu-${code.toLowerCase()})`;
const planWash = (code: string) => `var(--ihu-${code.toLowerCase()}-wash)`;

/**
 * The compare page's form and table. Only who is being quoted and how they pay are asked: the
 * arrangement under the prices is held at the page's opening one, the fifty-thousand package in
 * Thailand on full cover, which is what the page's own premiums are for.
 */
export function IHealthyCompare(
  { table, lines, plans: sheetPlans, participationNote, initial, lang }: {
    table: IHealthyTable;
    lines: CompareLine[];
    plans: IHealthyFacts["plans"];
    participationNote: string;
    initial: IHealthyInitial;
    lang: Lang;
  },
) {
  const w = WORDS[lang];
  const cw = COMPARE_WORDS[lang];
  const ages = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [age, setAge] = useState(initial.age);
  const [sex, setSex] = useState<Sex>(initial.sex);
  const [mode, setMode] = useState<PayMode>(initial.mode);

  const { base: baseVariant, sumAssured, territory, coverage } = IHEALTHY_OPENING;
  const codes = comparePlans(plansFor(table, age).map((p) => p.code));
  const shownLines = visibleLines(lines, codes, age);
  const priced = !table.expired;
  const amount = (code: string, m: PayMode) => comparePremium(code, sex, age, m)?.toLocaleString("en-US") ?? "-";

  const standardPlan = compareDailyCash(table.standard.plan[age - table.ageMin], age, table.juvenileBelowAge);
  const big = (baht: number) => {
    const b = w.big(baht);
    return `${b.num} ${b.unit}`;
  };
  const facts: ComparePlanFacts[] = codes.map((code) => ({
    code,
    name: planLabel(code),
    ceiling: big(sheetPlans.find((p) => p.code === code)?.annualMax ?? 0),
    premiums: MODES.map((m) => ({ label: w.mode[m], amount: amount(code, m) })),
  }));
  const quoteText = priced
    ? compareText({
        age, sex, plans: facts, lines: shownLines, lifeSum: sumAssured,
        ...(standardPlan !== null ? { dailyCash: w.dailyCash(standardPlan) } : {}),
      }, w, cw)
    : undefined;

  // what the picture, the PDF and the address name; the plan is only somewhere for the link to
  // stand, since none of the three is about one plan
  const { plan } = resolveArrangement(table, age, { plan: IHEALTHY_OPENING.plan, territory, coverage });
  const drawn: IHealthyInitial = {
    age, sex, base: baseVariant, sumAssured, mode, plan: plan?.code ?? codes[0], territory, coverage,
  };
  const link = queryFrom(table, drawn);
  useEffect(() => {
    if (window.location.search.replace(/^\?/, "") !== link) {
      window.history.replaceState(null, "", `?${link}${window.location.hash}`);
    }
  }, [link]);

  const printedAt = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const stamp = () => {
      if (printedAt.current) {
        printedAt.current.textContent = w.printedAt(
          new Date().toLocaleString(HTML_LANG[lang], { dateStyle: "long", timeStyle: "short" }),
        );
      }
    };
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, [w, lang]);
  // the figures are worked out here in the browser, so the server's Chrome may print at once
  useEffect(() => {
    registerPrepare(() => window.dispatchEvent(new Event("beforeprint")));
    markPdfReady();
  }, []);

  const baseRow = table.bases.find((b) => b.variant === baseVariant);
  const baseName = baseRow ? baseWords(w, baseRow.variant, baseRow).label : baseVariant;
  const firstRow = shownLines.findIndex((l) => l.kind === "row");
  const childMarks = shownLines.some((l) => l.kind === "row" && compareCells(l.entry, codes, age).some((c) => c.text.includes("*")));

  return (
    <div className="space-y-5">
      <p ref={printedAt} className="ihc-printed-at hidden print:block" />

      <div className="grid grid-cols-2 gap-3 print:hidden sm:grid-cols-[1fr_1fr_1.6fr]">
        <div>
          <span className={label}>{w.sexLabel}</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["M", "F"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={s === sex} onClick={() => setSex(s)} className={chip(s === sex)}>
                {w.sex[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="ihc-age" className={label}>{w.age}</label>
          <select
            id="ihc-age" value={age} onChange={(e) => setAge(Number(e.target.value))}
            className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-sm text-[var(--lg-white)]"
          >
            {ages.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className={label}>{cw.paymentLabel}</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button key={m} type="button" aria-pressed={m === mode} onClick={() => setMode(m)} className={chip(m === mode)}>
                {w.mode[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="ihc-who">
          {`${w.sex[sex]} ${w.years(age)} · ${w.mode[mode]}`}
          {codes.length < 4 && <small>{cw.agePlans(codes.length)}</small>}
        </p>
        <table className={`ihc-table ${codes.length <= 2 ? "ihc-two" : ""}`}>
          <colgroup>
            <col className="ihc-col-name" />
            {codes.map((code) => <col key={code} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="ihc-name">{w.benefitColumn}</th>
              {codes.map((code) => <th key={code} scope="col" style={{ background: planHue(code) }}>{planLabel(code)}</th>)}
            </tr>
          </thead>
          <tbody>
            {priced && (
              <tr className="ihc-premium">
                <th scope="row" className="ihc-name">{cw.premiumRow(w.mode[mode])}</th>
                {codes.map((code) => <td key={code}>{amount(code, mode)}</td>)}
              </tr>
            )}
            <tr className="ihc-ceiling">
              <th scope="row" className="ihc-name">{w.annualLimit}</th>
              {facts.map((p) => <td key={p.code}>{p.ceiling}</td>)}
            </tr>
            {shownLines.map((line, i) => {
              if (line.kind === "group") {
                return <tr key={line.label} className="ihc-group"><td colSpan={codes.length + 1}>{line.label}</td></tr>;
              }
              const cells = compareCells(line.entry, codes, age);
              const dashed = (text: string) => (text === "-" ? "ihc-dash" : undefined);
              return (
                <tr key={`${line.label}-${i}`}>
                  <th scope="row" className="ihc-name">{line.pair ? line.pair.lines.join(" · ") : line.label}</th>
                  {line.pair
                    ? cells.map((c, n) => (
                        <td key={codes[n]} className={dashed(c.text)}>
                          {c.text}
                          {c.text !== "-" && <small>{line.pair!.note}</small>}
                        </td>
                      ))
                    : cellRuns(cells, codes).map((run) => {
                        const one = run.plans.length === 1 && run.cell.text !== "-";
                        return (
                          <td
                            key={run.plans[0]} colSpan={run.plans.length} className={dashed(run.cell.text)}
                            // the first row is the one a reader compares across, so each plan keeps its colour
                            style={one && i === firstRow ? { background: planWash(run.plans[0]) } : undefined}
                          >
                            {run.cell.text}
                          </td>
                        );
                      })}
                </tr>
              );
            })}
            {standardPlan !== null && (
              <tr>
                <th scope="row" className="ihc-name">{w.dailyCashRow}</th>
                <td colSpan={codes.length}>{`${standardPlan.toLocaleString("en-US")} ${w.perDay} · ${w.samePlans}`}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-relaxed text-[var(--lg-mute)]">
          {cw.note(baseName, sumAssured.toLocaleString("en-US"), standardPlan !== null)}
        </p>
        {childMarks && <p className="mt-1 text-xs leading-relaxed text-[var(--lg-mute)]">{participationNote}</p>}
      </div>

      <p className="text-sm print:hidden">
        <Link href={`/ihealthy-ultra?${link}`} className="text-[var(--lg-gold)] underline underline-offset-2">{cw.morePlans}</Link>
      </p>

      {priced && (
        <div className="space-y-5 print:hidden">
          <PdfButton
            path={comparePdfPath(table, drawn, lang)} filename={`iHealthy-Ultra-compare-${sex}${age}.pdf`}
            className="w-full rounded-sm border border-[var(--lg-panel-line)] px-3 py-3 text-center text-sm text-[var(--lg-mute)]"
            words={{ idle: w.printOrPdf, making: SEND_WORDS[lang].pdfMaking, ready: SEND_WORDS[lang].pdfReady, failed: SEND_WORDS[lang].pdfFailed }}
          />
          {/* วิดีโอเทียบ 4 แผน (owner chose ข, 2026-11-11): the Studio form open on this table, for a signed-in agent only */}
          <ContactButtons
            copyText={quoteText} tableCardPath={compareCardPath(table, drawn, lang)} tableLabel={cw.picture} words={w.contact}
            videoHref={videoStartHref({ product: "IHEALTHY", sex, age, plan: drawn.plan, allPlans: mode, lang })} videoLabel={VIDEO_LABEL[lang]}
          />
        </div>
      )}
    </div>
  );
}
