"use server";
import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { requireMember } from "@/lib/auth/viewer";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iShieldTable } from "@/lib/ishield-table";
import { getContact } from "@/lib/quote-video/contact";
import { costView, createVideo, listVideos, produce, videoLink, type CostView, type VideoStatus } from "@/lib/quote-video/make";
import { formatBaht } from "@/lib/wallet/money";
import { cleanCustomerName, productOf, quoteVideoFacts, type Product, type VideoInput } from "@/lib/quote-video/script";

/** วิดีโอนำเสนอ (owner, 2026-10-11): every agent's — two free clips each, then the Studio wallet. */

/** the paying terms each product's clip offers, as its page names them */
const TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const SUM_STEP = 50_000;
const NAMES: Record<Product, string> = { LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra" };

export interface Preview { lead: { label: string; amount: string }; mark: string; prices: { label: string; amount: string; main: boolean } [] }
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

function sumLimits(product: "LIFEPROTECT" | "ISHIELD") {
  if (product === "ISHIELD") {
    const t = iShieldTable();
    return { min: t.saMin, max: t.saMax };
  }
  return { min: 500_000, max: 50_000_000 };
}

/** What was sent, made into an input the engine is asked about — or the words for what is wrong. */
function checked(v: VideoInput): VideoInput | string {
  const c = checkedQuote(v);
  return typeof c === "string" ? c : { ...c, narrator: v.narrator === "M" ? "M" : "F" };
}

function checkedQuote(v: VideoInput): VideoInput | string {
  if (v.sex !== "M" && v.sex !== "F") return "เลือกเพศ";
  if (!Number.isInteger(v.age) || v.age < 0 || v.age > 99) return "ใส่อายุให้ถูกต้อง";
  if (v.product === "IHEALTHY") {
    const codes = new Set(iHealthyTable().plans.map((p) => p.code));
    if (!codes.has(v.plan)) return "เลือกแผน";
    const compare = [...new Set((Array.isArray(v.compare) ? v.compare : []).filter((c) => codes.has(c) && c !== v.plan))].slice(0, 2);
    return { product: "IHEALTHY", sex: v.sex, age: v.age, plan: v.plan, compare };
  }
  const product = productOf(v);
  if (product !== "LIFEPROTECT" && product !== "ISHIELD") return "เลือกแบบประกัน";
  const term = TERMS[product].find((x) => x.variant === v.variant);
  if (!term) return "เลือกระยะชำระเบี้ย";
  const { min, max } = sumLimits(product);
  if (!Number.isInteger(v.sumAssured) || v.sumAssured < min || v.sumAssured > max || v.sumAssured % SUM_STEP) {
    return `ทุนประกัน ${min.toLocaleString("en-US")} – ${max.toLocaleString("en-US")} บาท ทีละ 50,000`;
  }
  return { product, variant: v.variant, sex: v.sex, age: v.age, sumAssured: v.sumAssured };
}

const NOT_PRICED = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุ ทุน หรือแผน";

export async function previewQuote(v: VideoInput): Promise<Preview | { error: string }> {
  await requireMember();
  const c = checked(v);
  if (typeof c === "string") return { error: c };
  const f = quoteVideoFacts(c);
  if (!f) return { error: NOT_PRICED };
  return { lead: { label: f.lead.label, amount: f.lead.amount }, mark: f.leadMark, prices: f.prices };
}

export async function makeVideo(v: VideoInput, customer: string): Promise<Made> {
  const viewer = await requireMember();
  const c = checked(v);
  if (typeof c === "string") return { ok: false, error: c };
  if (!quoteVideoFacts(c)) return { ok: false, error: NOT_PRICED };
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
const planWord = (code: string) => code.charAt(0) + code.slice(1).toLowerCase();
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
    const input = v.input;
    const product = productOf(input);
    const what = input.product === "IHEALTHY"
      ? planWord(input.plan)
      : `${sumWords(input.sumAssured)} · ${TERMS[product as "LIFEPROTECT" | "ISHIELD"].find((x) => x.variant === input.variant)?.years ?? "?"} ปี`;
    const who = `${NAMES[product]} · ${SEX[input.sex]} ${input.age} · ${what}`;
    const done = v.status === "done" && v.video_path;
    const file = `${NAMES[product].replace(/\s+/g, "")}-${v.customer_name || `${SEX[input.sex]}${input.age}`}.mp4`;
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
