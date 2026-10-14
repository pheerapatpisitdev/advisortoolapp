import Link from "next/link";
import type { HistItem, HistKind } from "@/lib/home/history";

/**
 * The lines of ประวัติการทำงาน, drawn the same on the /home card and on /home/history (owner
 * chose option ก, 2026-10-14). Pill colours are the palette's, as งานค้าง's are.
 */

const PILL: Record<HistKind, React.CSSProperties> = {
  studio: { color: "var(--bot-navy)", background: "var(--bot-navy-soft)", borderColor: "var(--bot-blue)" },
  clip: { color: "var(--bot-ok)", background: "var(--bot-ok-soft)", borderColor: "var(--bot-ok-line)" },
  fhc: { color: "var(--bot-sand-ink)", background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)" },
  ads: { color: "var(--hm-accent)", background: "var(--hm-panel)", borderColor: "var(--hm-accent)" },
  money: { color: "var(--hm-mute)", background: "var(--hm-ground)", borderColor: "var(--hm-hair)" },
};

const baht = (satang: number) =>
  `${satang >= 0 ? "+" : "−"}฿${(Math.abs(satang) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** `when` is the left column: the hour on the month page, the hour or the day on the card */
export function HistoryList({ items }: { items: (HistItem & { when: string })[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((t, n) => (
        <li key={t.key} className={`flex items-start gap-2.5 py-2.5 ${n ? "border-t border-[var(--hm-hair)]" : "pt-0.5"}`}>
          <span className="w-12 shrink-0 pt-0.5 text-[13px] tabular-nums text-[var(--hm-mute)]">{t.when}</span>
          <span className="mt-0.5 shrink-0 rounded-full border px-2 text-xs whitespace-nowrap" style={PILL[t.kind]}>{t.word}</span>
          <div className="min-w-0 flex-1 text-[15px] leading-snug [overflow-wrap:anywhere]">
            {t.title}
            {t.note && <small className="block text-[13px] text-[var(--hm-mute)]">{t.note}</small>}
          </div>
          {t.satang !== undefined ? (
            <span className="mt-0.5 shrink-0 text-sm font-semibold tabular-nums" style={{ color: t.satang >= 0 ? "var(--bot-ok)" : "var(--hm-alert)" }}>{baht(t.satang)}</span>
          ) : t.href && t.action ? (
            <Link href={t.href} className="mt-0.5 shrink-0 text-sm font-semibold text-[var(--hm-accent)]">{t.action}</Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
