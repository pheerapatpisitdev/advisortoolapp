/**
 * วิดีโอโฆษณา's form as state (owner chose ก ×6 on mockup v4, 2026-11-22): what the agent has picked, the plan on
 * screen, and what each press does. The board (AdVideoBoard.tsx) draws this and runs the steps below with the
 * server actions handed in; nothing here imports server code (types only), so the form stays a client bundle.
 */
import { pictureSatang, type Prices } from "@/lib/wallet/prices";
import { formatBaht } from "@/lib/wallet/money";
import type { CostView } from "@/lib/quote-video/make";
import type { VideoInput } from "@/lib/quote-video/script";
import { HOOKS } from "@/lib/quote-video/brief";
import { DEFAULT_ART, photoScenes, type AdArt, type AdBodyKey, type AdCtaKey, type AdHookKind, type AdPlan, type AdProduct } from "@/lib/ad-video/keys";
import type { AdPart } from "@/lib/ad-video/writer";
import type { AdDraft, AdDraftOpts, draftAdPlan, makeAdVideo, previewAd, redraftAdPart } from "./actions";
import { costLine } from "../quote-video/QuoteVideoBoard";

/** the agent's own opening is a spoken line, the checker's 150 (R13, 2026-11-22); so is any line edited in a row */
export const LINE_MAX = 150;
const MAX_BODIES = 3;
const OFFLINE = "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
const MOVED = "ยังไม่ได้สร้างวิดีโอ ข้อมูลแบบประกันเปลี่ยนระหว่างตรวจบท กดสร้างวิดีโออีกครั้ง";
/** the clip was started; only the desk's list could not be read again (no "try again": a second press is a second clip) */
export const STARTED = "เริ่มสร้างวิดีโอแล้ว คลิปจะขึ้นบนโต๊ะเมื่อเปิดหน้านี้ใหม่";
/** the words after a price range */
const BY_AI = "ตามจำนวนฉากที่ AI เลือก";
/** an own opening the checker turned down: shown with its reason, nothing made (R14's rule, a line the agent saw) */
const OWN_REPLACED = "ประโยคเปิดที่เขียนเองใช้ไม่ได้ ระบบใช้ประโยคมาตรฐานแทน ตรวจแล้วกดสร้างวิดีโออีกครั้ง";

export type AdTheme = "board" | "navy";
export type Ages = Record<AdProduct, { min: number; max: number }>;

/** the hook cards in the mockup's order and words; the hints are โจทย์การเล่า's (brief.ts HOOKS) */
export const AD_HOOKS: { kind: AdHookKind; name: string; hint: string }[] = [
  ...([["shock", "ตัวเลขช็อก"], ["question", "ถามสะกิด"], ["myth", "สวนความเชื่อ"], ["story", "เล่าเรื่อง"], ["list", "ลิสต์ 3 ข้อ"]] as const)
    .map(([kind, name]) => ({ kind, name, hint: HOOKS.find((h) => h.kind === kind)?.hint ?? "" })),
  { kind: "own", name: "เขียนเอง", hint: "พิมพ์ประโยคเปิดของคุณ (ระบบตรวจตัวเลขให้)" },
];
export const hookName = (k: AdHookKind): string => AD_HOOKS.find((h) => h.kind === k)?.name ?? "";

/** the paying terms each plan offers, as วิดีโอนำเสนอ's form lists them */
export const AD_TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }, { variant: "WLF99H", years: 99 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const DEFAULT_TERM = { LIFEPROTECT: "WLF19H", ISHIELD: "WLCI10" } as const;
/** the scenes a plan can carry before the server says (plan.ts bodiesFor): iHealthy has no value or versus */
const bodiesOf = (p: AdProduct): AdBodyKey[] => (p === "IHEALTHY" ? ["price", "cover"] : p === "ISHIELD" ? ["price", "cover", "versus"] : ["price", "cover", "value", "versus"]);
const CTAS: AdCtaKey[] = ["chat", "line", "comment", "nextyear", "meet"];

/**
 * `upTo`: AI mode, art ข, before the AI has written: the price at three scenes, `satang` being the price at one,
 * since the AI picks how many and every scene is a photo (a range is said, not a guess)
 */
export interface AdPreview { line: string; satang: number; upTo?: number; bodies: AdBodyKey[]; ctas: AdCtaKey[] }
/** the plan on screen: the quote line it was written for, why the checker replaced any part, a part the AI kept */
export interface AdShown { plan: AdPlan; line: string; reasons: Record<string, string>; kept?: string }

export interface AdState {
  mode: "ai" | "pick";
  product: AdProduct;
  sex: "M" | "F";
  age: number;
  variant: string;
  sum: string;
  /** iHealthy's plan code */
  plan: string;
  brief: string;
  hook: AdHookKind;
  ownHook: string;
  bodies: AdBodyKey[];
  cta: AdCtaKey;
  art: AdArt;
  theme: AdTheme;
  narrator: "F" | "M";
  voice: string;
  gemini: string;
  /** bumped whenever the quote changes: a draft or price asked for before it is not shown */
  stamp: number;
  /** another ✦ turns the writer toward another opening technique */
  seed: number;
  preview: AdPreview | { error: string } | null;
  shown: AdShown | null;
  /** the row whose words are open for editing */
  editing: string | null;
  busy: "draft" | "make" | AdPart | null;
  error: { text: string; contact?: boolean } | null;
  notice: string | null;
}

type Patch = Partial<Pick<AdState, "mode" | "sex" | "age" | "variant" | "sum" | "plan" | "brief" | "hook" | "ownHook" | "cta" | "art" | "theme" | "narrator" | "voice" | "gemini">>;
export type AdAction =
  | { type: "set"; patch: Patch }
  | { type: "product"; product: AdProduct; ages: Ages }
  | { type: "body"; key: AdBodyKey }
  | { type: "preview"; stamp: number; preview: AdPreview | { error: string } }
  | { type: "drafted"; stamp: number; seed: number; draft: AdDraft }
  | { type: "redrafted"; stamp: number; part: AdPart; plan: AdPlan; kept?: true }
  | { type: "edit"; part: string; text: string }
  | { type: "editing"; part: string | null }
  | { type: "refused"; stamp: number; error: string; contact?: boolean; reasons?: Record<string, string>; plan?: AdPlan }
  /** a line that is neither an error nor the price: the clip started though the desk could not be read again */
  | { type: "notice"; text: string }
  | { type: "error"; text: string; contact?: boolean }
  | { type: "made" }
  | { type: "busy"; what: AdState["busy"] };

/** the mockup's opening: AI mode, Life Protect for a man of 35, a million over 19 years, ค ผสม on ไวท์บอร์ด */
export function startState({ ihuPlans }: { ihuPlans: { code: string }[] }): AdState {
  return {
    mode: "ai", product: "LIFEPROTECT", sex: "M", age: 35, variant: DEFAULT_TERM.LIFEPROTECT, sum: "1,000,000",
    plan: ihuPlans.some((p) => p.code === "GOLD") ? "GOLD" : ihuPlans[0]?.code ?? "GOLD",
    brief: "", hook: "shock", ownHook: "", bodies: ["price", "cover"], cta: "chat", art: DEFAULT_ART, theme: "board",
    narrator: "F", voice: "", gemini: "",
    stamp: 0, seed: 0, preview: null, shown: null, editing: null, busy: null, error: null, notice: null,
  };
}

const QUOTE_KEYS = ["sex", "age", "variant", "sum", "plan"] as const;
const PICK_KEYS = ["hook", "ownHook", "cta"] as const;
/** a plan of the mode on screen; the other mode's plan waits, unshown */
export const shownFor = (s: AdState): AdShown | null => (s.shown && s.shown.plan.mode === s.mode ? s.shown : null);
const dropPick = (s: AdState): AdState => (s.shown?.plan.mode === "pick" ? { ...s, shown: null, editing: null } : s);

function editPlan(plan: AdPlan, part: string, text: string): AdPlan {
  if (part === "hook") return { ...plan, hook: { ...plan.hook, voice: text } };
  if (part === "cta") return { ...plan, cta: { ...plan.cta, voice: text } };
  const i = Number(part.replace("body", "")) - 1;
  return plan.body[i] ? { ...plan, body: plan.body.map((b, j) => (j === i ? { ...b, voice: text } : b)) } : plan;
}
const without = (r: Record<string, string>, part: string) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== part));

export function reduce(s: AdState, a: AdAction): AdState {
  switch (a.type) {
    case "set": {
      let next: AdState = { ...s, ...a.patch };
      // a plan holds the quote's figures: a new quote, and the plan and its price go with the old one
      if (QUOTE_KEYS.some((k) => k in a.patch && a.patch[k] !== s[k])) next = { ...next, stamp: s.stamp + 1, shown: null, editing: null };
      // เลือกเอง's plan was written to the picks: new picks, a new plan at the press
      if (PICK_KEYS.some((k) => k in a.patch && a.patch[k] !== s[k])) next = dropPick(next);
      if ("mode" in a.patch && a.patch.mode !== s.mode) next = { ...next, editing: null, error: null };
      return next;
    }
    case "product": {
      if (a.product === s.product) return s;
      const r = a.ages[a.product];
      return {
        ...s, product: a.product, age: Math.min(r.max, Math.max(r.min, s.age)),
        variant: a.product === "IHEALTHY" ? s.variant : DEFAULT_TERM[a.product],
        bodies: ["price", "cover"], stamp: s.stamp + 1, preview: null, shown: null, editing: null, error: null,
      };
    }
    case "body": {
      // 1–3 scenes in the order tapped; a fourth drops the first, the last one left stays (mockup v4)
      const at = s.bodies.indexOf(a.key);
      const bodies = at >= 0 ? (s.bodies.length > 1 ? s.bodies.filter((k) => k !== a.key) : s.bodies)
        : s.bodies.length < MAX_BODIES ? [...s.bodies, a.key] : [...s.bodies.slice(1), a.key];
      return bodies === s.bodies ? s : dropPick({ ...s, bodies });
    }
    case "preview": {
      if (a.stamp !== s.stamp) return s;
      if ("error" in a.preview) return { ...s, preview: a.preview };
      const p = a.preview;
      // the scenes and closings this quote can carry: picks it cannot are let go
      const kept = s.bodies.filter((k) => p.bodies.includes(k));
      const bodies = kept.length === s.bodies.length ? s.bodies : kept.length ? kept : p.bodies.slice(0, 2);
      const cta = p.ctas.includes(s.cta) ? s.cta : "chat";
      return { ...s, preview: p, bodies, cta };
    }
    case "drafted":
      if (a.stamp !== s.stamp) return s;
      return { ...s, seed: a.seed, shown: { plan: a.draft.plan, line: a.draft.facts.line, reasons: a.draft.reasons ?? {} }, editing: null, error: null };
    case "redrafted": {
      if (a.stamp !== s.stamp || !s.shown) return s;
      return { ...s, shown: { ...s.shown, plan: a.plan, reasons: without(s.shown.reasons, a.part), kept: a.kept ? a.part : undefined }, error: null };
    }
    case "edit":
      if (!s.shown) return s;
      return { ...s, shown: { ...s.shown, plan: editPlan(s.shown.plan, a.part, a.text.slice(0, LINE_MAX)), reasons: without(s.shown.reasons, a.part), kept: undefined } };
    case "editing":
      return { ...s, editing: a.part };
    case "refused":
      // R14: the server mended the plan and made nothing; its plan goes up with what it mended, to press again
      // a plan mended for a quote the form has since left is not put up under the new one
      if (a.plan && a.stamp !== s.stamp) return { ...s, error: { text: MOVED } };
      if (a.plan) {
        const line = s.shown?.line ?? (s.preview && !("error" in s.preview) ? s.preview.line : "");
        return { ...s, shown: { plan: a.plan, line, reasons: a.reasons ?? {} }, editing: null, error: { text: a.error } };
      }
      return { ...s, error: { text: a.error, ...(a.contact ? { contact: true } : {}) } };
    case "error":
      return { ...s, error: { text: a.text, ...(a.contact ? { contact: true } : {}) } };
    case "made":
      // the plan leaves the form once its clip is on the desk: the next press is a new clip
      return { ...s, shown: null, editing: null, error: null, notice: null };
    case "notice":
      return { ...s, notice: a.text };
    case "busy":
      return { ...s, busy: a.what };
  }
}

/** the quote the ad is told from, plain, as the server forces it anyway (actions.ts adQuote) */
export function adInput(s: AdState): VideoInput {
  const look = {
    narrator: s.narrator, ...(s.voice ? { voice: s.voice } : {}), ...(s.gemini ? { gemini: s.gemini } : {}),
    style: "motion" as const, length: "short" as const, size: "portrait" as const, theme: s.theme,
  };
  return s.product === "IHEALTHY"
    ? { product: "IHEALTHY", sex: s.sex, age: s.age, plan: s.plan, compare: [], ...look }
    : { product: s.product, variant: s.variant, sex: s.sex, age: s.age, sumAssured: Number(s.sum.replace(/[^\d]/g, "")), ...look };
}

/** AI mode before the AI has written, with a photo on every scene: the price is a range over 1–3 scenes */
export const ranged = (s: AdState): boolean => s.mode === "ai" && s.art === "photo" && !shownFor(s);

/** the bodies the clip will have as the form stands: the picks, the AI's plan, or the AI's usual two before it writes */
export const sceneCount = (s: AdState): number =>
  s.mode === "pick" ? s.bodies.length : shownFor(s)?.plan.body.length ?? 2;

/** the scenes and closings offered: the server's for this quote once it has said, the plan's own until then */
export const offeredBodies = (s: AdState): AdBodyKey[] => (s.preview && !("error" in s.preview) ? s.preview.bodies : bodiesOf(s.product));
export const offeredCtas = (s: AdState): AdCtaKey[] => (s.preview && !("error" in s.preview) ? s.preview.ctas : CTAS);

function draftOpts(s: AdState, seed: number): AdDraftOpts {
  return s.mode === "ai"
    ? { mode: "ai", art: s.art, brief: s.brief.trim(), seed }
    : { mode: "pick", art: s.art, hook: s.hook, body: s.bodies, cta: s.cta, ...(s.hook === "own" ? { ownHook: s.ownHook } : {}), seed };
}

/** ✦ ให้ AI เขียน (and แบบใหม่: the next seed, so another technique) */
export async function draftStep(s: AdState, draft: typeof draftAdPlan): Promise<AdAction> {
  const seed = s.mode === "ai" && shownFor(s) ? s.seed + 1 : s.seed;
  try {
    const r = await draft(adInput(s), draftOpts(s, seed));
    return "error" in r ? { type: "error", text: r.error } : { type: "drafted", stamp: s.stamp, seed, draft: r };
  } catch {
    return { type: "error", text: OFFLINE };
  }
}

/** เปลี่ยน on one row: the plan as shown goes, the server cleans it first */
export async function redraftStep(s: AdState, part: AdPart, redraft: typeof redraftAdPart): Promise<AdAction> {
  const shown = shownFor(s);
  if (!shown) return { type: "error", text: "ให้ AI เขียนบทก่อน" };
  try {
    const r = await redraft(adInput(s), shown.plan, part);
    return "error" in r ? { type: "error", text: r.error } : { type: "redrafted", stamp: s.stamp, part, plan: r.plan, ...(r.kept ? { kept: true as const } : {}) };
  } catch {
    return { type: "error", text: OFFLINE };
  }
}

/** the quote line and the clip's price for the art and the scenes as they stand */
export async function previewStep(s: AdState, preview: typeof previewAd): Promise<AdAction> {
  try {
    if (ranged(s)) {
      // the price at one scene and at three, each from the server, so either end is what would be charged
      const [lo, hi] = await Promise.all([preview(adInput(s), s.art, 1), preview(adInput(s), s.art, 3)]);
      if ("error" in lo) return { type: "preview", stamp: s.stamp, preview: lo };
      if ("error" in hi) return { type: "preview", stamp: s.stamp, preview: hi };
      return { type: "preview", stamp: s.stamp, preview: { ...lo, upTo: hi.satang } };
    }
    return { type: "preview", stamp: s.stamp, preview: await preview(adInput(s), s.art, sceneCount(s)) };
  } catch {
    return { type: "preview", stamp: s.stamp, preview: { error: OFFLINE } };
  }
}

/**
 * สร้างวิดีโอ: the plan on screen, with the art as it stands now; none yet (เลือกเอง, or AI mode pressed straight
 * away: one press, a clip, mockup Q6 ก) and the AI writes it first. An own opening the checker turned down stops
 * there, shown; a refusal of a mended plan (R14) puts that plan up to be pressed again.
 */
export async function makeStep(s: AdState, draft: typeof draftAdPlan, make: typeof makeAdVideo): Promise<AdAction[]> {
  const out: AdAction[] = [];
  let plan = shownFor(s)?.plan;
  if (!plan) {
    const d = await draftStep(s, draft);
    out.push(d);
    if (d.type !== "drafted") return out;
    if (d.draft.plan.hook.kind === "own" && d.draft.fixed?.includes("hook")) return [...out, { type: "error", text: OWN_REPLACED }];
    plan = d.draft.plan;
  }
  try {
    const r = await make(adInput(s), { ...plan, art: s.art });
    if (r.ok) return [...out, { type: "made" }];
    return [...out, { type: "refused", stamp: s.stamp, error: r.error, ...(r.needContact ? { contact: true } : {}), ...(r.plan ? { plan: r.plan, reasons: r.reasons ?? {} } : {}) }];
  } catch {
    return [...out, { type: "error", text: OFFLINE }];
  }
}

/**
 * After a press: the desk and the money read again. A clip that started stays started whatever the reading does
 * (a second press would make and charge a second clip), so a failed reading says the clip started instead.
 */
export async function refreshAfter(made: boolean, refresh: () => Promise<void>): Promise<AdAction | null> {
  try {
    await refresh();
    return null;
  } catch {
    return made ? { type: "notice", text: STARTED } : null;
  }
}

/** one photo's price: Gemini's (the ad's painter, photo.ts AD_PAINTER), or its own key should the list drop it (R4) */
export const photoSatang = (prices: Prices): number => pictureSatang(prices, "gemini") ?? prices.drawGemini;

/**
 * The line above สร้างวิดีโอ: วิดีโอนำเสนอ's (costLine, the whole clip from previewAd), except a free clip with
 * photos, whose photos are still paid from the wallet (R11, 2026-11-22) and are said so before the press.
 */
export function adCostLine(cost: CostView | null, prices: Prices, s: AdState): { text: string; blocked: boolean; topUp: boolean } | null {
  const p = s.preview && !("error" in s.preview) ? s.preview : null;
  const range = ranged(s);
  const photosAt = (bodies: number) => photoScenes(s.art, bodies).filter(Boolean).length;
  const photos = photosAt(range ? 1 : sceneCount(s));
  if (cost?.kind === "free" && photos > 0) {
    if (cost.walletOff) return { text: "ค่าภาพประกอบจ่ายจากกระเป๋าเงิน แต่กระเป๋าเงินยังไม่เปิดใช้ เลือกภาพแบบ ก · Motion Graphic ได้", blocked: true, topUp: false };
    const each = photoSatang(prices);
    const head = `ใช้วิดีโอฟรี 1 ครั้ง · เหลือ ${cost.left}/${cost.of} ครั้ง · ค่าภาพ`;
    const eachWord = formatBaht(each).replace(/\.00$/, "");
    if (range) {
      const most = photosAt(MAX_BODIES);
      return { text: `${head} ${photos}–${most} × ${eachWord} = ${formatBaht(photos * each)}–${formatBaht(most * each)} ${BY_AI} หักจากกระเป๋า`, blocked: false, topUp: false };
    }
    return { text: `${head} ${photos} × ${eachWord} = ${formatBaht(photos * each)} หักจากกระเป๋า`, blocked: false, topUp: false };
  }
  if (range && p?.upTo !== undefined && cost?.kind === "wallet") return rangeLine(cost, p.satang, p.upTo);
  return costLine(cost, "videoMotion", p?.satang);
}

/** a wallet's line for a price between `lo` and `hi`: shut only when even the lower end is more than the balance */
function rangeLine(c: Extract<CostView, { kind: "wallet" }>, lo: number, hi: number): { text: string; blocked: boolean; topUp: boolean } {
  const price = `${formatBaht(lo)}–${formatBaht(hi)} ${BY_AI}`;
  if (c.satang < lo) {
    return { text: `${c.credit ? "เครดิตและเงินในกระเป๋าไม่พอ" : "ยอดในกระเป๋าไม่พอ"} (คลิปนี้ ${price} · ยอดคงเหลือ ${c.balance})`, blocked: true, topUp: true };
  }
  const short = c.satang < hi;
  return {
    text: `${c.credit ? "หักจากเครดิตและกระเป๋า" : "ใช้วิดีโอฟรีครบแล้ว · หักจากกระเป๋า"} ${price} (ยอดคงเหลือ ${c.balance})${short ? " · ถ้า AI เลือก 3 ฉากอาจไม่พอ" : ""}`,
    blocked: false, topUp: short,
  };
}

/**
 * The figures in a line, to mark as the mockup does: digits with their commas, and "ล้าน" after them; a
 * length of time ("15 นาที") is not a figure from the quote.
 */
export function figureParts(text: string): { text: string; figure: boolean }[] {
  const out: { text: string; figure: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(/\d[\d,]*(?:\s?ล้าน)?(?!\d|,|\s?นาที)/g)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: text.slice(at, i), figure: false });
    out.push({ text: m[0], figure: true });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), figure: false });
  return out;
}
