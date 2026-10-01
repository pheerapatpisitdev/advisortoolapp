"use client";
import { useRef, useState } from "react";
import { clipProblem } from "@/lib/content/clip";
import type { ContentItem } from "@/lib/content/store";
import { finishClipUpload, startClipUpload, transcribeClip } from "../clip";
import { readClipFile, uploadClip, uploadStatus } from "./upload";

const DROPPED = "การเชื่อมต่อหลุด ลองใหม่อีกครั้งนะครับ";
/** storage signs an upload for two hours; a little under, so a reused one cannot lapse mid-send */
const TOKEN_MS = 110 * 60_000;

/**
 * The last clip started and not yet kept: the piece it went on, and — while still good — the
 * path and token its bytes go to. Pressing again with the same file carries on there rather
 * than making another piece (a form press makes one) and starting the bytes over.
 */
interface Started {
  file: string;
  pieceId: string;
  /** absent once storage refused it: the next press asks for a new path, on the same piece */
  path?: string;
  token?: string;
  at: number;
  /** the bytes all arrived; only keeping them is left */
  sent?: boolean;
}

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/**
 * One clip from the phone to its piece: read, checked, uploaded straight to storage, kept,
 * then listened to. `onItem` hears the piece at each step, so the card shows it as it goes.
 * Whatever happens on the way — a refusal, a dropped connection, a server action that throws —
 * the hook ends not busy and with no bar, and says why in `note`; a piece already made stays,
 * and the next press with the same file goes on with it.
 */
export function useClipUpload(onItem: (item: ContentItem) => void) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // a second tap before the first render shows busy would send the file twice
  const sending = useRef(false);
  const last = useRef<Started | null>(null);

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

      // the same file again, for the same piece (or from the form, whose piece is the one made last time)
      const key = fileKey(file);
      const before = last.current;
      const again = before && before.file === key && (!target.pieceId || target.pieceId === before.pieceId) ? before : null;
      let run: Started;
      if (again?.path && again.token && Date.now() - again.at < TOKEN_MS) {
        run = again;
      } else {
        const started = await startClipUpload({ pieceId: again?.pieceId ?? target.pieceId, page: target.page, file: meta });
        if (!started.ok) {
          // the remembered piece may be gone (thrown away, deleted): the next press starts clean
          if (again) last.current = null;
          setNote(started.error);
          return null;
        }
        if (started.item) onItem(started.item);
        run = { file: key, pieceId: started.pieceId, path: started.path, token: started.token, at: Date.now() };
        last.current = run;
      }
      const path = run.path!;

      if (!run.sent) {
        try {
          await uploadClip({ file, path, token: run.token!, onProgress: setProgress });
          run.sent = true;
        } catch (e) {
          const status = uploadStatus(e);
          // storage said no (an expired token, a path already taken): the piece stays, the path does not
          if (status !== null && status >= 400 && status < 500) last.current = { file: key, pieceId: run.pieceId, at: run.at };
          setNote("อัปโหลดไม่สำเร็จ — เช็กสัญญาณเน็ตแล้วกดอัปโหลดอีกครั้ง ระบบจะต่อจากที่ค้างไว้");
          return null;
        }
      }
      setProgress(1);
      const kept = await finishClipUpload({ pieceId: run.pieceId, path, file: meta, brief: target.brief });
      if (!kept.ok) {
        // refused (the bytes did not all arrive, a clash with another save): the piece stays, the
        // file goes again to a new path; a piece no longer open to a clip is refused at the start
        last.current = { file: key, pieceId: run.pieceId, at: run.at };
        setNote(kept.error);
        return null;
      }
      last.current = null;
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
      // a server action that threw (the connection, a deploy mid-upload): the bar and the busy
      // state go; what was started is remembered, so the next press carries on with it
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
