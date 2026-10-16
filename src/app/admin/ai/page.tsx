import type { Metadata } from "next";
import { loadAiPage } from "./actions";
import { AiClient } from "./AiClient";
import { gatePage } from "@/lib/auth/viewer";
import { tablesMeta } from "@/calc/plans/tables-meta";
import { daysUntil } from "@/calc/calendar";
import { PageHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * The tab says which page this is. The root layout's title is the calculator's, and every
 * admin page wore it, so two open tabs of the back office could not be told apart.
 */
export const metadata: Metadata = {
  title: "คีย์และโมเดล | AdvisorTool",
};

export default async function AiPage() {
  await gatePage("/admin/ai", "backoffice");
  const data = await loadAiPage();
  const meta = tablesMeta();
  // counted the way the overview's warning counts, so the two never disagree by a day
  const daysLeft = daysUntil(new Date(), meta.expiresOn);
  return (
    <>
      <PageHead title="คีย์และโมเดล" hint="กุญแจ โมเดล งบ และบริการอื่นที่ระบบใช้ ยอดใช้จ่ายอยู่ที่หน้าการใช้งานและค่า AI" />
      <AiClient {...data} rates={{ version: meta.version, expiresOn: meta.expiresOn, daysLeft: Math.max(0, daysLeft), expired: meta.expired }} />
    </>
  );
}
