"use client";
import { useEffect, useState } from "react";
import { isComputer, saveToComputer } from "../saveToComputer";

type State = "idle" | "working" | "again" | "saved" | "downloads" | "failed";

/**
 * "บันทึกวิดีโอ" (owner, 2026-10-11): on a phone or tablet it hands the file to the system share
 * sheet, where "บันทึกวิดีโอ" (iPhone / iPad) or Photos / Gallery (Android) puts it in the album —
 * the way CardButton hands over a card. A browser cannot write to the album by itself.
 *
 * On a computer it asks where to save (Save As, Chrome / Edge); a computer browser without that
 * window, or an old phone, gets the plain download the button always was. Some phones lose the tap while the file is fetched and refuse to open the
 * sheet: the file is kept, and a second tap — a fresh gesture — opens it.
 */
export function SaveVideoButton({ href, watch, filename, className }: { href: string; watch: string; filename: string; className: string }) {
  const [state, setState] = useState<State>("idle");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (state !== "saved" && state !== "downloads" && state !== "failed") return;
    const t = setTimeout(() => setState("idle"), state === "downloads" ? 4000 : 2500);
    return () => clearTimeout(t);
  }, [state]);

  const sheet = async (f: File): Promise<boolean> => {
    try {
      await navigator.share({ files: [f] });
      return true;
    } catch (e) {
      // closing the sheet is an answer, not a failure
      if (e instanceof DOMException && e.name === "AbortError") return true;
      return false;
    }
  };

  const save = async () => {
    if (isComputer()) {
      setState("working");
      try {
        const r = await saveToComputer(watch, filename, { description: "วิดีโอ MP4", mime: "video/mp4", ext: ".mp4" }, () => { window.location.href = href; });
        setState(r === "picked" ? "saved" : r === "downloads" ? "downloads" : "idle");
      } catch {
        setState("failed");
      }
      return;
    }
    // the second tap: the file is ready, so the sheet opens inside this gesture
    if (file) {
      const ok = await sheet(file);
      setState(ok ? "saved" : "failed");
      if (!ok) window.location.href = href;
      return;
    }
    setState("working");
    try {
      const res = await fetch(watch);
      if (!res.ok) throw new Error(String(res.status));
      const f = new File([await res.blob()], filename, { type: "video/mp4" });
      if (!navigator.canShare?.({ files: [f] })) {
        // no file sharing here: the download, as before
        window.location.href = href;
        setState("idle");
        return;
      }
      if (await sheet(f)) {
        setState("saved");
        return;
      }
      setFile(f);
      setState("again");
    } catch {
      window.location.href = href;
      setState("failed");
    }
  };

  const text = state === "working" ? "กำลังเตรียมไฟล์…"
    : state === "again" ? "แตะอีกครั้งเพื่อบันทึก"
      : state === "saved" ? (isComputer() ? "บันทึกแล้ว ✓" : "ส่งไปที่เครื่องแล้ว ✓")
        : state === "downloads" ? "บันทึกแล้ว · อยู่ในโฟลเดอร์ Downloads"
        : state === "failed" ? "บันทึกไม่สำเร็จ ลองอีกครั้ง"
          : "บันทึกวิดีโอ";
  return (
    <button type="button" onClick={save} disabled={state === "working"} className={className} aria-live="polite">{text}</button>
  );
}
