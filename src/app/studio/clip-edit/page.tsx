import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { gatePage } from "@/lib/auth/viewer";
import { CLIP_HREF, forClient } from "@/lib/content/clip";
import { getContent } from "@/lib/content/store";
import { pageConnections } from "@/lib/facebook/connection";
import { closedFor } from "@/lib/switches/store";
import { videoSettings } from "@/lib/video/settings";
import { contentWorkbench } from "../actions";
import { ClipDesk } from "./ClipDesk";

export const dynamic = "force-dynamic";
// the clip's actions run as this page: a clip over 100MB goes storage → Gemini upload (≤100 s) →
// wait (≤60 s) → a listen of up to 110 s, and a Reel's send is start + the file + finish — inside
// the 300 s the Hobby plan allows, as /studio/write has it
export const maxDuration = 300;

export const metadata = {
  title: "ตัดต่อคลิป | AdvisorTool",
  description: "แนบคลิปที่ถ่ายเอง ถอดเสียง ตัดประโยค ใส่ซับและ hook แล้วลงเพจเป็น Reel",
};

/**
 * ตัดต่อคลิป (owner chose ก, 2026-10-19; mockup https://claude.ai/artifact/RhJjExoTqVQ5SDKh73KmUu):
 * Organic Studio's คลิป tab as a page of its own — the clips attached, the editor, ลงเพจ. The
 * same pieces as before (plan_href "clip"), of one Page at a time, as the workbench keeps them.
 */
export default async function ClipEditPage({ searchParams }: { searchParams: Promise<{ open?: string; page?: string }> }) {
  const viewer = await gatePage("/studio/clip-edit");
  // Organic's switch: the clip actions have always answered to it (clip.ts, clip-edit.ts)
  const locked = await closedFor(viewer, "write");
  if (locked) return <LockedPage feature="write" message={locked} />;
  const { open, page } = await searchParams;
  // the calendar's แก้ไข and the history's links: the clip opens on arrival, in its own Page
  const found = open && /^[0-9a-f-]{36}$/.test(open) ? await getContent(open).catch(() => null) : null;
  const opened = found && found.planHref === CLIP_HREF ? forClient(found) : null;
  const [mine, connected] = await Promise.all([myPages().catch(() => null), pageConnections().catch(() => [])]);
  const asked = opened?.pageId ?? page;
  // as StudioPage settles it: one of the caller's Pages, else the one asked for for the server to settle
  const project = mine
    ? mine.find((p) => p.pageId === asked) ?? mine[0] ?? null
    : asked ? { pageId: asked, pageName: connected.find((p) => p.pageId === asked)?.pageName ?? "" } : null;
  const [initial, clipEditing] = await Promise.all([
    contentWorkbench({ status: "draft", page: project?.pageId, clips: true }),
    // a read that fails hides the button: the server refuses an edit while the switch is not known to be on
    videoSettings().then((s) => s.enabled, () => false),
  ]);
  return (
    <div>
      <h1 className="text-xl font-semibold">ตัดต่อคลิป</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        แนบคลิปที่ถ่ายเอง ระบบถอดเสียง ร่างแคปชัน และตรวจคำให้ แล้วตัดประโยคที่ไม่ใช้ ใส่ซับกับ hook ก่อนลงเพจเป็น Reel
      </p>
      <ClosedNotice viewer={viewer} feature="write" />
      <ClipDesk
        key={project?.pageId ?? "none"}
        initial={initial}
        initialOpen={opened}
        project={project}
        pages={(mine ?? []).map((p) => ({ pageId: p.pageId, pageName: p.pageName }))}
        planner={!can(viewer, "publish")}
        clipEditing={clipEditing}
      />
    </div>
  );
}
