"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { XIcon } from "../ui/icons";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** an upload tray: a picture with an arrow rising out of it */
function UploadIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-7">
      <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M12 15V4.5M7.5 9 12 4.5 16.5 9" />
    </svg>
  );
}

/**
 * The photo chooser, in place of the browser's own "Choose Files — No file chosen": a tray
 * to tap or drop photos on, and the chosen ones shown as thumbnails with an × each, so what
 * is about to be sent is what is on screen. `limit` is how many more photos may be added.
 *
 * `minSide`: a photo whose short side is under it is marked เล็ก and said so — taken, not
 * refused, since a small photo is sometimes the only one there is. The people library asks
 * for it: a face drawn from a thumbnail comes out as somebody else.
 */
export function PhotoDrop({ files, onChange, limit, minSide }: { files: File[]; onChange: (f: File[]) => void; limit: number; minSide?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  // thumbnails for the chosen files, released when the choice changes
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function take(list: FileList | null) {
    const picked = [...(list ?? [])];
    const ok = picked.filter((f) => ACCEPT.includes(f.type));
    setRefused(ok.length < picked.length ? "บางรูปไม่ใช่ JPG, PNG หรือ WebP (รูป HEIC จากไอโฟน ให้แปลงเป็น JPG ก่อน)" : null);
    const next = [...files, ...ok].slice(0, Math.max(0, limit));
    if (files.length + ok.length > limit) setRefused(`เลือกได้อีก ${Math.max(0, limit)} รูปเท่านั้น`);
    onChange(next);
    if (input.current) input.current.value = "";
  }

  const full = files.length >= limit;

  // each photo's short side, measured once, when there is a floor to hold it to
  const [shortSide, setShortSide] = useState<Map<File, number>>(() => new Map());
  useEffect(() => {
    if (!minSide) return;
    let live = true;
    for (const f of files) {
      if (shortSide.has(f)) continue;
      createImageBitmap(f).then((b) => {
        const side = Math.min(b.width, b.height);
        b.close();
        if (live) setShortSide((m) => new Map(m).set(f, side));
      }).catch(() => { /* not measurable: no mark */ });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured per file; the map only grows
  }, [files, minSide]);
  const small = (f: File) => Boolean(minSide) && (shortSide.get(f) ?? Infinity) < minSide!;
  const smallCount = files.filter(small).length;

  return (
    <div className="space-y-2">
      <input
        ref={input} id={id} type="file" accept={ACCEPT.join(",")} multiple className="sr-only"
        onChange={(e) => take(e.target.files)} disabled={full}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); if (!full) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!full) take(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          full ? "cursor-not-allowed border-[var(--ct-hair)] opacity-60"
            : over ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]"
              : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:border-[var(--ct-solid)] hover:bg-[var(--ct-soft)] hover:text-[var(--ct-accent)]"
        }`}
      >
        <UploadIcon />
        <span className="text-sm font-medium">{full ? "ครบจำนวนแล้ว" : "แตะเพื่อเลือกรูป หรือลากรูปมาวางที่นี่"}</span>
        <span className="text-xs">JPG · PNG · WebP · เลือกได้อีก {Math.max(0, limit - files.length)} รูป</span>
      </label>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative size-20 overflow-hidden rounded-lg ring-1 ring-[var(--ct-hair)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file not yet sent */}
              <img src={previews[i]} alt="" className="size-full object-cover" />
              {small(f) && (
                <span className="absolute inset-x-0 bottom-0 bg-[var(--ct-warn-bg)] py-0.5 text-center text-[0.65rem] font-medium text-[var(--ct-warn-ink)]">รูปเล็ก</span>
              )}
              {/* a finger-sized press over a small drawn circle, so the photo stays visible */}
              <button
                type="button" aria-label="เอารูปนี้ออก" title="เอารูปนี้ออก"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="group absolute right-0 top-0 flex size-11 items-start justify-end p-1"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--ct-scrim)] text-[var(--ct-on-scrim)] group-hover:bg-[var(--ct-scrim-strong)]">
                  <XIcon className="size-4" />
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      {smallCount > 0 && (
        <p className="text-xs text-[var(--ct-warn-ink)]">
          {smallCount} รูปความละเอียดต่ำ (ด้านสั้นไม่ถึง {minSide}px) — AI อาจวาดหน้าไม่เหมือน ถ้ามีรูปที่ใหญ่กว่าให้ใช้รูปนั้นแทน
        </p>
      )}
      {refused && <p className="text-xs text-[var(--ct-alert)]">{refused}</p>}
    </div>
  );
}
