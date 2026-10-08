import { gatePage } from "@/lib/auth/viewer";
import { DescribeBoard } from "./DescribeBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ถอดรูปเป็น prompt | AdvisorTool",
  description: "อัปโหลดรูป แล้ว AI เขียน prompt ภาษาอังกฤษสำหรับวาดรูปแบบเดียวกัน แยกหมวด พร้อมก๊อป",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function DescribePage() {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  await gatePage("/studio/describe");
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">ถอดรูปเป็น prompt</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        อัปโหลดรูป แล้ว AI เขียน prompt ภาษาอังกฤษแยกหมวดสำหรับวาดรูปแบบเดียวกัน ก๊อปไปใช้ได้ทั้งในช่องบรีฟภาพของ Studio และเครื่องมือวาดรูปอื่น
        นับเป็น 1 รอบ และไม่เก็บรูปไว้
      </p>
      <DescribeBoard />
    </div>
  );
}
