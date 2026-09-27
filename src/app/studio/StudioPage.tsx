import "./theme.css";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { LENGTHS } from "@/lib/content/prompt";
import { listPeople } from "@/lib/content/people-store";
import { getContent, listContent, listHookTemplates } from "@/lib/content/store";
import { contentSpend, contentWorkbench } from "./actions";
import { ContentStudio } from "./ContentStudio";
import { fillable, todayKey } from "@/lib/content/calendar";

/**
 * The workbench and everything it loads, for /studio. The page exports its own `maxDuration`,
 * because the actions run as the page. (/maryjane, the workbench with nothing around it, was
 * a second door to this until the owner took it out on 2026-09-27; it redirects here.)
 */
/** `day`: the calendar's "เขียนโพสต์ใหม่สำหรับวันนี้" — a day still ahead the new posts are meant for */
export async function StudioPage({ hook, open, day }: { hook?: string; open?: string; day?: string }) {
  const [initial, used, hooks, spend, people] = await Promise.all([
    contentWorkbench({ status: "draft" }),
    listContent({ status: "used" }, 20).catch(() => []),
    listHookTemplates().catch(() => []),
    contentSpend(),
    listPeople().catch(() => []),
  ]);
  // the calendar's แก้ไข: the piece opens in the editor on arrival
  const opened = open && /^[0-9a-f-]{36}$/.test(open) ? await getContent(open).catch(() => null) : null;
  return (
    <ContentStudio
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
      lengths={LENGTHS}
      hooks={hooks}
      initialHook={hooks.some((h) => h.id === hook) ? hook! : null}
      initial={initial}
      initialUsed={used}
      spend={spend}
      initialOpen={opened}
      forDay={day && /^\d{4}-\d{2}-\d{2}$/.test(day) && fillable(day, todayKey()) ? day : null}
      people={people.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
