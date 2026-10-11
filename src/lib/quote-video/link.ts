import type { Product } from "./script";

/**
 * The shortcut from a plan's sales page into วิดีโอนำเสนอ (owner, 2026-10-11, option ก): the
 * page's own arrangement, written into the Studio form's address so the agent only adds a name
 * and a voice. Nothing here is trusted — the form checks every value again.
 */

export const VIDEO_PAGE = "/studio/quote-video";

export interface VideoStart {
  product: Product;
  sex?: "M" | "F";
  age?: number;
  sumAssured?: number;
  variant?: string;
  /** iHealthy's plan code */
  plan?: string;
}

export function videoStartHref(s: VideoStart): string {
  const q = new URLSearchParams({ product: s.product });
  if (s.sex) q.set("sex", s.sex);
  if (s.age !== undefined) q.set("age", String(s.age));
  if (s.sumAssured !== undefined) q.set("sum", String(s.sumAssured));
  if (s.variant) q.set("variant", s.variant);
  if (s.plan) q.set("plan", s.plan);
  return `${VIDEO_PAGE}?${q.toString()}`;
}

const PRODUCTS: readonly Product[] = ["LIFEPROTECT", "ISHIELD", "IHEALTHY"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** what an address asked the form to start with; anything unreadable is left out */
export function videoStartFrom(params: Record<string, string | string[] | undefined>): VideoStart | undefined {
  const product = one(params.product) as Product | undefined;
  if (!product || !PRODUCTS.includes(product)) return undefined;
  const sex = one(params.sex);
  const age = Number(one(params.age));
  const sum = Number(one(params.sum));
  const variant = one(params.variant);
  const plan = one(params.plan);
  return {
    product,
    ...(sex === "M" || sex === "F" ? { sex } : {}),
    ...(Number.isInteger(age) && age >= 0 && age <= 99 ? { age } : {}),
    ...(Number.isInteger(sum) && sum > 0 && sum <= 100_000_000 ? { sumAssured: sum } : {}),
    ...(variant && /^[A-Z0-9]{3,12}$/.test(variant) ? { variant } : {}),
    ...(plan && /^[A-Z]{3,12}$/.test(plan) ? { plan } : {}),
  };
}
