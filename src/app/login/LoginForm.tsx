"use client";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Field, FormError } from "@/components/auth/fields";
import { GOOGLE, GoogleG } from "@/components/auth/google-button";
import { INPUT, MUTE, PRIMARY } from "@/components/auth/styles";
import { SIGNUP_HINT } from "@/lib/pricing/front";
import { signIn } from "./actions";

type Tab = "member" | "unitos";

/** who each tab is for, said under the tabs: a first visitor cannot tell from the names alone */
const FOR: Record<Tab, string> = {
  member: "เข้าด้วยบัญชี Google (Gmail) ของคุณ",
  unitos: "รหัสตัวแทน 6 หลัก — รหัสเดียวกับที่ใช้เข้า UnitOS",
};

/**
 * `error` is why Google sent somebody back (/login?error=…, src/lib/auth/google.ts); it opens
 * the member tab, where it is said.
 */
/**
 * A basic agent of a room that keeps advisortool for Premium (owner, 2026-10-16): said in the
 * sand of the invitation box, not the red of a wrong code, since nothing was typed wrong.
 */
function PremiumOnly() {
  return (
    <div role="status" className="rounded-lg border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-3.5 py-3 text-sm text-[var(--bot-sand-ink)]">
      <p className="text-[15px] font-semibold text-[var(--bot-ink)]">advisortool สำหรับสมาชิก Premium ของทีม</p>
      <p className="mt-1">ตอนนี้บัญชีของคุณเป็นระดับธรรมดา ต่ออายุหรืออัปเกรดเป็น Premium ได้ในเว็บของทีม แล้วกลับมาเข้าใหม่ได้ทันที</p>
    </div>
  );
}

/** the eye beside the agent's code: open to show it, struck through (`off`) to hide it again */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.1" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export function LoginForm({ next, signupOpen, error: googleError, notice = null, premium = false, signupHint = SIGNUP_HINT, prices = null }: {
  next: string; signupOpen: boolean; error: string | null;
  /** the line under the Google button for somebody new: the trial, from the back office (door.tsx) */
  signupHint?: string;
  /** ค่าบริการ, drawn under the card (owner, 2026-10-20); null when the settings cannot be read */
  prices?: React.ReactNode;
  /** why somebody was sent here, said above the tabs (door.tsx) */
  notice?: string | null;
  /** sent here as a basic agent of a room that keeps advisortool for Premium (door.tsx) */
  premium?: boolean;
}) {
  // ตัวแทน UnitOS opens first (owner, 2026-11-11); the member tab only when Google sent somebody
  // back with a reason to read there. Both stay available
  const [tab, setTab] = useState<Tab>(!premium && googleError ? "member" : "unitos");
  const [error, setError] = useState<string>();
  // the code typed was a basic agent's: the Premium box takes the error's place
  const [locked, setLocked] = useState(false);
  // the agent's code shown as typed, after a tap on the eye
  const [shown, setShown] = useState(false);
  const [pending, start] = useTransition();
  const clear = () => {
    setError(undefined);
    setLocked(false);
  };
  // method="post": a submit before hydration must not put the code in the URL. onSubmit, not
  // action=: React 19 resets a form after its action, which would wipe what was typed
  const submit = (action: (fd: FormData) => Promise<{ error: string; premium?: true } | undefined>) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await action(fd);
      if (res?.premium) setLocked(true);
      else if (res?.error) setError(res.error);
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
    <AuthCard title="ยินดีต้อนรับสู่ advisortool" subtitle="ถาม AI ได้ไม่จำกัด · ใช้ Studio ช่วยเขียนคอนเทนต์" below={prices}>
      {premium && <div className="mt-4"><PremiumOnly /></div>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-[var(--bot-band)] px-3 py-2 text-center text-sm text-[var(--bot-ink)]">{notice}</p>}
      <div role="tablist" className="mt-6 flex gap-1 rounded-lg bg-[var(--bot-band)] p-1">
        <button type="button" role="tab" aria-selected={tab === "unitos"} className={tabClass("unitos")} onClick={() => pick("unitos")}>ตัวแทน UnitOS</button>
        <button type="button" role="tab" aria-selected={tab === "member"} className={tabClass("member")} onClick={() => pick("member")}>สมาชิกทั่วไป</button>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--bot-ink-mute)]">{FOR[tab]}</p>

      {tab === "member" ? (
        <div className="mt-5 space-y-4">
          {googleError && <FormError>{googleError}</FormError>}
          <a href={`/auth/google?next=${encodeURIComponent(next)}`} className={GOOGLE}>
            <GoogleG />ดำเนินการต่อด้วย Google
          </a>
          {signupOpen && <p className={`text-center text-sm ${MUTE}`}>{signupHint}</p>}
          <p className={`text-center text-xs ${MUTE}`}>
            การดำเนินการต่อถือว่ายอมรับ{" "}
            <Link href="/privacy" className="underline underline-offset-2">นโยบายความเป็นส่วนตัว</Link>
          </p>
        </div>
      ) : (
        <form method="post" className="mt-5 space-y-4" onSubmit={submit(signIn)}>
          <input type="hidden" name="next" value={next} />
          <Field id="login-code" label="รหัสตัวแทน 6 หลัก">
            {/* dots, not the digits, so a person beside them cannot read the code; the eye shows
                it to check a typo (owner chose ข, 2026-11-12). inputMode keeps the number pad */}
            <div className="relative">
              <input
                id="login-code" name="code" type={shown ? "text" : "password"} inputMode="numeric" autoComplete="current-password"
                maxLength={6} autoFocus pattern="\d{6}" placeholder="••••••" onChange={clear}
                className={`${INPUT} pr-12 tracking-[0.3em] tabular-nums placeholder:tracking-[0.2em]`}
              />
              <button
                type="button" onClick={() => setShown((s) => !s)}
                aria-label={shown ? "ซ่อนรหัส" : "แสดงรหัส"} aria-pressed={shown} aria-controls="login-code"
                className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-[var(--bot-ink-mute)] hover:bg-[var(--bot-band)] hover:text-[var(--bot-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bot-navy)]"
              >
                <EyeIcon off={shown} />
              </button>
            </div>
          </Field>
          {locked && !premium && <PremiumOnly />}
          {error && <FormError>{error}</FormError>}
          <button disabled={pending} className={PRIMARY}>{pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
        </form>
      )}
      {prices && (
        <a href="#prices" className="mt-5 block text-center text-sm font-semibold text-[var(--bot-navy)] underline-offset-2 hover:underline">ดูค่าบริการ ↓</a>
      )}
      {/* the how-to clips, for somebody who has not got in yet (owner chose 1ก, 2026-11-11) */}
      <Link href="/help" className="mt-3 block text-center text-sm font-semibold text-[var(--bot-navy)] underline-offset-2 hover:underline">ดูคลิปวิธีใช้งาน</Link>
    </AuthCard>
  );
}
