"use client";
import { useState, useTransition, type FormEvent } from "react";
import { Field, FormError } from "@/components/auth/fields";
import { GoogleG } from "@/components/auth/google-button";
import { INPUT, MUTE, PRIMARY } from "@/components/auth/styles";
import { signOut } from "@/app/login/actions";
import { OFFICE_MAX } from "@/lib/auth/member";
import { saveSignup, type SignupResult } from "./actions";

const WRONG = "border-[var(--bot-red-ink)]";

/**
 * The three boxes of สมัครสมาชิก (owner, 2026-10-27, mockup 189doYqMskU9fUDbvfHbLU). The Gmail is
 * the Google account they just came in with, shown rather than typed: it is the one they sign in
 * with, so ใช้บัญชีอื่น signs out and lets them pick another at Google.
 */
export function SignupForm({ name, email, next, trial, button }: {
  name: string; email: string; next: string;
  /** the trial a new member starts with, said above the button; null for anybody else */
  trial: string | null;
  button: string;
}) {
  const [result, setResult] = useState<SignupResult>();
  const [pending, start] = useTransition();
  const clear = () => setResult(undefined);
  // onSubmit, not action=: React 19 resets a form after its action, which would wipe what was typed
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setResult(await saveSignup(String(fd.get("name") ?? ""), String(fd.get("office") ?? ""), next)));
  };
  const wrong = (f: "name" | "office") => result?.field === f;

  return (
    <div className="mt-6 space-y-4">
      <form method="post" className="space-y-4" onSubmit={submit}>
        <Field id="signup-name" label="ชื่อ - นามสกุล" hint={wrong("name") ? undefined : "ดึงจาก Google มาให้ แก้ได้"}>
          <input id="signup-name" name="name" defaultValue={name} maxLength={60} autoComplete="name" onChange={clear}
                 aria-invalid={wrong("name") || undefined} className={`${INPUT} ${wrong("name") ? WRONG : ""}`} />
        </Field>
        {wrong("name") && <FormError>{result?.error}</FormError>}
        <div>
          <p className="mb-1.5 block text-sm font-medium">Gmail สำหรับเข้าใช้งาน</p>
          <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[var(--bot-line)] bg-[var(--bot-band)] px-3.5 py-3">
            <GoogleG />
            <span className="min-w-0 flex-1 break-all text-base">{email}</span>
          </div>
          <p className={`mt-1 text-xs ${MUTE}`}>ครั้งต่อไปเข้าด้วยบัญชีนี้</p>
        </div>
        <Field id="signup-office" label="สำนักงาน">
          <input id="signup-office" name="office" maxLength={OFFICE_MAX} placeholder="เช่น กรุงไทย-แอกซ่า สาขาบางนา" onChange={clear}
                 autoFocus aria-invalid={wrong("office") || undefined} className={`${INPUT} ${wrong("office") ? WRONG : ""}`} />
        </Field>
        {result && !wrong("name") && <FormError>{result.error}</FormError>}
        {trial && (
          <p className="rounded-lg bg-[var(--bot-sand-soft)] px-3 py-2.5 text-sm text-[var(--bot-sand-ink)]">{trial}</p>
        )}
        <button disabled={pending} className={PRIMARY}>{pending ? "กำลังบันทึก…" : button}</button>
      </form>
      <form action={signOut} className="text-center">
        <button type="submit" className={`text-sm underline underline-offset-2 ${MUTE}`}>ใช้บัญชี Google อื่น</button>
      </form>
    </div>
  );
}
