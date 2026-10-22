"use client";
import { PlanView } from "@/components/plan/PlanView";
import { lineText } from "@/lib/fhc/share";
import type { FhcReply, FhcWords } from "./actions";
import { DOT, ScoreBoard, WORD } from "./ScoreBoard";

/**
 * The check's result: the AI's reading, six scores, the five events answered from our plans,
 * then the plan card from the planner engine. Printable on the app's A4 sheet; the agent's name and
 * the dependants' names appear on paper only, never in what is sent or stored.
 */

const BOX = "rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4";

export function FhcResult({ result, words, interviewer, idate, names, editLocked = false, onEdit }: {
  result: Extract<FhcReply, { ok: true }>;
  words: FhcWords | null;
  interviewer: string;
  idate: string;
  names: string[];
  /** while the customer is being saved or updated: editing now would save them twice */
  editLocked?: boolean;
  onEdit: () => void;
}) {
  const { scores, after, events, plan, figures } = result;
  const s = words?.summary;
  const named = names.filter(Boolean);

  function share() {
    const text = lineText({ figures, scores, after, events, plan, summary: s });
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      {(interviewer || named.length > 0) && (
        <p className="hidden text-sm print:block">
          {interviewer && <>ผู้ทำแบบสอบถาม {interviewer}{idate && ` · ${idate}`}</>}
          {named.length > 0 && <> · คนในความดูแล: {named.join(", ")}</>}
        </p>
      )}

      <section className={`${BOX} border-[var(--lg-gold)]`}>
        <h2 className="text-lg font-medium text-[var(--lg-white)]">ผลตรวจสุขภาพการเงิน</h2>
        {s ? (
          <div className="mt-2 space-y-3 text-sm leading-relaxed">
            <p className="text-[var(--lg-white)]">{s.start}</p>
            {s.strengths.length > 0 && (
              <div>
                <h3 className="text-xs text-[var(--lg-mute)]">จุดแข็ง</h3>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--lg-white)]">{s.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {s.risks.length > 0 && (
              <div>
                <h3 className="text-xs text-[var(--lg-mute)]">จุดที่ต้องระวัง</h3>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--lg-white)]">{s.risks.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--lg-mute)]">กำลังสรุปผล…</p>
        )}

        <div className="mt-4 border-t border-[var(--lg-hair)] pt-3">
          <ScoreBoard scores={scores} after={after} />
        </div>
        <p className="mt-3 text-xs text-[var(--lg-mute)]">
          สินทรัพย์สุทธิ {Math.round(figures.netWorth).toLocaleString("en-US")} บาท · ค่าความสามารถในการทำงาน{" "}
          {Math.round(figures.lifetimeIncome).toLocaleString("en-US")} บาท
        </p>
      </section>

      <section className={BOX}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">5 เหตุการณ์ที่ควบคุมไม่ได้ กับทางรับมือ</h2>
        <ol className="mt-3 space-y-3">
          {events.map((e, i) => (
            <li key={e.key} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--lg-gold)] text-xs text-[var(--lg-gold)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[var(--lg-white)]">
                  {e.name}
                  {e.level !== "none" && <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT[e.level]}`} />}
                  {e.level !== "none" && <span className="text-xs text-[var(--lg-mute)]">{WORD[e.level]}</span>}
                </p>
                {e.lines.map((l) => <p key={l} className="text-xs leading-relaxed text-[var(--lg-mute)]">{l}</p>)}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <PlanView result={plan} prose={words?.prose ?? null} />

      <div className="grid gap-2 sm:grid-cols-3 print:hidden">
        <button
          type="button" onClick={() => window.print()}
          className="rounded-sm border border-[var(--lg-gold)] py-3 text-sm text-[var(--lg-gold)]"
        >
          พิมพ์ / บันทึก PDF
        </button>
        <button type="button" onClick={share} className="lg-metal-face rounded-sm border border-[var(--lg-gold)] py-3 text-sm font-medium">
          ส่งไป LINE
        </button>
        <button
          type="button" onClick={onEdit} disabled={editLocked}
          className="rounded-sm border border-[var(--lg-panel-line)] py-3 text-sm text-[var(--lg-mute)] disabled:opacity-45"
        >
          แก้ข้อมูลแล้วตรวจใหม่
        </button>
      </div>
    </div>
  );
}
