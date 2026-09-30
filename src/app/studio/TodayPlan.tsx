import { CalendarIcon } from "./ui/icons";

/**
 * วันนี้มีงานตามแผน, at the top of the workbench of an agent who plans (owner, 2026-09-30). Plain
 * links, not next/link: the workbench is already this page, and a client-side visit keeps its
 * state, so ?open= opened nothing (final review, 2026-09-30). A full load opens the editor on it.
 */
export function TodayPlan({ items }: { items: { id: string; title: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div role="status" className="space-y-1 rounded-lg border border-[var(--ct-accent)] bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]">
      <p className="flex items-center gap-2"><CalendarIcon className="size-4 shrink-0" />วันนี้มีงานตามแผน <b>{items.length} ชิ้น</b></p>
      <ul className="space-y-0.5 pl-6">
        {items.map((p) => (
          <li key={p.id}><a href={`/studio/write?open=${p.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2">{p.title}</a></li>
        ))}
      </ul>
    </div>
  );
}
