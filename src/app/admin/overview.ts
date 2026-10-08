"use server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { monthSpend, spendSince } from "@/lib/ai/ledger";
import { pageConnection } from "@/lib/facebook/connection";
import { adAccounts } from "@/lib/facebook/ads-connection";
import { SUBSCRIBED_FIELDS } from "@/lib/facebook/oauth";
import { tablesMeta } from "@/lib/api/service";
import { daysUntil } from "@/calc/calendar";
import { conversationsSince, openQuestions, READ_FAILED } from "@/lib/crm/load";
import { rangeStart, summarise } from "@/lib/crm/summary";
import type { Counts } from "@/lib/crm/types";
import { requireStaff } from "@/lib/auth/viewer";

/**
 * What is waiting for somebody, and how the week has gone.
 *
 * `/admin` was a five-line redirect to the AI settings, so opening the back office told you
 * nothing and landed you on the page you were least likely to want. The owner named the gap:
 * "no page that shows the overall picture".
 *
 * The rule for the top half is that a warning appears only when it is true. A dashboard whose
 * panels are always lit is a dashboard nobody reads, and this system has a live example of the
 * cost: the Messenger subscription has never been switched on, so no customer message has ever
 * reached the database — and the only place that was visible was a page nobody had reason to
 * open.
 */

export type Urgency = "wait" | "soon";

export interface Attention {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  urgency: Urgency;
}

/**
 * The week, as the customer page's "7 วัน" counts it.
 *
 * `null` where a figure could not be read — never zero, which would say nobody wrote.
 */
export interface Week {
  /** the same three figures, under the same names, as /admin/crm?range=7d */
  counts: Pick<Counts, "arrived" | "priced" | "interested"> | null;
  /** open questions, the same number the alert and the CRM tab show */
  unanswered: number | null;
  aiCostThisMonth: number | null;
  budgetThb: number | null;
}

export interface Overview {
  attention: Attention[];
  week: Week;
}

/** far enough ahead that new rates can be asked for without anybody hurrying */
const EXPIRY_WARNING_DAYS = 60;
/** one missed daily pull plus a day of grace */
const ADS_STALE_MS = 2 * 86_400_000;

/**
 * The webhook subscriptions, in the owner's words.
 *
 * The detail line listed Meta's own field names — "ขาด messaging_referrals" — which tell the
 * owner nothing about what is broken or what to press.
 */
const FIELD_WORDS: Record<string, string> = {
  messages: "ข้อความจากลูกค้า",
  messaging_postbacks: "การกดปุ่มในแชท",
  message_echoes: "ข้อความที่เพจตอบเอง",
  messaging_referrals: "ข้อมูลว่าลูกค้ามาจากโฆษณาไหน",
};

/** A thing that failed to be read, kept as "could not tell" rather than as an answer. */
const FAILED = Symbol("failed");

async function orFailed<T>(what: string, read: () => Promise<T>): Promise<T | typeof FAILED> {
  try {
    return await read();
  } catch (e) {
    console.error(`${READ_FAILED} (${what}):`, e);
    return FAILED;
  }
}

/** A Supabase result, turned into a value or a throw, so `orFailed` can see the failure. */
function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function loadOverview(): Promise<Overview> {
  await requireStaff("admin");
  const supabase = supabaseAdmin();

  /**
   * The week is the customer page's seven days, read by the customer page's own reader and
   * counted by its own `summarise`. It was the last 168 hours, counted here, with "ขอสมัคร"
   * meaning the form going out — so /admin said 114, 35 and /admin/crm said 107, 32 on the
   * same morning, and neither page could say why.
   */
  const [connection, open, conversations, spend, settings, ads, newestAd] = await Promise.all([
    orFailed("เพจ", () => pageConnection()),
    orFailed("คำถามค้างตอบ", () => openQuestions(1)),
    orFailed("บทสนทนา", () => conversationsSince(rangeStart("7d"))),
    orFailed("ค่า AI", async () => monthSpend(await spendSince())),
    orFailed("งบ AI", async () =>
      must(await supabase.from("ins_ai_settings").select("monthly_budget_thb").maybeSingle()) as
        { monthly_budget_thb: number | null } | null),
    orFailed("บัญชีโฆษณา", () => adAccounts()),
    orFailed("ตัวเลขโฆษณา", async () =>
      must(await supabase.from("ins_ad_daily").select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle()) as
        { fetched_at: string } | null),
  ]);

  const week = conversations === FAILED ? null : summarise(conversations, "7d").counts;
  const aiCost = spend === FAILED ? null : spend.baht;
  const budget = settings === FAILED ? null : settings?.monthly_budget_thb ?? null;
  const asked = open === FAILED ? null : open.total;

  const attention: Attention[] = [];

  /**
   * The subscription first, because without it none of the rest of this page has any figures
   * to show. A connected Page that is not subscribed looks connected on every screen that
   * only asks whether a token exists.
   */
  if (connection === FAILED) {
    // a failed look is not a missing Page: saying "ยังไม่ได้เชื่อม" here sent the owner off to
    // reconnect a Page that was working
    attention.push({
      id: "page", urgency: "wait",
      title: "ตรวจสถานะเพจไม่สำเร็จ ลองเปิดใหม่",
      detail: "ระบบอ่านสถานะการเชื่อมเพจไม่ได้ในครั้งนี้ บอทอาจยังตอบปกติ — ถ้าเปิดใหม่แล้วยังขึ้นอีก ให้ดูที่หน้าเชื่อมเพจ",
      href: "/admin/messenger", action: "ดูหน้าเชื่อมเพจ",
    });
  } else if (!connection) {
    attention.push({
      id: "page", urgency: "soon",
      title: "ยังไม่ได้เชื่อมเพจเฟซบุ๊ก",
      detail: "บอทยังตอบข้อความในเพจไม่ได้ และยังไม่มีข้อมูลลูกค้าเข้าระบบ",
      href: "/admin/messenger", action: "ไปเชื่อมเพจ",
    });
  } else {
    /**
     * The subscription, because without it none of the rest of this page has any figures to
     * show. A connected Page that is not subscribed looks connected on every screen that only
     * asks whether it is connected.
     */
    const missing = SUBSCRIBED_FIELDS.filter((f) => !connection.fields.includes(f));
    if (missing.length > 0) {
      attention.push({
        id: "subscribe", urgency: "soon",
        title: "เชื่อมเพจแล้ว แต่ยังไม่ได้สมัครรับข้อความ",
        detail: `ระบบยังไม่ได้รับ${missing.map((f) => FIELD_WORDS[f] ?? "ข้อมูลบางอย่าง").join(", ")} — กดปุ่มสมัครรับอีกครั้งที่หน้าเชื่อมเพจ`,
        href: "/admin/messenger", action: "กดสมัครรับ",
      });
    }
  }

  if (asked !== null && asked > 0) {
    attention.push({
      id: "unanswered", urgency: "wait",
      title: `มีคำถามที่ผู้ช่วยตอบเองไม่ได้ ${asked} ข้อ`,
      detail: "อ่านแล้วเขียนคำตอบไว้ แล้วกด “ตอบแล้ว” — ครั้งหน้าระบบจะตอบได้เองโดยไม่ต้องเสียค่า AI",
      href: "/admin/crm?tab=unanswered", action: "ไปอ่าน",
    });
  }

  const meta = tablesMeta();
  const left = daysUntil(new Date(), meta.expiresOn);
  if (meta.expired || left <= EXPIRY_WARNING_DAYS) {
    attention.push({
      id: "rates", urgency: meta.expired ? "soon" : "wait",
      title: meta.expired ? "ตารางเบี้ยหมดอายุแล้ว" : `ตารางเบี้ยเหลืออีก ${left} วัน`,
      detail: `ชุด ${meta.version} ใช้ได้ถึง ${meta.expiresOn} — ขอชุดใหม่จากบริษัทไว้ก่อน`,
      href: "/admin/ai", action: "ดูรายละเอียด",
    });
  }

  if (budget !== null && aiCost !== null && aiCost >= budget * 0.8) {
    attention.push({
      id: "budget", urgency: aiCost >= budget ? "soon" : "wait",
      title: aiCost >= budget ? "ค่า AI เดือนนี้เต็มงบแล้ว" : "ค่า AI เดือนนี้ใกล้เต็มงบ",
      detail: `ใช้ไป ${aiCost.toFixed(2)} จาก ${budget} บาท — เต็มงบแล้วผู้ช่วยจะหยุดตอบทั้งเว็บและเพจ`,
      href: "/admin/ai", action: "ดูการใช้งาน",
    });
  }

  /**
   * The advertising figures, last and gently: nothing here stops the bot answering. The two
   * states worth a line are "never connected" and "connected but the daily pull has stopped",
   * because the second looks exactly like the first from the ADS page's table.
   */
  if (ads === FAILED) {
    attention.push({
      id: "ads", urgency: "wait",
      title: "ตรวจบัญชีโฆษณาไม่สำเร็จ ลองเปิดใหม่",
      detail: "ระบบอ่านสถานะการเชื่อมบัญชีโฆษณาไม่ได้ในครั้งนี้ — ไม่ได้แปลว่าหลุดการเชื่อม",
      href: "/admin/ads", action: "ดูหน้า ADS",
    });
  } else if (ads.length === 0) {
    attention.push({
      id: "ads", urgency: "wait",
      title: "ยังไม่ได้เชื่อมบัญชีโฆษณา",
      detail: "หน้า ADS จะบอกได้ว่าโฆษณาแต่ละชิ้นได้ลูกค้ากี่คน ตกคนละกี่บาท",
      href: "/admin/ads", action: "ไปเชื่อม",
    });
  } else if (newestAd !== FAILED) {
    const fetchedAt = newestAd?.fetched_at;
    if (!fetchedAt || Date.now() - new Date(fetchedAt).getTime() > ADS_STALE_MS) {
      attention.push({
        id: "ads-stale", urgency: "wait",
        title: fetchedAt ? "ตัวเลขโฆษณาค้างเกิน 2 วัน" : "ยังไม่เคยดึงตัวเลขโฆษณา",
        detail: "ตัวดึงรายวันอาจติดขัด หรือการเชื่อมบัญชีโฆษณาหมดอายุ — กดดึงเองได้ที่หน้า ADS",
        href: "/admin/ads", action: "ไปดึง",
      });
    }
  }

  /** Whatever else could not be read, said once, so a blank is never mistaken for a zero. */
  const unread = [
    conversations === FAILED && "ตัวเลขลูกค้า",
    open === FAILED && "คำถามค้างตอบ",
    spend === FAILED && "ค่า AI",
    settings === FAILED && "งบ AI",
    newestAd === FAILED && "วันที่ดึงตัวเลขโฆษณา",
  ].filter((x): x is string => Boolean(x));
  if (unread.length > 0) {
    attention.push({
      id: "read-failed", urgency: "wait",
      title: "อ่านข้อมูลบางส่วนไม่สำเร็จ ลองเปิดใหม่",
      detail: `ยังไม่ได้แสดง: ${unread.join(", ")}`,
      href: "/admin", action: "เปิดใหม่",
    });
  }

  return {
    attention,
    week: {
      counts: week && { arrived: week.arrived, priced: week.priced, interested: week.interested },
      unanswered: asked,
      aiCostThisMonth: aiCost,
      budgetThb: budget,
    },
  };
}
