"use server";
import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { requireMember } from "@/lib/auth/viewer";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { getContact } from "@/lib/quote-video/contact";
import { costView, createVideo, listVideos, planInput, produce, videoLink, type CostView, type VideoInput, type VideoStatus } from "@/lib/quote-video/make";
import { formatBaht } from "@/lib/wallet/money";
import { cleanCustomerName, quoteVideoFacts } from "@/lib/quote-video/script";

/** วิดีโอนำเสนอ (owner, 2026-10-11): every agent's — two free clips each, then the Studio wallet. */

const VARIANTS = ["WLF09H", "WLF19H"] as const;
const SUM_MIN = 500_000;
const SUM_MAX = 50_000_000;
const SUM_STEP = 50_000;

export interface Preview { legacy: string; perDay: string; prices: { label: string; amount: string; main: boolean }[] }
export interface VideoItem {
  id: string;
  createdAt: string;
  title: string;
  status: VideoStatus;
  error: string | null;
  watch: string | null;
  save: string | null;
  share: string | null;
  /** "ใช้สิทธิ์ฟรี", "หักจากกระเป๋า ฿1.90"; null for the owner's */
  paid: string | null;
}
export type Made = { ok: true; id: string } | { ok: false; error: string; needContact?: boolean };

function checked(v: VideoInput): VideoInput | string {
  const t = lifeProtectTable();
  if (!VARIANTS.includes(v.variant as (typeof VARIANTS)[number])) return "เลือกระยะชำระ 9 หรือ 19 ปี";
  if (v.sex !== "M" && v.sex !== "F") return "เลือกเพศ";
  if (!Number.isInteger(v.age) || v.age < t.ageMin || v.age > t.ageMax) return `อายุต้องอยู่ระหว่าง ${t.ageMin}–${t.ageMax} ปี`;
  if (!Number.isInteger(v.sumAssured) || v.sumAssured < SUM_MIN || v.sumAssured > SUM_MAX || v.sumAssured % SUM_STEP) {
    return "ทุนประกัน 500,000 – 50,000,000 บาท ทีละ 50,000";
  }
  return { variant: v.variant, sex: v.sex, age: v.age, sumAssured: v.sumAssured };
}

export async function previewQuote(v: VideoInput): Promise<Preview | { error: string }> {
  await requireMember();
  const c = checked(v);
  if (typeof c === "string") return { error: c };
  const f = quoteVideoFacts(planInput(c));
  if (!f) return { error: "แผนนี้คิดราคาไม่ได้ ลองเปลี่ยนอายุหรือทุน" };
  return { legacy: f.legacy, perDay: f.perDay, prices: f.prices };
}

export async function makeVideo(v: VideoInput, customer: string): Promise<Made> {
  const viewer = await requireMember();
  const c = checked(v);
  if (typeof c === "string") return { ok: false, error: c };
  if (!quoteVideoFacts(planInput(c))) return { ok: false, error: "แผนนี้คิดราคาไม่ได้ ลองเปลี่ยนอายุหรือทุน" };
  const contact = await getContact(viewer.agentId);
  if (!viewer.name.trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอ" };
  }
  try {
    const made = await createVideo(viewer, c, cleanCustomerName(customer));
    if ("refusal" in made) return { ok: false, error: made.refusal };
    const { id } = made;
    // the making outlives this answer: the board polls the row
    after(() => asWho(viewer.agentId, () => produce(id, viewer.name.trim())));
    return { ok: true, id };
  } catch (e) {
    console.error("quote video not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

const SEX = { M: "ชาย", F: "หญิง" } as const;
const sumWords = (n: number) => (n % 1_000_000 === 0 ? `${n / 1_000_000} ล้าน` : n.toLocaleString("en-US"));

/** how the next clip would be paid for */
export async function myCost(): Promise<CostView | null> {
  const viewer = await requireMember();
  return costView(viewer).catch((e) => {
    console.error("quote video cost not read:", e);
    return null;
  });
}

export async function myVideos(): Promise<VideoItem[]> {
  const viewer = await requireMember();
  const list = await listVideos(viewer.agentId);
  return Promise.all(list.map(async (v) => {
    const years = v.input.variant === "WLF09H" ? 9 : 19;
    const who = `${SEX[v.input.sex]} ${v.input.age} · ${sumWords(v.input.sumAssured)} · ${years} ปี`;
    const done = v.status === "done" && v.video_path;
    const file = `LifeProtect-${v.customer_name || `${SEX[v.input.sex]}${v.input.age}`}.mp4`;
    return {
      id: v.id,
      createdAt: v.created_at,
      title: v.customer_name ? `คุณ${v.customer_name} · ${who}` : who,
      status: v.status,
      error: v.error,
      watch: done ? await videoLink(v.video_path!, 3600) : null,
      save: done ? await videoLink(v.video_path!, 3600, file) : null,
      // a link that can go to a customer: a week
      share: done ? await videoLink(v.video_path!, 7 * 24 * 3600) : null,
      paid: v.paid_by === "free"
        ? (v.status === "failed" ? "คืนสิทธิ์ฟรีแล้ว" : "ใช้สิทธิ์ฟรี")
        : v.paid_by === "wallet"
          ? (v.status === "failed" ? "คืนเงินแล้ว" : v.charged_satang !== null ? `หักจากกระเป๋า ${formatBaht(Number(v.charged_satang))}` : "กันเงินไว้ระหว่างทำ")
          : null,
    };
  }));
}
