import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/**
 * An old ชวนเพื่อน link, /r/CODE. ชวนเพื่อน was taken out on 2026-11-01 (owner chose ก); links
 * already sent on LINE still land on the front page, and nothing is remembered.
 */
export function GET(req: Request) {
  return NextResponse.redirect(`${requestOrigin(req)}/`);
}
