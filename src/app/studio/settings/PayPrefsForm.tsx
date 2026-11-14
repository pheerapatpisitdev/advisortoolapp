"use client";
import { useState, useTransition } from "react";
import { FormError } from "@/components/auth/fields";
import { MUTE } from "@/components/auth/styles";
import type { AgentPrefs } from "@/lib/pay-prefs";
import { saveMyPrefs, type Result } from "./actions";

const CARD = "space-y-1 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";

/** One switch: a checkbox drawn as a toggle, so a keyboard and a screen reader both have it. */
function Switch({ id, label, hint, checked, disabled, onChange }: {
  id: string; label: string; hint: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[var(--ct-hair)] py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium">{label}</label>
        <p className={`text-sm ${MUTE}`}>{hint}</p>
      </div>
      <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0">
        <input
          id={id} type="checkbox" role="switch" checked={checked} disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-[var(--ct-line)] transition-colors peer-checked:bg-[var(--bot-ok)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ct-accent)] peer-disabled:opacity-50 motion-reduce:transition-none" />
        <span aria-hidden className="pointer-events-none absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 motion-reduce:transition-none" />
      </span>
    </div>
  );
}

/** Saved the moment a switch moves, as the mockup showed; a failed save puts the switch back. */
export function PayPrefsForm({ initial, locked }: { initial: AgentPrefs; locked: boolean }) {
  const [prefs, setPrefs] = useState(initial);
  const [result, setResult] = useState<Result>();
  const [pending, start] = useTransition();

  const change = (next: AgentPrefs) => {
    const before = prefs;
    setPrefs(next);
    setResult(undefined);
    start(async () => {
      const r = await saveMyPrefs(next);
      if (!r.ok) setPrefs(before);
      setResult(r);
    });
  };

  return (
    <section className={CARD} aria-label="ตั้งค่าส่วนตัว">
      <div className="pb-3">
        <h2 className="font-semibold">การแสดงเบี้ยประกัน</h2>
        <p className={`mt-1 text-sm ${MUTE}`}>มีผลกับใบเสนอราคาที่คุณทำเท่านั้น ทั้งหน้าคำนวณ ข้อความคัดลอก รูป PDF และวิดีโอนำเสนอ ไม่กระทบผู้ใช้คนอื่น</p>
      </div>
      <Switch
        id="pref-monthly" label="แสดงเบี้ยรายเดือน" checked={prefs.monthly} disabled={locked || pending}
        hint="ปิดแล้วจะไม่เห็นเบี้ยรายเดือนและ “ชำระครั้งแรก 2 งวด” ตัวเลขหลักเปลี่ยนเป็นรายปี"
        onChange={(v) => change({ ...prefs, monthly: v })}
      />
      <Switch
        id="pref-semi" label="แสดงเบี้ยราย 6 เดือน" checked={prefs.semi} disabled={locked || pending}
        hint="ปิดทั้งสองอัน = เห็นเฉพาะเบี้ยรายปี"
        onChange={(v) => change({ ...prefs, semi: v })}
      />
      <div className="pb-1 pt-5">
        <h2 className="font-semibold">ตารางแบบประกัน</h2>
      </div>
      <Switch
        id="pref-pen" label="แสดงคำอธิบายในตาราง" checked={prefs.pen} disabled={locked || pending}
        hint="เส้นปีกกา ลูกศร วงกลมแดง และข้อความลายมือ เช่น “เบี้ยคงที่” “หยุดส่งเบี้ย” “เงินโตทุกปี” ปิดแล้วเหลือตารางตัวเลขล้วน (จุดคุ้มทุนยังอยู่)"
        onChange={(v) => change({ ...prefs, pen: v })}
      />
      <div className="pt-2 text-sm" role="status">
        {locked ? (
          <span className={MUTE}>บัญชีทดลองใช้ร่วมกันหลายคน จึงแสดงเบี้ยครบทุกงวดและคำอธิบายในตารางเสมอ</span>
        ) : result && !result.ok ? (
          <FormError>{result.error}</FormError>
        ) : (
          <span className="text-[var(--bot-ok)]">{pending ? "กำลังบันทึก…" : result ? "บันทึกแล้ว · ใช้ได้ทุกเครื่องที่เข้าสู่ระบบ" : "บันทึกอัตโนมัติ · ใช้ได้ทุกเครื่องที่เข้าสู่ระบบ"}</span>
        )}
      </div>
    </section>
  );
}
