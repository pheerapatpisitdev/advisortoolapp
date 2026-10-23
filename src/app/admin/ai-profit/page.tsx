import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/**
 * กำไรค่า AI is the first tab of การใช้งานและค่า AI since 2026-10-23 (owner chose ก, mockup
 * https://claude.ai/artifact/1MZqF78ZXVU64Pv5wPzh2u). The old address still opens, on that tab and
 * the period it was asked for, so a saved link does not break.
 */
export default async function AiProfitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/stats", "backoffice");
  const p = (await searchParams).p;
  redirect(typeof p === "string" && p ? `/admin/stats?p=${encodeURIComponent(p)}` : "/admin/stats");
}
