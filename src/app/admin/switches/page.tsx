import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { DEFAULT_CLOSED, SHOWN_FEATURES } from "@/lib/switches/features";
import { readSwitches } from "@/lib/switches/store";
import { PageHead } from "../ui";
import { SwitchBoard } from "./SwitchBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เปิด-ปิดฟังก์ชัน | AdvisorTool" };

/**
 * เปิด-ปิดฟังก์ชันชั่วคราว for the Super Admin (owner chose ก ก ก, 2026-10-17; mockup
 * https://claude.ai/artifact/QHYvw2p19iTuj9LcnxWge7): a tool switched off while something it
 * needs is down, with the words its users see (src/lib/switches).
 */
export default async function AdminSwitchesPage() {
  await gatePage("/admin/switches", "backoffice");
  const switches = await readSwitches();
  return (
    <>
      <PageHead title="เปิด-ปิดฟังก์ชัน" hint="ปิดเครื่องมือชั่วคราวเวลาขัดข้อง ผู้ใช้จะเห็นข้อความแจ้งแทนการกดแล้วล้ม เจ้าของและ Super Admin ยังใช้ทดสอบได้" />
      <SwitchBoard
        rows={SHOWN_FEATURES.map((f) => ({ key: f.key, label: f.label, note: "note" in f ? f.note : undefined, ...switches[f.key] }))}
        placeholder={DEFAULT_CLOSED}
      />
    </>
  );
}
