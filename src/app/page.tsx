import "./home-theme.css";
import { Chat } from "./Chat";
import { AppShell } from "@/components/shell/AppShell";
import { inviteToTry } from "@/lib/auth/free-asks";
import { memberSettings } from "@/lib/auth/member-store";
import { getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ถามเรื่องแบบประกัน | advisortool",
  description: "ถามเงื่อนไขแบบประกันและคิดเบี้ยจากตารางจริง ตอบจากข้อมูลในระบบเท่านั้น",
};

export default async function Home() {
  // the "ลอง Studio ฟรี" bar (owner, 2026-10-01); a read that fails hides it rather than the page
  const [viewer, settings] = await Promise.all([
    getViewer().catch(() => null),
    memberSettings().catch(() => null),
  ]);
  const invite = inviteToTry(Boolean(viewer), settings?.signupOpen === true);
  return (
    <div className="home-chat">
      <AppShell>
      {/* The page is exactly the screen, so the chat box can be the rest of it after the
          heading — a conversation that scrolls inside its own frame rather than a column of
          answers with the box you type in stranded somewhere down the page. */}
      {/* No row kept free for the phone's menu button: the chat decides for itself whether its
          heading sits beside that button or under it — see `Chat`. */}
      <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 pb-4 pt-3 sm:pb-5 lg:pt-5">
        <Chat invite={invite} />
      </div>
      </AppShell>
    </div>
  );
}
