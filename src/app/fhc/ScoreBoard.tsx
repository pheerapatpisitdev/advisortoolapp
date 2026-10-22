import { formatBaht } from "@/calc/money";
import { tally, type AfterPlan } from "@/lib/fhc/after";
import type { Level, Score } from "@/lib/fhc/health";

/**
 * The six scores. When the plan buys something, each sits beside where it would stand once the
 * customer takes the plan, with the colours counted above (owner, 2026-10-22, mockup
 * J1QgqER7XRAXde4AyTeEkr ก). Read by the result page and the saved customer alike; no hooks,
 * so it renders on either side.
 */

export const DOT: Record<Level, string> = {
  green: "bg-[var(--bot-ok)]",
  yellow: "bg-[var(--bot-sand)]",
  red: "bg-[var(--bot-red)]",
  none: "bg-[var(--bot-grey)]",
};
// said in words too, so a black-and-white print still reads
export const WORD: Record<Level, string> = { green: "ดี", yellow: "ควรปรับ", red: "ต้องแก้", none: "ไม่มีข้อมูล" };

function Dot({ level }: { level: Level }) {
  return <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${DOT[level]}`} />;
}

export function ScoreBoard({ scores, after }: { scores: Score[]; after: AfterPlan | null }) {
  if (!after) {
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {scores.map((x) => (
          <li key={x.key} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${DOT[x.level]}`} />
            <span className="min-w-0 flex-1 text-[var(--lg-white)]">{x.label}</span>
            <span className="shrink-0 text-right text-xs text-[var(--lg-mute)]">
              {x.shown} · <span className="text-[var(--lg-white)]">{WORD[x.level]}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const [was, will] = [tally(scores), tally(after.scores)];
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-3 py-2 text-sm tabular-nums text-[var(--lg-white)]">
        <span>
          ทำตามแผนนี้ เบี้ยเพิ่มเฉลี่ยเดือนละ <span className="font-medium text-[var(--lg-gold)]">{formatBaht(Math.round(after.annual / 12))}</span> บาท
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT.green}`} />เขียว {was.green} → <span className="font-medium">{will.green}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT.red}`} />แดง {was.red} → <span className="font-medium">{will.red}</span>
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--lg-hair)] text-xs text-[var(--lg-mute)]">
              <th className="py-1.5 pr-2 font-medium">ด้าน</th>
              <th className="px-2 py-1.5 font-medium">ตอนนี้</th>
              <th className="py-1.5 font-medium text-[var(--lg-gold)]">ถ้าทำตามแผน</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const a = after.scores.find((x) => x.key === s.key);
              const up = !!a && !a.same && a.level !== s.level;
              return (
                <tr key={s.key} className="border-b border-[var(--lg-hair)] align-top">
                  <td className="py-2 pr-2 text-[var(--lg-white)]">{s.label}</td>
                  <td className="px-2 py-2">
                    <span className="flex gap-2">
                      <Dot level={s.level} />
                      <span>
                        <span className="text-[var(--lg-white)]">{s.shown}</span>
                        <span className="block text-xs text-[var(--lg-mute)]">{WORD[s.level]}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2">
                    {a && (
                      <span className="flex gap-2">
                        <Dot level={a.level} />
                        <span>
                          <span className={a.same ? "text-[var(--lg-mute)]" : up ? "font-medium text-[var(--lg-white)]" : "text-[var(--lg-white)]"}>
                            {a.same ? "เท่าเดิม" : a.shown}
                          </span>
                          <span className="block text-xs text-[var(--lg-mute)]">
                            {WORD[a.level]}{a.note ? ` · ${a.note}` : ""}
                          </span>
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--lg-mute)]">ไฟหลังทำตามแผน นับเฉพาะแบบที่เสนอด้านล่าง และสมมติว่าบริษัทรับประกันตามปกติ</p>
    </div>
  );
}
