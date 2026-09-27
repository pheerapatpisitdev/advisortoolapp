"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-center text-xl font-semibold">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-center text-sm text-[var(--bot-ink-mute)]">รหัสตัวแทน 6 หลัก — รหัสเดียวกับที่ใช้เข้า UnitOS</p>

        <form
          className="mt-6"
          action={(fd) => start(async () => {
            const res = await signIn(fd);
            if (res?.error) setError(res.error);
          })}
        >
          <input type="hidden" name="next" value={next} />
          <input
            name="code" inputMode="numeric" autoComplete="username" maxLength={6} autoFocus
            pattern="\d{6}" placeholder="••••••" aria-label="รหัสตัวแทน 6 หลัก"
            className="w-full rounded-md border px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums"
            onChange={() => setError(undefined)}
          />
          <button disabled={pending}
                  className="mt-4 w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>

        {error && <p role="alert" className="mt-3 text-center text-sm text-[var(--bot-red-ink)]">{error}</p>}
        <Link href="/" className="mt-6 block text-center text-sm text-[var(--bot-ink-mute)] underline">กลับไปหน้าแรก</Link>
      </div>
    </main>
  );
}
