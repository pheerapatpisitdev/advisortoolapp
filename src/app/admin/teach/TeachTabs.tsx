"use client";
import { useState } from "react";

/**
 * The page's tabs. Each tab's content is drawn once and kept, hidden rather than unmounted, so
 * a conversation in the test chat is still there after a look at the taught answers.
 */
export function TeachTabs({ tabs, first }: { tabs: { key: string; label: string; content: React.ReactNode }[]; first?: string }) {
  const [on, setOn] = useState(first && tabs.some((t) => t.key === first) ? first : tabs[0].key);
  return (
    <div className="grid gap-4">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--bot-line)]">
        {tabs.map((t) => (
          <button
            key={t.key} id={`tab-${t.key}`} role="tab" type="button" aria-selected={on === t.key} aria-controls={`panel-${t.key}`}
            onClick={() => setOn(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${on === t.key
              ? "border-[var(--bot-navy)] font-semibold text-[var(--bot-navy)]"
              : "border-transparent text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} id={`panel-${t.key}`} role="tabpanel" aria-labelledby={`tab-${t.key}`} hidden={on !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
