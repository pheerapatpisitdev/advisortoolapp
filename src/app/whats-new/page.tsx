import "../home-theme.css";
import { AppShell } from "@/components/shell/AppShell";
import { gatePage } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";
import { updatesFor } from "@/lib/updates/store";
import { WhatsNewList } from "./WhatsNewList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "มีอะไรใหม่ | AdvisorTool",
  description: "อัปเดตของ AdvisorTool: ฟังก์ชันใหม่ สิ่งที่ปรับปรุง และสิ่งที่แก้ไข",
};

/**
 * มีอะไรใหม่ (owner chose 1ข 2ก 3ก, 2026-11-14, mockup https://claude.ai/artifact/NW7M5MzvhWiZHymbyU34hs): the
 * changes published on /admin/updates in the last 60 days, newest first, each viewer shown only what is for
 * them. Opening it marks everything read (WhatsNewList), which clears the menu's number and /home's bar.
 */
export default async function WhatsNewPage() {
  const viewer = await gatePage("/whats-new");
  const news = await updatesFor(viewer).catch((e) => {
    console.error("whats-new: list not read:", e instanceof Error ? e.message : e);
    return null;
  });
  return (
    <div className="home-chat">
      <AppShell who={await shellWho(viewer)}>
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-10 pt-3 lg:pt-6">
          <header className="max-lg:ml-12">
            <h1 className="text-2xl font-semibold text-balance">มีอะไรใหม่</h1>
            <p className="text-sm text-[var(--hm-mute)]">อัปเดตของ AdvisorTool ย้อนหลัง 60 วัน</p>
          </header>
          {news ? (
            <WhatsNewList rows={news.rows} unread={news.unread.map((u) => u.id)} />
          ) : (
            <p role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ color: "var(--hm-alert)", background: "var(--hm-alert-bg)", borderColor: "var(--hm-alert-line)" }}>
              เปิดรายการอัปเดตไม่ได้ตอนนี้ ลองรีเฟรชหน้าอีกครั้ง
            </p>
          )}
        </div>
      </AppShell>
    </div>
  );
}
