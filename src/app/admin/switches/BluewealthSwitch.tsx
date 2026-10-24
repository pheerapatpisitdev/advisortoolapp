"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "../ui";
import { setBluewealthSwitch } from "./actions";

/**
 * Whether Bluewealth's agents may sign in (src/lib/auth/bluewealth.ts; owner, 2026-10-24). Closed,
 * they are answered as any closed room is, and their open sessions end at the next click.
 */
export function BluewealthSwitch({ open, connected }: { open: boolean; connected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function flip() {
    setBusy(true);
    setMsg(null);
    const res = await setBluewealthSwitch(!open).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: open ? "ปิดการเข้าใช้ของตัวแทน Bluewealth แล้ว" : "เปิดให้ตัวแทน Bluewealth เข้าใช้แล้ว" } : { ok: false, text: res.error });
    router.refresh();
  }

  return (
    <Card title="ตัวแทนห้อง Bluewealth" hint="เข้าด้วยรหัสตัวแทน 6 หลักที่หน้าแรก ได้สิทธิ์เหมือนตัวแทน UnitOS · ปิดแล้ว ตัวแทน Bluewealth เข้าใหม่ไม่ได้ และคนที่เข้าอยู่จะหลุดตอนกดครั้งถัดไป เห็นข้อความเดียวกับห้องที่ปิด">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mb-3 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"}`}>{msg.text}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={`ตัวแทนห้อง Bluewealth: ${open ? "เปิดอยู่ กดเพื่อปิด" : "ปิดอยู่ กดเพื่อเปิด"}`}
          disabled={busy}
          onClick={flip}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${open ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white" : "border-[var(--bot-line)] text-[var(--bot-ink)]"}`}
        >
          {open ? "เปิดอยู่" : "ปิดอยู่"}
        </button>
        {!connected && <span className="text-sm text-[var(--bot-red-ink)]">ยังไม่ได้ตั้งค่าการเชื่อมกับ Bluewealth บนเซิร์ฟเวอร์ ตัวแทน Bluewealth ยังเข้าไม่ได้</span>}
      </div>
    </Card>
  );
}
