import { NextResponse } from "next/server";
import { syncAds } from "@/lib/ads/sync";
import { refuseUnlessCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel calls this once a day (vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Nobody else is meant to: without the secret the route answers nobody at all, which is the
 * safer failure on a deployment that forgot to set it.
 *
 * The answer is 500 when every account failed. It used to be 200 whatever happened, so the
 * cron's own record showed a green tick on the nights nothing was fetched; one account
 * failing among several still answers 200, because the others did arrive, and each
 * account's failure is written onto its own card on the ADS page by the sync itself.
 */
export async function GET(req: Request) {
  const refused = await refuseUnlessCron(req);
  if (refused) return refused;
  const result = await syncAds();
  for (const e of result.errors) console.error(`ดึงตัวเลขโฆษณา ${e.name} (${e.actId}) ไม่สำเร็จ: ${e.message}`);
  const allFailed = result.accounts > 0 && result.errors.length >= result.accounts;
  return NextResponse.json(result, { status: allFailed ? 500 : 200 });
}
