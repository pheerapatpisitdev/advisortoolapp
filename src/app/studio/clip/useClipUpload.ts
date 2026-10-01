"use client";
import { useRef, useState } from "react";
import { clipProblem } from "@/lib/content/clip";
import type { ContentItem } from "@/lib/content/store";
import { finishClipUpload, startClipUpload, transcribeClip } from "../clip";
import { readClipFile, uploadClip } from "./upload";

const DROPPED = "การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ";

/**
 * One clip from the phone to its piece: read, checked, uploaded straight to storage, kept,
 * then listened to. `onItem` hears the piece at each step, so the card shows it as it goes.
 * Whatever happens on the way — a refusal, a dropped connection, a server action that throws —
 * the hook ends not busy and with no bar, and says why in `note`.
 */
export function useClipUpload(onItem: (item: ContentItem) => void) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // a second tap before the first render shows busy would send the file twice
  const sending = useRef(false);

  async function send(file: File, target: { pieceId?: string; page?: string; brief?: string }): Promise<ContentItem | null> {
    if (sending.current) return null;
    sending.current = true;
    setNote(null);
    setBusy(true);
    try {
      const meta = await readClipFile(file);
      const problem = clipProblem(meta);
      if (problem) { setNote(problem); return null; }
      setProgress(0);
      const started = await startClipUpload({ pieceId: target.pieceId, page: target.page, file: meta });
      if (!started.ok) { setNote(started.error); return null; }
      if (started.item) onItem(started.item);
      try {
        await uploadClip({ file, path: started.path, token: started.token, onProgress: setProgress });
      } catch {
        setNote("อัปโหลดไม่สำเร็จ — เช็กสัญญาณเน็ตแล้วกดอัปโหลดอีกครั้ง ระบบจะต่อจากที่ค้างไว้");
        return null;
      }
      setProgress(1);
      const kept = await finishClipUpload({ pieceId: started.pieceId, path: started.path, file: meta, brief: target.brief });
      if (!kept.ok) { setNote(kept.error); return null; }
      onItem(kept.item);
      setProgress(null);
      setNote("อัปโหลดแล้ว กำลังถอดเสียงและร่างแคปชัน…");
      const heard = await transcribeClip(kept.item.id).catch(() => null);
      if (!heard) { setNote("ถอดเสียงไม่สำเร็จ — กด “ถอดเสียงอีกครั้ง” ในหน้าแก้ไขได้"); return kept.item; }
      if (!heard.ok) { setNote(heard.error); return kept.item; }
      onItem(heard.item);
      setNote(null);
      return heard.item;
    } catch {
      // a server action that threw (the connection, a deploy mid-upload): nothing half-done stays on screen
      setNote(DROPPED);
      return null;
    } finally {
      sending.current = false;
      setBusy(false);
      setProgress(null);
    }
  }

  return { busy, progress, note, send };
}
