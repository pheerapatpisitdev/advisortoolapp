"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Who } from "@/lib/shell/menu";
import { freshHere, type FreshItem } from "@/lib/updates/rules";
import { markOpened, useWho, wasOpened } from "./who-client";

/**
 * What changed on this page, at its top (owner chose 3ก, 2026-11-24, mockup
 * https://claude.ai/artifact/Xvdsgw9YWuwCKpLPKgRj1T): one line per published มีอะไรใหม่ row whose ลองเลย
 * link is this page. Showing it is what "opened the page" means, so the menu's New goes with it (2ก);
 * the strip itself stays for the visit and is gone on the next. Never on paper: a quotation is printed
 * from these pages.
 */
export function FreshStrip({ who: given }: { who?: Who | null }) {
  const path = usePathname();
  const who = useWho(given);
  const fresh = who?.fresh;
  const [shown, setShown] = useState<{ path: string; items: FreshItem[] }>(() => ({ path, items: freshHere(path, fresh ?? []) }));

  useEffect(() => {
    // kept while the page is looked at, though opening it has just taken it off the list
    if (shown.path === path && shown.items.length > 0) {
      markOpened(shown.items.map((f) => f.id));
      return;
    }
    const items = freshHere(path, fresh ?? []).filter((f) => !wasOpened(f.id));
    if (shown.path !== path || items.length > 0) setShown({ path, items });
  }, [path, fresh, shown]);

  if (shown.path !== path || shown.items.length === 0) return null;
  return (
    <aside className="shell-fresh print:hidden" aria-label="มีอะไรใหม่ในหน้านี้">
      <ul>
        {shown.items.map((f) => (
          <li key={f.id}>
            <span className="shell-new">New</span>
            <span className="min-w-0">
              <b>{f.title}</b>
              {f.body && <> · {f.body}</>}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
