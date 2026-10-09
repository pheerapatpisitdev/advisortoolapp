import type { Metadata } from "next";
import { LoginDoor, type DoorParams } from "./login/door";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | AdvisorTool",
  description: "ถามเงื่อนไขแบบประกันและคิดเบี้ยจากตารางจริง ตอบจากข้อมูลในระบบเท่านั้น",
};

/**
 * The front page is the way in (owner, 2026-10-10): Studio's sign-in, and where every gate sends
 * somebody not signed in. Nothing saying where to go means /home. The chat that used to be here
 * is at /home, still open to anyone with its free questions.
 */
export default function Front({ searchParams }: { searchParams: DoorParams }) {
  return <LoginDoor searchParams={searchParams} />;
}
