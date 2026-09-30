"use client";
import { useState, useTransition } from "react";
import { changePin, renameMe, type Result } from "./actions";

function Note({ result, done }: { result?: Result; done: string }) {
  if (!result) return null;
  return result.ok
    ? <p role="status" className="mt-2 text-sm text-[var(--bot-ok)]">{done}</p>
    : <p role="alert" className="mt-2 text-sm text-[var(--bot-red-ink)]">{result.error}</p>;
}

export function AccountForm({ name, phone }: { name: string; phone: string }) {
  const [nameResult, setNameResult] = useState<Result>();
  const [pinResult, setPinResult] = useState<Result>();
  const [pending, start] = useTransition();
  const field = "w-full rounded-md border px-3 py-2 text-base";
  const button = "mt-3 rounded-md bg-[var(--bot-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-xl font-semibold">บัญชีของฉัน</h1>
      <p className="text-sm text-[var(--bot-ink-mute)]">เบอร์ที่ใช้เข้าสู่ระบบ: <span className="tabular-nums">{phone}</span></p>

      <form className="rounded-lg border bg-white p-4" action={(fd) => start(async () => setNameResult(await renameMe(String(fd.get("name") ?? ""))))}>
        <label className="block text-sm font-medium" htmlFor="name">ชื่อที่แสดง</label>
        <input id="name" name="name" defaultValue={name} maxLength={60} className={`${field} mt-1`} />
        <button disabled={pending} className={button}>บันทึกชื่อ</button>
        <Note result={nameResult} done="บันทึกแล้ว" />
      </form>

      <form className="rounded-lg border bg-white p-4" action={(fd) => start(async () => {
        const res = await changePin(String(fd.get("oldPin") ?? ""), String(fd.get("pin") ?? ""), String(fd.get("pinAgain") ?? ""));
        setPinResult(res);
      })}>
        <p className="text-sm font-medium">เปลี่ยน PIN</p>
        <p className="text-xs text-[var(--bot-ink-mute)]">เครื่องอื่นที่เข้าไว้จะต้องเข้าสู่ระบบใหม่</p>
        {(["oldPin", "pin", "pinAgain"] as const).map((n) => (
          <input key={n} name={n} type="password" inputMode="numeric" maxLength={6} pattern="\d{6}"
                 autoComplete={n === "oldPin" ? "current-password" : "new-password"}
                 placeholder={n === "oldPin" ? "PIN เดิม" : n === "pin" ? "PIN ใหม่" : "PIN ใหม่อีกครั้ง"}
                 aria-label={n === "oldPin" ? "PIN เดิม" : n === "pin" ? "PIN ใหม่" : "PIN ใหม่อีกครั้ง"}
                 className={`${field} mt-2 tracking-[0.3em] tabular-nums`} />
        ))}
        <button disabled={pending} className={button}>เปลี่ยน PIN</button>
        <Note result={pinResult} done="เปลี่ยน PIN แล้ว" />
      </form>
    </div>
  );
}
