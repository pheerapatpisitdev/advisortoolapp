"use client";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { signUp } from "./actions";

export function SignupForm({ next }: { next: string }) {
  const login = `/login?next=${encodeURIComponent(next)}`;
  const [error, setError] = useState<{ error: string; taken?: boolean }>();
  const [pending, start] = useTransition();
  const field = "w-full rounded-md border px-4 py-3 text-base";
  const pin = "w-full rounded-md border px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums";
  const clear = () => setError(undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-center text-xl font-semibold">สมัครใช้ Studio</h1>
        <p className="mt-1 text-center text-sm text-[var(--bot-ink-mute)]">ถาม AI ได้ไม่จำกัด · ใช้ AI เขียนคอนเทนต์ฟรี 10 รอบ แล้วเติมเงินใช้ต่อได้</p>

        {/* onSubmit, not action=: React 19 resets a form after its action, which would wipe
            everything typed after every error */}
        <form method="post" className="mt-6 space-y-3" onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await signUp(fd);
            if (res) setError(res);
          });
        }}>
          <input type="hidden" name="next" value={next} />
          <input name="name" autoComplete="name" maxLength={60} placeholder="ชื่อที่แสดง" aria-label="ชื่อที่แสดง" className={field} onChange={clear} />
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="เบอร์มือถือ" aria-label="เบอร์มือถือ" className={field} onChange={clear} />
          <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="\d{6}"
                 placeholder="ตั้ง PIN 6 หลัก" aria-label="ตั้ง PIN 6 หลัก" className={pin} onChange={clear} />
          <input name="pinAgain" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} pattern="\d{6}"
                 placeholder="PIN อีกครั้ง" aria-label="PIN อีกครั้ง" className={pin} onChange={clear} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-1" onChange={clear} />
            <span>ยอมรับ <Link href="/privacy" target="_blank" className="underline">นโยบายความเป็นส่วนตัว</Link></span>
          </label>
          <button disabled={pending}
                  className="w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "กำลังสมัคร…" : "สมัครและเข้าใช้งาน"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--bot-red-ink)]">
            {error.error}
            {error.taken && <> — <Link href={login} className="underline">เข้าสู่ระบบ</Link></>}
          </p>
        )}
        <p className="mt-6 text-center text-xs text-[var(--bot-ink-mute)]">จำ PIN ไว้ให้ดี ถ้าลืมต้องติดต่อแอดมินให้ตั้งใหม่</p>
        <Link href={login} className="mt-2 block text-center text-sm text-[var(--bot-ink-mute)] underline">มีบัญชีแล้ว? เข้าสู่ระบบ</Link>
      </div>
    </main>
  );
}
