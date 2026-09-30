"use client";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field, FormError, PinInput } from "@/components/auth/fields";
import { INPUT, PRIMARY, SECONDARY } from "@/components/auth/styles";
import { memberSignIn, signIn } from "./actions";

type Tab = "member" | "unitos";

/** who each tab is for, said under the tabs: a first visitor cannot tell from the names alone */
const FOR: Record<Tab, string> = {
  member: "เข้าด้วยเบอร์มือถือและ PIN ที่ตั้งไว้ตอนสมัคร",
  unitos: "รหัสตัวแทน 6 หลัก — รหัสเดียวกับที่ใช้เข้า UnitOS",
};

export function LoginForm({ next, signupOpen, contactUrl }: { next: string; signupOpen: boolean; contactUrl: string | null }) {
  // the member tab is for people who can still sign up; while sign-up is off a visitor is
  // almost surely a UnitOS agent, so that tab opens first (both stay available)
  const [tab, setTab] = useState<Tab>(signupOpen ? "member" : "unitos");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const clear = () => setError(undefined);
  // every form here is method="post": a submit before hydration must not put the PIN in the URL
  // onSubmit, not action=: React 19 resets a form after its action, which would wipe the phone
  // after every wrong PIN
  const submit = (action: (fd: FormData) => Promise<{ error: string } | undefined>) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await action(fd);
      if (res?.error) setError(res.error);
    });
  };
  const pick = (t: Tab) => {
    setTab(t);
    clear();
  };
  const tabClass = (t: Tab) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      tab === t
        ? "bg-[var(--bot-surface)] text-[var(--bot-navy)] shadow-[0_1px_2px_rgba(21,24,29,0.15)]"
        : "text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink)]"
    }`;

  return (
    <AuthCard title="ยินดีต้อนรับสู่ advisortool" subtitle="ถาม AI ได้ไม่จำกัด · ใช้ Studio ช่วยเขียนคอนเทนต์">
      <div role="tablist" className="mt-6 flex gap-1 rounded-lg bg-[var(--bot-band)] p-1">
        <button type="button" role="tab" aria-selected={tab === "member"} className={tabClass("member")} onClick={() => pick("member")}>สมาชิกทั่วไป</button>
        <button type="button" role="tab" aria-selected={tab === "unitos"} className={tabClass("unitos")} onClick={() => pick("unitos")}>ตัวแทน UnitOS</button>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--bot-ink-mute)]">{FOR[tab]}</p>

      {tab === "member" ? (
        <form method="post" className="mt-5 space-y-4" onSubmit={submit(memberSignIn)}>
          <input type="hidden" name="next" value={next} />
          <Field id="login-phone" label="เบอร์มือถือ">
            <input
              id="login-phone" name="phone" type="tel" inputMode="tel" autoComplete="username" autoFocus
              placeholder="เช่น 081-234-5678" className={INPUT} onChange={clear}
            />
          </Field>
          <Field id="login-pin" label="PIN 6 หลัก">
            <PinInput id="login-pin" name="pin" autoComplete="current-password" onChange={clear} />
          </Field>
          {error && <FormError>{error}</FormError>}
          <button disabled={pending} className={PRIMARY}>{pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
        </form>
      ) : (
        <form method="post" className="mt-5 space-y-4" onSubmit={submit(signIn)}>
          <input type="hidden" name="next" value={next} />
          <Field id="login-code" label="รหัสตัวแทน 6 หลัก">
            <input
              id="login-code" name="code" inputMode="numeric" autoComplete="username" maxLength={6} autoFocus
              pattern="\d{6}" placeholder="••••••" onChange={clear}
              className={`${INPUT} tracking-[0.3em] tabular-nums placeholder:tracking-[0.2em]`}
            />
          </Field>
          {error && <FormError>{error}</FormError>}
          <button disabled={pending} className={PRIMARY}>{pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
        </form>
      )}

      {tab === "member" && contactUrl && (
        <p className="mt-3 text-center text-sm text-[var(--bot-ink-mute)]">
          ลืม PIN?{" "}
          <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--bot-navy)] underline underline-offset-2">ติดต่อแอดมิน</a>
        </p>
      )}

      {/* the way in for somebody new, as a button of its own: a small link under the form was
          easy to miss, and new members are who this page is now for */}
      {tab === "member" && signupOpen && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-[var(--bot-ink-mute)]">
            <span className="h-px flex-1 bg-[var(--bot-line)]" />ยังไม่มีบัญชี<span className="h-px flex-1 bg-[var(--bot-line)]" />
          </div>
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className={SECONDARY}>สมัครใหม่ ฟรี 10 รอบ</Link>
        </>
      )}
    </AuthCard>
  );
}
