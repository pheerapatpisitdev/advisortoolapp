import type { Metadata } from "next";
import { loadAiPage } from "./actions";
import { BudgetSection, KeysSection, RatesSection } from "./AiClient";
import { LanesCard } from "./LanesCard";
import { ModelSwitches } from "./ModelSwitches";
import { loadLanes } from "./lanes-actions";
import { gatePage } from "@/lib/auth/viewer";
import { tablesMeta } from "@/calc/plans/tables-meta";
import { daysUntil } from "@/calc/calendar";
import { PageHead } from "../ui";
import { SettingsNav } from "./kit/SettingsNav";
import { SectionHead } from "./kit/parts";

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
  const [data, lanes] = await Promise.all([
    loadAiPage(),
    // the keys must stay reachable when the lanes cannot be read: the card is left out instead
    loadLanes().catch((e) => {
      console.error("อ่านลำดับหลักและสำรองไม่สำเร็จ:", e instanceof Error ? e.message : "unknown");
      return null;
    }),
  ]);
  const meta = tablesMeta();
  // counted the way the overview's warning counts, so the two never disagree by a day
  const daysLeft = daysUntil(new Date(), meta.expiresOn);
  const rates = { version: meta.version, expiresOn: meta.expiresOn, daysLeft: Math.max(0, daysLeft), expired: meta.expired };
  // settings-kit's shape (owner chose ข, 2026-11-18, https://claude.ai/artifact/J3GD1YGtWCU9WTiovgeoDP): a section
  // per card the page had, down a sidebar; the model switches are their own section again, so they stay
  // reachable when the lanes cannot be read
  return (
    <>
      <PageHead title="คีย์และโมเดล" hint="กุญแจ โมเดล งบ และบริการอื่นที่ระบบใช้ ยอดใช้จ่ายอยู่ที่หน้าการใช้งานและค่า AI" />
      <SettingsNav sections={[
        { id: "keys", group: "คีย์และโมเดล", title: "กุญแจของค่าย AI", keywords: "key api กุญแจ cloud run",
          node: <KeysSection keys={data.keys} providers={data.providers} models={data.models} video={data.video} /> },
        { id: "lanes", group: "คีย์และโมเดล", title: "ลำดับหลักและสำรอง", keywords: "lane สำรอง autobot เขียน รูปภาพ เสียง วิดีโอ",
          node: lanes
            ? <LanesCard {...lanes} />
            : <><SectionHead title="ลำดับหลักและสำรอง" /><p className="text-sm text-[var(--bot-red-ink)]">อ่านลำดับหลักและสำรองไม่สำเร็จ ลองโหลดหน้าใหม่ ระบบยังใช้ลำดับที่บันทึกไว้</p></> },
        { id: "budget", group: "คีย์และโมเดล", title: "งบต่อเดือน", keywords: "budget งบ รีเซ็ต",
          node: <BudgetSection settings={data.settings} spentThisMonth={data.spentThisMonth} content={data.content} /> },
        { id: "models", group: "คีย์และโมเดล", title: "ปิดโมเดลทั้งระบบ", keywords: "model โมเดล",
          node: <><SectionHead title="ปิดโมเดลทั้งระบบ" hint="ปิดโมเดลที่ไม่ต้องการให้ทุกหมวดข้ามไปพร้อมกัน ต่างจากสวิตช์ในลำดับหลักและสำรองที่ข้ามเฉพาะในหมวดนั้น" /><ModelSwitches models={data.models} /></> },
        { id: "rates", group: "ข้อมูล", title: "ตารางเบี้ย", keywords: "rates เบี้ย",
          node: <RatesSection rates={rates} /> },
      ]} />
    </>
  );
}
