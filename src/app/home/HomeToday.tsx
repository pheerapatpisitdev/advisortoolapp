import Link from "next/link";
import { SHORTCUTS, type Today, type TodoKind } from "@/lib/home/today";

/**
 * งานวันนี้, drawn (owner chose option ข, 2026-10-14). Colours are the home theme's --hm-*
 * tokens and the palette's own sand, the same as the chat this page replaced at /home.
 */

const PILL: Record<TodoKind, { word: string; style: React.CSSProperties }> = {
  clip: { word: "คลิป", style: { color: "var(--bot-ok)", background: "var(--bot-ok-soft)", borderColor: "var(--bot-ok-line)" } },
  fhc: { word: "FHC", style: { color: "var(--bot-sand-ink)", background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)" } },
  post: { word: "โพสต์", style: { color: "var(--bot-navy)", background: "var(--bot-navy-soft)", borderColor: "var(--bot-blue)" } },
};

const card = "rounded-xl border border-[var(--hm-hair)] bg-[var(--hm-panel)]";

/** `notice` is the member's pass bar, drawn under the greeting as the mockup has it */
export function HomeToday({ today, notice }: { today: Today; notice?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="max-lg:ml-12">
        <h1 className="text-2xl font-semibold text-balance">{today.greeting}</h1>
        <p className="text-sm text-[var(--hm-mute)]">{today.date}</p>
      </header>

      {notice}

      {today.tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {today.tiles.map((t, n) => (
            <Link
              key={t.key}
              href={t.href}
              // on a phone an odd last tile takes the whole row rather than sitting alone in half of it
              className={`${card} block px-3.5 py-3 no-underline ${n === today.tiles.length - 1 && n % 2 === 0 ? "max-sm:col-span-2" : ""}`}
              style={t.tone === "warn" ? { background: "var(--bot-sand-soft)", borderColor: "var(--bot-sand-line)", color: "var(--bot-sand-ink)" } : { color: "var(--hm-ink)" }}
            >
              <span className="block text-[13px]" style={{ color: t.tone === "warn" ? "inherit" : "var(--hm-mute)" }}>{t.label}</span>
              <strong className="text-2xl tabular-nums">{t.value}</strong>{" "}
              <span className="text-[13px]" style={{ color: t.tone === "warn" ? "inherit" : "var(--hm-mute)" }}>{t.note}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={`${card} min-w-0 px-4 py-3.5`}>
          <h2 className="mb-2 text-base font-semibold">งานค้าง</h2>
          {today.todos.length === 0 ? (
            <p className="py-2 text-sm text-[var(--hm-mute)]">ไม่มีงานค้างตอนนี้ เริ่มจากทางลัดด้านข้างได้เลย</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {today.todos.map((t, n) => (
                <li key={t.key} className={`flex items-start gap-2.5 py-2.5 ${n ? "border-t border-[var(--hm-hair)]" : "pt-0.5"}`}>
                  <span className="mt-0.5 shrink-0 rounded-full border px-2 text-xs" style={PILL[t.kind].style}>{PILL[t.kind].word}</span>
                  <div className="min-w-0 flex-1 text-[15px] leading-snug">
                    {t.title}
                    <small className="block text-[13px] text-[var(--hm-mute)]">{t.note}</small>
                  </div>
                  <Link href={t.href} className="mt-0.5 shrink-0 text-sm font-semibold text-[var(--hm-accent)]">{t.action}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} min-w-0 px-4 py-3.5`}>
          <h2 className="mb-2 text-base font-semibold">ทางลัด</h2>
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map((s) => (
              <Link key={s.href} href={s.href} className="flex justify-between gap-2 rounded-lg bg-[var(--hm-ground)] px-3 py-2 text-[15px] text-[var(--hm-ink)] no-underline">
                {s.label} <span className="text-[13px] text-[var(--hm-mute)]">{s.note}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
