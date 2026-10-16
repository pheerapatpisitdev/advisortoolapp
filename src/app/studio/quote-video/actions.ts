"use server";
import { after } from "next/server";
import { asWho } from "@/lib/ai/who";
import { myPages } from "@/lib/auth/pages";
import { can } from "@/lib/auth/access";
import { requireMember, requireStaff } from "@/lib/auth/viewer";
import { elevenVoice, type ElevenChoice } from "@/lib/voice/elevenlabs";
import { cleanBudget, resolveBudget } from "@/lib/quote-video/budget";
import { NAMED, sendToCalendar } from "@/lib/quote-video/calendar";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { cleanSetup, setupQuery } from "@/lib/quote-video/ihealthy-setup";
import { iShieldTable } from "@/lib/ishield-table";
import { getContact } from "@/lib/quote-video/contact";
import { ADMIN_VOICE, voiceAsked, voiceRefusal } from "@/lib/quote-video/voice-check";
import { fallbackReader, geminiUsable } from "@/lib/quote-video/speak";
import { promptStoryCaption } from "@/lib/prompt-story/caption";
import { isPromptStory, promptPicturePrice } from "@/lib/prompt-story/types";
import { priceBaht } from "@/lib/wallet/prices";
import { walletPrices } from "@/lib/wallet/store";
import { boardOf, type Board } from "@/lib/quote-video/board";
import { paidLine } from "@/lib/quote-video/paid-line";
import { clipEstimates, clipSize, langOfInput, costView, createVideo, deleteVideo, listVideos, produce, savePost, videoLink, videoOf, voiceFullUntil, type CostView, type VideoRow, type VideoStatus } from "@/lib/quote-video/make";
import { clipKind, DEFAULT_ESTIMATES, readNote, type ProgressState } from "@/lib/quote-video/progress";
import { bangkokClock, VOICE_FULL } from "@/lib/quote-video/voice-quota";
import { sizeOf, type VideoSize } from "@/lib/quote-video/timeline";
import { cleanCustomerName, pageCaption, productOf, quoteVideoFacts, type Product, type VideoInput } from "@/lib/quote-video/script";
import { fhcVideoFacts, isFhcInput, type FhcVideoInput } from "@/lib/quote-video/fhc";
import { checkedStory, isStoryInput, planName, STORY_TOPICS, storyCaption, storyFigure, storyPension, type StoryVideoInput } from "@/lib/quote-video/story";
import { getCustomer, listCustomers } from "@/lib/fhc/customers";
import { MONTHLY_FACTOR_FIRST } from "@/calc/pension/engine";
import { checkedPension } from "@/lib/quote-video/pension";
import { checkedLegacy } from "@/lib/quote-video/legacy";
import { checkedPlb } from "@/lib/quote-video/plb";
import { GAP_WORD } from "@/lib/fhc/gaps";
import { cleanBrief, storiesFor, writes, writtenProblems, type WrittenLines } from "@/lib/quote-video/brief";
import { readVideoLang } from "@/lib/quote-video/video-words";
import { LANG_NAME } from "@/lib/ihealthy-lang";
import { readLength } from "@/lib/quote-video/told";
import { writeLines } from "@/lib/quote-video/writer";
import { quoteVideoScript, type SceneScript } from "@/lib/quote-video/script";
import { linesBasis, quoteBasis, readPostText, writePost, type PostBasis, type PostText } from "@/lib/quote-video/post-text";
import { POST_TRIES, readTone, readVoice } from "@/lib/quote-video/post-tones";

/** วิดีโอนำเสนอ (owner, 2026-10-11): every agent's — two free clips each, then the Studio wallet. */

/** the paying terms each product's clip offers, as its page names them */
const TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }, { variant: "WLF99H", years: 99 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const SUM_STEP = 50_000;
const NAMES: Record<Product, string> = { LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", PENSION: "บำนาญ 95", LEGACY: "มรดก", PLB: "Protection Life" };

export interface Preview {
  lead: { label: string; amount: string }; mark: string; prices: { label: string; amount: string; main: boolean }[];
  /** the stories this quote backs, for โจทย์การเล่า (brief.ts storiesFor) */
  stories: { key: string; name: string }[];
  /** what the form asked for settled into: the sum, or iHealthy's plan (a budget works these out); บำนาญ 95's monthly pension too; มรดก's tier */
  resolved: { sum?: number; plan?: string; monthly?: number; tier?: number };
  /** iHealthy from its page (owner, 2026-10-14): the page's arrangement the clip is priced on */
  setup?: { line: string; riders: string };
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
  /** longer than a Reel may be (90 s): it goes to the customer, not to a Page */
  overReel?: boolean;
  /** a clip still being made: how far, as read now (progress.ts); null once done or failed */
  progress?: ProgressState | null;
  /** the words the AI wrote to go with it, and the writes left (post-text.ts) */
  post?: ClipPost | null;
  /** a finished คลิปตามโจทย์: its scenes, and what a picture drawn again costs ("1"; null for the owner) */
  redraw?: { scenes: number; price: string | null };
}
export interface ClipPost { text: string; tone: PostText["tone"]; voice: PostText["voice"]; kind: PostText["kind"]; left: number }
const clipPost = (raw: unknown): ClipPost | null => {
  const p = readPostText(raw);
  return p ? { text: p.text, tone: p.tone, voice: p.voice, kind: p.kind, left: Math.max(0, POST_TRIES - p.tries) } : null;
};
export type Made = { ok: true; id: string } | { ok: false; error: string; needContact?: boolean };

function sumLimits(product: "LIFEPROTECT" | "ISHIELD") {
  if (product === "ISHIELD") {
    const t = iShieldTable();
    return { min: t.saMin, max: t.saMax };
  }
  return { min: 500_000, max: 50_000_000 };
}

/**
 * The voice a clip asked for: one of the listed ElevenLabs voices, or the agent's own cloned one
 * (เสียงของฉัน, owner 2026-10-15) — never another agent's: an id is the agent's only when their
 * approved voice has it.
 */
/** how a clip's voice reads in the list of clips */
const voiceLabel = (id: string) => (elevenVoice(id) ? `เสียง ${elevenVoice(id)!.name}` : "เสียงของฉัน");
/** " · เสียง X" for the voice a clip asked for; " · เสียง อ้อม (ElevenLabs แทน Gemini)" when it was switched (make.ts speakClip) */
const voiceWord = (input: { voice?: string }) => {
  if (input.voice) return ` · ${voiceLabel(input.voice)}`;
  const fell = (input as { voiceFallback?: unknown }).voiceFallback;
  return typeof fell === "string" ? ` · เสียง ${fell} (ElevenLabs แทน Gemini)` : "";
};

/** What was sent, made into an input the engine is asked about — or the words for what is wrong. */
function checked(v: VideoInput, mine?: ElevenChoice): VideoInput | string {
  // from a budget: the form is checked with a stand-in sum, then the budget works out the real one
  const budget = v.budget ? cleanBudget(v.budget) : undefined;
  if (typeof budget === "string") return budget;
  const asked = !budget || v.product === "IHEALTHY" ? v
    : v.product === "LEGACY" ? { ...v, tier: 1 }
    // Protection Life's stand-in must be one of its page's steps
    : v.product === "PLB" ? { ...v, sumAssured: 300_000 } : { ...v, sumAssured: 500_000 };
  const checkedAsked = checkedQuote(asked);
  if (typeof checkedAsked === "string") return checkedAsked;
  const worked = budget ? resolveBudget(checkedAsked, budget) : checkedAsked;
  if (typeof worked === "string") return worked;
  const c = worked;
  // another language (owner, 2026-10-15): Gemini's narrator, fixed lines, the 15-second clip or the whole one
  const foreign = c.product === "IHEALTHY" && readVideoLang(c.lang) !== "th";
  // an ElevenLabs voice sets the endings itself: a man's voice says ครับ
  const eleven = foreign ? undefined : elevenVoice(v.voice) ?? (mine && mine.id === v.voice ? mine : undefined);
  const narrator = eleven ? eleven.sex : v.narrator === "M" ? "M" : "F";
  const style = v.style === "motion" ? "motion" : "classic";
  const askedLength = readLength(v.length);
  const length = foreign && askedLength !== "short" ? "full" : askedLength;
  // every clip in every shape (owner, 2026-10-13)
  const size = sizeOf(v);
  // โจทย์การเล่า: the brief, and the lines the agent saw (and may have edited) — checked again here
  const facts = quoteVideoFacts(c);
  const brief = facts && !foreign ? cleanBrief(v.brief, facts) : undefined;
  let lines: WrittenLines | undefined;
  if (facts && writes(brief) && v.lines) {
    const l = cleanLines(v.lines);
    const bad = writtenProblems(l, facts, { loop: Boolean(brief.loop), story: length === "long" || length === "max", note: brief.note });
    const first = Object.entries(bad)[0];
    if (first) return `${FIELD_WORD[first[0]] ?? "ประโยค"}: ${first[1]}`;
    lines = l;
  }
  return { ...c, narrator, ...(eleven ? { voice: eleven.id } : {}), style, length, size, ...(brief ? { brief } : {}), ...(lines ? { lines } : {}) };
}

/** what each written field is called on the board, for a refusal */
const FIELD_WORD: Record<string, string> = { hook: "ประโยคเปิด", headline: "พาดหัว", close: "ประโยคปิด", loopClose: "ประโยควนลูป", story: "เรื่องของลูกค้า", points: "ข้อความบนจอ" };

/** lines as the board sent them back, each a string or a list of strings */
function cleanLines(raw: WrittenLines): WrittenLines {
  const t = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const list = (v: unknown) => (Array.isArray(v) ? v.map(t).filter(Boolean).slice(0, 3) : []);
  const kinds = ["question", "shock", "myth", "story", "list"] as const;
  return {
    kind: kinds.includes(raw?.kind as (typeof kinds)[number]) ? raw.kind : "question",
    hook: t(raw?.hook), headline: list(raw?.headline),
    ...(raw?.close ? { close: t(raw.close) } : {}), ...(raw?.loopClose ? { loopClose: t(raw.loopClose) } : {}),
    ...(raw?.story ? { story: t(raw.story) } : {}), ...(raw?.points ? { points: list(raw.points) } : {}),
  };
}

export interface ScriptPreview {
  lines?: WrittenLines;
  /** every line the clip will speak, as the narrator says it */
  script: SceneScript[];
  /** whether a model wrote the lines (false: the fixed ones stood in) */
  written: boolean;
}

/**
 * ดูสคริปต์ (owner, 2026-10-13): the lines a brief is told with, written now, and the whole clip's
 * voice with them. Free; the board allows three more tries per clip. `seed` asks for another try.
 */
export async function previewScript(v: VideoInput, customer: string, seed = 0, rewrite = true): Promise<ScriptPreview | { error: string }> {
  const viewer = await requireMember();
  // lines sent back without a rewrite are the agent's own edits: checked, then spoken as they are
  const c = checked(rewrite ? { ...v, lines: undefined } : v, await voiceAsked(viewer.agentId, v?.voice));
  if (typeof c === "string") return { error: c };
  const f = quoteVideoFacts(c);
  if (!f) return { error: NOT_PRICED };
  const length = readLength(c.length);
  const name = length === "short" ? "" : cleanCustomerName(customer);
  if (!writes(c.brief)) return { script: quoteVideoScript(f, name, c.narrator, length, {}), written: false };
  const brief = c.brief;
  if (!rewrite && c.lines) return { lines: c.lines, script: quoteVideoScript(f, name, c.narrator, length, { brief, lines: c.lines }), written: true };
  const got = await asWho(viewer.agentId, () => writeLines(f, brief, length, Number.isInteger(seed) ? seed : 0));
  return { lines: got.lines, script: quoteVideoScript(f, name, c.narrator, length, { brief, lines: got.lines }), written: got.written };
}

function checkedQuote(v: VideoInput): VideoInput | string {
  if (v.sex !== "M" && v.sex !== "F") return "เลือกเพศ";
  if (!Number.isInteger(v.age) || v.age < 0 || v.age > 99) return "ใส่อายุให้ถูกต้อง";
  if (v.product === "IHEALTHY") {
    const codes = new Set(iHealthyTable().plans.map((p) => p.code));
    if (!codes.has(v.plan)) return "เลือกแผน";
    const compare = [...new Set((Array.isArray(v.compare) ? v.compare : []).filter((c) => codes.has(c) && c !== v.plan))].slice(0, 2);
    const setup = cleanSetup(v.setup);
    const lang = readVideoLang(v.lang);
    return { product: "IHEALTHY", sex: v.sex, age: v.age, plan: v.plan, compare, ...(setup ? { setup } : {}), ...(lang !== "th" ? { lang } : {}) };
  }
  if (v.product === "PENSION") return checkedPension(v);
  if (v.product === "LEGACY") return checkedLegacy(v);
  if (v.product === "PLB") return checkedPlb(v);
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

export interface VoiceQuota { until: string | null; clock: string | null; fallback: boolean }

/**
 * Gemini's voice cannot be used (owner, 2026-10-12, mockup ข; 2026-10-17: also when it is switched off):
 * when it comes back (null while it is off), and whether อ้อม / สมชาย are ready to read in its place.
 * Null when it works. A wrong answer here only hides the note; the clip itself still switches or fails.
 */
export async function voiceQuota(): Promise<VoiceQuota | null> {
  await requireMember();
  const [until, on] = await Promise.all([
    voiceFullUntil().catch((e) => {
      console.error("voice quota not read:", e instanceof Error ? e.message : "unknown error");
      return null;
    }),
    geminiUsable(),
  ]);
  if (on && !until) return null;
  const fallback = Boolean(await fallbackReader("F").catch(() => null));
  return { until: until ? until.toISOString() : null, clock: until ? bangkokClock(until) : null, fallback };
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
  const eleven = await voiceAsked(viewer.agentId, v?.voice);
  if (eleven?.adminOnly && !can(viewer, "owner")) return { ok: false, error: ADMIN_VOICE };
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

/** a premium for คลิปเล่าเรื่อง's jar scene, worked out as the form is filled (story.ts storyFigure) */
export async function previewStoryFigure(v: { plan?: string; variant?: string; sex?: string; age?: number; sumAssured?: number }): Promise<{ annual: number; monthly: number } | { error: string }> {
  await requireMember();
  const f = storyFigure(v ?? {});
  return typeof f === "string" ? { error: f } : { annual: f.annual, monthly: f.monthly };
}

/** บำนาญ 95's premium for คลิปเล่าเรื่อง's ใกล้เกษียณ, worked out as the form is filled (story.ts storyPension) */
export async function previewStoryPension(v: { sex?: string; age?: number; annuityAge?: number; pay?: string; monthly?: number }): Promise<{ annual: number; monthlyPension: number; annuityAge: number } | { error: string }> {
  await requireMember();
  const p = storyPension(v ?? {});
  return typeof p === "string" ? { error: p } : { annual: p.annual, monthlyPension: p.monthlyPension, annuityAge: p.annuityAge };
}

/**
 * คลิปเล่าเรื่อง (owner, 2026-10-15): a cartoon story clip. The premium it shows, if any, is
 * worked out again here from the plan's table, never taken from the form.
 */
export async function makeStoryVideo(v: Omit<Partial<StoryVideoInput>, "figure" | "ladder" | "pension" | "home"> & { figure?: unknown; ladder?: unknown; pension?: unknown; home?: unknown }, customer: string): Promise<Made> {
  const viewer = await requireMember();
  const eleven = await voiceAsked(viewer.agentId, v?.voice);
  if (eleven?.adminOnly && !can(viewer, "owner")) return { ok: false, error: ADMIN_VOICE };
  const input = checkedStory(v ?? {}, eleven ? eleven.sex : v?.narrator === "M" ? "M" : "F", eleven?.id);
  if (typeof input === "string") return { ok: false, error: input };
  const contact = await getContact(viewer.agentId);
  if (!viewer.name.trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอ" };
  }
  const full = await voiceRefusal(input.voice);
  if (full) return { ok: false, error: full };
  try {
    const made = await createVideo(viewer, input, cleanCustomerName(customer));
    if ("refusal" in made) return { ok: false, error: made.refusal };
    const { id } = made;
    after(() => asWho(viewer.agentId, () => produce(id, viewer.name.trim())));
    return { ok: true, id };
  } catch (e) {
    console.error("story video not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/** a Page's calendar posts Reels, and a Reel is portrait (owner, 2026-10-11) */
const NOT_PORTRAIT = "ลงปฏิทินเพจได้เฉพาะคลิปแนวตั้ง";
const LENGTH_WORD = { short: " (สั้น 15 วิ)", full: "", long: " (ยาว 90 วิ)", max: " (2 นาที)" } as const;
/** a Facebook Reel's longest (owner, 2026-10-13, plan §7): a 2-minute clip goes to the customer directly */
const REEL_MAX_SEC = 90;
const TOO_LONG = "คลิปยาวเกิน 90 วินาที ลงเพจเป็น Reels ไม่ได้ ส่งให้ลูกค้าโดยตรงได้";
const SIZE_WORD: Record<VideoSize, string> = { portrait: "", square: " · จัตุรัส", landscape: " · แนวนอน" };

const NOT_PRICED = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุ ทุน หรือแผน";

export async function previewQuote(v: VideoInput): Promise<Preview | { error: string }> {
  const viewer = await requireMember();
  const c = checked(v, await voiceAsked(viewer.agentId, v?.voice));
  if (typeof c === "string") return { error: c };
  const f = quoteVideoFacts(c);
  if (!f) return { error: NOT_PRICED };
  return {
    lead: { label: f.lead.label, amount: f.lead.amount }, mark: f.leadMark, prices: f.prices,
    stories: storiesFor(f).map((x) => ({ key: x.key, name: x.name })),
    resolved: c.product === "IHEALTHY" ? { plan: c.plan }
      : c.product === "PENSION" ? { sum: c.sumAssured, monthly: f.lead.baht }
      : c.product === "LEGACY" ? { tier: c.tier } : { sum: c.sumAssured },
    ...(c.product === "IHEALTHY" && c.setup ? { setup: setupWords(c) } : {}),
  };
}

/** the page's arrangement in the form's words: the base, sum and territory, then what is attached */
function setupWords(c: Extract<VideoInput, { product: "IHEALTHY" }>): { line: string; riders: string } {
  const card = iHealthyCard(setupQuery(c));
  const attached = card.lines.slice(2).map((l) => l.label);
  return { line: card.insuredLine, riders: attached.length ? attached.join(" · ") : "ไม่มี" };
}

export async function makeVideo(v: VideoInput, customer: string): Promise<Made> {
  const viewer = await requireMember();
  const c = checked(v, await voiceAsked(viewer.agentId, v?.voice));
  if (typeof c === "string") return { ok: false, error: c };
  if (!quoteVideoFacts(c)) return { ok: false, error: NOT_PRICED };
  // every member's since 2026-10-13, but the two cloned voices are the owner's
  if (elevenVoice(c.voice)?.adminOnly && !can(viewer, "owner")) return { ok: false, error: ADMIN_VOICE };
  const contact = await getContact(viewer.agentId);
  if (!viewer.name.trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอ" };
  }
  const full = await voiceRefusal(c.voice, langOfInput(c) === "th");
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
  // the words the agent's AI wrote for this clip, as they kept them (owner, 2026-10-15)
  const post = readPostText(row.post_text);
  if (post?.kind === "post") return { ok: true, caption: post.text };
  if (isStoryInput(row.input)) return { ok: true, caption: storyCaption(row.input) };
  if (isPromptStory(row.input)) return { ok: true, caption: promptStoryCaption(row.input) };
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
  if (Number(row.duration_sec ?? 0) > REEL_MAX_SEC) return { ok: false, error: TOO_LONG };
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

/**
 * The agent's clips for one board: วิดีโอนำเสนอ's quotes and FHC summaries, or คลิปเล่าเรื่อง's
 * stories (owner, 2026-10-15), or คลิปตามโจทย์'s — each board lists its own.
 */
export async function myVideos(board: Board = "quote"): Promise<VideoItem[]> {
  const viewer = await requireMember();
  const list = (await listVideos(viewer.agentId, 60)).filter((v) => boardOf(v.input) === board).slice(0, 30);
  const making = (v: VideoRow) => v.status === "drawing" || v.status === "rendering";
  const est = list.some(making) ? await clipEstimates().catch(() => DEFAULT_ESTIMATES) : DEFAULT_ESTIMATES;
  const now = Date.now();
  const owner = can(viewer, "owner");
  const prices = !owner && list.some((v) => v.status === "done" && isPromptStory(v.input)) ? await walletPrices().catch(() => null) : null;
  // how far a clip being made is: the board runs the bar on from here between its reads
  const progressOf = (v: VideoRow): ProgressState | null => {
    if (v.status !== "drawing" && v.status !== "rendering") return null;
    const started = v.status === "rendering" ? Date.parse(v.job?.startedAt ?? "") : NaN;
    return {
      status: v.status, note: readNote(v.progress),
      sinceStart: Math.max(0, (now - Date.parse(v.created_at)) / 1000),
      sinceRender: Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : null,
      est: est[clipKind(v.input as { fhc?: unknown; style?: unknown; length?: unknown; product?: unknown })],
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
      const who = `สรุป FHC${SIZE_WORD[clipSize(input)]} · ${SEX[input.sex]} ${input.age}${voiceWord(input)}`;
      return {
        id: v.id, named: true, personal: true, size: clipSize(input), createdAt: v.created_at,
        title: v.customer_name ? `คุณ${v.customer_name} · ${who}` : who,
        status: v.status, error: v.error, voiceFull: isVoiceFull(v), progress: progressOf(v), fileName: file, ...(await links(file)), paid: paidLine(v), post: clipPost(v.post_text),
      };
    }
    if (isStoryInput(v.input)) {
      const input = v.input;
      const topic = STORY_TOPICS.find((x) => x.key === input.topic)?.name ?? "คลิปเล่าเรื่อง";
      const fig = input.figure ? ` · ${planName(input.figure.plan)} ${SEX[input.figure.sex]} ${input.figure.age}` : "";
      const who = `${topic}${SIZE_WORD[clipSize(input)]}${fig}${voiceWord(input)}`;
      const file = `เล่าเรื่อง-${v.customer_name || topic.replace(/\s+/g, "")}.mp4`;
      return {
        id: v.id, named: Boolean(v.customer_name), personal: false, size: clipSize(input), createdAt: v.created_at,
        title: v.customer_name ? `คุณ${v.customer_name} · ${who}` : who,
        status: v.status, error: v.error, voiceFull: isVoiceFull(v), progress: progressOf(v),
        overReel: Number(v.duration_sec ?? 0) > REEL_MAX_SEC, fileName: file, ...(await links(file)), paid: paidLine(v), post: clipPost(v.post_text),
      };
    }
    if (isPromptStory(v.input)) {
      const input = v.input;
      const who = `${input.title}${SIZE_WORD[clipSize(input)]}${voiceWord(input)}`;
      const file = `ตามโจทย์-${v.customer_name || input.title.replace(/\s+/g, "")}.mp4`;
      return {
        id: v.id, named: Boolean(v.customer_name), personal: false, size: clipSize(input), createdAt: v.created_at,
        title: v.customer_name ? `คุณ${v.customer_name} · ${who}` : who,
        status: v.status, error: v.error, voiceFull: isVoiceFull(v), progress: progressOf(v),
        overReel: Number(v.duration_sec ?? 0) > REEL_MAX_SEC, fileName: file, ...(await links(file)), paid: paidLine(v), post: clipPost(v.post_text),
        ...(v.status === "done" && (owner || prices) ? { redraw: { scenes: input.scenes.length, price: owner || !prices ? null : priceBaht(promptPicturePrice(input, prices)) } } : {}),
      };
    }
    const input = v.input;
    const product = productOf(input);
    const what = input.product === "IHEALTHY"
      ? `${planWord(input.plan)}${input.lang && input.lang !== "th" ? ` · ${LANG_NAME[readVideoLang(input.lang)]}` : ""}`
      : input.product === "PENSION"
        ? `เดือนละ ${Math.round(input.sumAssured * MONTHLY_FACTOR_FIRST).toLocaleString("en-US")} · รับ ${input.annuityAge} · ${input.pay === "6" ? "จ่าย 6 ปี" : "จ่ายจนรับ"}`
        : input.product === "LEGACY"
        ? `มรดก ${input.tier} ล้าน`
        : input.product === "PLB"
        ? `${sumWords(input.sumAssured)} · ${input.variant.slice(3).replace(/^0/, "")} ปี`
        : `${sumWords(input.sumAssured)} · ${TERMS[product as "LIFEPROTECT" | "ISHIELD"].find((x) => x.variant === input.variant)?.years ?? "?"} ปี`.replace("99 ปี", "ถึงอายุ 99");
    const who = `${NAMES[product]}${input.style === "motion" ? " (Motion)" : ""}${SIZE_WORD[clipSize(input)]}${LENGTH_WORD[readLength(input.length)]}${input.brief?.loop ? " ↻" : ""}${voiceWord(input)} · ${SEX[input.sex]} ${input.age} · ${what}`;
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
      overReel: Number(v.duration_sec ?? 0) > REEL_MAX_SEC,
      personal: false,
      size: clipSize(input),
      fileName: file,
      ...(await links(file)),
      paid: paidLine(v),
      post: clipPost(v.post_text),
    };
  }));
}

/** What a clip's words are written from, or null when the clip cannot say. */
function postBasis(row: VideoRow): PostBasis | null {
  const input = row.input;
  if (isFhcInput(input)) {
    // one customer's money: the message says what the clip covers, and no figure of it
    return linesBasis("customer", "คลิปสรุปผลตรวจสุขภาพการเงิน (Financial Health Check) ของลูกค้าคนนี้", [
      "ในคลิปมี ผลตรวจ 6 ด้าน · ยังขาดเรื่องไหน · เหตุการณ์ที่อาจเกิดขึ้น · แผนที่แนะนำ · ช่องทางติดต่อ",
      "เป็นข้อมูลส่วนตัว ห้ามใส่ตัวเลขใดๆ ในข้อความ",
    ], row.customer_name || undefined, true);
  }
  if (isStoryInput(input)) {
    const topic = STORY_TOPICS.find((x) => x.key === input.topic)?.name ?? "คลิปเล่าเรื่อง";
    const facts = storyCaption(input).split("\n").map((l) => l.replace(/^\*/, "").trim()).filter((l) => l && !l.startsWith("#"));
    if (input.figure) {
      const f = input.figure;
      facts.push(`ตัวอย่างเบี้ย ${planName(f.plan)} ${SEX[f.sex]} อายุ ${f.age} ทุน ${f.sumAssured.toLocaleString("en-US")} บาท ปีละ ${f.annual.toLocaleString("en-US")} บาท (เดือนละ ${f.monthly.toLocaleString("en-US")} บาท)`);
    }
    if (input.ladder) facts.push(...input.ladder.rows.map((r) => `Life Protect ${SEX[input.ladder!.sex]} อายุ ${r.age} เบี้ยปีละ ${r.annual.toLocaleString("en-US")} บาท`));
    if (input.home?.kind === "spend") facts.push(`ค่าใช้จ่ายบ้านเดือนละ ${input.home.monthly.toLocaleString("en-US")} บาท ลูกยังต้องพึ่งอีก ${input.home.years} ปี`);
    if (input.home?.kind === "school") facts.push(`ลูกอายุ ${input.home.childAge} ค่าเรียนปีละ ${input.home.tuition.toLocaleString("en-US")} บาท`);
    if (input.due?.amount) facts.push(`เบี้ยที่ต้องชำระ ${input.due.amount.toLocaleString("en-US")} บาท`);
    return linesBasis(row.customer_name ? "customer" : "post", `คลิปเล่าเรื่อง "${topic}"`, facts, row.customer_name || undefined);
  }
  if (isPromptStory(input)) {
    return linesBasis(row.customer_name ? "customer" : "post", `คลิป "${input.title}"`, [input.brief, ...input.scenes.map((x) => x.voice)], row.customer_name || undefined);
  }
  const f = quoteVideoFacts(input);
  if (!f) return null;
  const lang = input.product === "IHEALTHY" && readVideoLang(input.lang) !== "th" ? LANG_NAME[readVideoLang(input.lang)] : undefined;
  return quoteBasis(f, row.customer_name, lang);
}

/**
 * ข้อความโพสต์ (owner, 2026-10-15, option ก): the AI writes the words to go up with a clip —
 * free, three writes a clip. A write that does not come back is not counted.
 */
export async function writePostText(id: string, tone: unknown, voice: unknown): Promise<{ ok: true; post: ClipPost } | { ok: false; error: string }> {
  const viewer = await requireMember();
  const row = await videoOf(viewer.agentId, id).catch(() => null);
  if (!row || row.status !== "done") return { ok: false, error: "ไม่พบวิดีโอนี้" };
  const was = readPostText(row.post_text);
  if (was && was.tries >= POST_TRIES) return { ok: false, error: `เขียนครบ ${POST_TRIES} ครั้งแล้ว แก้ข้อความเองได้ในช่องนี้` };
  const basis = postBasis(row);
  if (!basis) return { ok: false, error: NOT_PRICED };
  const t = readTone(tone);
  const v = readVoice(voice);
  const text = await asWho(viewer.agentId, () => writePost(basis, t, v));
  if (!text) return { ok: false, error: "AI เขียนไม่สำเร็จ ลองกดใหม่อีกครั้ง (ไม่นับครั้ง)" };
  const post: PostText = { text, tone: t, voice: v, kind: basis.kind, tries: (was?.tries ?? 0) + 1, writtenAt: new Date().toISOString() };
  try {
    await savePost(viewer.agentId, id, post);
  } catch (e) {
    console.error("clip post not kept:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เก็บข้อความไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true, post: clipPost(post)! };
}

/** the agent's own edit of the words, kept with the clip; the writes used stay as they were */
export async function keepPostText(id: string, text: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await requireMember();
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "ข้อความว่าง" };
  if (text.length > 2000) return { ok: false, error: "ข้อความยาวเกิน 2,000 ตัวอักษร" };
  const row = await videoOf(viewer.agentId, id).catch(() => null);
  const was = row ? readPostText(row.post_text) : null;
  if (!row || !was) return { ok: false, error: "ไม่พบข้อความของวิดีโอนี้" };
  try {
    await savePost(viewer.agentId, id, { ...was, text: text.trim() });
    return { ok: true };
  } catch (e) {
    console.error("clip post edit not kept:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เก็บข้อความไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

const isVoiceFull = (v: VideoRow) => v.status === "failed" && Boolean(v.error?.startsWith(VOICE_FULL));

