import { redirect } from "next/navigation";
import { gatePage } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/**
 * ประวัติเติมเงิน is the second tab of กระเป๋าเงิน since 2026-10-23 (owner chose ก, mockup
 * https://claude.ai/artifact/1MZqF78ZXVU64Pv5wPzh2u). The old address still opens, on that tab with
 * the day, range, kind and search it was given, so a saved link does not break.
 */
export default async function TopupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await gatePage("/admin/wallet", "backoffice");
  const sp = await searchParams;
  const q = new URLSearchParams({ tab: "topups" });
  for (const key of ["p", "d", "k", "q"]) {
    const v = sp[key];
    if (typeof v === "string" && v) q.set(key, v);
  }
  redirect(`/admin/wallet?${q}`);
}
