"use client";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field, FormError, PinInput } from "@/components/auth/fields";
import { INPUT, PRIMARY } from "@/components/auth/styles";
import { signUp } from "./actions";

export function SignupForm({ next }: { next: string }) {
  const login = `/login?next=${encodeURIComponent(next)}`;
  const [error, setError] = useState<{ error: string; taken?: boolean }>();
  const [pending, start] = useTransition();
  const clear = () => setError(undefined);

  return (
    <AuthCard title="สมัครใช้ advisortool" subtitle="ถาม AI ได้ไม่จำกัด · ใช้ AI เขียนคอนเทนต์ฟรี 10 รอบ แล้วเติมเงินใช้ต่อได้">
      {/* onSubmit, not action=: React 19 resets a form after its action, which would wipe
          everything typed after every error */}
      <form method="post" className="mt-6 space-y-4" onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await signUp(fd);
          if (res) setError(res);
        });
      }}>
        <input type="hidden" name="next" value={next} />
        <Field id="signup-name" label="ชื่อที่แสดง">
          <input id="signup-name" name="name" autoComplete="name" maxLength={60} placeholder="เช่น สมชาย ใจดี" className={INPUT} onChange={clear} />
        </Field>
        <Field id="signup-phone" label="เบอร์มือถือ" hint="ใช้เป็นชื่อเข้าสู่ระบบ">
          <input id="signup-phone" name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="เช่น 081-234-5678" className={INPUT} onChange={clear} />
        </Field>
        <Field id="signup-pin" label="ตั้ง PIN 6 หลัก" hint="ห้ามเลขเรียงหรือเลขซ้ำ เช่น 123456, 000000">
          <PinInput id="signup-pin" name="pin" autoComplete="new-password" onChange={clear} />
        </Field>
        <Field id="signup-pin-again" label="ยืนยัน PIN">
          <PinInput id="signup-pin-again" name="pinAgain" autoComplete="new-password" onChange={clear} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-[var(--bot-navy)]" onChange={clear} />
          <span>ยอมรับ <Link href="/privacy" target="_blank" className="font-medium text-[var(--bot-navy)] underline underline-offset-2">นโยบายความเป็นส่วนตัว</Link></span>
        </label>
        {error && (
          <FormError>
            {error.error}
            {error.taken && <> — <Link href={login} className="font-medium underline">เข้าสู่ระบบ</Link></>}
          </FormError>
        )}
        <button disabled={pending} className={PRIMARY}>{pending ? "กำลังสมัคร…" : "สมัครและเข้าใช้งาน"}</button>
      </form>

      <p className="mt-4 text-center text-xs text-[var(--bot-ink-mute)]">จำ PIN ไว้ให้ดี ถ้าลืมต้องติดต่อแอดมินให้ตั้งใหม่</p>
      <p className="mt-4 text-center text-sm text-[var(--bot-ink-mute)]">
        มีบัญชีแล้ว? <Link href={login} className="font-medium text-[var(--bot-navy)] underline underline-offset-2">เข้าสู่ระบบ</Link>
      </p>
    </AuthCard>
  );
}
