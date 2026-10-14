"use client";
import { useState } from "react";
import { disconnectAdAccount } from "./actions";
import { ActionError, useAction } from "../pages/useAction";

/** Asks twice in the page itself, for the reason DisconnectButton in messenger/ gives. */
export function DisconnectAdAccountButton({ actId }: { actId: string }) {
  const { pending, error, run } = useAction();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <div>
        <button type="button" onClick={() => setArmed(true)} className="rounded-md border border-[var(--bot-red)] px-3 py-1.5 text-sm text-[var(--bot-red-ink)] hover:bg-[var(--bot-red-soft)]">
          ตัดการเชื่อมต่อ
        </button>
        <ActionError error={error} />
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm text-[var(--bot-red-ink)]">
        ตัดแล้วหน้านี้จะหยุดดึงตัวเลขของบัญชีนี้ ตัวเลขที่ดึงไว้แล้วยังอยู่ และเชื่อมใหม่ได้ทุกเมื่อ
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => disconnectAdAccount(actId))} className="rounded-md bg-[var(--bot-red-ink)] px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {pending ? "กำลังตัด…" : "ยืนยันตัดการเชื่อมต่อ"}
        </button>
        <button type="button" disabled={pending} onClick={() => setArmed(false)} className="text-sm text-[var(--bot-ink-mute)] underline disabled:opacity-50">
          ไม่ตัดแล้ว
        </button>
      </div>
      <ActionError error={error} />
    </div>
  );
}
