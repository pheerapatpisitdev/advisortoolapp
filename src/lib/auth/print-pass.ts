import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminSecret, deriveKey } from "./keys";

/**
 * The note our own PDF printer carries into the calculator pages (owner, 2026-10-20). Those
 * pages are for members only since then, but the bots' quote PDF is the page printed in
 * headless Chrome (src/lib/quote-pdf/render.ts), which has no session. The printer sets this
 * cookie before it opens the page; the page's gate lets it through.
 *
 * Two minutes, the printer's own limit with room to spare: the cookie lives only in that one
 * Chrome, which is closed after the page is printed.
 */
export const PRINT_COOKIE = "ins_print";

const TTL_MS = 2 * 60 * 1000;

function mac(exp: string): string {
  return createHmac("sha256", deriveKey(adminSecret(), "print-pass")).update(`print:${exp}`).digest("hex");
}

/** a fresh pass, good for two minutes from `now` */
export function printPassFor(now = Date.now()): string {
  const exp = String(now + TTL_MS);
  return `${exp}.${mac(exp)}`;
}

/** whether `value` is a pass this deploy made that has not run out */
export function validPrintPass(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [exp, sig, ...rest] = value.split(".");
  if (rest.length || !exp || !sig || !/^\d+$/.test(exp)) return false;
  const expires = Number(exp);
  if (expires < now || expires > now + TTL_MS) return false;
  const want = Buffer.from(mac(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** whether this request is our PDF printer's */
export async function printing(): Promise<boolean> {
  return validPrintPass((await cookies()).get(PRINT_COOKIE)?.value);
}
