"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/assistant/rate-limit";
import { hashPin, readSignup, SIGNUPS_PER_IP_PER_DAY } from "@/lib/auth/member";
import { safeNext } from "@/lib/auth/next";
import { createMember, deleteMember, memberByPhone, memberSettings, signupsFromIp } from "@/lib/auth/member-store";
import { startSession } from "@/lib/auth/session";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Opening an account outside UnitOS (owner, 2026-10-01): a name, a phone and a PIN the member
 * chooses, then straight into Studio with the free rounds. Open to anybody, so it is not a
 * door the guard test asks to be gated; what holds it is the owner's switch and three
 * accounts an address a day. A phone already taken is said so — a phone alone signs nobody in.
 *
 * Counts the address's signups twice: early (to avoid hashing if past the limit), then again
 * after the insert (parallel requests from the same address each read 0 and all create accounts;
 * the re-count catches this, deletes the new one, and returns the limit message).
 *
 * Goes on to `next` when the form carries one — ถาม AI sends people here after its free
 * questions and should get them back (2026-10-01) — and to Studio otherwise; safeNext keeps it on this site.
 */
export async function signUp(formData: FormData): Promise<{ error: string; taken?: boolean } | undefined> {
  let id: string;
  try {
    if (!(await memberSettings()).signupOpen) return { error: "ยังไม่เปิดรับสมัคร" };
    const ip = clientIp(await headers());
    const since = new Date(Date.now() - DAY_MS);
    if ((await signupsFromIp(ip, since)) >= SIGNUPS_PER_IP_PER_DAY) {
      return { error: "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้" };
    }
    const form = readSignup({
      name: formData.get("name"), phone: formData.get("phone"), pin: formData.get("pin"),
      pinAgain: formData.get("pinAgain"), consent: formData.get("consent"),
    });
    if (!form.ok) return { error: form.error };
    if (await memberByPhone(form.phone)) return { error: "เบอร์นี้สมัครไว้แล้ว", taken: true };
    const made = await createMember({ phone: form.phone, name: form.name, pinHash: await hashPin(form.pin), ip });
    if (!made.ok) return { error: "เบอร์นี้สมัครไว้แล้ว", taken: true };
    id = made.id;
    // re-count after insert to catch parallel requests that all passed the early check
    if ((await signupsFromIp(ip, since)) > SIGNUPS_PER_IP_PER_DAY) {
      await deleteMember(id);
      return { error: "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้" };
    }
  } catch (e) {
    console.error("signup failed:", e);
    return { error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" };
  }
  // outside the try: redirect() works by throwing, and must not be caught as a failure
  await startSession(id);
  redirect(safeNext(formData.get("next")));
}
