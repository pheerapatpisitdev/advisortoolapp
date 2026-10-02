import { gatePage } from "@/lib/auth/viewer";
import { hookPostCounts, listHookTemplates } from "@/lib/content/store";
import { HookLibrary } from "./HookLibrary";
import { LoadFailed } from "../ui/LoadFailed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "คลังสูตรประโยคเปิด | AdvisorTool",
  description: "สูตรประโยคเปิดโพสต์ มีช่องให้เติม ใช้ซ้ำกับแบบประกันไหนก็ได้",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function HooksPage() {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  await gatePage("/studio/hooks");
  const [hooks, posted] = await Promise.all([
    listHookTemplates().catch(() => null),
    hookPostCounts().catch(() => ({} as Record<string, number>)),
  ]);
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">คลังสูตรประโยคเปิด</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        สูตรที่มีช่อง [ ] ให้ AI เติมตามแบบประกัน เริ่มต้น 30 สูตร และเพิ่มเองทุกครั้งที่กด “ใช้จริง” กับชิ้นงาน
      </p>
      {hooks ? <HookLibrary items={hooks} posted={posted} /> : <LoadFailed what="คลังสูตร" href="/studio/hooks" />}
    </div>
  );
}
