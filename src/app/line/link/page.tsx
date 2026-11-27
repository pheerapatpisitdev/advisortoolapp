import type { Metadata } from "next";
import { OA_ID } from "@/lib/line/agent-line";
import { liffId } from "@/lib/line/liff";
import { LiffLink } from "./LiffLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เชื่อม LINE | AdvisorTool", robots: { index: false } };

/**
 * The page the QR on ตั้งค่าส่วนตัว opens inside LINE (owner chose ง, 2026-11-21: the way UnitOS
 * and KingClub link). Open to anybody: LINE says who holds the phone, the code says whose
 * alerts. src/lib/line/liff.ts.
 */
export default function LineLinkPage() {
  const id = liffId();
  return (
    <main className="mx-auto min-h-screen max-w-sm px-4 py-8">
      {id ? (
        <LiffLink liffId={id} oa={OA_ID} />
      ) : (
        <p className="text-sm text-[var(--bot-ink-mute)]">ยังเชื่อม LINE แบบนี้ไม่ได้ เปิดหน้า ตั้งค่าส่วนตัว ใน advisortool แล้วทำตามที่หน้านั้นบอก</p>
      )}
    </main>
  );
}
