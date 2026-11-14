import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { mayPromptStory } from "@/lib/prompt-story/access";
import { LIBRARY, type LibraryTool } from "@/lib/scene-library/catalog";
import { marksOf, wantCounts } from "@/lib/scene-library/marks";
import { closedFor } from "@/lib/switches/store";
import { LibraryBoard } from "./LibraryBoard";
import { LoadFailed } from "../ui/LoadFailed";
import { ToolLogo } from "@/components/shell/ToolLogo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังแอนิเมชัน | AdvisorTool",
  description: "รูปแบบรายการ อุปกรณ์ภาพ สไตล์ และลูกเล่น ที่ใช้ในคลิปของ Studio",
};

/**
 * คลังแอนิเมชัน (spec 2026-11-14, owner-approved mockup v5): what the clip forms can make, and what is
 * coming, with a way into the right form. The catalogue is static and always shown; the viewer's marks
 * and the vote counts are read from ins_library_marks, and when that cannot be read (a moment's
 * trouble, or the table not migrated yet) the page says so for that part alone and leaves ★ and
 * อยากได้ out rather than show every count as nought.
 */
export default async function LibraryPage() {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  const viewer = await gatePage("/studio/library");
  const [marks, counts, storyClosed, quoteClosed, promptClosed] = await Promise.all([
    marksOf(viewer.agentId).catch(() => null),
    wantCounts().catch(() => null),
    closedFor(viewer, "story-clip"),
    closedFor(viewer, "quote-video"),
    closedFor(viewer, "prompt-story"),
  ]);
  const open: Record<LibraryTool, boolean> = {
    "story-clip": !storyClosed,
    "quote-video": !quoteClosed,
    "prompt-story": mayPromptStory(viewer) && !promptClosed,
  };
  const marksRead = Boolean(marks && counts);
  return (
    <div className="max-w-5xl">
      <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="an" size="lg" />คลังแอนิเมชัน</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        รูปแบบรายการ อุปกรณ์ภาพ สไตล์ และลูกเล่น ที่ใช้ในคลิปของ Studio กด “ใช้แบบนี้” เพื่อเปิดฟอร์มที่เลือกไว้ให้แล้ว
      </p>
      {!marksRead && <LoadFailed what="รายการที่บันทึกและจำนวนคนอยากได้" href="/studio/library" />}
      <LibraryBoard
        items={LIBRARY}
        open={open}
        saved={marks?.saved ?? []}
        wanted={marks?.wanted ?? []}
        counts={counts ?? {}}
        owner={can(viewer, "owner")}
        marksFailed={!marksRead}
        demo={viewer.kind === "demo"}
      />
    </div>
  );
}
