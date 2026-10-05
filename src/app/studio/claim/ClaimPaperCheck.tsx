"use client";
import { useEffect, useRef, useState } from "react";
import type { Box } from "@/lib/content/claim";
import type { PosterSpec } from "@/lib/content/poster";
import type { ContentItem } from "@/lib/content/store";
import { AlertIcon, CheckIcon } from "../ui/icons";
import { burn } from "./redact";
import { RedactImage } from "./RedactImage";

interface Loaded {
  blob: Blob;
  src: string;
  width: number;
  height: number;
}

/**
 * รีวิวเคลม's one check, in the editor (owner, 2026-09-25: one press to create, as for a plan).
 * The AI laid the stickers; the owner looks at every paper on the poster as it will be posted,
 * drags more over anything it missed, and ticks ตรวจแล้ว once for all of them. Until then the
 * piece cannot go to a Page.
 *
 * `item`: only its id and papers are read, so the Ads room's piece can stand in for a content item.
 * `onPending`: told whether stickers have been laid and not yet saved, so leaving asks first
 */
export function ClaimPaperCheck({ item, onChecked, onPending }: { item: { id: string; output: { poster?: PosterSpec | null } }; onChecked: (item: ContentItem) => void; onPending?: (pending: boolean) => void }) {
  const docs = item.output.poster?.documents ?? [];
  const key = docs.map((d) => d.path).join("|");
  const [papers, setPapers] = useState<(Loaded | null)[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** the stickers the owner adds, per paper */
  const [boxes, setBoxes] = useState<Box[][]>([]);
  const [drawing, setDrawing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    const made: string[] = [];
    setPapers(null);
    setFailed(false);
    setBoxes(docs.map(() => []));
    Promise.all(docs.map(async (_, i): Promise<Loaded> => {
      const res = await fetch(`/api/content-claim/paper?id=${item.id}&i=${i}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      const src = URL.createObjectURL(blob);
      made.push(src);
      return { blob, src, ...size };
    }))
      .then((list) => { if (!gone) setPapers(list); })
      .catch(() => { if (!gone) setFailed(true); });
    return () => {
      gone = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the papers' paths
  }, [item.id, key]);

  const added = boxes.reduce((n, b) => n + b.length, 0);
  // stickers laid by hand live only here until ตรวจแล้ว: leaving dropped them without a word
  const tell = useRef(onPending);
  useEffect(() => { tell.current = onPending; });
  useEffect(() => { tell.current?.(added > 0); }, [added]);
  useEffect(() => () => tell.current?.(false), []);

  async function check() {
    if (!papers || saving) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("id", item.id);
      for (const [i, p] of papers.entries()) {
        if (!p || !boxes[i]?.length) continue;
        form.set(`paper-${i}`, await burn(p.blob, boxes[i]), `paper-${i}.jpg`);
        form.set(`ratio-${i}`, String(p.width / p.height));
      }
      const res = await fetch("/api/content-claim/paper", { method: "POST", body: form });
      const reply = await res.json() as { ok: true; item: ContentItem } | { ok: false; error: string };
      if (!reply.ok) { setError(reply.error); return; }
      onChecked(reply.item);
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
    } finally {
      setSaving(false);
    }
  }

  const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]"}`;

  return (
    <section aria-label="ตรวจรูปเอกสารเคลม" className="mt-4 space-y-3 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3">
      <p className="flex items-start gap-1.5 text-sm font-medium text-[var(--ct-warn-ink)]">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>ตรวจรูปเอกสาร{docs.length > 1 ? `ทั้ง ${docs.length} ใบ` : ""}ก่อนโพสต์ — AI แปะสติ๊กเกอร์ปิดชื่อและเลขให้แล้ว ดูว่าไม่เหลือชื่อ เลขบัตร เลขกรมธรรม์ หรือชื่อโรงพยาบาลที่ไม่อยากให้เห็น ถ้าเจอ กด “แปะสติ๊กเกอร์เพิ่ม” แล้วลากบนรูป</span>
      </p>
      {failed ? (
        <p role="alert" className="text-sm text-[var(--ct-alert)]">เปิดรูปเอกสารไม่ได้ ลองปิดแล้วเปิดชิ้นนี้ใหม่นะครับ</p>
      ) : !papers ? (
        <p className="text-sm text-[var(--ct-mute)]">กำลังโหลดรูปเอกสาร…</p>
      ) : (
        <>
          {papers.map((p, i) => p && (
            <div key={i} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {docs.length > 1 && <span className="text-sm font-medium">ใบที่ {i + 1}</span>}
                <button type="button" aria-pressed={drawing === i} onClick={() => setDrawing(drawing === i ? null : i)} className={chip(drawing === i)}>
                  {drawing === i ? "ลากบนรูปเพื่อแปะ · แตะเพื่อหยุด" : "แปะสติ๊กเกอร์เพิ่ม"}
                </button>
                {/* always there, so the paper does not jump when the first sticker lands */}
                <span className="text-sm text-[var(--ct-mute)]">
                  {boxes[i]?.length ? `เพิ่มใหม่ ${boxes[i].length} จุด · แตะสติ๊กเกอร์ใหม่เพื่อเอาออก` : "สติ๊กเกอร์ที่ AI แปะไว้แล้วเอาออกไม่ได้"}
                </span>
              </div>
              <div className="mx-auto max-w-md">
                <RedactImage
                  src={p.src} width={p.width} height={p.height} boxes={boxes[i] ?? []} drawing={drawing === i}
                  onChange={(b) => setBoxes((all) => all.map((x, j) => (j === i ? b : x)))}
                  alt={`รูปเอกสารเคลมใบที่ ${i + 1} ที่จะขึ้นโปสเตอร์`}
                />
              </div>
            </div>
          ))}
          <button
            type="button" onClick={check} disabled={saving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ct-solid)] px-4 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
          >
            <CheckIcon className="size-4" />
            {saving ? "กำลังบันทึก…" : added ? `แปะ ${added} จุดแล้วกดตรวจแล้ว` : "ตรวจแล้ว ไม่เห็นชื่อหรือเลขใดๆ"}
          </button>
          {error && <p role="alert" className="text-sm text-[var(--ct-alert)]">{error}</p>}
        </>
      )}
    </section>
  );
}
