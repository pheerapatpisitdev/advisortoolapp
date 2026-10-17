import { can } from "@/lib/auth/access";
import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { closedFor } from "@/lib/switches/store";
import { allowanceOf } from "@/lib/auth/quota";
import { gatePage } from "@/lib/auth/viewer";
import { listPeople } from "@/lib/content/people-store";
import { listThumbnails } from "@/lib/content/thumbnail-history";
import type { Rounds } from "@/lib/wallet/note";
import { walletView } from "@/lib/wallet/store";
import { ThumbnailBoard } from "./ThumbnailBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ภาพปกคลิป | AdvisorTool",
  description: "สร้างภาพปกคลิป (thumbnail) แนวตั้ง 9:16 และแนวนอน 16:9 พร้อมตัวหนังสือไทยที่ AI วาดให้",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function ThumbnailPage() {
  // every agent's and member's since 2026-10-14 (owner chose ก): a cover is paid as a picture in
  // Organic is, a free round then the wallet; the owner draws free
  const viewer = await gatePage("/studio/thumbnail");
  // switched off by the Super Admin: locked, nothing of the tool shown (owner, 2026-10-17)
  const locked = await closedFor(viewer, "thumbnail");
  if (locked) return <LockedPage feature="thumbnail" message={locked} />;
  const owner = can(viewer, "owner");
  const [people, history, rounds] = await Promise.all([
    listPeople().catch(() => []),
    // a history that cannot be read leaves the page working, without it, and says so (null)
    listThumbnails(viewer.agentId).catch((e) => {
      console.error("thumbnail history not read:", e);
      return null;
    }),
    // what is left to draw with, as Organic shows it (contentSpend); unreadable leaves the line out
    owner ? Promise.resolve(null) : Promise.all([allowanceOf(viewer), walletView(viewer.agentId)])
      .then(([a, wallet]): Rounds | null => (a.limit === null ? null : { used: a.used, limit: a.limit, wallet }))
      .catch(() => null),
  ]);
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-semibold">ภาพปกคลิป</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        เลือกขนาด ใส่หัวข้อคลิป ให้ AI คิดหัวปก แล้ววาดภาพปกพร้อมตัวหนังสือไทย ตรวจคำที่วาดให้ทุกภาพ เก็บภาพล่าสุด 200 รายการไว้ที่นี่
      </p>
      <ClosedNotice viewer={viewer} feature="thumbnail" />
      <ThumbnailBoard people={people.map((p) => ({ id: p.id, name: p.name }))} initial={history} owner={owner} rounds={rounds} />
    </div>
  );
}
