import { readRiders, writeRiders, type CardRiders } from "@/lib/card-link";
import { PLB_SUMS } from "@/lib/quote-pdf/pages";
import { cleanSetup } from "./ihealthy-setup";
import type { Product } from "./script";
import { readVideoLang, type VideoLang } from "./video-words";

/**
 * The shortcut from a plan's sales page into วิดีโอนำเสนอ (owner, 2026-10-11, option ก): the
 * page's own arrangement, written into the Studio form's address so the agent only adds a name
 * and a voice. Nothing here is trusted — the form checks every value again.
 */

export const VIDEO_PAGE = "/studio/quote-video";

export interface VideoStart {
  /** "FHC": วิดีโอสรุป FHC of the customer named by `fhc` (owner, 2026-10-12) */
  product: Product | "FHC";
  /** the FHC customer's id */
  fhc?: string;
  sex?: "M" | "F";
  age?: number;
  sumAssured?: number;
  variant?: string;
  /** iHealthy's plan code */
  plan?: string;
  /** iHealthy: the page's base, sum, territory, coverage and riders, as its address writes them (ihealthy-setup.ts) */
  setup?: string;
  /** บำนาญ 95: the age the pension starts, and how the premiums are paid */
  annuityAge?: number;
  pay?: "6" | "untilAnnuity";
  /** มรดก: the tier, 1–10 million */
  tier?: number;
  /** iHealthy: the language the page was read in, which the clip starts in (owner, 2026-10-15); absent = Thai */
  lang?: VideoLang;
  /** Life Protect: the riders its page priced in, written as its card links write them (owner, 2026-10-17, 1ก) */
  riders?: CardRiders;
}

export function videoStartHref(s: VideoStart): string {
  const q = new URLSearchParams({ product: s.product });
  if (s.sex) q.set("sex", s.sex);
  if (s.age !== undefined) q.set("age", String(s.age));
  if (s.sumAssured !== undefined) q.set("sum", String(s.sumAssured));
  if (s.variant) q.set("variant", s.variant);
  if (s.plan) q.set("plan", s.plan);
  if (s.setup) q.set("ihu", s.setup);
  if (s.annuityAge !== undefined) q.set("start", String(s.annuityAge));
  if (s.pay) q.set("pay", s.pay);
  if (s.tier !== undefined) q.set("tier", String(s.tier));
  if (s.lang && s.lang !== "th") q.set("lang", s.lang);
  if (s.product === "LIFEPROTECT") writeRiders(q, s.riders);
  return `${VIDEO_PAGE}?${q.toString()}`;
}

const PRODUCTS: readonly Product[] = ["LIFEPROTECT", "ISHIELD", "IHEALTHY", "PENSION", "LEGACY", "PLB"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Protection Life's terms and sums: only the /plb page's own are read from an address */
const PLB_TERMS = ["PLB05", "PLB10", "PLB12", "PLB15"];

/** what an address asked the form to start with; anything unreadable is left out */
/** the customer page's button: the Studio form open on that customer's summary */
export const fhcVideoHref = (customerId: string) => `${VIDEO_PAGE}?${new URLSearchParams({ product: "FHC", fhc: customerId }).toString()}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function videoStartFrom(params: Record<string, string | string[] | undefined>): VideoStart | undefined {
  if (one(params.product) === "FHC") {
    const id = one(params.fhc);
    return { product: "FHC", ...(id && UUID.test(id) ? { fhc: id } : {}) };
  }
  const product = one(params.product) as Product | undefined;
  if (!product || !PRODUCTS.includes(product)) return undefined;
  const sex = one(params.sex);
  const age = Number(one(params.age));
  const sum = Number(one(params.sum));
  const variant = one(params.variant);
  const plan = one(params.plan);
  const start = Number(one(params.start));
  const pay = one(params.pay);
  const tier = Number(one(params.tier));
  const setup = product === "IHEALTHY" ? cleanSetup(one(params.ihu)) : undefined;
  const lang = product === "IHEALTHY" ? readVideoLang(one(params.lang)) : "th";
  const plb = product === "PLB";
  const riders = product === "LIFEPROTECT" ? readRiders((k) => one(params[k])) : undefined;
  return {
    product,
    ...(sex === "M" || sex === "F" ? { sex } : {}),
    ...(Number.isInteger(age) && age >= 0 && age <= 99 ? { age } : {}),
    ...(Number.isInteger(sum) && sum > 0 && sum <= 100_000_000 && (!plb || PLB_SUMS.includes(sum)) ? { sumAssured: sum } : {}),
    ...(variant && /^[A-Z0-9]{3,12}$/.test(variant) && (!plb || PLB_TERMS.includes(variant)) ? { variant } : {}),
    ...(plan && /^[A-Z]{3,12}$/.test(plan) ? { plan } : {}),
    ...([55, 60, 65, 70].includes(start) ? { annuityAge: start } : {}),
    ...(pay === "6" || pay === "untilAnnuity" ? { pay } : {}),
    ...(Number.isInteger(tier) && tier >= 1 && tier <= 10 ? { tier } : {}),
    ...(setup ? { setup } : {}),
    ...(lang !== "th" ? { lang } : {}),
    ...(riders ? { riders } : {}),
  };
}
