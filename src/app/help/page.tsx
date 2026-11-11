import "../home-theme.css";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { getViewer } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";
import { HelpClips } from "./HelpClips";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "วิธีใช้งาน | AdvisorTool",
  description: "คลิปสั้นสอนใช้ advisortool ทีละขั้น: เพิ่มทางลัดไว้หน้าจอมือถือ เติมเงิน และทำวิดีโอนำเสนอแบบประกัน",
};

/**
 * วิธีใช้งาน: the how-to clips (src/lib/help/clips.ts). Open to everyone, signed in or not
 * (owner chose 1ก, 2026-11-11), so the link can be sent on LINE to somebody who has not got
 * in yet. Somebody signed in gets the menu round it; a stranger gets the way to the sign-in.
 */
export default async function HelpPage() {
  const viewer = await getViewer();
  const body = (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-10 pt-3 lg:pt-6">
      {!viewer && (
        <Link href="/" className="w-fit text-sm font-semibold text-[var(--hm-accent)] underline-offset-2 hover:underline">← หน้าเข้าสู่ระบบ</Link>
      )}
      <header>
        <h1 className="text-2xl font-semibold text-[var(--hm-accent)]">วิธีใช้งาน</h1>
        <p className="mt-1 text-[var(--hm-mute)]">คลิปสั้น สอนใช้ระบบทีละขั้น</p>
      </header>
      <HelpClips />
    </div>
  );
  return (
    <div className="home-chat min-h-dvh text-[var(--hm-ink)]">
      {viewer ? <AppShell who={await shellWho(viewer)}>{body}</AppShell> : body}
    </div>
  );
}
