"use client";
import { useState, useTransition } from "react";
import { FormError } from "@/components/auth/fields";
import { INPUT, MUTE, PRIMARY, SECONDARY } from "@/components/auth/styles";
import { saveMyFormLink, type FormLinkView } from "./actions";

const CARD = "space-y-3 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";

/**
 * ลิงก์ฟอร์มใบคำขอของฉัน (owner chose ค ก ก, 2026-11-27, mockup https://claude.ai/artifact/7sJchDbGgkax2iM1ndUSwH):
 * the link the LINE OA sends this agent when they ask it for a form. A UnitClub agent sees their
 * UnitClub form filled in already (ค); anyone may type another in its place, and a blank box goes
 * back to the UnitClub one.
 */
export function FormLinkForm({ initial, locked }: { initial: FormLinkView | null; locked: boolean }) {
  const [view, setView] = useState(initial);
  const current = view?.own ?? view?.unitclub ?? "";
  const [text, setText] = useState(current);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = (value: string) => {
    setError(undefined);
    setSaved(false);
    start(async () => {
      const r = await saveMyFormLink(value);
      if (!r.ok) { setError(r.error); return; }
      setView(r.view);
      setText(r.view.own ?? r.view.unitclub ?? "");
      setSaved(true);
    });
  };

  const changed = text.trim() !== current;
  const source = view?.own
    ? "ลิงก์ที่คุณตั้งเอง"
    : view?.unitclub ? "ดึงจากเมนูใบคำขอใน UnitClub ให้อัตโนมัติ" : null;

  return (
    <section className={CARD} aria-label="ลิงก์ฟอร์มใบคำขอของฉัน">
      <div>
        <h2 className="font-semibold">ลิงก์ฟอร์มใบคำขอของฉัน</h2>
        <p className={`mt-1 text-sm ${MUTE}`}>
          เมื่อคุณพิมพ์ขอฟอร์มในแชท LINE advisortool บอทจะส่งลิงก์นี้ให้ ใบคำขอที่ลูกค้ากรอกจึงเข้าหาคุณ ใช้ได้เมื่อเชื่อม LINE ของฉันแล้ว
        </p>
      </div>
      {view === null && !locked ? (
        <FormError>อ่านลิงก์ไม่ได้ ลองเปิดหน้านี้ใหม่</FormError>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); if (!locked) save(text); }}
        >
          <label htmlFor="form-link" className="sr-only">ลิงก์ฟอร์มใบคำขอ</label>
          <input
            id="form-link" type="url" inputMode="url" autoComplete="off" spellCheck={false}
            className={`${INPUT} font-mono text-sm`} value={text} disabled={locked || pending}
            placeholder="https://ktaxa83g.com/apply/ชื่อของคุณ"
            onChange={(e) => { setText(e.target.value); setSaved(false); setError(undefined); }}
          />
          <p className={`text-sm ${MUTE}`} role="status">
            {locked
              ? "บัญชีทดลองใช้ร่วมกันหลายคน จึงตั้งลิงก์นี้ไม่ได้"
              : pending ? "กำลังบันทึก…"
              : saved ? `บันทึกแล้ว${source ? ` · ${source}` : " · ยังไม่มีลิงก์ บอทจะบอกวิธีตั้งเมื่อคุณขอฟอร์ม"}`
              : source ?? "ยังไม่มีลิงก์ วางลิงก์ฟอร์มใบคำขอของคุณแล้วกดบันทึก"}
          </p>
          {error && <FormError>{error}</FormError>}
          {!locked && (
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" className={PRIMARY} disabled={pending || !changed}>บันทึก</button>
              {current && !changed ? (
                <a href={current} target="_blank" rel="noreferrer" className={SECONDARY}>ลองเปิดลิงก์</a>
              ) : view?.own && view.unitclub ? (
                <button type="button" className={SECONDARY} disabled={pending} onClick={() => save("")}>ใช้ลิงก์จาก UnitClub</button>
              ) : (
                <button type="button" className={SECONDARY} disabled={pending || !changed} onClick={() => { setText(current); setError(undefined); }}>ยกเลิก</button>
              )}
            </div>
          )}
          {!locked && view?.own && view.unitclub && !changed && (
            <button type="button" className={`text-sm underline ${MUTE}`} disabled={pending} onClick={() => save("")}>
              กลับไปใช้ลิงก์จาก UnitClub
            </button>
          )}
        </form>
      )}
    </section>
  );
}
