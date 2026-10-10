"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { moveFhcCustomer, removeFhcCustomer } from "../actions";

/** LINE and copy for the saved check, deleting the customer, and — owner only — handing them to another agent. */

const BTN = "rounded-sm border py-3 text-sm";

export function CustomerActions({ id, name, message, owner }: { id: string; name: string; message: string; owner: boolean }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function line() {
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setNote("คัดลอกข้อความแล้ว");
    } catch {
      setNote("คัดลอกไม่สำเร็จ ใช้ปุ่มส่งไป LINE แทนนะครับ");
    }
  }
  async function remove() {
    setBusy(true);
    const r = await removeFhcCustomer(id).catch(() => ({ ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }));
    setBusy(false);
    if (r.ok) router.push("/fhc/customers");
    else setNote(r.error ?? "ลบไม่สำเร็จ");
  }
  async function move() {
    setBusy(true);
    const r = await moveFhcCustomer(id, code).catch(() => ({ ok: false, error: "ย้ายไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }));
    setBusy(false);
    if (r.ok) router.push("/fhc/customers?all=1");
    else setNote(r.error ?? "ย้ายไม่สำเร็จ");
  }

  return (
    <section className="space-y-3 print:hidden">
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={line} className={`${BTN} lg-metal-face border-[var(--lg-gold)] font-medium`}>ส่งไป LINE</button>
        <button type="button" onClick={copy} className={`${BTN} border-[var(--lg-gold)] text-[var(--lg-gold)]`}>คัดลอกข้อความ</button>
      </div>
      {note && <p role="status" className="text-center text-sm text-[var(--lg-gold)]">{note}</p>}

      {owner && (
        <div className="flex flex-wrap items-end gap-2 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4">
          <label className="grid flex-1 gap-1 text-xs text-[var(--lg-mute)]" htmlFor="fhc-move-code">
            ย้ายให้ตัวแทนรหัส 6 หลัก
            <input
              id="fhc-move-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2 text-base tabular-nums text-[var(--lg-white)]"
            />
          </label>
          <button
            type="button" onClick={move} disabled={busy || code.length !== 6}
            className="rounded-sm border border-[var(--lg-gold)] px-4 py-2.5 text-sm text-[var(--lg-gold)] disabled:opacity-50"
          >
            ย้าย
          </button>
        </div>
      )}

      {sure ? (
        <div className="space-y-2 rounded-sm border border-[var(--bot-red)] p-4 text-sm">
          <p className="text-[var(--lg-white)]">ลบ {name} ออกจากรายชื่อถาวร กู้คืนไม่ได้</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={remove} disabled={busy} className={`${BTN} border-[var(--bot-red)] text-[var(--bot-red)] disabled:opacity-50`}>ลบเลย</button>
            <button type="button" onClick={() => setSure(false)} className={`${BTN} border-[var(--lg-panel-line)] text-[var(--lg-mute)]`}>ไม่ลบ</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setSure(true)} className={`${BTN} w-full border-[var(--lg-panel-line)] text-[var(--lg-mute)]`}>
          ลบลูกค้าคนนี้
        </button>
      )}
    </section>
  );
}
