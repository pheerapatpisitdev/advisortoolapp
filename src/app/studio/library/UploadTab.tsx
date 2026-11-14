"use client";
import { useRef, useState } from "react";
import { checkForm, sentView, submitUpload } from "@/lib/scene-library/upload-flow";
import { shrinkForUpload } from "@/lib/scene-library/shrink";
import { KIND_HINT, KIND_NAME, KIND_TELLS, NAME_MAX, NOTE_MAX, PER_PERSON, RIGHTS_LINE, type UploadKind, type UploadView } from "@/lib/scene-library/upload-rules";
import type { Sent } from "@/lib/scene-library/uploads";

/**
 * อัปโหลด (spec 2026-11-14-library-uploads-design.md, "The page"): pick a kind, the file with the kind's hint,
 * a name, a note, the rights box, send. The same checks the server makes are made first and the server's own
 * refusal is shown under the button. The page re-encodes the picture (part → PNG, the rest → JPEG) before it goes.
 */

const KINDS: UploadKind[] = ["part", "style", "ask"];
const field = "min-h-tap w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

interface Props {
  /** how many files this person has sent, for the cap */
  sent: number;
  owner: boolean;
  demo: boolean;
  send: (form: FormData) => Promise<Sent>;
  /** the new row, once the server has taken it */
  onSent: (row: UploadView) => void;
  /** the kind first shown (a test's start) */
  initialKind?: UploadKind;
}

export function UploadTab({ sent, owner, demo, send, onSent, initialKind = "part" }: Props) {
  const [kind, setKind] = useState<UploadKind>(initialKind);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [rights, setRights] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // a new key empties the file box (a file input cannot be set from here)
  const [fileKey, setFileKey] = useState(0);
  const sending = useRef(false);

  if (demo) {
    return <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">บัญชีทดลองอัปโหลดไม่ได้</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    setDone(false);
    const wrong = checkForm({ kind, name, note, rights, files: files.map((f) => ({ size: f.size, type: f.type })) }, { owner, sent });
    if (wrong) { setError(wrong); return; }
    sending.current = true;
    setBusy(true);
    setError(null);
    const r = await submitUpload({ send, shrink: shrinkForUpload }, { kind, name, note, rights, files }, { owner, sent });
    sending.current = false;
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const row = sentView({ kind, name, note, files: files.length }, r);
    setName(""); setNote(""); setRights(false); setFiles([]); setFileKey((k) => k + 1);
    setDone(true);
    onSent(row);
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4" noValidate>
      <div className="grid gap-1 text-sm">
        {owner
          ? <p className="text-[var(--ct-accent)]">ไฟล์ของเจ้าของเข้าคลังทันที ไม่ต้องรอตรวจ</p>
          : <p>คุณส่งแล้ว {sent} จาก {PER_PERSON} ไฟล์ ไฟล์ใช้ร่วมได้หลังเจ้าของอนุมัติ</p>}
      </div>

      <div role="group" aria-label="แบบที่จะส่ง" className="grid gap-2 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setFiles([]); setFileKey((n) => n + 1); setError(null); }}
            className={`grid min-h-tap content-start gap-1 rounded-xl border p-3 text-left ${kind === k ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)] bg-[var(--ct-panel)]"}`}
          >
            <span className="text-sm font-semibold">{KIND_NAME[k]}</span>
            <span className="text-xs text-[var(--ct-mute)]">{KIND_TELLS[k]}</span>
          </button>
        ))}
      </div>

      <label className="grid gap-1 text-sm">
        <span>{kind === "ask" ? "ภาพหน้าจอ (ถ้ามี)" : "ไฟล์ภาพ"}</span>
        <input
          key={fileKey} type="file" accept="image/png,image/jpeg,image/webp" multiple={kind === "ask"}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className={`${field} file:mr-3`}
        />
        <span className="text-xs text-[var(--ct-mute)]">{KIND_HINT[kind]}</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span>{kind === "ask" ? "อยากได้อะไร" : "ชื่อที่จะแสดงในคลัง"}</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-describedby="library-upload-name" className={field} />
        <span id="library-upload-name" className="text-xs text-[var(--ct-mute)]">{name.trim().length}/{NAME_MAX}</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span>{kind === "ask" ? "เล่าเพิ่ม หรือวางลิงก์ตัวอย่าง" : "ใช้กับฉากแบบไหน (ไม่บังคับ)"}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={field} />
        <span className="text-xs text-[var(--ct-mute)]">{note.trim().length}/{NOTE_MAX}</span>
      </label>

      {kind !== "ask" && (
        <label className="flex min-h-tap items-start gap-2 text-sm">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 size-5 shrink-0" />
          <span>{RIGHTS_LINE}</span>
        </label>
      )}

      <div className="grid gap-2">
        <button type="submit" disabled={busy} className="inline-flex min-h-tap items-center justify-center rounded-lg bg-[var(--ct-solid)] px-4 text-sm text-[var(--ct-solid-ink)] disabled:opacity-60">
          {busy ? "กำลังส่ง…" : kind === "ask" ? "ส่งคำขอ" : "ส่งเข้าคลัง"}
        </button>
        {error && <p role="alert" className="text-sm text-[var(--ct-alert)]">{error}</p>}
        {done && owner && <p role="status" className="text-sm text-[var(--ct-accent)]">ส่งแล้ว</p>}
      </div>
    </form>
  );
}
