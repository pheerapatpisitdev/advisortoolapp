import "./theme.css";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { LENGTHS } from "@/lib/content/prompt";
import { listPeople } from "@/lib/content/people-store";
import { peopleFor } from "@/lib/content/people-pages";
import { pageConnections } from "@/lib/facebook/connection";
import { can } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";
import { getContent, listContent, listHookTemplates } from "@/lib/content/store";
import { contentSpend, contentWorkbench } from "./actions";
import { ContentStudio } from "./ContentStudio";
import { fillable, todayKey } from "@/lib/content/calendar";

/**
 * The workbench and everything it loads, for /studio/write (/studio is the front page). The page exports its own `maxDuration`,
 * because the actions run as the page. (/maryjane, the workbench with nothing around it, was
 * a second door to this until the owner took it out on 2026-09-27; it redirects here.)
 */
/** `day`: the calendar's "เขียนโพสต์ใหม่สำหรับวันนี้" — a day still ahead the new posts are meant for */
/** `page`: the Facebook Page being worked for (from its card on /studio); the first when not given */
export async function StudioPage({ hook, open, day, page }: { hook?: string; open?: string; day?: string; page?: string }) {
  const staff = can(await getViewer(), "publish");
  const [initial, used, hooks, spend, people, pages] = await Promise.all([
    contentWorkbench({ status: "draft" }),
    listContent({ status: "used" }, 20).catch(() => []),
    listHookTemplates().catch(() => []),
    contentSpend(),
    listPeople().catch(() => []),
    // the staff who post work for one Page at a time, and see only its people (owner, 2026-09-28)
    staff ? pageConnections().catch(() => []) : Promise.resolve([]),
  ]);
  const current = pages.find((p) => p.pageId === page)?.pageId ?? pages[0]?.pageId ?? "";
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
      people={peopleFor(people, pages, current)}
      // only a Page actually chosen is remembered for ลงเพจ: the fallback to the first is a
      // guess, and writing it down would send the next post to the wrong Page
      page={current === page ? current : undefined}
    />
  );
}
