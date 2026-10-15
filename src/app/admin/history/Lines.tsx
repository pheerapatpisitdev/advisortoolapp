import Link from "next/link";
import type { AdminItem, AdminKind, Media } from "@/lib/admin/people-history";

/**
 * The lines of ประวัติผู้ใช้, each with the work it made (owner, 2026-10-15; mockup
 * https://claude.ai/artifact/2uzD38rmUBZ223o6SPG3M1): the pictures, the clip that plays, the
 * words, a question with its answer. Drawn the same on a person's page and in the feed, where
 * `names` puts whose each line is in front of it.
 */

const PILL: Record<AdminKind, React.CSSProperties> = {
  studio: { color: "var(--bot-navy)", background: "var(--bot-navy-soft)", borderColor: "var(--bot-blue)" },
  clip: { color: "var(--bot-ok)", background: "var(--bot-ok-soft)", borderColor: "var(--bot-ok-line)" },
  fhc: { color: "var(--bot-sand-ink)", background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)" },
  ads: { color: "var(--bot-red-ink)", background: "var(--bot-red-soft)", borderColor: "var(--bot-red)" },
  money: { color: "var(--bot-ink-foot)", background: "var(--bot-band)", borderColor: "var(--bot-line-strong)" },
  ask: { color: "var(--bot-olive-ink)", background: "var(--bot-panel)", borderColor: "var(--bot-olive)" },
  login: { color: "var(--bot-ink-mute)", background: "var(--bot-surface)", borderColor: "var(--bot-line)" },
  setup: { color: "var(--bot-navy-deep)", background: "var(--bot-band)", borderColor: "var(--bot-navy-lift)" },
  calc: { color: "var(--bot-ink-foot)", background: "var(--bot-surface)", borderColor: "var(--bot-line-strong)" },
};

export const baht = (satang: number, sign = true) =>
  `${sign ? (satang >= 0 ? "+" : "−") : ""}฿${(Math.abs(satang) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const thb = (n: number) => `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 })}`;

/** one picture or clip; `fill` makes it as wide as its cell (the gallery), else `size` square */
export function Work({ media, size = 104, fill = false }: { media: Media; size?: number; fill?: boolean }) {
  const box = "relative flex max-w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--bot-line)] bg-[var(--bot-band)]";
  const square: React.CSSProperties = fill ? { width: "100%", aspectRatio: "1" } : { width: size, height: size };
  if (!media.url) {
    return (
      <div className={`${box} border-dashed p-1.5 text-center text-[11px] leading-tight text-[var(--bot-ink-mute)]`} style={square}>
        ไฟล์ถูกลบแล้ว<br />เหลือแค่รายการ
      </div>
    );
  }
  if (media.type === "video") {
    return (
      <video
        src={media.url} controls preload="none" playsInline
        className={`${box} bg-black object-contain`} style={fill ? { width: "100%", aspectRatio: "3 / 4" } : { width: size * 1.2, height: size * 1.6 }}
        aria-label={media.label ?? "คลิป"}
      />
    );
  }
  return (
    <a href={media.full ?? media.url} target="_blank" rel="noreferrer" className={box} style={square} title="ดูภาพเต็ม">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed links from storage, not Next's optimizer */}
      <img src={media.url} alt={media.label ?? "ภาพ"} loading="lazy" className="h-full w-full object-cover" />
    </a>
  );
}

function Line({ t, time, who }: { t: AdminItem; time: string; who?: { id: string; name: string } | null }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-x-2.5 border-t border-[var(--bot-line)] py-2.5 first:border-t-0 sm:grid-cols-[3rem_6.5rem_1fr_auto]">
      <span className="pt-0.5 text-[13px] tabular-nums text-[var(--bot-ink-mute)]">{time}</span>
      <span className="pt-0.5">
        <span className="inline-block rounded-full border px-2 text-xs whitespace-nowrap" style={PILL[t.kind]}>{t.word}</span>
      </span>
      <div className="col-span-2 min-w-0 text-sm leading-snug [overflow-wrap:anywhere] sm:col-span-1">
        {who && <><Link href={`/admin/history/${who.id}`} className="font-semibold text-[var(--bot-navy)] underline">{who.name}</Link> · </>}
        {t.title}
        {t.note && <small className="block text-xs text-[var(--bot-ink-mute)]">{t.note}</small>}
        {t.media.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {t.media.map((m, i) => <Work key={i} media={m} />)}
          </div>
        )}
        {t.text && (
          <details className="mt-2 max-w-xl rounded-md border border-[var(--bot-line)] bg-[var(--bot-band)] px-2.5 py-1.5 text-[13px]">
            <summary className="cursor-pointer text-[var(--bot-navy)]">
              {t.kind === "ask" ? "ดูคำถามและคำตอบ" : t.text.split("\n")[0].slice(0, 80) + (t.text.length > 80 ? "…" : "")}
            </summary>
            {t.kind === "ask" ? (
              <div className="mt-1.5 flex flex-col gap-2">
                <p className="m-0 whitespace-pre-wrap"><b>ถาม:</b> {t.text}</p>
                <p className="m-0 whitespace-pre-wrap"><b>ตอบ:</b> {t.answer || "—"}</p>
              </div>
            ) : (
              <p className="m-0 mt-1.5 whitespace-pre-wrap">{t.text}</p>
            )}
          </details>
        )}
        {t.link && (
          <a href={t.link.href} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs text-[var(--bot-navy)] underline">{t.link.label}</a>
        )}
      </div>
      <span className="col-start-2 text-sm tabular-nums sm:col-start-auto sm:text-right">
        {t.satang !== undefined && (
          <span className="block font-semibold" style={{ color: t.satang >= 0 ? "var(--bot-ok)" : "var(--bot-red-ink)" }}>{baht(t.satang)}</span>
        )}
        {t.costThb !== undefined && <span className="block text-xs text-[var(--bot-ink-mute)]">ค่า AI {thb(t.costThb)}</span>}
      </span>
    </li>
  );
}

export interface Day { day: string; label: string; items: { item: AdminItem; time: string }[] }

export function Lines({ days, names }: { days: Day[]; names?: Record<string, string> }) {
  return (
    <div className="flex flex-col">
      {days.map((d) => (
        <section key={d.day}>
          <h3 className="mt-4 mb-1 text-[13px] font-semibold first:mt-0">{d.label}</h3>
          <ul className="m-0 list-none p-0">
            {d.items.map(({ item, time }) => (
              <Line
                key={item.key} t={item} time={time}
                who={names && item.by ? { id: item.by, name: names[item.by] ?? "ไม่ทราบชื่อ" } : null}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
