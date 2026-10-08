import { gatePage } from "@/lib/auth/viewer";
import { listReadings } from "@/lib/content/describe-history";
import { DescribeBoard } from "./DescribeBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ถอดรูปเป็น prompt | AdvisorTool",
  description: "อัปโหลดรูป แล้ว AI เขียน prompt ภาษาอังกฤษสำหรับวาดรูปแบบเดียวกัน แยกหมวด พร้อมก๊อป",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function DescribePage() {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  const viewer = await gatePage("/studio/describe");
  // a history that cannot be read leaves the page working, without it, and says so (null)
  const history = await listReadings(viewer.agentId).catch((e) => {
    console.error("describe history not read:", e);
    return null;
  });
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">ถอดรูปเป็น prompt</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        อัปโหลดรูป แล้ว AI เขียน prompt ภาษาอังกฤษแยกหมวดสำหรับวาดรูปแบบเดียวกัน ก๊อปไปใช้ได้ทั้งในช่องบรีฟภาพของ Studio และเครื่องมือวาดรูปอื่น
        นับเป็น 1 รอบ เก็บรูปย่อและ prompt ล่าสุด 200 รายการไว้ให้คุณคนเดียว ลบได้
      </p>
      <DescribeBoard initial={history} />
    </div>
  );
}
