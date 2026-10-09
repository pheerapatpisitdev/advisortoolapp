import { gatePage } from "@/lib/auth/viewer";
import { listPeople } from "@/lib/content/people-store";
import { listThumbnails } from "@/lib/content/thumbnail-history";
import { ThumbnailBoard } from "./ThumbnailBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ภาพปกคลิป | AdvisorTool",
  description: "สร้างภาพปกคลิป (thumbnail) แนวตั้ง 9:16 และแนวนอน 16:9 พร้อมตัวหนังสือไทยที่ AI วาดให้",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function ThumbnailPage() {
  // the owner's alone: it spends AI money with no wallet behind it
  const viewer = await gatePage("/studio/thumbnail", "owner");
  const [people, history] = await Promise.all([
    listPeople().catch(() => []),
    // a history that cannot be read leaves the page working, without it, and says so (null)
    listThumbnails(viewer.agentId).catch((e) => {
      console.error("thumbnail history not read:", e);
      return null;
    }),
  ]);
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold">ภาพปกคลิป</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        เลือกขนาด ใส่หัวข้อคลิป ให้ AI คิดหัวปก แล้ววาดภาพปกพร้อมตัวหนังสือไทย ตรวจคำที่วาดให้ทุกภาพ เก็บภาพล่าสุด 200 รายการไว้ที่นี่
      </p>
      <ThumbnailBoard people={people.map((p) => ({ id: p.id, name: p.name }))} initial={history} />
    </div>
  );
}
