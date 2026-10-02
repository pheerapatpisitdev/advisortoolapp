"use client";
import { useState, useTransition, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field, FormError } from "@/components/auth/fields";
import { INPUT, MUTE, PRIMARY } from "@/components/auth/styles";
import { signIn } from "./actions";

type Tab = "member" | "unitos";

/** who each tab is for, said under the tabs: a first visitor cannot tell from the names alone */
const FOR: Record<Tab, string> = {
  member: "เข้าด้วยบัญชี Google (Gmail) ของคุณ",
  unitos: "รหัสตัวแทน 6 หลัก — รหัสเดียวกับที่ใช้เข้า UnitOS",
};

/** Google's own look for its button: white, a grey edge, the four-colour G (their branding rules). */
const GOOGLE =
  "flex w-full items-center justify-center gap-3 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-sm font-medium text-[#3c4043] no-underline hover:bg-[#f8f9fa]";

function GoogleG() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * `error` is why Google sent somebody back (/login?error=…, src/lib/auth/google.ts); it opens
 * the member tab, where it is said.
 */
export function LoginForm({ next, signupOpen, error: googleError }: { next: string; signupOpen: boolean; error: string | null }) {
  // the member tab is for people who can still sign up; while sign-up is off a visitor is
  // almost surely a UnitOS agent, so that tab opens first (both stay available)
  const [tab, setTab] = useState<Tab>(signupOpen || googleError ? "member" : "unitos");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const clear = () => setError(undefined);
  // method="post": a submit before hydration must not put the code in the URL. onSubmit, not
  // action=: React 19 resets a form after its action, which would wipe what was typed
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
        <div className="mt-5 space-y-4">
          {googleError && <FormError>{googleError}</FormError>}
          <a href={`/auth/google?next=${encodeURIComponent(next)}`} className={GOOGLE}>
            <GoogleG />ดำเนินการต่อด้วย Google
          </a>
          {signupOpen && <p className={`text-center text-sm ${MUTE}`}>ยังไม่มีบัญชี? กดปุ่มเดียวกันนี้เพื่อสมัคร ฟรี 10 รอบ</p>}
        </div>
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
    </AuthCard>
  );
}
