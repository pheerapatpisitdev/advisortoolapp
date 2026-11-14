import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { mayPromptStory } from "@/lib/prompt-story/access";
import { LIBRARY_CLOSED, mayLibrary } from "@/lib/scene-library/access";
import { LIBRARY, type LibraryTool } from "@/lib/scene-library/catalog";
import { marksOf } from "@/lib/scene-library/marks";
import { uploadViews } from "@/lib/scene-library/uploads";
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
 * coming, with a way into the right form. The owner's alone since the same day (owner chose ก on mockup
 * https://claude.ai/artifact/5M3orXAdEViBYn7qSGALXr, spec 2026-11-14-library-owner-only-design.md): anyone
 * else is told it is closed, as คลิปตามโจทย์ does, and nothing is read for them.
 *
 * For the owner the catalogue is static and always shown; the saves are read from ins_library_marks and the
 * owner's files from ins_library_uploads, and when either cannot be read (a moment's trouble, or the table not
 * migrated yet) the page says so for that part alone and leaves it out.
 */
export default async function LibraryPage() {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  const viewer = await gatePage("/studio/library");
  if (!mayLibrary(viewer)) {
    return (
      <div className="max-w-5xl">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="an" size="lg" />คลังแอนิเมชัน</h1>
        <p className="mt-3 max-w-md rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 text-sm">
          {LIBRARY_CLOSED} ทำคลิปได้ที่ <Link href="/studio/story-clip">คลิปเล่าเรื่อง</Link> หรือ <Link href="/studio/quote-video">วิดีโอนำเสนอ</Link>
        </p>
      </div>
    );
  }
  const [marks, uploads, storyClosed, quoteClosed, promptClosed] = await Promise.all([
    marksOf(viewer.agentId).catch(() => null),
    uploadViews({ agentId: viewer.agentId }),
    closedFor(viewer, "story-clip"),
    closedFor(viewer, "quote-video"),
    closedFor(viewer, "prompt-story"),
  ]);
  const open: Record<LibraryTool, boolean> = {
    "story-clip": !storyClosed,
    "quote-video": !quoteClosed,
    "prompt-story": mayPromptStory(viewer) && !promptClosed,
  };
  return (
    <div className="max-w-5xl">
      <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="an" size="lg" />คลังแอนิเมชัน</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        รูปแบบรายการ อุปกรณ์ภาพ สไตล์ และลูกเล่น ที่ใช้ในคลิปของ Studio กด “ใช้แบบนี้” เพื่อเปิดฟอร์มที่เลือกไว้ให้แล้ว
      </p>
      {!marks && <LoadFailed what="รายการที่บันทึก" href="/studio/library" />}
      {!uploads && <LoadFailed what="ไฟล์ที่อัปโหลด" href="/studio/library" />}
      <LibraryBoard items={LIBRARY} open={open} saved={marks?.saved ?? []} uploads={uploads} marksFailed={!marks} />
    </div>
  );
}
