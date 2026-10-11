import { can } from "@/lib/auth/access";
import { myPages } from "@/lib/auth/pages";
import { gatePage } from "@/lib/auth/viewer";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { planLabel } from "@/lib/ihealthy-facts";
import { videoStartFrom } from "@/lib/quote-video/link";
import { myCost, myVideos } from "./actions";
import { QuoteVideoBoard } from "./QuoteVideoBoard";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "วิดีโอนำเสนอ | AdvisorTool",
  description: "สร้างคลิปนำเสนอแบบประกันแนวตั้ง พร้อมเสียงพากย์และซับไทย",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function QuoteVideoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // every agent's (owner, 2026-10-11): two free clips, then the wallet
  const viewer = await gatePage("/studio/quote-video");
  // putting a clip on a Page's calendar is the owner's alone (owner, 2026-10-11)
  const pages = can(viewer, "owner") ? (await myPages().catch(() => [])).map((p) => ({ id: p.pageId, name: p.pageName })) : [];
  const ihuPlans = iHealthyTable().plans.map((p) => ({ code: p.code, name: planLabel(p.code) }));
  const cost = await myCost();
  const initial = await myVideos().catch((e) => {
    console.error("quote videos not read:", e);
    return null;
  });
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold">วิดีโอนำเสนอ</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        ใส่ข้อมูลลูกค้า แล้วได้คลิปแนวตั้งพร้อมเสียงพากย์ ไว้ส่งทาง LINE / Messenger
      </p>
      <QuoteVideoBoard ihuPlans={ihuPlans} initial={initial} cost={cost} pages={pages} start={videoStartFrom(await searchParams)} />
    </div>
  );
}
