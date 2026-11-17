"use client";
/**
 * /admin/ai in settings-kit's shape (owner chose ข, 2026-11-18): the sections down a sidebar with a
 * search box, the chosen one on the right. On a phone the sidebar is a row of buttons over the page.
 *
 * Every section is rendered and the others hidden, so a half-typed key or an unsaved lane order is
 * still there after a look at another section. The section is named in the address (#keys, #lanes,
 * #budget, #models, #rates), so the overview's "/admin/ai#rates" still opens on the premium tables.
 *
 * Adapted from settings-kit's SettingsShell (OpenFilm Studio, MIT, see ./LICENSE-openfilm).
 */
import { useEffect, useState } from "react";

export interface NavSection {
  id: string;
  title: string;
  /** the sidebar heading it sits under */
  group: string;
  /** extra words the search matches */
  keywords?: string;
  node: React.ReactNode;
}

export function SettingsNav({ sections }: { sections: NavSection[] }) {
  const [showing, setShowing] = useState(sections[0]?.id);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const read = () => {
      const id = window.location.hash.slice(1);
      if (sections.some((s) => s.id === id)) setShowing(id);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [sections]);

  const show = (id: string) => {
    setShowing(id);
    // replaceState: the back button leaves the page rather than walking through its sections
    window.history.replaceState(null, "", `#${id}`);
  };

  const q = query.trim().toLowerCase();
  const found = sections.filter((s) => !q || `${s.title} ${s.keywords ?? ""}`.toLowerCase().includes(q));
  const groups = [...new Set(found.map((s) => s.group))];

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] md:flex-row">
      <nav aria-label="ส่วนของหน้าคีย์และโมเดล" className="shrink-0 border-b border-[var(--bot-line)] p-3 md:w-60 md:border-b-0 md:border-r">
        <label className="mb-1 hidden h-10 items-center gap-2.5 rounded-lg border border-[var(--bot-line)] px-3 text-[var(--bot-ink-mute)] focus-within:border-[var(--bot-navy)] md:flex">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา" aria-label="ค้นหาส่วน"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--bot-ink)] outline-none placeholder:text-[var(--bot-ink-faint)]"
          />
        </label>
        <div className="flex gap-1 overflow-x-auto md:block">
          {groups.map((group) => (
            <div key={group} className="contents md:mt-3 md:flex md:flex-col md:gap-0.5">
              <div className="hidden px-2.5 pb-1 text-xs text-[var(--bot-ink-faint)] md:block">{group}</div>
              {found.filter((s) => s.group === group).map((s) => {
                const on = s.id === showing;
                return (
                  <button
                    key={s.id} type="button" aria-current={on ? "page" : undefined} onClick={() => show(s.id)}
                    className={`flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-[var(--bot-navy)] ${
                      on ? "bg-[var(--bot-navy-soft)] font-medium text-[var(--bot-navy)]" : "text-[var(--bot-ink-mute)] hover:bg-[var(--bot-band)] hover:text-[var(--bot-ink)]"
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </div>
          ))}
          {found.length === 0 && <p className="px-2.5 pt-3 text-sm text-[var(--bot-ink-faint)]">ไม่พบ</p>}
        </div>
      </nav>
      <div className="min-w-0 flex-1 bg-[var(--bot-band)] px-4 py-6 sm:px-7">
        {sections.map((s) => (
          <section key={s.id} id={`section-${s.id}`} hidden={s.id !== showing} aria-label={s.title}>
            {s.node}
          </section>
        ))}
      </div>
    </div>
  );
}
