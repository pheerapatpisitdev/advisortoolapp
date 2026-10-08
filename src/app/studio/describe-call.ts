import type { DescribeResult } from "@/lib/content/describe-run";
import type { Swatch } from "@/lib/content/palette";

/** Order a picture's reading through /api/content-describe, which is not queued behind the page's other actions. */
export async function describeCall(image: { base64: string; mimeType: string; palette?: Swatch[]; thumb?: string }): Promise<DescribeResult> {
  try {
    const res = await fetch("/api/content-describe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image }),
    });
    return await res.json() as DescribeResult;
  } catch {
    return { ok: false, error: "อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
