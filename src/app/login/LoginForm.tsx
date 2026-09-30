"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { memberSignIn, signIn } from "./actions";

type Tab = "member" | "unitos";

export function LoginForm({ next, signupOpen, contactUrl }: { next: string; signupOpen: boolean; contactUrl: string | null }) {
  const [tab, setTab] = useState<Tab>("member");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = (action: (fd: FormData) => Promise<{ error: string } | undefined>) => (fd: FormData) =>
    start(async () => {
      const res = await action(fd);
      if (res?.error) setError(res.error);
    });
  const pick = (t: Tab) => {
    setTab(t);
    setError(undefined);
  };
  const tabClass = (t: Tab) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-medium ${tab === t ? "bg-[var(--bot-navy)] text-white" : "text-[var(--bot-ink-mute)]"}`;
  const pinClass = "w-full rounded-md border px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-center text-xl font-semibold">เข้าสู่ระบบ</h1>

        <div role="tablist" className="mt-4 flex gap-1 rounded-lg border p-1">
          <button type="button" role="tab" aria-selected={tab === "member"} className={tabClass("member")} onClick={() => pick("member")}>สมาชิกทั่วไป</button>
          <button type="button" role="tab" aria-selected={tab === "unitos"} className={tabClass("unitos")} onClick={() => pick("unitos")}>ตัวแทน UnitOS</button>
        </div>

        {tab === "member" ? (
          <form className="mt-5 space-y-3" action={submit(memberSignIn)}>
            <input type="hidden" name="next" value={next} />
            <input
              name="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder="เบอร์มือถือ"
              aria-label="เบอร์มือถือ" className="w-full rounded-md border px-4 py-3 text-base"
              onChange={() => setError(undefined)}
            />
            <input
              name="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6}
              pattern="\d{6}" placeholder="PIN 6 หลัก" aria-label="PIN 6 หลัก" className={pinClass}
              onChange={() => setError(undefined)}
            />
            <button disabled={pending}
                    className="w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        ) : (
          <form className="mt-5" action={submit(signIn)}>
            <p className="mb-3 text-center text-sm text-[var(--bot-ink-mute)]">รหัสตัวแทน 6 หลัก — รหัสเดียวกับที่ใช้เข้า UnitOS</p>
            <input type="hidden" name="next" value={next} />
            <input
              name="code" inputMode="numeric" autoComplete="username" maxLength={6} autoFocus
              pattern="\d{6}" placeholder="••••••" aria-label="รหัสตัวแทน 6 หลัก" className={pinClass}
              onChange={() => setError(undefined)}
            />
            <button disabled={pending}
                    className="mt-4 w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-3 text-center text-sm text-[var(--bot-red-ink)]">{error}</p>}

        {tab === "member" && (
          <div className="mt-5 space-y-2 text-center text-sm">
            {signupOpen && (
              <p>ยังไม่มีบัญชี? <Link href="/signup" className="font-medium text-[var(--bot-navy)] underline">สมัครใช้ Studio</Link></p>
            )}
            <p className="text-[var(--bot-ink-mute)]">
              ลืม PIN?{" "}
              {contactUrl
                ? <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="underline">ติดต่อแอดมิน</a>
                : "ติดต่อแอดมิน"}
            </p>
          </div>
        )}
        <Link href="/" className="mt-6 block text-center text-sm text-[var(--bot-ink-mute)] underline">กลับไปหน้าแรก</Link>
      </div>
    </main>
  );
}
