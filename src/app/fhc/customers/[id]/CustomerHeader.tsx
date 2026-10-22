"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { editFhcCustomer } from "../actions";

/**
 * The customer's name, contact and note, with แก้ไข to correct them in place (owner,
 * 2026-10-22, mockup J1QgqER7XRAXde4AyTeEkr). The check, its date and the consent are not
 * edited here; the figures change through แก้ข้อมูลแล้วตรวจใหม่ on /fhc.
 */

const INPUT = "rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2 text-base text-[var(--lg-white)]";
const BTN = "rounded-sm border py-2.5 text-sm disabled:opacity-60";

export function CustomerHeader({ id, name, contact, note, meta }: { id: string; name: string; contact: string; note: string; meta: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name, contact, note });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  function open() {
    setDraft({ name, contact, note });
    setError("");
    setSaved("");
    setEditing(true);
  }
  async function save() {
    if (!draft.name.trim()) { setError("ใส่ชื่อลูกค้าก่อนนะครับ"); return; }
    setBusy(true);
    setError("");
    const r = await editFhcCustomer(id, draft).catch(() => ({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }));
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "บันทึกไม่สำเร็จ"); return; }
    setEditing(false);
    setSaved(`บันทึกข้อมูลคุณ${draft.name.replace(/\s+/g, " ").trim()}แล้ว`);
    router.refresh();
  }

  return (
    <header className="pb-1 pt-8">
      <Link href="/fhc/customers" className="text-sm text-[var(--lg-mute)]">‹ ลูกค้า FHC ของฉัน</Link>
      {saved && (
        <p role="status" className="mt-3 rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] p-2.5 text-sm text-[var(--lg-white)] print:hidden">{saved}</p>
      )}
      {editing ? (
        <div className="mt-3 space-y-3 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-4 print:hidden">
          <label className="grid gap-1 text-sm text-[var(--lg-mute)]" htmlFor="fhc-edit-name">
            ชื่อลูกค้า
            <input id="fhc-edit-name" type="text" maxLength={100} className={INPUT} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--lg-mute)]" htmlFor="fhc-edit-contact">
            เบอร์โทร หรือ LINE (ไม่บังคับ)
            <input id="fhc-edit-contact" type="text" maxLength={100} className={INPUT} value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm text-[var(--lg-mute)]" htmlFor="fhc-edit-note">
            โน้ตของตัวแทน (ไม่บังคับ)
            <input id="fhc-edit-note" type="text" maxLength={300} className={INPUT} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </label>
          {error && <p role="alert" className="text-sm text-[var(--bot-red)]">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={save} disabled={busy} className={`${BTN} lg-metal-face border-[var(--lg-gold)] font-medium`}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy} className={`${BTN} border-[var(--lg-panel-line)] text-[var(--lg-mute)]`}>
              ยกเลิก
            </button>
          </div>
          <p className="text-sm tabular-nums text-[var(--lg-mute)]">{meta}</p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <h1 className="lg-figure text-3xl leading-tight text-[var(--lg-white)]">{name}</h1>
            <button
              type="button" onClick={open}
              className="rounded-sm border border-[var(--lg-gold)] px-4 py-1.5 text-sm text-[var(--lg-gold)] print:hidden"
            >
              แก้ไข
            </button>
          </div>
          <p className="mt-2 text-sm tabular-nums text-[var(--lg-mute)]">{meta}</p>
          {contact && <p className="mt-1 text-sm text-[var(--lg-white)]">{contact}</p>}
          {note && <p className="mt-1 text-sm text-[var(--lg-mute)]">โน้ต: {note}</p>}
        </>
      )}
    </header>
  );
}
