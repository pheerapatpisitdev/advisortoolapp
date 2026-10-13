"use server";
import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { myPages } from "@/lib/auth/pages";
import { can } from "@/lib/auth/access";
import { requireMember, requireStaff } from "@/lib/auth/viewer";
import { elevenVoice } from "@/lib/voice/elevenlabs";
import { cleanBudget, resolveBudget } from "@/lib/quote-video/budget";
import { NAMED, sendToCalendar } from "@/lib/quote-video/calendar";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iShieldTable } from "@/lib/ishield-table";
import { getContact } from "@/lib/quote-video/contact";
import { clipEstimates, clipSize, costView, createVideo, deleteVideo, listVideos, produce, videoLink, videoOf, voiceFullUntil, type CostView, type VideoRow, type VideoStatus } from "@/lib/quote-video/make";
import { clipKind, DEFAULT_ESTIMATES, readNote, type ProgressState } from "@/lib/quote-video/progress";
import { bangkokClock, VOICE_FULL, voiceFullNotice } from "@/lib/quote-video/voice-quota";
import { sizeOf, type VideoSize } from "@/lib/quote-video/timeline";
import { formatBaht } from "@/lib/wallet/money";
import { cleanCustomerName, pageCaption, productOf, quoteVideoFacts, type Product, type VideoInput } from "@/lib/quote-video/script";
import { fhcVideoFacts, isFhcInput, type FhcVideoInput } from "@/lib/quote-video/fhc";
import { getCustomer, listCustomers } from "@/lib/fhc/customers";
import { MONTHLY_FACTOR_FIRST } from "@/calc/pension/engine";
import { checkedPension } from "@/lib/quote-video/pension";
import { GAP_WORD } from "@/lib/fhc/gaps";

/** วิดีโอนำเสนอ (owner, 2026-10-11): every agent's — two free clips each, then the Studio wallet. */

/** the paying terms each product's clip offers, as its page names them */
const TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }, { variant: "WLF99H", years: 99 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const SUM_STEP = 50_000;
const NAMES: Record<Product, string> = { LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", PENSION: "บำนาญ 95" };

export interface Preview {
  lead: { label: string; amount: string }; mark: string; prices: { label: string; amount: string; main: boolean }[];
  /** what the form asked for settled into: the sum, or iHealthy's plan (a budget works these out); บำนาญ 95's monthly pension too */
  resolved: { sum?: number; plan?: string; monthly?: number };
}
export interface VideoItem {
  id: string;
  createdAt: string;
  title: string;
  status: VideoStatus;
  error: string | null;
  watch: string | null;
  save: string | null;
  /** the file's name when it is saved or shared */
  fileName: string;
  share: string | null;
  /** "ใช้สิทธิ์ฟรี", "หักจากกระเป๋า ฿1.90"; null for the owner's */
  paid: string | null;
  /** a clip with a customer's name stays off Pages */
  named: boolean;
  /** an FHC summary: one customer's money, never on a Page */
  personal: boolean;
  /** only a portrait clip goes on a Page (as a Reel) */
  size: VideoSize;
  /** failed because Gemini's voice was used up for the day */
  voiceFull: boolean;
  /** a clip still being made: how far, as read now (progress.ts); null once done or failed */
  progress: ProgressState | null;
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
  // from a budget: the form is checked with a stand-in sum, then the budget works out the real one
  const budget = v.budget ? cleanBudget(v.budget) : undefined;
  if (typeof budget === "string") return budget;
  const asked = budget && v.product !== "IHEALTHY" ? { ...v, sumAssured: 500_000 } : v;
  const checkedAsked = checkedQuote(asked);
  if (typeof checkedAsked === "string") return checkedAsked;
  const worked = budget ? resolveBudget(checkedAsked, budget) : checkedAsked;
  if (typeof worked === "string") return worked;
  const c = worked;
  // an ElevenLabs voice sets the endings itself: a man's voice says ครับ
  const eleven = elevenVoice(v.voice);
  const narrator = eleven ? eleven.sex : v.narrator === "M" ? "M" : "F";
  const style = v.style === "motion" ? "motion" : "classic";
  const length = v.length === "short" ? "short" : "full";
  // square and landscape are the Motion Graphic style's, the full clip's (owner, 2026-10-11)
  const size = style === "motion" && length === "full" ? sizeOf(v) : "portrait";
  return { ...c, narrator, ...(eleven ? { voice: eleven.id } : {}), style, length, size };
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
  if (v.product === "PENSION") return checkedPension(v);
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

export interface VoiceQuota { until: string; clock: string }

/**
 * Gemini's voice used up for the day (owner, 2026-10-12, mockup ข): when it comes back, or null.
 * A wrong answer here only hides the warning; the clip itself still fails with the reason.
 */
export async function voiceQuota(): Promise<VoiceQuota | null> {
  await requireMember();
  const until = await voiceFullUntil().catch((e) => {
    console.error("voice quota not read:", e instanceof Error ? e.message : "unknown error");
    return null;
  });
  return until ? { until: until.toISOString(), clock: bangkokClock(until) } : null;
}

/** a Gemini-voiced clip is not started while the voice is used up: it would only fail */
async function voiceRefusal(voice: string | undefined): Promise<string | null> {
  if (voice) return null;
  const q = await voiceQuota();
  return q ? voiceFullNotice(q.clock) : null;
}

/** an FHC summary is one customer's money: it never goes to a Page (owner, 2026-10-12) */
const FHC_PRIVATE = "วิดีโอสรุป FHC เป็นข้อมูลส่วนตัวของลูกค้า ลงเพจไม่ได้";

export interface FhcChoice {
  id: string;
  name: string;
  /** "ชาย 35 · 12 ต.ค." */
  line: string;
  /** "ชีวิต ไม่พอ · โรคร้ายแรง ขาด" — what is still open */
  open: string;
}

/** the agent's own FHC customers for the form's list; one more when the address named another the viewer may see (the owner) */
export async function fhcChoices(also?: string): Promise<FhcChoice[]> {
  const viewer = await requireMember();
  const own = await listCustomers(viewer, false);
  const rows: { id: string; name: string; sex: "M" | "F"; age: number; createdAt: string; gaps: { label?: string; key: string; state: "missing" | "short" | "ok" }[] }[] = [...own];
  if (also && !own.some((c) => c.id === also)) {
    const extra = await getCustomer(viewer, also, can(viewer, "owner")).catch(() => null);
    if (extra) rows.unshift(extra);
  }
  const AREA: Record<string, string> = { life: "ชีวิต", health: "สุขภาพ", ci: "โรคร้ายแรง", retire: "เกษียณ" };
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    line: `${SEX[c.sex]} ${c.age} · ${new Date(c.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })}`,
    open: c.gaps.filter((g) => g.state !== "ok").map((g) => `${AREA[g.key] ?? g.key} ${GAP_WORD[g.state]}`).join(" · ") || "ครบทุกด้าน",
  }));
}

/**
 * วิดีโอสรุป FHC (owner, 2026-10-12): one saved customer's check as a clip. The figures are copied
 * from the check as it was saved; the name goes in only when the agent leaves it ticked.
 */
export async function makeFhcVideo(customerId: string, withName: boolean, v: { narrator?: "F" | "M"; voice?: string; size?: VideoSize }): Promise<Made> {
  const viewer = await requireMember();
  if (typeof customerId !== "string") return { ok: false, error: "เลือกลูกค้า" };
  const c = await getCustomer(viewer, customerId, can(viewer, "owner")).catch(() => null);
  if (!c) return { ok: false, error: "ไม่พบลูกค้าคนนี้ในรายชื่อ FHC ของคุณ" };
  const eleven = elevenVoice(v?.voice);
  if (eleven && !can(viewer, "owner")) return { ok: false, error: "เสียง ElevenLabs ยังเปิดให้เฉพาะเจ้าของ" };
  const contact = await getContact(viewer.agentId);
  if (!viewer.name.trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอ" };
  }
  const full = await voiceRefusal(eleven?.id);
  if (full) return { ok: false, error: full };
  const input: FhcVideoInput = {
    product: "FHC", customerId: c.id, age: c.age, sex: c.sex,
    narrator: eleven ? eleven.sex : v?.narrator === "M" ? "M" : "F", ...(eleven ? { voice: eleven.id } : {}),
    style: "motion", length: "full", size: sizeOf(v ?? {}), fhc: fhcVideoFacts(c),
  };
  try {
    const made = await createVideo(viewer, input, withName === true ? cleanCustomerName(c.name) : "");
    if ("refusal" in made) return { ok: false, error: made.refusal };
    const { id } = made;
    after(() => asWho(viewer.agentId, () => produce(id, viewer.name.trim())));
    return { ok: true, id };
  } catch (e) {
    console.error("fhc video not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/** a Page's calendar posts Reels, and a Reel is portrait (owner, 2026-10-11) */
const NOT_PORTRAIT = "ลงปฏิทินเพจได้เฉพาะคลิปแนวตั้ง";
const SIZE_WORD: Record<VideoSize, string> = { portrait: "", square: " · จัตุรัส", landscape: " · แนวนอน" };

const NOT_PRICED = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุ ทุน หรือแผน";

export async function previewQuote(v: VideoInput): Promise<Preview | { error: string }> {
  await requireMember();
  const c = checked(v);
  if (typeof c === "string") return { error: c };
  const f = quoteVideoFacts(c);
  if (!f) return { error: NOT_PRICED };
  return {
    lead: { label: f.lead.label, amount: f.lead.amount }, mark: f.leadMark, prices: f.prices,
    resolved: c.product === "IHEALTHY" ? { plan: c.plan }
      : c.product === "PENSION" ? { sum: c.sumAssured, monthly: f.lead.baht } : { sum: c.sumAssured },
  };
}

export async function makeVideo(v: VideoInput, customer: string): Promise<Made> {
  const viewer = await requireMember();
  const c = checked(v);
  if (typeof c === "string") return { ok: false, error: c };
  if (!quoteVideoFacts(c)) return { ok: false, error: NOT_PRICED };
  // ElevenLabs is the owner's alone for now (owner, 2026-10-11)
  if (c.voice && !can(viewer, "owner")) return { ok: false, error: "เสียง ElevenLabs ยังเปิดให้เฉพาะเจ้าของ" };
  const contact = await getContact(viewer.agentId);
  if (!viewer.name.trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอ" };
  }
  const full = await voiceRefusal(c.voice);
  if (full) return { ok: false, error: full };
  try {
    const made = await createVideo(viewer, c, c.length === "short" ? "" : cleanCustomerName(customer));
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

/** deletes one of the asker's own clips */
export async function removeVideo(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "ไม่พบวิดีโอนี้" };
  try {
    const r = await deleteVideo(viewer.agentId, id);
    if (r === "busy") return { ok: false, error: "วิดีโอนี้กำลังสร้างอยู่ รอให้เสร็จก่อนจึงลบได้" };
    if (r === "missing") return { ok: false, error: "ไม่พบวิดีโอนี้" };
    return { ok: true };
  } catch (e) {
    console.error("quote video not deleted:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/**
 * A finished clip onto a Page's posting calendar (owner, 2026-10-11): the owner's alone, and only
 * a clip without a customer's name — the name would go up on a public Page.
 */
export async function calendarCaption(id: string): Promise<{ ok: true; caption: string } | { ok: false; error: string }> {
  const viewer = await requireStaff("owner");
  const row = await videoOf(viewer.agentId, id).catch(() => null);
  if (!row || row.status !== "done") return { ok: false, error: "ไม่พบวิดีโอนี้" };
  if (row.customer_name) return { ok: false, error: NAMED };
  if (isFhcInput(row.input)) return { ok: false, error: FHC_PRIVATE };
  if (clipSize(row.input) !== "portrait") return { ok: false, error: NOT_PORTRAIT };
  const f = quoteVideoFacts(row.input);
  return { ok: true, caption: f ? pageCaption(f) : "" };
}

export async function addToCalendar(id: string, pageId: string, caption: string): Promise<{ ok: true; pageId: string } | { ok: false; error: string }> {
  const viewer = await requireStaff("owner");
  const pages = await myPages().catch(() => []);
  if (!pages.some((p) => p.pageId === pageId)) return { ok: false, error: "เลือกเพจที่จะลง" };
  const row = await videoOf(viewer.agentId, id).catch(() => null);
  if (!row || row.status !== "done") return { ok: false, error: "ไม่พบวิดีโอนี้" };
  if (row.customer_name) return { ok: false, error: NAMED };
  if (isFhcInput(row.input)) return { ok: false, error: FHC_PRIVATE };
  if (clipSize(row.input) !== "portrait") return { ok: false, error: NOT_PORTRAIT };
  try {
    await sendToCalendar(row, pageId, typeof caption === "string" ? caption : "");
    return { ok: true, pageId };
  } catch (e) {
    console.error("quote video not put on the calendar:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เพิ่มลงปฏิทินไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

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
  const making = (v: VideoRow) => v.status === "drawing" || v.status === "rendering";
  const est = list.some(making) ? await clipEstimates().catch(() => DEFAULT_ESTIMATES) : DEFAULT_ESTIMATES;
  const now = Date.now();
  // how far a clip being made is: the board runs the bar on from here between its reads
  const progressOf = (v: VideoRow): ProgressState | null => {
    if (v.status !== "drawing" && v.status !== "rendering") return null;
    const started = v.status === "rendering" ? Date.parse(v.job?.startedAt ?? "") : NaN;
    return {
      status: v.status, note: readNote(v.progress),
      sinceStart: Math.max(0, (now - Date.parse(v.created_at)) / 1000),
      sinceRender: Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : null,
      est: est[clipKind(v.input as { fhc?: unknown; style?: unknown; length?: unknown })],
    };
  };
  return Promise.all(list.map(async (v) => {
    const done = v.status === "done" && v.video_path;
    const links = async (file: string) => ({
      watch: done ? await videoLink(v.video_path!, 3600) : null,
      save: done ? await videoLink(v.video_path!, 3600, file) : null,
      // a link that can go to a customer: a week
      share: done ? await videoLink(v.video_path!, 7 * 24 * 3600) : null,
    });
    if (isFhcInput(v.input)) {
      const input = v.input;
      const file = `สรุปFHC-${v.customer_name || `${SEX[input.sex]}${input.age}`}.mp4`;
      const who = `สรุป FHC${SIZE_WORD[clipSize(input)]} · ${SEX[input.sex]} ${input.age}${input.voice ? ` · เสียง ${elevenVoice(input.voice)?.name ?? "ElevenLabs"}` : ""}`;
      return {
        id: v.id, named: true, personal: true, size: clipSize(input), createdAt: v.created_at,
        title: v.customer_name ? `คุณ${v.customer_name} · ${who}` : who,
        status: v.status, error: v.error, voiceFull: isVoiceFull(v), progress: progressOf(v), fileName: file, ...(await links(file)), paid: paidLine(v),
      };
    }
    const input = v.input;
    const product = productOf(input);
    const what = input.product === "IHEALTHY"
      ? planWord(input.plan)
      : input.product === "PENSION"
        ? `เดือนละ ${Math.round(input.sumAssured * MONTHLY_FACTOR_FIRST).toLocaleString("en-US")} · รับ ${input.annuityAge} · ${input.pay === "6" ? "จ่าย 6 ปี" : "จ่ายจนรับ"}`
        : `${sumWords(input.sumAssured)} · ${TERMS[product as "LIFEPROTECT" | "ISHIELD"].find((x) => x.variant === input.variant)?.years ?? "?"} ปี`.replace("99 ปี", "ถึงอายุ 99");
    const who = `${NAMES[product]}${input.style === "motion" ? " (Motion)" : ""}${SIZE_WORD[clipSize(input)]}${input.length === "short" ? " (สั้น 15 วิ)" : ""}${input.voice ? ` · เสียง ${elevenVoice(input.voice)?.name ?? "ElevenLabs"}` : ""} · ${SEX[input.sex]} ${input.age} · ${what}`;
    const file = `${NAMES[product].replace(/\s+/g, "")}-${v.customer_name || `${SEX[input.sex]}${input.age}`}.mp4`;
    return {
      id: v.id,
      named: Boolean(v.customer_name),
      createdAt: v.created_at,
      title: v.customer_name ? `คุณ${v.customer_name} · ${who}` : who,
      status: v.status,
      error: v.error,
      voiceFull: isVoiceFull(v),
      progress: progressOf(v),
      personal: false,
      size: clipSize(input),
      fileName: file,
      ...(await links(file)),
      paid: paidLine(v),
    };
  }));
}

const isVoiceFull = (v: VideoRow) => v.status === "failed" && Boolean(v.error?.startsWith(VOICE_FULL));

function paidLine(v: VideoRow): string | null {
  return v.paid_by === "free"
    ? (v.status === "failed" ? "คืนสิทธิ์ฟรีแล้ว" : "ใช้สิทธิ์ฟรี")
    : v.paid_by === "wallet"
      ? (v.status === "failed" ? "คืนเงินแล้ว" : v.charged_satang !== null ? `หักจากกระเป๋า ${formatBaht(Number(v.charged_satang))}` : "กันเงินไว้ระหว่างทำ")
      : null;
}
