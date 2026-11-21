/**
 * วิดีโอโฆษณา: what an ad may say and how a written plan is held to it. Every figure is the quote's
 * (quoteVideoFacts), so an AI line that carries any other number is replaced by a fixed line built from the
 * same facts. Owner chose ก ×6 on the mockup, 2026-11-22.
 */
import { fallbackLines, HEADLINE_MAX, lineProblem, NOTE_MAX } from "@/lib/quote-video/brief";
import { quoteVideoFacts, quoteVideoScript, spokenBaht, type QuoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import {
  AD_PRODUCTS, readArt,
  type AdArt, type AdBodyKey, type AdCtaKey, type AdHookKind, type AdPlan, type AdProduct,
} from "./keys";


const HOOK_KINDS: AdHookKind[] = ["question", "shock", "myth", "story", "list", "own"];
const CTA_KEYS: AdCtaKey[] = ["chat", "line", "comment", "nextyear", "meet"];
const BODY_KEYS: AdBodyKey[] = ["price", "cover", "value", "versus"];
const VOICE_MAX = 150;
const MAX_BODIES = 3;

/** a clip the ad can carry: one of the three plans, Thai, plain (no riders, budget, compare or setup) */
export function adInputOk(v: VideoInput): boolean {
  const product = v.product ?? "LIFEPROTECT";
  if (!(AD_PRODUCTS as string[]).includes(product)) return false;
  if ("riders" in v && v.riders) return false;
  if (v.budget) return false;
  if (v.product === "IHEALTHY") {
    if (v.compare && v.compare.length) return false;
    if (v.setup || v.allPlans) return false;
    if (v.lang && v.lang !== "th") return false;
  }
  return true;
}

const num = (s: string | undefined): number => Number((s ?? "").replace(/[^\d.]/g, ""));

/**
 * The age+1 quote's price when it is higher than this one's, for the "รอปีหน้า" closing (owner, 2026-11-22).
 * `per` is "วันละ" when that quote has a daily figure, else its spoken instalment's word.
 */
export function nextYear(v: VideoInput, today: Date = new Date()): { said: string; per: string } | undefined {
  const here = quoteVideoFacts(v, today);
  const there = quoteVideoFacts({ ...v, age: v.age + 1 }, today);
  if (!here || !there) return undefined;
  if (there.perDayAmount) {
    const now = here.perDayAmount;
    return now && num(there.perDayAmount) > num(now) ? { said: there.perDayAmount, per: "วันละ" } : undefined;
  }
  if (here.spokenPrice.per !== there.spokenPrice.per) return undefined;
  return num(there.spokenPrice.amount) > num(here.spokenPrice.amount) ? { said: there.spokenPrice.amount, per: there.spokenPrice.per } : undefined;
}
type Next = ReturnType<typeof nextYear>;

/** the middle scenes this quote can carry: value needs a break-even, versus needs the total paid */
export function bodiesFor(f: QuoteVideoFacts): AdBodyKey[] {
  const out: AdBodyKey[] = ["price", "cover"];
  if (f.product === "LIFEPROTECT" && f.breakEven) out.push("value");
  if (f.product !== "IHEALTHY" && f.totalPaid) out.push("versus");
  return out;
}

export function ctasFor(next: Next): AdCtaKey[] {
  return CTA_KEYS.filter((k) => k !== "nextyear" || next);
}

/** the sentence the checker may let through besides the quote's own figures */
export const allowedNote = (next: Next): string => (next ? `อายุถัดไป ${next.per} ${next.said} บาท` : "");

/**
 * The quote video's own line for that scene when the checker lets it through; otherwise a compact ad line
 * built from the same facts (R10, 2026-11-22: the "max" script says เบี้ย for iShield's price and runs past
 * 150 characters on iShield's cover and Life Protect's value). Female endings, never เบี้ย.
 */
export function fixedBody(f: QuoteVideoFacts, key: AdBodyKey): string {
  const script = quoteVideoScript(f, "", "F", "max");
  const find = (k: string) => script.find((s) => s.key === k)?.voice;
  const own = find(key) ?? find("price");
  if (own && !lineProblem(own, f, VOICE_MAX, "")) return own;
  return compactBody(f, find(key) ? key : "price");
}

function compactBody(f: QuoteVideoFacts, key: AdBodyKey): string {
  const lead = spokenBaht(f.lead.baht);
  const shield = f.product === "ISHIELD";
  if (key === "cover") {
    if (shield) return `คุ้มครองโรคร้ายแรง ${f.illness?.total ?? 70} โรค รับเงินก้อนสูงสุด ${lead} ตั้งแต่ระยะเริ่มต้นค่ะ`;
    if (f.product === "IHEALTHY") return `เหมาจ่ายค่ารักษาสูงสุด ${lead} ต่อปีค่ะ`;
    return `ครอบครัวได้เงินก้อนสูงสุด ${lead} ดูแลยาวถึงอายุ ${f.coverToAge} ค่ะ`;
  }
  if (key === "value" && f.breakEven) {
    return `ออมครบตอนอายุ ${f.lastPayAge} พออายุ ${f.breakEven.age} ขอคืนได้ ${f.breakEven.cash} บาท มากกว่าที่ออมไปค่ะ`;
  }
  if (key === "versus" && f.totalPaid) {
    return `เก็บเงินเองได้ ${f.totalPaid} บาท แต่แผนนี้ ${shield ? "รับเงินก้อนสูงสุด" : "ครอบครัวได้ถึง"} ${lead} ค่ะ`;
  }
  if (f.product === "IHEALTHY") return `ปีแรก${f.spokenPrice.per} ${f.spokenPrice.amount} บาท ค่ะ`;
  const [per, amount] = f.perDayAmount ? ["วันละ", f.perDayAmount] : [f.spokenPrice.per, f.spokenPrice.amount];
  const years = f.payToEnd || !f.payYears ? `ออมถึงอายุ ${f.coverToAge}` : `ออมเพียง ${f.payYears} ปี`;
  return `ออมแค่${per} ${amount} บาท ${years} คุ้มครองถึงอายุ ${f.coverToAge} ค่ะ`;
}

export function fixedCta(key: AdCtaKey, next: Next): string {
  switch (key) {
    case "line": return "แอด LINE รับใบเสนอตามอายุของคุณได้เลยนะคะ";
    case "comment": return "คอมเมนต์คำว่า สนใจ เดี๋ยวส่งรายละเอียดให้ทางแชทนะคะ";
    case "meet": return "ทักมานัดคุย 15 นาที ช่วยดูแผนให้ฟรีค่ะ";
    case "nextyear": return next ? `ถ้ารอปีหน้า ยอดออมขึ้นเป็น${next.per} ${next.said} บาท ทักมาคุยวันนี้เลยนะคะ` : fixedCta("chat", next);
    default: return "บอกแค่อายุ ทักมาขอใบเสนอของคุณได้เลยนะคะ";
  }
}

/** English picture prompts: no Thai letters and no digits, so the painter cannot misdraw a figure (owner, 2026-11-22) */
const PHOTOS: Record<AdProduct, Record<"hook" | "close" | "body", string>> = {
  LIFEPROTECT: {
    hook: "a Thai father in his thirties holding his small child at home, warm evening light",
    close: "a Thai family sitting together on a sofa, smiling, soft natural light",
    body: "a Thai couple reviewing papers at a kitchen table, calm and relaxed",
  },
  ISHIELD: {
    hook: "a Thai man in his forties sitting quietly in a doctor's waiting room, thoughtful",
    close: "a Thai woman smiling with relief while holding a phone at home, soft daylight",
    body: "a Thai adult talking with a friendly doctor in a bright clinic",
  },
  IHEALTHY: {
    hook: "a Thai woman in her thirties resting in a clean hospital room, gentle light",
    close: "a Thai woman walking out of a hospital entrance with a relieved smile",
    body: "a Thai nurse speaking kindly with a patient beside a hospital bed",
  },
};
export const fixedPhoto = (product: AdProduct, scene: "hook" | "close" | "body"): string => PHOTOS[product][scene];

const productOf = (f: QuoteVideoFacts): AdProduct => (f.product as AdProduct);

export function fixedPlan(
  f: QuoteVideoFacts,
  opts: { art: AdArt; mode: "ai" | "pick"; hook?: AdHookKind; body?: AdBodyKey[]; cta?: AdCtaKey; next?: Next },
): AdPlan {
  const kind = opts.hook ?? "question";
  const lines = fallbackLines(f, { hook: kind === "own" ? "question" : kind });
  const keys = opts.body && opts.body.length ? opts.body : bodiesFor(f).slice(0, 2);
  const cta = opts.cta ?? "chat";
  return {
    mode: opts.mode,
    hook: { kind, voice: lines.hook, headline: lines.headline },
    body: keys.map((key) => ({ key, voice: fixedBody(f, key) })),
    cta: { key: cta, voice: fixedCta(cta, opts.next) },
    photos: {},
    art: opts.art,
    written: false,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

/** a plan as the AI wrote it, held to the quote: whatever fails is replaced and named in `fixed` */
export function cleanAdPlan(
  raw: unknown, f: QuoteVideoFacts, next: Next, today?: Date,
): { plan: AdPlan; fixed: string[]; reasons: Record<string, string> } {
  void today; // facts are already built for the day; kept so callers pass one date everywhere
  const r = isObj(raw) ? raw : {};
  const fixed: string[] = [];
  // why each part was replaced, for the form (lineProblem's text); `fixed` itself holds the plain part names
  const reasons: Record<string, string> = {};
  const fix = (part: string, why: string) => { if (!fixed.includes(part)) fixed.push(part); reasons[part] ??= why; };
  const note = allowedNote(next);
  const product = productOf(f);
  const art = readArt(r.art);

  // hook
  const h = isObj(r.hook) ? r.hook : {};
  const kind = HOOK_KINDS.includes(h.kind as AdHookKind) ? (h.kind as AdHookKind) : "question";
  const fixedHook = fallbackLines(f, { hook: kind === "own" ? "question" : kind });
  let voice = str(h.voice);
  const headRaw = (Array.isArray(h.headline) ? h.headline : []).map(str).filter(Boolean);
  let headline = headRaw.slice(0, 2);
  const voiceWhy = lineProblem(voice, f, VOICE_MAX, note);
  const headWhy = !headline.length ? "ว่าง"
    : headline.map((l) => (l.length > HEADLINE_MAX ? `ยาวเกิน ${HEADLINE_MAX} ตัวอักษร` : lineProblem(l, f, HEADLINE_MAX, note))).find(Boolean) ?? null;
  if (voiceWhy) { voice = fixedHook.hook; fix("hook", voiceWhy); }
  if (headWhy) { headline = fixedHook.headline; if (!voiceWhy) fix("hook", headWhy); }
  else if (headRaw.length > 2) fix("hook", "หัวข้อเกิน 2 บรรทัด");

  // bodies: only this quote's, once each, three at most
  const allowed = bodiesFor(f);
  const rawBody = Array.isArray(r.body) ? r.body : [];
  const seen = new Set<AdBodyKey>();
  const body: { key: AdBodyKey; voice: string }[] = [];
  for (const b of rawBody) {
    if (!isObj(b) || !BODY_KEYS.includes(b.key as AdBodyKey)) continue;
    const key = b.key as AdBodyKey;
    if (!allowed.includes(key) || seen.has(key) || body.length >= MAX_BODIES) continue;
    seen.add(key);
    const text = str(b.voice);
    const why = lineProblem(text, f, VOICE_MAX, note);
    if (why) fix(`body${body.length + 1}`, why);
    body.push({ key, voice: why ? fixedBody(f, key) : text });
  }
  if (!body.length) {
    for (const key of allowed.slice(0, 2)) body.push({ key, voice: fixedBody(f, key) });
    fix("body1", rawBody.length ? "ไม่ตรงกับแบบประกันนี้" : "ว่าง");
  }

  // cta
  const c = isObj(r.cta) ? r.cta : {};
  const ctaKey = ctasFor(next).includes(c.key as AdCtaKey) ? (c.key as AdCtaKey) : "chat";
  let ctaVoice = str(c.voice);
  const ctaWhy = ctaKey !== c.key ? "ไม่มีแบบนี้" : lineProblem(ctaVoice, f, VOICE_MAX, note);
  if (ctaWhy) { ctaVoice = fixedCta(ctaKey, next); fix("cta", ctaWhy); }

  // photo prompts: English only, no digits
  const p = isObj(r.photos) ? r.photos : {};
  let photosFixed = false;
  const photo = (x: unknown, scene: "hook" | "close" | "body"): string | undefined => {
    const t = str(x);
    if (!t) return undefined;
    if (/[ก-๙0-9]/.test(t)) { photosFixed = true; return fixedPhoto(product, scene); }
    return t;
  };
  const photos: AdPlan["photos"] = {};
  const ph = photo(p.hook, "hook"); if (ph) photos.hook = ph;
  const pc = photo(p.close, "close"); if (pc) photos.close = pc;
  if (Array.isArray(p.body)) {
    // one prompt per body scene: a missing one is filled, an extra one dropped, and either is said
    const given: unknown[] = p.body;
    photos.body = body.map((_, i) => photo(given[i], "body") ?? fixedPhoto(product, "body"));
    if (given.length !== body.length || given.some((x) => !str(x))) photosFixed = true;
  }
  if (photosFixed) fix("photos", "ภาพต้องเป็นภาษาอังกฤษ ไม่มีตัวเลข");

  const brief = str(r.brief).slice(0, NOTE_MAX);
  const plan: AdPlan = {
    mode: r.mode === "pick" ? "pick" : "ai",
    hook: { kind, voice, headline },
    body,
    cta: { key: ctaKey, voice: ctaVoice },
    photos,
    art,
    ...(brief ? { brief } : {}),
    written: r.written === true,
    ...(typeof r.model === "string" && r.model ? { model: r.model } : {}),
  };
  return { plan, fixed, reasons };
}
