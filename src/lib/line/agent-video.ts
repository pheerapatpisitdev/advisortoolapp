import type { AnySlots, WithPdf } from "@/lib/assistant/slots";
import type { LineMessage } from "@/lib/line/client";
import { C } from "@/lib/line/rich-menu-image";
import { EXTERNAL_BROWSER } from "@/lib/quote-pdf/link";
import { VIDEO_PAGE, videoStartHref, type VideoStart } from "@/lib/quote-video/link";
import { siteUrl } from "@/lib/site-url";

/**
 * A linked agent asking the LINE OA for a video (owner chose ก ก, 2026-11-27, mockup
 * https://claude.ai/artifact/V9Fv9Rouh4Lbj1jSkGmXQU). Until clips can be ordered in the chat, the
 * bot sends them to วิดีโอนำเสนอ instead of "ไม่ได้" or "เดี๋ยวแอดมินเช็ก": after a quote in this
 * chat, a card whose link opens the form on that quote (ก); with "คลิปทำเสร็จ" off, a reminder
 * that the clip comes back here only when it is on (ก). A customer asking is left to the brains.
 */

const VIDEO_WORD = /วิดีโอ|วีดีโอ|วิดิโอ|วีดิโอ|คลิป|video|clip/i;
const ASKING = /ทำ|สร้าง|สั่ง|ขอ|อยากได้|เป็น|ได้ไหม|ได้มั้ย|ยังไง|อย่างไร|\?/;

/** a short message asking to make a video: "สร้างเป็นวิดีโอ", "สั่งทำวิดีโอใน LINE ได้ไหม" */
export function asksForVideo(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 80) return false;
  return VIDEO_WORD.test(t) && ASKING.test(t);
}

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

const PLAN_NAMES: Partial<Record<VideoStart["product"], string>> = {
  LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", LEGACY: "มรดก",
};

const baht = (n: number) => n.toLocaleString("en-US");

/** the card's lines: "Life Protect · ชาย 35 ปี", then the sum, plan or tier when known */
export function startLines(s: VideoStart): string[] {
  const who = `${s.sex === "F" ? "หญิง" : "ชาย"} ${s.age} ปี`;
  const detail = s.sumAssured ? `ทุน ${baht(s.sumAssured)} บาท`
    : s.plan ? `แผน ${s.plan}`
      : s.tier ? `ครอบครัวได้รับ ${baht(s.tier * 1_000_000)} บาท`
        : "";
  return [`${PLAN_NAMES[s.product] ?? s.product} · ${who}`, ...(detail ? [detail] : [])];
}

/** where the clip goes once done: this chat, or how to make it come here */
export function clipComesBack(notifyOn: boolean, settings: string): string {
  return notifyOn
    ? "คลิปเสร็จแล้ว ระบบจะส่งวิดีโอมาที่แชทนี้ให้เลย กดค้างที่คลิปแล้วแชร์ต่อให้ลูกค้าได้ครับ"
    : `ถ้าอยากให้ส่งวิดีโอมาที่แชทนี้ เปิด "คลิปทำเสร็จ" ในตั้งค่าส่วนตัวก่อนครับ\n${settings}`;
}

/** the LINE menu's navy and ink (rich-menu-image.tsx); the button in LINE's own green, as its chat draws one */
const NAVY = C.ground;
const GREEN = "#06C755";

function card(s: VideoStart, link: string): LineMessage {
  const lines = startLines(s);
  return {
    type: "flex",
    altText: `วิดีโอนำเสนอ · ${lines.join(" · ")}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: NAVY, paddingAll: "12px",
        contents: [{ type: "text", text: "วิดีโอนำเสนอ", color: C.ink, weight: "bold", size: "sm" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "xs", paddingAll: "12px",
        contents: lines.map((text) => ({ type: "text", text, size: "sm", wrap: true })),
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px", paddingTop: "0px",
        contents: [{
          type: "button", style: "primary", color: GREEN, height: "sm",
          action: { type: "uri", label: "เปิดหน้าวิดีโอนำเสนอ", uri: link },
        }],
      },
    },
  };
}

/**
 * The reply: after a quote, the words, the card and where the clip goes (ก); with no quote, how
 * to order one today and where the clip goes.
 */
export function agentVideoReply(start: VideoStart | null, notifyOn: boolean, settings: string): LineMessage[] {
  const back = clipComesBack(notifyOn, settings);
  if (start) {
    return [
      { type: "text", text: "ทำวิดีโอจากใบเสนอนี้ได้ที่หน้าวิดีโอนำเสนอครับ กรอกข้อมูลไว้ให้แล้ว เลือกแบบคลิปแล้วกดสร้างได้เลย" },
      card(start, videoFormLink(start)),
      { type: "text", text: back },
    ];
  }
  return [{
    type: "text",
    text: [
      "ตอนนี้ยังพิมพ์สั่งในแชทไม่ได้ครับ สั่งได้ที่หน้าวิดีโอนำเสนอ หรือกดเมนูด้านล่าง แท็บ Studio → วิดีโอนำเสนอ",
      videoFormLink(null),
      "",
      back,
    ].join("\n"),
  }];
}
