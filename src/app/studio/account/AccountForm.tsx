"use client";
import { useState, useTransition, type FormEvent } from "react";
import { Field, FormError, PinInput } from "@/components/auth/fields";
import { INPUT, MUTE, PRIMARY, STUDIO_FIELDS } from "@/components/auth/styles";
import { changePin, renameMe, type Result } from "./actions";

function Note({ result, done }: { result?: Result; done: string }) {
  if (!result) return null;
  return result.ok
    ? <p role="status" className="text-sm text-[var(--bot-ok)]">{done}</p>
    : <FormError>{result.error}</FormError>;
}

const CARD = "space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";

export function AccountForm({ name, phone }: { name: string; phone: string }) {
  const [nameResult, setNameResult] = useState<Result>();
  const [pinResult, setPinResult] = useState<Result>();
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-md space-y-6" style={STUDIO_FIELDS}>
      <div>
        <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
        <p className={`mt-1 text-sm ${MUTE}`}>เบอร์ที่ใช้เข้าสู่ระบบ: <span className="tabular-nums">{phone}</span></p>
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

      <form method="post" className={CARD} onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // captured now: currentTarget is gone once the await returns
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const res = await changePin(String(fd.get("oldPin") ?? ""), String(fd.get("pin") ?? ""), String(fd.get("pinAgain") ?? ""));
          setPinResult(res);
          // the three boxes are emptied only when the PIN changed; after an error they keep what was typed
          if (res.ok) form.reset();
        });
      }}>
        <div>
          <p className="font-medium">เปลี่ยน PIN</p>
          <p className={`text-xs ${MUTE}`}>เครื่องอื่นที่เข้าไว้จะต้องเข้าสู่ระบบใหม่</p>
        </div>
        <Field id="account-old-pin" label="PIN เดิม">
          <PinInput id="account-old-pin" name="oldPin" autoComplete="current-password" onChange={() => setPinResult(undefined)} />
        </Field>
        <Field id="account-pin" label="PIN ใหม่" hint="ห้ามเลขเรียงหรือเลขซ้ำ เช่น 123456, 000000">
          <PinInput id="account-pin" name="pin" autoComplete="new-password" onChange={() => setPinResult(undefined)} />
        </Field>
        <Field id="account-pin-again" label="ยืนยัน PIN ใหม่">
          <PinInput id="account-pin-again" name="pinAgain" autoComplete="new-password" onChange={() => setPinResult(undefined)} />
        </Field>
        <Note result={pinResult} done="เปลี่ยน PIN แล้ว" />
        <button disabled={pending} className={PRIMARY}>เปลี่ยน PIN</button>
      </form>
    </div>
  );
}
