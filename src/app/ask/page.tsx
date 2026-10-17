import "../home-theme.css";
import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { closedFor } from "@/lib/switches/store";
import { openingGuide } from "@/lib/copilot/guide";
import { Chat } from "../Chat";
import { AppShell } from "@/components/shell/AppShell";
import { PassReminder, reminderOf } from "@/components/shell/PassReminder";
import { gatePage } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";
import { memberAccess } from "@/lib/members/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ถาม AI | AdvisorTool",
  description: "ถามเงื่อนไขแบบประกันและคิดเบี้ยจากตารางจริง ตอบจากข้อมูลในระบบเท่านั้น",
};

/**
 * ถาม AI. It was /home until 2026-10-14, when /home became งานวันนี้ (owner chose option ข and
 * said the home page carries no ask box); the menu's ถาม AI opens it here.
 */
export default async function Ask() {
  // members only (owner, 2026-10-12: "เป็นระบบปิด"): somebody not signed in signs in first
  const viewer = await gatePage("/ask");
  // a member's last three days: the bar over the chat (owner, 2026-10-13)
  const reminder = await reminderOf(viewer, memberAccess);
  // switched off by the Super Admin: locked, no chat at all (owner, 2026-10-17)
  const locked = await closedFor(viewer, "ask");
  return (
    <div className="home-chat">
      {/* who is signed in, for the foot of the menu: their name and ออกจากระบบ, or เข้าสู่ระบบ */}
      <AppShell who={await shellWho(viewer)}>
      {/* The page is exactly the screen, so the chat box can be the rest of it after the
          heading — a conversation that scrolls inside its own frame rather than a column of
          answers with the box you type in stranded somewhere down the page. */}
      {/* No row kept free for the phone's menu button: the chat decides for itself whether its
          heading sits beside that button or under it — see `Chat`. */}
      <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 pb-4 pt-3 sm:pb-5 lg:pt-5">
        {/* inside the screen-tall column, so the chat gives up the bar's height; clear of the
            phone's menu button, which is fixed at the top left */}
        {reminder && <div className="mb-2 shrink-0 max-lg:ml-12"><PassReminder {...reminder} /></div>}
        {locked ? (
          <LockedPage feature="ask" message={locked} back={{ href: "/home", label: "กลับหน้าหลัก" }} />
        ) : (
          <>
            <div className="shrink-0 max-lg:ml-12"><ClosedNotice viewer={viewer} feature="ask" /></div>
            {/* built on the server from the plan registry, so a new plan brings its own button */}
            <Chat guide={openingGuide()} />
          </>
        )}
      </div>
      </AppShell>
    </div>
  );
}
