import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { allUpdates, readCounts } from "@/lib/updates/store";
import { PageHead } from "../ui";
import { UpdatesBoard } from "./UpdatesBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "มีอะไรใหม่ | หลังบ้าน" };

/**
 * มีอะไรใหม่ for the Super Admin (owner chose 1ข 2ก 3ก, 2026-11-14, mockup
 * https://claude.ai/artifact/NW7M5MzvhWiZHymbyU34hs, section 4): Claude's drafts from each push, edited and
 * published here; what agents see on /whats-new, and how many have read each.
 */
export default async function AdminUpdatesPage() {
  await gatePage("/admin/updates", "backoffice");
  const rows = await allUpdates();
  const reads = await readCounts(rows.filter((r) => r.status === "live").map((r) => r.id)).catch((e) => {
    console.error("whats-new: read counts not read:", e instanceof Error ? e.message : e);
    return null;
  });
  return (
    <>
      <PageHead title="มีอะไรใหม่" hint="อัปเดตที่ตัวแทนเห็นในเมนู มีอะไรใหม่ และแถบบนหน้าหลัก ร่างมาจาก Claude ทุกครั้งที่ขึ้นระบบ ตรวจคำแล้วกดเผยแพร่" />
      <UpdatesBoard rows={rows} reads={reads} />
    </>
  );
}
