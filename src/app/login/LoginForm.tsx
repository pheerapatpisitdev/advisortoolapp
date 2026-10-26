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

export function LoginForm({ next, signupOpen, error: googleError, notice = null, invitedBy = null, premium = false, signupHint = SIGNUP_HINT, prices = null }: {
  next: string; signupOpen: boolean; error: string | null;
  /** the line under the Google button for somebody new: the trial, from the back office (door.tsx) */
  signupHint?: string;
  /** ค่าบริการ, drawn under the card (owner, 2026-10-20); null when the settings cannot be read */
  prices?: React.ReactNode;
  /** why somebody was sent here, said above the tabs (door.tsx) */
  notice?: string | null;
  /** the first name of whoever sent the invitation link this visitor came through (src/lib/referrals) */
  invitedBy?: string | null;
  /** sent here as a basic agent of a room that keeps advisortool for Premium (door.tsx) */
  premium?: boolean;
}) {
  // the member tab is for people who can still sign up; while sign-up is off a visitor is
  // almost surely a UnitOS agent, so that tab opens first (both stay available). An invited
  // friend signs up with Google, so theirs is the member tab too
  const [tab, setTab] = useState<Tab>(!premium && (signupOpen || googleError || invitedBy) ? "member" : "unitos");
  const [error, setError] = useState<string>();
  // the code typed was a basic agent's: the Premium box takes the error's place
  const [locked, setLocked] = useState(false);
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
      {invitedBy && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-[var(--bot-sand-soft)] px-3 py-2.5 text-sm text-[var(--bot-sand-ink)]">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--bot-navy)] font-semibold text-[var(--bot-surface)]">
            {Array.from(invitedBy)[0]}
          </span>
          <p><b>คุณ{invitedBy}</b> ชวนคุณมาใช้ AdvisorTool<br />เครื่องคิดเบี้ย ถาม AI และ Studio ทำโพสต์</p>
        </div>
      )}
      {premium && <div className="mt-4"><PremiumOnly /></div>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-[var(--bot-band)] px-3 py-2 text-center text-sm text-[var(--bot-ink)]">{notice}</p>}
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
            <input
              id="login-code" name="code" inputMode="numeric" autoComplete="username" maxLength={6} autoFocus
              pattern="\d{6}" placeholder="••••••" onChange={clear}
              className={`${INPUT} tracking-[0.3em] tabular-nums placeholder:tracking-[0.2em]`}
            />
          </Field>
          {locked && !premium && <PremiumOnly />}
          {error && <FormError>{error}</FormError>}
          <button disabled={pending} className={PRIMARY}>{pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
        </form>
      )}
      {prices && (
        <a href="#prices" className="mt-5 block text-center text-sm font-semibold text-[var(--bot-navy)] underline-offset-2 hover:underline">ดูค่าบริการ ↓</a>
      )}
    </AuthCard>
  );
}
