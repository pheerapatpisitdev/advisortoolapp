import { gatePage } from "@/lib/auth/viewer";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { myVideos } from "./actions";
import { QuoteVideoBoard } from "./QuoteVideoBoard";

export const dynamic = "force-dynamic";
// a clip is drawn after the request is answered (after()), inside this page's time
export const maxDuration = 300;

export const metadata = {
  title: "วิดีโอนำเสนอ | AdvisorTool",
  description: "สร้างคลิปนำเสนอแบบประกันแนวตั้ง พร้อมเสียงพากย์และซับไทย",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function QuoteVideoPage() {
  // the owner's alone in round one (owner, 2026-10-11)
  await gatePage("/studio/quote-video", "owner");
  const t = lifeProtectTable();
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
      <QuoteVideoBoard ageMin={t.ageMin} ageMax={t.ageMax} initial={initial} />
    </div>
  );
}
