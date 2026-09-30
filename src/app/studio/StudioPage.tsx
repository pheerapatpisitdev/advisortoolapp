import "./theme.css";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { LENGTHS } from "@/lib/content/prompt";
import { listPeople } from "@/lib/content/people-store";
import { peopleFor, visibleTo } from "@/lib/content/people-pages";
import { pageConnections } from "@/lib/facebook/connection";
import { myPages } from "@/lib/auth/pages";
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
/** `page`: the Page whose project opens (from its card on /studio); the first when not given */
export async function StudioPage({ hook, open, day, page }: { hook?: string; open?: string; day?: string; page?: string }) {
  // the calendar's แก้ไข: the piece opens in the editor on arrival — in its own Page's project
  const opened = open && /^[0-9a-f-]{36}$/.test(open) ? await getContent(open).catch(() => null) : null;
  // the project (owner, 2026-09-30): one of the caller's Pages — the opened piece's, else the one
  // its card asked for, else the first — or none for an agent with no Pages, as projectPage settles it
  const [mine, connected] = await Promise.all([myPages().catch(() => null), pageConnections().catch(() => [])]);
  const asked = opened?.pageId ?? page;
  // the Pages could not be read: the one asked for is kept, for the server to settle or refuse,
  // rather than none — a round sent with none would land in the first Page's project for good
  const project = mine
    ? mine.find((p) => p.pageId === asked) ?? mine[0] ?? null
    : asked ? { pageId: asked, pageName: connected.find((p) => p.pageId === asked)?.pageName ?? "" } : null;
  const pageId = project?.pageId;
  const [initial, used, hooks, spend, people] = await Promise.all([
    contentWorkbench({ status: "draft", page: pageId }),
    // nothing for a project not known: every Page's pieces would show together
    mine || pageId ? listContent({ status: "used", pageId }, 20).catch(() => []) : Promise.resolve([]),
    listHookTemplates().catch(() => []),
    contentSpend(),
    listPeople().catch(() => []),
  ]);
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
      // nobody of a Page the caller does not look after (final review, 2026-09-29)
      people={peopleFor(visibleTo(people, new Set(connected.map((p) => p.pageId)), new Set((mine ?? []).map((p) => p.pageId))), mine ?? [], pageId ?? "")}
      project={project ? { pageId: project.pageId, pageName: project.pageName } : null}
    />
  );
}
