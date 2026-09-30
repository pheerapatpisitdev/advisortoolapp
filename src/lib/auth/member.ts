import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * สมาชิกทั่วไป: the rules for an account outside UnitOS (owner, 2026-10-01). Pure, apart from
 * the hashing, so the rules can be tested without a database; src/lib/auth/member-store.ts
 * reads and writes the rows.
 *
 * The phone is the account's name and the PIN its secret. A PIN alone would not do, because
 * the members choose their own: two would choose the same one, and a sign-up page refusing a
 * PIN as taken would tell anybody which PINs sign somebody in.
 */

/** accounts one address may open in a day — the free rounds are real money (owner, 2026-10-01) */
export const SIGNUPS_PER_IP_PER_DAY = 3;
/** wrong PINs for one phone, from any address, before it waits (the same window as the IP's) */
export const PHONE_FAILURES = 5;

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_BYTES = 32;
const scrypt = promisify(scryptCallback) as (
  pin: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** Ten digits starting with 0, however it was typed: `+66 81-234-5678` is `0812345678`. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+66")) digits = `0${digits.slice(3)}`;
  else if (/^66\d{9}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

/** One digit six times, or a run up or down by one: the first PINs anybody tries. */
export function weakPin(pin: string): boolean {
  const d = [...pin].map(Number);
  const steps = d.slice(1).map((x, i) => x - d[i]);
  return [0, 1, -1].some((step) => steps.every((s) => s === step));
}

/** What is wrong with a new PIN, or null. `again` is the second box, when there is one. */
export function pinProblem(pin: unknown, again?: unknown): string | null {
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) return "PIN ต้องเป็นตัวเลข 6 หลัก";
  if (again !== undefined && pin !== again) return "PIN สองช่องไม่ตรงกัน";
  if (weakPin(pin)) return "PIN นี้เดาง่ายเกินไป ลองตั้งใหม่";
  return null;
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export type SignupInput = { name: unknown; phone: unknown; pin: unknown; pinAgain: unknown; consent: unknown };

/** The sign-up form, checked in the order it is filled in; the first thing wrong is the one said. */
export function readSignup(input: SignupInput): { ok: true; name: string; phone: string; pin: string } | { ok: false; error: string } {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "กรุณากรอกเบอร์มือถือ 10 หลัก" };
  const problem = pinProblem(input.pin, input.pinAgain);
  if (problem) return { ok: false, error: problem };
  if (input.consent !== "on") return { ok: false, error: "กรุณายอมรับนโยบายความเป็นส่วนตัว" };
  return { ok: true, name, phone, pin: input.pin as string };
}

/** `scrypt$N$r$p$salt$hash`, so the cost can be raised later without losing the old hashes. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEY_BYTES, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const want = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || want.length === 0) return false;
  const got = await scrypt(pin, salt, want.length, { N, r, p });
  return timingSafeEqual(got, want);
}
