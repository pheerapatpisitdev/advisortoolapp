import { redirect } from "next/navigation";

/** ข้อความต้อนรับ is a tab of สอนบอท since 2026-10-15 (owner chose ข); its old address still leads there. */
export default function WelcomePage() {
  redirect("/admin/teach?tab=welcome");
}
