"use client";
import { useState } from "react";
import { MAX_PHOTOS, MAX_REFERENCES } from "@/lib/content/people";
import type { Person } from "@/lib/content/people-store";
import { ask } from "../ask";
import { PhotoDrop } from "./PhotoDrop";

/** thumbnails on a person's row before the rest are counted */
const SHOWN = 4;

/** the long side a reference photo is sent at: plenty for a face, and ten fit one request */
const LONG_SIDE = 1024;

/** A photo shrunk in the browser to LONG_SIDE and re-encoded as JPEG, so an upload stays small. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.85));
}

const photoUrl = (path: string) => `/api/content-people/photo?path=${encodeURIComponent(path)}`;

export function PeopleBoard({ initial }: { initial: Person[] }) {
  const [people, setPeople] = useState(initial);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  /** an add or an edit being saved; one at a time, and every row's buttons wait for it */
  const [busy, setBusy] = useState(false);
  /** each error beside the thing it is about: the add form's in the form, an edit's in its card, a delete's in its row */
  const [addError, setAddError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  /** the people whose delete is under way */
  const [removing, setRemoving] = useState<Set<string>>(() => new Set());
  const [formKey, setFormKey] = useState(0);
  // the person being edited, and what is changing on them
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dropping, setDropping] = useState<string[]>([]);
  const [adding, setAdding] = useState<File[]>([]);

  function startEdit(p: Person) {
    setEditError(null);
    setRowError(null);
    setEditing(p.id); setEditName(p.name); setDropping([]); setAdding([]);
  }

  async function saveEdit(p: Person) {
    setEditError(null);
    const left = p.photos.length - dropping.length + adding.length;
    if (!editName.trim()) return setEditError("ตั้งชื่อก่อนนะครับ");
    if (left < 1) return setEditError("ต้องเหลือรูปอย่างน้อย 1 รูปนะครับ");
    if (left > MAX_PHOTOS) return setEditError(`มีรูปได้ไม่เกิน ${MAX_PHOTOS} รูปนะครับ`);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("id", p.id);
      form.set("name", editName.trim());
      for (const path of dropping) form.append("remove", path);
      for (const [i, f] of adding.entries()) form.append("photos", await shrink(f), `photo-${i}.jpg`);
      const res = await fetch("/api/content-people", { method: "PATCH", body: form }).then((r) => r.json());
      if (!res.ok) return setEditError(res.error);
      setPeople((list) => list.map((x) => (x.id === p.id ? res.person as Person : x)));
      setEditing(null);
    } catch {
      setEditError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ (รูป HEIC จากไอโฟน ให้แปลงเป็น JPG ก่อน)");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setAddError(null);
    if (!name.trim()) return setAddError("ตั้งชื่อก่อนนะครับ");
    if (files.length === 0) return setAddError("เลือกรูปอย่างน้อย 1 รูปนะครับ");
    if (files.length > MAX_PHOTOS) return setAddError(`เลือกได้ไม่เกิน ${MAX_PHOTOS} รูปนะครับ`);
    if (!consent) return setAddError("ต้องติ๊กยืนยันว่าได้รับความยินยอมจากเจ้าของรูปก่อนนะครับ");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("consent", "on");
      for (const [i, f] of files.entries()) form.append("photos", await shrink(f), `photo-${i}.jpg`);
      const res = await fetch("/api/content-people", { method: "POST", body: form }).then((r) => r.json());
      if (!res.ok) return setAddError(res.error);
      setPeople((list) => [...list, res.person as Person]);
      setName(""); setFiles([]); setConsent(false); setFormKey((k) => k + 1);
    } catch {
      setAddError("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะครับ (รูปบางแบบ เช่น HEIC จากไอโฟน ให้แปลงเป็น JPG ก่อน)");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Person) {
    if (removing.has(p.id)) return;
    // what was drawn with their face stays where it is: said before, not found out after
    const usage = await fetch(`/api/content-people?usage=${p.id}`).then((r) => r.json()).catch(() => null) as { ok: boolean; total: number; onPage: number } | null;
    const drawn = !usage?.ok
      ? "\n\nภาพโพสต์ที่วาดหน้าเขาไปแล้วจะยังอยู่ ลบแค่รูปต้นแบบในคลัง"
      : usage.total > 0
        ? `\n\nยังมีภาพที่วาดหน้าเขาอยู่ใน ${usage.total} ชิ้น${usage.onPage ? ` (ลงเพจหรือตั้งเวลาไว้ ${usage.onPage} ชิ้น)` : ""} — ลบจากคลังแล้วภาพเหล่านั้นยังอยู่ ต้องทิ้งหรือลบโพสต์เอง`
        : "";
    if (!(await ask(`ลบ "${p.name}" และรูปทั้งหมดออกจากระบบ? ลบแล้วกู้คืนไม่ได้${drawn}`, "ลบ"))) return;
    setRowError(null);
    setRemoving((r) => new Set(r).add(p.id));
    const res = await fetch(`/api/content-people?id=${p.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({ ok: false }));
    setRemoving((r) => { const n = new Set(r); n.delete(p.id); return n; });
    if (!res.ok) return setRowError({ id: p.id, text: "ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
    setPeople((list) => list.filter((x) => x.id !== p.id));
  }

  const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
  const alert = "rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-3 text-sm text-[var(--ct-alert)]";
  const btn = "inline-flex min-h-11 items-center rounded-lg px-4 text-sm disabled:opacity-50";

  return (
    <div className="space-y-6">

      <section className="space-y-3">
        {people.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">ยังไม่มีใครในคลัง — เพิ่มคนแรกด้านล่าง</p>
        ) : people.map((p) => editing === p.id ? (
          <article key={p.id} className="space-y-3 rounded-lg border border-[var(--ct-solid)] bg-[var(--ct-panel)] p-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">ชื่อ</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} className={field} />
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium">รูป — กดที่รูปเพื่อเอาออก</span>
              <div className="flex flex-wrap gap-2">
                {p.photos.map((path) => {
                  const out = dropping.includes(path);
                  return (
                    <button
                      key={path} type="button" aria-pressed={out} title={out ? "กดอีกครั้งเพื่อเก็บไว้" : "เอารูปนี้ออก"}
                      onClick={() => setDropping((d) => (out ? d.filter((x) => x !== path) : [...d, path]))}
                      className={`relative size-20 overflow-hidden rounded-md ${out ? "opacity-30 ring-2 ring-[var(--ct-alert)]" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a private photo through our own route */}
                      <img src={photoUrl(path)} alt="" className="size-full object-cover" />
                      {out && <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[var(--ct-alert)]">เอาออก</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">เพิ่มรูป (รวมแล้วไม่เกิน {MAX_PHOTOS} รูป)</span>
              <PhotoDrop files={adding} onChange={setAdding} limit={MAX_PHOTOS - (p.photos.length - dropping.length)} />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">
                หลังบันทึกจะมี {p.photos.length - dropping.length + adding.length} รูป
              </span>
            </div>
            {editError && <p role="alert" className={alert}>{editError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => saveEdit(p)} disabled={busy} className={`${btn} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </button>
              <button type="button" onClick={() => { setEditing(null); setEditError(null); }} disabled={busy} className={`${btn} border border-[var(--ct-line)]`}>ยกเลิก</button>
            </div>
          </article>
        ) : (
          <article key={p.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3">
            {/* four at most and a count of the rest: ten in a row ran off a phone's card and
                squeezed the name to a letter a line */}
            <div className="flex shrink-0 items-center gap-1.5">
              {p.photos.slice(0, SHOWN).map((path) => (
                // eslint-disable-next-line @next/next/no-img-element -- a private photo through our own route
                <img key={path} src={photoUrl(path)} alt="" className="size-14 rounded-md object-cover" />
              ))}
              {p.photos.length > SHOWN && (
                <span className="flex size-14 items-center justify-center rounded-md bg-[var(--ct-soft)] text-sm font-medium text-[var(--ct-accent)]">+{p.photos.length - SHOWN}</span>
              )}
            </div>
            <div className="min-w-32 flex-1">
              <p className="font-medium">{p.name}</p>
              {/* Thailand's date on the server too, or a consent before 07:00 renders a day apart */}
              <p className="text-xs text-[var(--ct-mute)]">{p.photos.length} รูป · ยืนยันความยินยอม {new Date(p.consentedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => startEdit(p)} disabled={busy || removing.has(p.id)} className={`${btn} border border-[var(--ct-line)] px-3`}>แก้ไข</button>
              <button type="button" onClick={() => remove(p)} disabled={busy || removing.has(p.id)} className={`${btn} border border-[var(--ct-line)] px-3 text-[var(--ct-alert)]`}>
                {removing.has(p.id) ? "กำลังลบ…" : "ลบ"}
              </button>
            </div>
            {rowError?.id === p.id && <p role="alert" className={`${alert} w-full`}>{rowError.text}</p>}
          </article>
        ))}
      </section>

      <section key={formKey} className="space-y-3 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
        <h2 className="font-semibold">เพิ่มบุคคล</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ชื่อ</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="ตัวผม" className={field} />
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium">รูปต้นแบบ (1–{MAX_PHOTOS} รูป)</span>
          <span className="mb-2 block text-xs text-[var(--ct-mute)]">AI วาดจากครั้งละ {MAX_REFERENCES} รูป — รูปแรกทุกครั้ง ที่เหลือสุ่มจากรูปอื่น</span>
          <PhotoDrop files={files} onChange={setFiles} limit={MAX_PHOTOS} />
        </div>
        <label className="flex min-h-11 items-start gap-3 py-1 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
          <span>ได้รับความยินยอมจากเจ้าของรูป ให้ใช้ในโฆษณาและให้ AI ดัดแปลงได้</span>
        </label>
        {addError && <p role="alert" className={alert}>{addError}</p>}
        <button type="button" onClick={save} disabled={busy} className={`${btn} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </section>
    </div>
  );
}
