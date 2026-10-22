import Link from "next/link";
import type { SurveyAnswers } from "@/lib/survey/answers";
import type { Summary } from "@/lib/survey/summary";

/** "สรุปก่อนนัด": shown when a survey is saved and on the customer's page in the list. */

const BOX = "space-y-3 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4";

export function SurveySummary({ a, s }: { a: SurveyAnswers; s: Summary }) {
  return (
    <div className="space-y-4">
      <section className={BOX}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {s.rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[var(--lg-mute)]">{k}</dt>
              <dd className="text-[var(--lg-white)]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {(s.calcs.length > 0 || s.promised.length > 0) && (
        <section className={BOX}>
          <h2 className="text-base font-medium text-[var(--lg-white)]">เตรียมไปวันนัด</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--lg-white)]">
            {s.calcs.map((c, i) => (
              <li key={c.worry}>
                <Link href={c.href} className="font-medium text-[var(--lg-gold)] underline underline-offset-2">{c.name}</Link>
                {i === 0 && a.top ? " · เรื่องที่ห่วงที่สุด" : " · เรื่องรอง"}
                {c.worry === "health" && s.ishield && (
                  <span className="text-[var(--lg-mute)]">
                    {" "}ถ้าลูกค้าห่วงโรคร้ายแรง ใช้ <Link href={s.ishield} className="text-[var(--lg-gold)] underline underline-offset-2">iShield</Link>
                  </span>
                )}
              </li>
            ))}
            {s.promised.map((p) => (
              <li key={p}>รับปากไว้: <b className="font-medium">{p}</b></li>
            ))}
          </ol>
          {s.calcs.length > 0 && (
            <p className="text-xs text-[var(--lg-mute)]">เครื่องคิดเปิดพร้อมอายุและเพศของลูกค้า และงบต่อปีเมื่อเครื่องคิดนั้นใส่เบี้ยได้</p>
          )}
        </section>
      )}
    </div>
  );
}
