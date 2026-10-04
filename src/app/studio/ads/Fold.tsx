"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "../ui/icons";

/**
 * One folded section of Ads Studio's tools column (ตั้งค่าแคมเปญ, ตั้งค่าเพจ): its title and a line
 * saying what is set inside, shut until pressed. `warn` colours the header while something there
 * still needs doing; `startOpen` opens it on arrival when it has something to say.
 */
export function Fold({ title, summary, warn = false, startOpen = false, children }: {
  title: string;
  summary: string;
  warn?: boolean;
  startOpen?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="border-t border-[var(--ct-hair)]">
      <button
        type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 w-full items-start justify-between gap-2 px-4 py-3 text-left ${warn ? "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]" : "hover:bg-[var(--ct-ground)]"}`}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className={`mt-0.5 block break-words text-xs ${warn ? "" : "text-[var(--ct-mute)]"}`}>{summary}</span>
        </span>
        <ChevronDownIcon className={`mt-0.5 size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} hidden={!open} className="space-y-4 px-4 pb-4 pt-1">
        {children}
      </div>
    </section>
  );
}
