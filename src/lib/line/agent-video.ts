import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import { EXTERNAL_BROWSER } from "@/lib/quote-pdf/link";
import { VIDEO_PAGE, videoStartHref, type VideoStart } from "@/lib/quote-video/link";
import { siteUrl } from "@/lib/site-url";

/**
 * A linked agent's video asked for in the LINE OA chat starts from the quote that chat holds (owner
 * chose ก ก, 2026-11-27, mockup https://claude.ai/artifact/V9Fv9Rouh4Lbj1jSkGmXQU), and แก้ละเอียดบนเว็บ
 * opens the form on it. Since ทาง ค the order itself is taken in the chat (src/lib/line/clip-order.ts).
 */

/** the latest PDF's figures, when it is the plan's own (the Life Protect sum is the sum assured, not the cover the family gets) */
function pdfFigures(slots: WithPdf<AnySlots>, page: string): { sum?: number; variant?: string } {
  const path = slots.pdf?.paths?.[0];
  if (!path) return {};
  const q = new URL(path, "https://x").searchParams;
  if (q.get("page") !== page) return {};
  const sum = Number(q.get("sum"));
  const variant = q.get("variant") ?? undefined;
  return { ...(Number.isInteger(sum) && sum > 0 ? { sum } : {}), ...(variant ? { variant } : {}) };
}

/**
 * The quote this chat holds, as the video form's start: Life Protect, iHealthy, iShield or มรดก
 * (the plans ค starts with, 2026-11-27), with a person to price. Null = no such quote yet.
 */
export function videoStartOfChat(slots: WithPdf<AnySlots> | null | undefined): VideoStart | null {
  if (!slots || slots.age === undefined || !slots.sex) return null;
  const person = { age: slots.age, sex: slots.sex };
  switch (slots.product ?? "lifeprotect") {
    case "lifeprotect": {
      const { sum, variant } = pdfFigures(slots, "lifeprotect");
      return { product: "LIFEPROTECT", ...person, ...(sum ? { sumAssured: sum } : {}), ...(variant ? { variant } : {}) };
    }
    case "ishield": {
      const s = slots as Extract<AnySlots, { product: "ishield" }>;
      return { product: "ISHIELD", ...person, ...(s.sumAssured ? { sumAssured: s.sumAssured } : {}), ...(s.variant ? { variant: s.variant } : {}) };
    }
    case "ihealthy": {
      const s = slots as Extract<AnySlots, { product: "ihealthy" }>;
      return { product: "IHEALTHY", ...person, ...(s.plan ? { plan: s.plan } : {}) };
    }
    case "legacy": {
      const s = slots as Extract<AnySlots, { product: "legacy" }>;
      return { product: "LEGACY", ...person, ...(s.tier ? { tier: s.tier } : {}) };
    }
    default:
      return null;
  }
}

/** the form's address, opened in the phone's own browser: Google's sign-in fails in LINE's */
export function videoFormLink(start: VideoStart | null): string {
  const url = new URL(siteUrl(start ? videoStartHref(start) : VIDEO_PAGE));
  url.searchParams.set(EXTERNAL_BROWSER, "1");
  return url.toString();
}
