/**
 * What วิดีโอนำเสนอ's form sends, checked and made into an input the engine is asked about (moved here unchanged from
 * src/app/studio/quote-video/actions.ts, 2026-11-22, R7): a "use server" file may export async functions only, and
 * วิดีโอโฆษณา (src/app/studio/ad-video/actions.ts) checks its quote the same way.
 */
import { elevenVoice } from "@/lib/voice/elevenlabs";
import { geminiVoice } from "@/lib/voice/gemini";
import { RIDERS_NOT_SOLD, cleanBudget, resolveBudget } from "@/lib/quote-video/budget";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { cleanSetup } from "@/lib/quote-video/ihealthy-setup";
import { isAllPlansMode } from "@/lib/quote-video/ihealthy-all-plans";
import { iShieldTable } from "@/lib/ishield-table";
import { sizeOf } from "@/lib/quote-video/timeline";
import { planInput, productOf, quoteVideoFacts, type VideoInput } from "@/lib/quote-video/script";
import { readRiders, writeRiders, type CardRiders } from "@/lib/card-link";
import { currentRiders, lifeProtectPriced } from "@/lib/lifeprotect-card";
import { lifeProtectLinkSum } from "@/lib/quote-pdf/pages";
import { checkedPension } from "@/lib/quote-video/pension";
import { checkedLegacy } from "@/lib/quote-video/legacy";
import { checkedPlb } from "@/lib/quote-video/plb";
import { checkedGsaving } from "@/lib/quote-video/gsaving";
import { cleanBrief, writes, writtenProblems, type WrittenLines } from "@/lib/quote-video/brief";
import { readVideoLang } from "@/lib/quote-video/video-words";
import { readLength } from "@/lib/quote-video/told";
import { DEFAULT_THEME, readTheme, type ThemeKey } from "@/lib/quote-video/theme-keys";
import { festivalOn, type FestivalKey } from "@/lib/quote-video/festival";
import { MY_COLORS, type MyColor } from "@/lib/card-theme";
import { recipeInput, recipeOf } from "@/lib/quote-video/recipes";
import { prefsFor } from "@/lib/pay-prefs-store";
import { hiddenModes } from "@/lib/pay-prefs";
import type { PayMode } from "@/calc/types";

/** the paying terms each product's clip offers, as its page names them */
export const TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }, { variant: "WLF99H", years: 99 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const SUM_STEP = 50_000;

/** iShield's sums; Life Protect's are the page's own (lifeProtectLinkSum) */
function iShieldSums() {
  const t = iShieldTable();
  return { min: t.saMin, max: t.saMax };
}

/** the agent's ตั้งค่าส่วนตัว as checked() takes it: the instalments hidden, then whether tables carry pen notes */
export async function payAndPen(agentId: string): Promise<[PayMode[], boolean]> {
  const p = await prefsFor(agentId);
  return [hiddenModes(p), p.pen];
}

/** What was sent, made into an input the engine is asked about — or the words for what is wrong. */
/**
 * `hide`: the instalments the signed-in agent switched off (ตั้งค่าส่วนตัว, owner 2026-11-14), read on the
 * server and kept on the clip, never taken from the form; a re-render says the same. `pen`: whether its table
 * carries the pen notes (แสดงคำอธิบายในตาราง), the same way.
 */
export function checked(v: VideoInput, hide: PayMode[] = [], pen = true): VideoInput | string {
  // from a budget: the form is checked with a stand-in sum, then the budget works out the real one
  // วิดีโอเทียบ 4 แผน shows the page's own prices: no budget, Motion Graphic only, portrait, the whole length, no brief
  const all = v.product === "IHEALTHY" && isAllPlansMode(v.allPlans);
  const budget = v.budget && !all ? cleanBudget(v.budget) : undefined;
  if (typeof budget === "string") return budget;
  // the stand-in sum is checked without riders: whether they can be bought is the budget's own question, sum by sum
  const asked = !budget || v.product === "IHEALTHY" ? v
    : v.product === "LEGACY" ? { ...v, tier: 1 }
    // Protection Life's stand-in must be one of its page's steps
    : v.product === "PLB" ? { ...v, sumAssured: 300_000 } : { ...v, sumAssured: 500_000, riders: undefined };
  const checkedAsked = checkedQuote(asked);
  if (typeof checkedAsked === "string") return checkedAsked;
  // Life Protect's riders picked on the form are part of what the budget pays for (owner, 2026-11-18, 1ก)
  const budgetRiders = budget && productOf(v) === "LIFEPROTECT" && "riders" in v ? currentRiders(cleanRiders(v.riders)) : undefined;
  const worked = budget
    ? resolveBudget(budgetRiders ? { ...checkedAsked, riders: budgetRiders } as VideoInput : checkedAsked, budget)
    : checkedAsked;
  if (typeof worked === "string") return worked;
  // the table notes, read on the server like `hide`; only an agent who switched them off is marked
  const c: VideoInput = { ...worked, ...(hide.length ? { hide } : {}), ...(pen ? {} : { pen: false }) };
  // another language (owner, 2026-10-15): Gemini's narrator, fixed lines, the 15-second clip or the whole one
  const foreign = c.product === "IHEALTHY" && readVideoLang(c.lang) !== "th";
  // an ElevenLabs voice sets the endings itself: a man's voice says ครับ
  const eleven = foreign ? undefined : elevenVoice(v.voice);
  // one of Gemini's 30 voices (owner, 2026-10-17), in every language; its sex sets the endings
  const gemini = eleven ? undefined : geminiVoice(v.gemini);
  const narrator = eleven ? eleven.sex : gemini ? gemini.sex : v.narrator === "M" ? "M" : "F";
  // แชทถาม-ตอบ came off the form (owner, 2026-11-21, ก): a request for it — an older tab — is made แบบปกติ.
  // Its drawing (chat.tsx) stays, so a chat clip already queued still finishes.
  const style = all || v.style === "motion" ? "motion" : "classic";
  // a Motion Graphic clip's look (owner, 2026-10-17); น้ำเงินทอง is kept as no theme at all
  const look = lookOf(style === "motion" ? v.theme : undefined, v.myColor);
  const askedLength = readLength(v.length);
  const length = all || (foreign && askedLength !== "short") ? "full" : askedLength;
  // every clip in every shape (owner, 2026-10-13); the 4-plan clip is drawn upright only
  const size = all ? "portrait" : sizeOf(v);
  // โจทย์การเล่า: the brief, and the lines the agent saw (and may have edited) — checked again here
  const facts = quoteVideoFacts(c);
  const brief = facts && !foreign && !all ? cleanBrief(v.brief, facts) : undefined;
  // a recipe clip speaks its own fixed lines and drops the brief's (recipeInput, below): the form sends them with it,
  // so they are not checked, and never refuse a clip that will not say them (final review, 2026-11-12)
  const recipe = facts ? recipeOf({ style, size, recipe: v.recipe }, facts) : undefined;
  let lines: WrittenLines | undefined;
  if (facts && !recipe && writes(brief) && v.lines) {
    const l = cleanLines(v.lines);
    const bad = writtenProblems(l, facts, { loop: Boolean(brief.loop), story: length === "long" || length === "max", note: brief.note });
    const first = Object.entries(bad)[0];
    if (first) return `${FIELD_WORD[first[0]] ?? "ประโยค"}: ${first[1]}`;
    lines = l;
  }
  const made: VideoInput = { ...c, narrator, ...(eleven ? { voice: eleven.id } : {}), ...(gemini ? { gemini: gemini.name } : {}), style, ...look, ...(style === "motion" && v.mascot === true ? { mascot: true } : {}), ...(style === "motion" && v.carry === true ? { carry: true } : {}), length, size, ...(brief ? { brief } : {}), ...(lines ? { lines } : {}), ...(v.noMusic === true ? { noMusic: true } : {}) };
  // สูตรคลิป Motion (owner, 2026-11-11, ก ก ก): kept only where it fits this quote, else the standing Motion clip is made (spec, Errors)
  return recipeInput(made, v.recipe, facts);
}

/**
 * A clip's look as it is kept: none for ไวท์บอร์ด, the default (theme-keys.ts); ธีมเทศกาล with the festival on today
 * (festival.ts), or the default when the festival's days ended while the form stood open.
 */
export function lookOf(asked: unknown, color?: unknown): { theme?: ThemeKey; festival?: FestivalKey; myColor?: MyColor } {
  const theme = readTheme(asked);
  // สีของฉัน left the form (owner, 2026-11-17): readTheme reads it as the default, so this stays for nothing older
  if (theme === "mine") return MY_COLORS.includes(color as MyColor) ? { theme, myColor: color as MyColor } : {};
  if (theme === "festival") {
    const on = festivalOn();
    return on ? { theme, festival: on.key } : {};
  }
  return theme !== DEFAULT_THEME ? { theme } : {};
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

export function checkedQuote(v: VideoInput): VideoInput | string {
  if (v.sex !== "M" && v.sex !== "F") return "เลือกเพศ";
  if (!Number.isInteger(v.age) || v.age < 0 || v.age > 99) return "ใส่อายุให้ถูกต้อง";
  if (v.product === "IHEALTHY") {
    const codes = new Set(iHealthyTable().plans.map((p) => p.code));
    // วิดีโอเทียบ 4 แผน (owner chose ข, 2026-11-11): the iHealthy Ultra Package page, no plan of its own
    if (isAllPlansMode(v.allPlans)) {
      const lang = readVideoLang(v.lang);
      return { product: "IHEALTHY", sex: v.sex, age: v.age, plan: codes.has(v.plan) ? v.plan : "GOLD", compare: [], allPlans: v.allPlans, ...(lang !== "th" ? { lang } : {}) };
    }
    if (!codes.has(v.plan)) return "เลือกแผน";
    const compare = [...new Set((Array.isArray(v.compare) ? v.compare : []).filter((c) => codes.has(c) && c !== v.plan))].slice(0, 2);
    const setup = cleanSetup(v.setup);
    const lang = readVideoLang(v.lang);
    return { product: "IHEALTHY", sex: v.sex, age: v.age, plan: v.plan, compare, ...(setup ? { setup } : {}), ...(lang !== "th" ? { lang } : {}) };
  }
  if (v.product === "PENSION") return checkedPension(v);
  if (v.product === "LEGACY") return checkedLegacy(v);
  if (v.product === "PLB") return checkedPlb(v);
  if (v.product === "GSAVING") return checkedGsaving(v);
  const product = productOf(v);
  if (product !== "LIFEPROTECT" && product !== "ISHIELD") return "เลือกแบบประกัน";
  const term = TERMS[product].find((x) => x.variant === v.variant);
  if (!term) return "เลือกระยะชำระเบี้ย";
  // Life Protect takes the page's sums, any whole baht (owner, 2026-11-20, ก): a sum typed or bought by a budget on
  // /lifeprotect came over to the form and was refused for not being a fifty-thousand step
  if (product === "LIFEPROTECT") {
    if (!lifeProtectLinkSum(v.sumAssured)) return "ทุนประกัน 150,000 – 50,000,000 บาท";
  } else {
    const { min, max } = iShieldSums();
    if (!Number.isInteger(v.sumAssured) || v.sumAssured < min || v.sumAssured > max || v.sumAssured % SUM_STEP) {
      return `ทุนประกัน ${min.toLocaleString("en-US")} – ${max.toLocaleString("en-US")} บาท ทีละ 50,000`;
    }
  }
  // a waiver no longer sold (พีบี, 2026-11-02) comes off rather than refusing the clip
  const riders = product === "LIFEPROTECT" && "riders" in v ? currentRiders(cleanRiders(v.riders)) : undefined;
  if (riders) {
    const plan = { product, variant: v.variant, sex: v.sex, age: v.age, sumAssured: v.sumAssured };
    // the page's riders on an age or sum they are not sold at: said, rather than a clip without them
    if (!lifeProtectPriced({ ...planInput(plan), riders }, new Date()) && lifeProtectPriced(planInput(plan), new Date())) return RIDERS_NOT_SOLD;
  }
  return { product, variant: v.variant, sex: v.sex, age: v.age, sumAssured: v.sumAssured, ...(riders ? { riders } : {}) };
}

/** riders as the board sent them back: through a link's own writing and reading, so only a shape our links have survives */
function cleanRiders(raw: unknown): CardRiders | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const q = new URLSearchParams();
  try { writeRiders(q, raw as CardRiders); } catch { return undefined; }
  return readRiders((k) => q.get(k)) ?? undefined;
}
