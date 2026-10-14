import { classify } from "@/lib/facebook/status";
import { pageToken } from "@/lib/facebook/connection";
import { publishView } from "./publish-label";
import type { Publish } from "./store";

/**
 * Whether the content workbench can post to each connected Page, for the ออโต้โพสต์ screen.
 *
 * The Messenger screen already checks every Page, but for the bot: its test is a read of the
 * Page's Messenger settings, and a Page can pass that and still refuse a post, or fail it for
 * a reason that has nothing to do with posting. This screen asks the question the workbench
 * depends on, and says what the workbench has done with each Page so far.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

/** the permission a Page must have been connected with for anything to be posted to it */
export const POST_SCOPE = "pages_manage_posts";

/** One piece's trip to a Page, as far as the counts need it. */
export type PublishRow = Pick<Publish, "pageId" | "state" | "at" | "error">;

export interface PageActivity {
  /** held by Facebook for a time still to come */
  scheduled: number;
  /** the soonest of those */
  nextAt: string | null;
  /** up on the Page, including held posts whose time has passed */
  published: number;
  lastPublishedAt: string | null;
  /** refused, or a send that died, and not yet sent again — each is waiting on the owner */
  failed: number;
  /** the newest refusal's words */
  lastError: string | null;
}

const EMPTY: PageActivity = { scheduled: 0, nextAt: null, published: 0, lastPublishedAt: null, failed: 0, lastError: null };

/**
 * Where each Page's posts stand, read the way the calendar reads them (publishView), so the
 * two screens cannot disagree about what is scheduled and what is up.
 */
export function activityByPage(rows: PublishRow[], now: Date = new Date()): Map<string, PageActivity> {
  const out = new Map<string, PageActivity>();
  /** when the newest refusal was, per Page, so its words are the ones kept */
  const failedAt = new Map<string, number>();
  for (const r of rows) {
    if (!r.pageId) continue;
    const a = out.get(r.pageId) ?? { ...EMPTY };
    out.set(r.pageId, a);
    const view = publishView({ ...r, postId: null }, now);
    if (view.kind === "scheduled") {
      a.scheduled += 1;
      if (!a.nextAt || new Date(r.at!).getTime() < new Date(a.nextAt).getTime()) a.nextAt = r.at;
    } else if (view.kind === "published") {
      a.published += 1;
      if (r.at && (!a.lastPublishedAt || new Date(r.at).getTime() > new Date(a.lastPublishedAt).getTime())) a.lastPublishedAt = r.at;
    } else if (view.kind === "failed") {
      a.failed += 1;
      const t = r.at ? new Date(r.at).getTime() : 0;
      if (a.lastError === null || t > (failedAt.get(r.pageId) ?? -1)) {
        a.lastError = view.error;
        failedAt.set(r.pageId, t);
      }
    }
  }
  return out;
}

export type PostingCheck =
  | { status: "ok" }
  /** Meta would not say just now; nothing is known to be wrong */
  | { status: "unknown"; note: string }
  | { status: "bad"; advice: string; detail: string };

const RECONNECT = "แล้วกดเชื่อมต่อเพจเพิ่มที่หน้าเพจและช่องทาง";

/**
 * What a refusal from Facebook means for posting, in words the owner can act on.
 *
 * #200 with "administrative permission" is the one the owner met on 2026-09-25 with
 * ประกันเงินออมเพื่อลูก: the app has its permissions, but the Facebook account that connected
 * the Page does not have enough of a role on it, or the business that owns the Page demands
 * two-factor sign-in and that account has not turned it on. Reconnecting alone does not fix
 * it, so it is said separately from a permission that was simply not ticked.
 */
export function explainCheck(code: number, message: string): Exclude<PostingCheck, { status: "ok" }> {
  const kind = classify(code);
  if (kind === "rate-limit") {
    return { status: "unknown", note: "Meta จำกัดจำนวนครั้งที่ถาม ตรวจไม่ได้ชั่วคราว ลองเปิดหน้านี้ใหม่ในอีกสักครู่" };
  }
  if (kind === "revoked") {
    return {
      status: "bad",
      detail: message,
      advice: `Meta ถอนสิทธิ์ของเพจนี้แล้ว ระบบโพสต์ลงเพจนี้ไม่ได้ — ${RECONNECT} และติ๊กทุกเพจพร้อมกัน`,
    };
  }
  if (code === 200 && /administrative permission|two factor/i.test(message)) {
    return {
      status: "bad",
      detail: message,
      advice:
        "บัญชี Facebook ที่ใช้เชื่อมต่อมีสิทธิ์ในเพจนี้ไม่พอ หรือธุรกิจที่เป็นเจ้าของเพจบังคับให้เปิดยืนยันตัวตน 2 ขั้นตอน — "
        + "ให้บัญชีนั้นมีสิทธิ์ควบคุมเพจแบบเต็ม (Meta Business Suite → การตั้งค่า → ผู้คน) และเปิดยืนยันตัวตน 2 ขั้นตอนในบัญชี "
        + RECONNECT,
    };
  }
  if (kind === "permission") {
    return {
      status: "bad",
      detail: message,
      advice: `เพจนี้ยังไม่ได้อนุญาตให้ระบบจัดการโพสต์ — ${RECONNECT} แล้วกดอนุญาตให้จัดการโพสต์ของเพจ`,
    };
  }
  return { status: "bad", detail: message, advice: "Facebook ตอบกลับผิดปกติ ลองเปิดหน้านี้ใหม่ ถ้ายังเป็นอยู่ให้กดเชื่อมต่อเพจเพิ่มที่หน้าเพจและช่องทาง" };
}

/**
 * Asks Facebook, without posting anything, whether this Page lets the workbench manage its
 * posts: a read of the Page's scheduled posts, which is the list a scheduled post goes on and
 * takes the same token and the same role on the Page as putting one there.
 */
export async function checkPosting(pageId: string): Promise<PostingCheck> {
  const token = await pageToken(pageId);
  if (!token) return { status: "bad", detail: "no token", advice: `ไม่พบสิทธิ์เชื่อมต่อของเพจนี้ — ${RECONNECT}` };
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/scheduled_posts?fields=id&limit=1`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({})) as { error?: { code?: number; message?: string } };
    if (res.ok && !body.error) return { status: "ok" };
    return explainCheck(body.error?.code ?? res.status, body.error?.message ?? `HTTP ${res.status}`);
  } catch {
    return { status: "unknown", note: "ติดต่อ Facebook ไม่ได้ชั่วคราว ลองเปิดหน้านี้ใหม่ในอีกสักครู่" };
  }
}
