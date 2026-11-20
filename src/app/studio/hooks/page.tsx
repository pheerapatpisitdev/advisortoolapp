import Link from "next/link";
import { can } from "@/lib/auth/access";
import { gatePage } from "@/lib/auth/viewer";
import { hookPostCounts, listHookTemplates } from "@/lib/content/store";
import { HookLibrary } from "./HookLibrary";
import { LoadFailed } from "../ui/LoadFailed";
import { ToolLogo } from "@/components/shell/ToolLogo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังสูตรประโยคเปิด | AdvisorTool",
  description: "สูตรประโยคเปิดโพสต์ มีช่องให้เติม ใช้ซ้ำกับแบบประกันไหนก็ได้",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function HooksPage() {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  const viewer = await gatePage("/studio/hooks");
  // the owner's alone since 2026-11-20 (owner chose ก): the menu and the Studio home list it for no one
  // else, and an old link tells them it is closed, as คลังแอนิเมชัน does; the AI keeps using the formulas
  if (!can(viewer, "owner")) {
    return (
      <div className="max-w-5xl">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="hk" size="lg" />คลังสูตรประโยคเปิด</h1>
        <p className="mt-3 max-w-md rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 text-sm">
          ฟังก์ชันนี้ปิดใช้งานอยู่ — AI ยังเลือกประโยคเปิดให้ทุกชิ้นเหมือนเดิม เขียนงานได้ที่ <Link href="/studio/write">Organic Studio</Link>
        </p>
      </div>
    );
  }
  const [hooks, posted] = await Promise.all([
    listHookTemplates().catch(() => null),
    hookPostCounts().catch(() => ({} as Record<string, number>)),
  ]);
  return (
    <div className="max-w-5xl">
      <h1 className="flex items-center gap-2.5 text-xl font-semibold"><ToolLogo id="hk" size="lg" />คลังสูตรประโยคเปิด</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        สูตรที่มีช่อง [ ] ให้ AI เติมตามแบบประกัน เริ่มต้น 30 สูตร และเพิ่มเองทุกครั้งที่ทีมงานกด “ใช้จริง” กับชิ้นงาน
      </p>
      {hooks ? <HookLibrary items={hooks} posted={posted} canDelete /> : <LoadFailed what="คลังสูตร" href="/studio/hooks" />}
    </div>
  );
}
