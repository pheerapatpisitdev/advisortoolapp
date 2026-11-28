"use server";
import { limiter } from "@/lib/assistant/rate-limit";
import { asWho } from "@/lib/ai/who";
import { runLater } from "@/lib/later";
import { requireMember } from "@/lib/auth/viewer";
import { closedFor } from "@/lib/switches/store";
import { clipProduce } from "@/lib/quote-video/jobs";
import { getContact } from "@/lib/quote-video/contact";
import { voiceRefusal } from "@/lib/quote-video/voice-check";
import { createVideo, pressId, videoPrice } from "@/lib/quote-video/make";
import { walletPrices } from "@/lib/wallet/store";
import { checked, payAndPen } from "@/lib/quote-video/check-input";
import { fallbackLines, lineProblem, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import { quoteVideoFacts, type QuoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { adInputOk, allowedNote, bodiesFor, cleanAdPlan, ctasFor, fixedBody, fixedCta, nextYear } from "@/lib/ad-video/plan";
import { readArt, type AdArt, type AdBodyKey, type AdCtaKey, type AdHookKind, type AdPlan } from "@/lib/ad-video/keys";
import { rewriteAdPart, writeAdPlan, type AdPart } from "@/lib/ad-video/writer";
import { adTheme } from "@/lib/ad-video/make";
import { myVideos, type VideoItem } from "@/app/studio/quote-video/actions";

/**
 * วิดีโอโฆษณา (owner chose ก ×6 on the mockup, 2026-11-22): an AI-written ad told as a 15-second portrait Motion
 * quote clip. The quote is checked as วิดีโอนำเสนอ checks it (check-input.ts), then held to the ad's plain shape on
 * the server whatever the form sent; the plan is cleaned here before it is shown, rewritten or stored.
 */

const NOT_AD = "ยังไม่รองรับแบบนี้";
const BUSY = "ลองใหม่อีกครั้งในอีกสักครู่";
const NOT_PRICED = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุ ทุน หรือแผน";
const OWN_HOOK = "ประโยคที่เขียนเองแก้ในช่องได้เลย";
const NO_PLAN = "ให้ AI เขียนบทก่อนสร้างวิดีโอ";
const REPLACED = "มีบางประโยคใช้ไม่ได้ ระบบแก้ให้แล้ว ตรวจอีกครั้งแล้วกดสร้าง";
/** what the form says of a part the checker replaced with the standard line */
const STANDARD = "ใช้ประโยคมาตรฐานแทน";
/** the agent's own opening is a spoken line: the checker's 150, cut on the server before any prompt (R13) */
const OWN_MAX = 150;
const BODY_KEYS: AdBodyKey[] = ["price", "cover", "value", "versus"];
const CTA_KEYS: AdCtaKey[] = ["chat", "line", "comment", "nextyear", "meet"];

/**
 * Drafts and redrafts are model calls the owner pays for: sixty an hour between them, per agent, as ดูสคริปต์'s
 * (quote-video previewScript, owner 2026-10-18)
 */
const draftsPerHour = limiter(60, 60 * 60_000);

/**
 * `fixed`, `reasons` and `plan` come with a refusal when the checker replaced part of the plan: the form shows the
 * cleaned plan and the agent presses สร้าง again (R14)
 */
export type AdMade = { ok: true; id: string }
  | { ok: false; error: string; needContact?: boolean; duplicate?: true; fixed?: string[]; reasons?: Record<string, string>; plan?: AdPlan };
export interface AdDraft {
  plan: AdPlan;
  /** the quote in one line, as the form shows it above the plan */
  facts: { line: string };
  /** the closings and scenes this quote can carry, so the form offers only those */
  ctas: AdCtaKey[];
  bodies: AdBodyKey[];
  /** the parts that took the standard line, and why (an own opening the checker turned down, say) */
  fixed?: string[];
  reasons?: Record<string, string>;
}
export interface AdDraftOpts {
  mode?: "ai" | "pick";
  art?: AdArt;
  brief?: string;
  hook?: AdHookKind;
  body?: AdBodyKey[];
  cta?: AdCtaKey;
  ownHook?: string;
  /** another try turns the model toward another opening technique */
  seed?: number;
}

interface AdQuote { c: VideoInput; f: QuoteVideoFacts; next: ReturnType<typeof nextYear> }

/**
 * The quote an ad is told from: one of its three plans, plain (no riders, budget, compared plans or page setup),
 * checked as วิดีโอนำเสนอ checks it, and always the 15-second portrait Motion clip in ไวท์บอร์ด or แบบเดิม with no
 * brief, recipe, mascot or picture paths from the form (checkedQuote keeps only the quote's own fields).
 */
async function adQuote(v: VideoInput, agentId: string): Promise<AdQuote | string> {
  if (!v || typeof v !== "object" || !adInputOk(v)) return NOT_AD;
  const asked = {
    ...v, style: "motion", length: "short", size: "portrait", theme: adTheme(v.theme),
    brief: undefined, lines: undefined, recipe: undefined, budget: undefined, mascot: undefined, carry: undefined,
  } as VideoInput;
  const c = checked(asked, ...(await payAndPen(agentId)));
  if (typeof c === "string") return c;
  if (!adInputOk(c)) return NOT_AD;
  const f = quoteVideoFacts(c);
  if (!f) return NOT_PRICED;
  return { c, f, next: nextYear(c) };
}

const quoteLine = (f: QuoteVideoFacts): string =>
  [f.planLine, f.insuredWho, f.insuredLine, `${f.lead.label} ${f.lead.amount} บาท`, f.leadMark].filter(Boolean).join(" · ");

/**
 * The parts of a written plan that are the standard lines rather than what was asked for: an own opening the
 * checker turned down always (with the checker's reason), and the model's parts only when the rest was written —
 * a plan the model never wrote is all standard, which the form already says from `written`.
 */
function standIns(q: AdQuote, plan: AdPlan, ownHook?: string): { fixed?: string[]; reasons?: Record<string, string> } {
  const reasons: Record<string, string> = {};
  if (plan.hook.kind === "own") {
    if (ownHook !== undefined && plan.hook.voice !== ownHook) {
      reasons.hook = lineProblem(ownHook, q.f, OWN_MAX, allowedNote(q.f, q.next)) ?? STANDARD;
    }
  } else if (plan.written && plan.hook.voice === fallbackLines(q.f, { hook: plan.hook.kind }).hook) reasons.hook = STANDARD;
  if (plan.written) {
    plan.body.forEach((b, i) => { if (b.voice === fixedBody(q.f, b.key)) reasons[`body${i + 1}`] = STANDARD; });
    if (plan.cta.voice === fixedCta(plan.cta.key, q.next)) reasons.cta = STANDARD;
  }
  const fixed = Object.keys(reasons);
  return fixed.length ? { fixed, reasons } : {};
}

/**
 * ✦ ให้ AI เขียน: the whole plan written for this quote and held to it (writer.ts). In เลือกเอง the agent's picks
 * stand and the model writes the lines; an own opening is the agent's words, cut to 150 characters first.
 */
export async function draftAdPlan(v: VideoInput, opts: AdDraftOpts): Promise<AdDraft | { error: string }> {
  const viewer = await requireMember();
  const closed = await closedFor(viewer, "ad-video");
  if (closed) return { error: closed };
  const q = await adQuote(v, viewer.agentId);
  if (typeof q === "string") return { error: q };
  if (!draftsPerHour(`ad:${viewer.agentId}`)) return { error: BUSY };
  const o: AdDraftOpts = opts && typeof opts === "object" ? opts : {};
  const hook = o.hook === "own" || (WRITTEN_HOOKS as string[]).includes(o.hook as string) ? o.hook : undefined;
  // an own opening left empty is still the agent's to fill: the form is told it was replaced, and why
  const ownHook = hook !== "own" ? undefined : typeof o.ownHook === "string" ? o.ownHook.replace(/\s+/g, " ").trim().slice(0, OWN_MAX) : "";
  const plan = await asWho(viewer.agentId, () => writeAdPlan(q.f, {
    art: readArt(o.art),
    mode: o.mode === "pick" ? "pick" : "ai",
    next: q.next,
    ...(typeof o.brief === "string" ? { brief: o.brief } : {}),
    ...(hook ? { hook } : {}),
    ...(Array.isArray(o.body) ? { body: o.body.filter((k) => BODY_KEYS.includes(k)) } : {}),
    ...(CTA_KEYS.includes(o.cta as AdCtaKey) ? { cta: o.cta } : {}),
    ...(ownHook !== undefined ? { ownHook } : {}),
    ...(Number.isInteger(o.seed) ? { seed: o.seed } : {}),
  }));
  return { plan, facts: { line: quoteLine(q.f) }, ctas: ctasFor(q.next), bodies: bodiesFor(q.f), ...standIns(q, plan, ownHook) };
}

/**
 * "เปลี่ยน" on one part: written anew with the rest as context. The plan as sent is cleaned first, so what comes
 * back holds to the quote whatever the form held; `kept` when the model could not do better and the part stands.
 */
export async function redraftAdPart(v: VideoInput, plan: AdPlan, part: AdPart): Promise<{ plan: AdPlan; kept?: true } | { error: string }> {
  const viewer = await requireMember();
  const closed = await closedFor(viewer, "ad-video");
  if (closed) return { error: closed };
  if (typeof part !== "string" || !/^(hook|cta|body[1-3])$/.test(part)) return { error: "เลือกท่อนที่จะเปลี่ยน" };
  if (!plan || typeof plan !== "object") return { error: NO_PLAN };
  const q = await adQuote(v, viewer.agentId);
  if (typeof q === "string") return { error: q };
  const clean = cleanAdPlan(plan, q.f, q.next).plan;
  if (part.startsWith("body") && Number(part.slice(4)) > clean.body.length) return { error: "เลือกท่อนที่จะเปลี่ยน" };
  // the agent's own words are not rewritten by AI: they edit them in the box (R13, 2026-11-22)
  if (part === "hook" && clean.hook.kind === "own") return { error: OWN_HOOK };
  if (!draftsPerHour(`ad:${viewer.agentId}`)) return { error: BUSY };
  const out = await asWho(viewer.agentId, () => rewriteAdPart(q.f, clean, part, q.next));
  return out === clean ? { plan: clean, kept: true } : { plan: out };
}

/** what the clip will cost as the form stands: the Motion clip, an ElevenLabs voice, and each photo its art draws */
export async function previewAd(v: VideoInput, art: AdArt, bodies: number): Promise<{ line: string; satang: number; bodies: AdBodyKey[]; ctas: AdCtaKey[] } | { error: string }> {
  const viewer = await requireMember();
  const closed = await closedFor(viewer, "ad-video");
  if (closed) return { error: closed };
  const q = await adQuote(v, viewer.agentId);
  if (typeof q === "string") return { error: q };
  const count = Number.isInteger(bodies) ? Math.min(3, Math.max(1, bodies)) : 2;
  // the price reads only the art, the number of scenes and the voice (ad-video/make.ts adPrice)
  const ad: AdPlan = {
    mode: "ai", hook: { kind: "question", voice: "", headline: [] },
    body: Array.from({ length: count }, () => ({ key: "price" as const, voice: "" })),
    cta: { key: "chat", voice: "" }, photos: {}, art: readArt(art), written: false,
  };
  try {
    const satang = videoPrice({ ...q.c, ad }, await walletPrices());
    return { line: quoteLine(q.f), satang, bodies: bodiesFor(q.f), ctas: ctasFor(q.next) };
  } catch (e) {
    console.error("ad video price not read:", e instanceof Error ? e.message : "unknown error");
    return { error: "อ่านราคาไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/**
 * สร้างวิดีโอ: gated as วิดีโอนำเสนอ's makeVideo (member, switch, contact, voice). The clip stores only the plan as
 * cleaned here, never the object the form sent (R13); when the checker replaced any part (a figure the quote has
 * not got, a photo idea in Thai) nothing is made and the cleaned plan goes back to the form to be seen (R14).
 */
export async function makeAdVideo(v: VideoInput, plan: AdPlan, press?: string, dupOk?: boolean): Promise<AdMade> {
  const viewer = await requireMember();
  const closed = await closedFor(viewer, "ad-video");
  if (closed) return { ok: false, error: closed };
  const q = await adQuote(v, viewer.agentId);
  if (typeof q === "string") return { ok: false, error: q };
  if (!plan || typeof plan !== "object") return { ok: false, error: NO_PLAN };
  const contact = await getContact(viewer.agentId);
  if (!(contact.name || viewer.name).trim() || !contact.phone) {
    return { ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน ลูกค้าจะเห็นตอนท้ายวิดีโอนะครับ" };
  }
  // an ad is always Thai
  const full = await voiceRefusal(q.c.voice, true);
  if (full) return { ok: false, error: full };
  const { plan: ad, fixed, reasons } = cleanAdPlan(plan, q.f, q.next);
  // a paid clip never speaks a line the agent did not see (R14, 2026-11-22): any part replaced — photos too — is
  // shown back first, and nothing is made or held. The cleaned plan passes the checker as it is, so sent again it is made
  if (fixed.length) return { ok: false, error: REPLACED, fixed, reasons, plan: ad };
  try {
    // no customer's name: an ad goes to a Page or to anyone
    const made = await createVideo(viewer, { ...q.c, ad }, "", pressId(press), { dupOk: dupOk === true });
    if ("refusal" in made) return { ok: false, error: made.refusal, ...(made.duplicate ? { duplicate: true as const } : {}) };
    const { id } = made;
    if (!made.again) runLater(clipProduce, { id, agentName: viewer.name.trim() }, { agentId: viewer.agentId });
    return { ok: true, id };
  } catch (e) {
    console.error("ad video not started:", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "เริ่มทำวิดีโอไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** the agent's ad clips, as วิดีโอนำเสนอ lists its own (myVideos, board "ad"); who is calling is asked first, as every action asks */
export async function myAdVideos(size?: number): Promise<VideoItem[]> {
  await requireMember();
  return myVideos("ad", size);
}
