import { redirect } from "next/navigation";

/** สอน AI is a tab of สอนบอท since 2026-10-15 (owner chose ข); its old address still leads there. */
export default function KnowledgePage() {
  redirect("/admin/teach?tab=lessons");
}
