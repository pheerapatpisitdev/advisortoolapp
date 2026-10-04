import type { SendResult } from "./send";
import type { LeadCta, SendObjective } from "./send-store";

/**
 * What the sent tab says and offers for each batch send and each ad launched one by one
 * (Ads Studio, 2026-10-04). Pure, so the rules for which button shows can be pinned by a test.
 */

/** Meta's effective_status in the words the owner reads; anything not listed is shown as Meta says it */
export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "กำลังวิ่ง",
  PAUSED: "หยุดไว้",
  CAMPAIGN_PAUSED: "หยุดไว้ (ที่แคมเปญ)",
  ADSET_PAUSED: "หยุดไว้ (ที่ชุดโฆษณา)",
  PENDING_REVIEW: "รอ Meta ตรวจ",
  IN_PROCESS: "Meta กำลังประมวลผล",
  DISAPPROVED: "Meta ไม่อนุมัติ",
  WITH_ISSUES: "มีปัญหา",
  ARCHIVED: "เก็บถาวร",
  DELETED: "ถูกลบ",
};
const BAD = new Set(["DISAPPROVED", "WITH_ISSUES"]);

/** What a send's ads ask people to do, as the owner reads it. */
export const OBJECTIVE_LABEL: Record<SendObjective, string> = { traffic: "ทราฟฟิก", leads: "ฟอร์มลีด" };

/** A lead ad's button, in the words Facebook shows on it in Thai. */
export const CTA_LABEL: Record<LeadCta, string> = { GET_QUOTE: "รับใบเสนอราคา", SIGN_UP: "ลงทะเบียน", LEARN_MORE: "ดูเพิ่มเติม" };

/** Where the owner accepts a Page's lead-ads terms; kept here, away from Graph code, for the dialog. */
export const tosUrl = (pageId: string) => `https://www.facebook.com/ads/leadgen/tos?page_id=${pageId}`;

/** Where the owner makes an Instant Form in Business Suite. */
export const NEW_FORM_URL = "https://business.facebook.com/latest/instant_forms";

export const statusText = (s: string | null): string | null => (s ? STATUS_LABEL[s] ?? s : null);
export const badStatus = (s: string | null): boolean => (s ? BAD.has(s) : false);

/** switched on, and not paused since: a pause after the last switch-on counts as off */
export function switchedOn(s: { activatedAt: string | null; pausedAt: string | null }): boolean {
  if (!s.activatedAt) return false;
  return !s.pausedAt || Date.parse(s.pausedAt) < Date.parse(s.activatedAt);
}

export interface SendShape {
  step: string;
  activatedAt: string | null;
  pausedAt: string | null;
  hasMetaCampaign: boolean;
  hasAdset: boolean;
  metaStatus: string | null;
  madeAfterActivation: number;
  items: { adId: string | null }[];
}

/**
 * The buttons one send shows.
 * - ลองใหม่: something is still missing — the campaign, the ad set, or an ad for one of its pieces.
 * - เปิดใช้ทั้งชุด: the ad set and at least one ad exist, and the send is not fully on — never
 *   switched on, paused since, an ad made after the last switch-on, or Meta saying it is not running.
 * - หยุดทั้งชุด: whenever there is a Meta campaign, whatever the switch-on record says (a switch-on
 *   that broke half-way can leave the campaign running).
 */
export function sendButtons(s: SendShape): { retry: boolean; activate: boolean; pause: boolean } {
  const anyAd = s.items.some((i) => i.adId);
  const fullyOn = switchedOn(s) && s.madeAfterActivation === 0 && (s.metaStatus === null || s.metaStatus === "ACTIVE");
  return {
    retry: s.step !== "ads" || s.items.some((i) => !i.adId),
    activate: s.hasMetaCampaign && s.hasAdset && anyAd && !fullyOn,
    pause: s.hasMetaCampaign,
  };
}

export interface BadgeShape {
  activatedAt: string | null;
  pausedAt: string | null;
  hasMetaCampaign: boolean;
  metaStatus: string | null;
  items: { effectiveStatus: string | null }[];
}

/**
 * The badge at the top of a send: whether it may be spending. Meta's word comes first — the
 * switch-on record can be half-finished (a switch-on or pause that broke midway).
 * - Meta says the campaign or any ad is ACTIVE: กำลังวิ่ง, marked เปิดใช้ไม่ครบ when no switch-on
 *   was recorded, with the switch-on time when the record agrees.
 * - ยังไม่เสียเงิน only when Meta says the campaign is PAUSED, or there is no Meta campaign.
 * - Otherwise (Meta unreadable or saying something else): the switch-on record, and no claim
 *   about money either way.
 * `since` is the time to show after the text, when there is one.
 */
export function sendBadge(s: BadgeShape): { on: boolean; text: string; since: string | null } {
  const active = s.metaStatus === "ACTIVE" || s.items.some((i) => i.effectiveStatus === "ACTIVE");
  if (active) {
    if (!s.activatedAt) return { on: true, text: "กำลังวิ่ง — เปิดใช้ไม่ครบ", since: null };
    return switchedOn(s) ? { on: true, text: "กำลังวิ่ง — เปิดใช้แล้ว", since: s.activatedAt } : { on: true, text: "กำลังวิ่ง", since: null };
  }
  if (!s.hasMetaCampaign || s.metaStatus === "PAUSED") return { on: false, text: "หยุดไว้ — ยังไม่เสียเงิน", since: null };
  if (switchedOn(s)) return { on: true, text: "เปิดใช้แล้ว", since: s.activatedAt };
  return { on: false, text: "หยุดไว้", since: null };
}

/** An ad launched one by one: เปิดใช้ when made and not switched on, หยุด whenever the ad exists. */
export function legacyButtons(l: { step: string; activatedAt: string | null; canPause: boolean }): { activate: boolean; pause: boolean } {
  return { activate: l.step === "ad" && !l.activatedAt, pause: l.canPause };
}

const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

/** The question before a switch-on: the account, the Page and the daily budget it is about to spend. */
export function activateQuestion(o: { what: string; account: string; page: string; dailyBudgetBaht: number }): string {
  return [
    `${o.what}?`,
    "",
    `บัญชีโฆษณา: ${o.account}`,
    `เพจ: ${o.page}`,
    `งบ: ${baht(o.dailyBudgetBaht)} ต่อวัน`,
    "",
    "กดแล้ว Facebook จะเริ่มใช้เงินจากบัญชีโฆษณานี้ทันที (หลังผ่านการตรวจของ Meta)",
  ].join("\n");
}

/** The question before a pause, naming the same three. */
export function pauseQuestion(o: { what: string; account: string; page: string; dailyBudgetBaht: number }): string {
  return [
    `${o.what}?`,
    "",
    `บัญชีโฆษณา: ${o.account}`,
    `เพจ: ${o.page}`,
    `งบ: ${baht(o.dailyBudgetBaht)} ต่อวัน`,
    "",
    "แอดจะหยุดแสดงและหยุดใช้เงิน เปิดใช้อีกครั้งได้ภายหลัง",
  ].join("\n");
}

/**
 * How one piece went, as the send dialog says it once the send is back: left out with why, made
 * (paused), failed with Meta's reason, or not made yet. Not made with a send on record: the sent
 * tab's ลองใหม่ makes it. Refused before a send existed: nothing was made, so the press is
 * ส่ง again — there is nothing in the sent tab to retry.
 */
export function sendOutcome(res: SendResult, pieceId: string): { tone: "ok" | "warn" | "bad"; text: string } {
  const skipped = res.skipped?.find((s) => s.pieceId === pieceId);
  if (skipped) return { tone: "warn", text: `กันออก — ${skipped.reason}` };
  const item = res.ok ? res.items.find((i) => i.pieceId === pieceId) : undefined;
  if (item?.adId) return { tone: "ok", text: "สร้างแล้ว (หยุดไว้)" };
  if (item?.error) return { tone: "bad", text: `ไม่สำเร็จ — ${item.error}` };
  if (!res.send) return { tone: "warn", text: "ยังไม่ได้สร้างอะไรบน Facebook — กดส่งอีกครั้ง" };
  return { tone: "warn", text: "ยังไม่ได้สร้าง — กดลองใหม่ในแท็บส่งแล้ว" };
}
