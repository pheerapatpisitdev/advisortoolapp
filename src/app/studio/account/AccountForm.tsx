"use client";
import { useState, useTransition, type FormEvent } from "react";
import { Field, FormError } from "@/components/auth/fields";
import { INPUT, MUTE, PRIMARY, STUDIO_FIELDS } from "@/components/auth/styles";
import { renameMe, type Result } from "./actions";

function Note({ result, done }: { result?: Result; done: string }) {
  if (!result) return null;
  return result.ok
    ? <p role="status" className="text-sm text-[var(--bot-ok)]">{done}</p>
    : <FormError>{result.error}</FormError>;
}

const CARD = "space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [nameResult, setNameResult] = useState<Result>();
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      <div>
        <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
        <p className={`mt-1 text-sm ${MUTE}`}>เข้าสู่ระบบด้วยบัญชี Google: <span className="break-all">{email}</span></p>
      </div>

      <form method="post" className={CARD} onSubmit={(e: FormEvent<HTMLFormElement>) => {
        // onSubmit, not action=: React 19 resets a form after its action, which would put the
        // old name back in the box after a failed save
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setNameResult(await renameMe(String(fd.get("name") ?? ""))));
      }}>
        <Field id="account-name" label="ชื่อที่แสดง">
          <input id="account-name" name="name" defaultValue={name} maxLength={60} className={INPUT} onChange={() => setNameResult(undefined)} />
        </Field>
        <Note result={nameResult} done="บันทึกแล้ว" />
        <button disabled={pending} className={PRIMARY}>บันทึกชื่อ</button>
      </form>
    </div>
  );
}
