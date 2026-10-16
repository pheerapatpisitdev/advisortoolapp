import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { listPieces, TRIAL } from "@/lib/collage/library";
import { PageHead } from "../ui";
import { CollageLibrary } from "./CollageLibrary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "คลังภาพคอลลาจ | AdvisorTool" };

/**
 * คลังภาพคอลลาจ for the Super Admin (owner, 2026-10-17, mockup https://claude.ai/artifact/PMX8rMQeobGGQF22rihpyX):
 * the cut-out pictures the คอลลาจกระดาษ theme is built from, drawn once — six to see the look, then
 * the rest — and any one drawn again.
 */
export default async function AdminCollagePage() {
  await gatePage("/admin/collage", "backoffice");
  const pieces = await listPieces().catch((e) => { console.error("collage library unreadable:", e); return null; });
  return (
    <>
      <PageHead title="คลังภาพคอลลาจ" hint="ภาพตัดแปะขาวดำลายจุดสำหรับธีมคอลลาจกระดาษ วาดครั้งเดียวด้วย GPT Image ภาพละประมาณ ฿0.43 แล้วใช้ซ้ำทุกคลิป" />
      <CollageLibrary pieces={pieces} trial={TRIAL} />
    </>
  );
}
