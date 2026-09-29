import Link from "next/link";
import { gatePage } from "@/lib/auth/viewer";
import { listPeople } from "@/lib/content/people-store";
import { choosePage, type PageRef } from "@/lib/content/people-pages";
import { myPages } from "@/lib/auth/pages";
import { PeopleBoard } from "./PeopleBoard";
import { LoadFailed } from "../ui/LoadFailed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังบุคคล | advisortool",
  description: "คนที่ยินยอมให้ใช้รูปในโปสเตอร์ และรูปต้นแบบให้ AI วาด",
};

// the menu, the palette and the tabs come from ../layout.tsx
/** where "← กลับ" may lead: Studio, or a piece open in it — nothing off the site */
const BACK = /^\/studio\/write(\?open=[0-9a-f-]{36})?$/;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ back?: string; page?: string }> }) {
  const { back, page } = await searchParams;
  const backTo = back && BACK.test(back) ? back : null;
  await gatePage("/studio/people");
  // a failed read is said, not shown as an empty library with an add form under it
  const [people, connected] = await Promise.all([
    listPeople().catch(() => null),
    // the library is split by the Pages the caller looks after; an agent's own has no Pages
    myPages().catch(() => []),
  ]);
  const pages: PageRef[] = connected.map((p) => ({ pageId: p.pageId, pageName: p.pageName }));
  // one Page, from its card on /studio; no switch between them (owner, 2026-09-28)
  const current = choosePage(page, pages);
  const currentName = pages.find((p) => p.pageId === current)?.pageName;
  return (
    <div className="max-w-[1000px] space-y-4">
      {backTo && (
        <Link href={backTo} className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
          ← {backTo.includes("open=") ? "กลับไปชิ้นงานที่แก้อยู่" : "กลับไป Organic Studio"}
        </Link>
      )}
      <div>
        <h1 className="text-xl font-semibold">
          คลังบุคคล{currentName && <span className="font-normal text-[var(--ct-mute)]"> · {currentName}</span>}
        </h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">
          คนที่จะให้ AI วาดลงในภาพโปสเตอร์ ใส่รูปหน้าชัดๆ ได้ถึง 10 รูปจากหลายมุม (รูปแรกคือรูปหลัก) แสงดี ไม่ใส่แว่นดำหรือหมวก — ยิ่งรูปดี หน้ายิ่งเหมือน
        </p>
      </div>
      {people ? <PeopleBoard initial={people} pages={pages} page={current} /> : <LoadFailed what="คลังบุคคล" href="/studio/people" />}
    </div>
  );
}
