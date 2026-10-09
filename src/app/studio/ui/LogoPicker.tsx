"use client";
import { useEffect, useId, useRef, useState } from "react";
import { LOGO_SPOT_ARROW, LOGO_SPOT_LABEL, LOGO_SPOTS, isLogoSpot, type LogoSpot } from "@/lib/content/logo";

/**
 * The Page's logo on the create forms (owner, 2026-09-29; src/lib/content/logo.ts): its
 * thumbnail with a way to upload or change it, and the spot it goes in — or ไม่ใส่. The spot is
 * remembered per browser; the logo is the Page's, kept on the server.
 */

const SPOT_KEY = "content-logo-spot";
/** the long side a logo is sent at: sharp at the size a poster draws it, and small to send */
const LONG_SIDE = 512;

/** the spot for new rounds, or null for ไม่ใส่; remembered per browser, off until chosen */
export function useLogoSpot(): [LogoSpot | null, (s: LogoSpot | null) => void] {
  const [spot, setSpotState] = useState<LogoSpot | null>(null);
  useEffect(() => {
    try {
      const kept = localStorage.getItem(SPOT_KEY);
      setSpotState(isLogoSpot(kept) ? kept : null);
    } catch { /* storage unavailable */ }
  }, []);
  const setSpot = (s: LogoSpot | null) => {
    setSpotState(s);
    try { localStorage.setItem(SPOT_KEY, s ?? ""); } catch { /* not kept */ }
  };
  return [spot, setSpot];
}

/** Shrunk in the browser to LONG_SIDE; a PNG or WebP stays PNG so its transparency is kept. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), type, 0.92));
}

export const logoUrl = (path: string) => `/api/content-logo?path=${encodeURIComponent(path)}`;

/** `page`: the Page the round is for; none for an agent's own logo. */
export function LogoPicker({ page, spot, onSpot }: { page?: string; spot: LogoSpot | null; onSpot: (s: LogoSpot | null) => void }) {
  const [path, setPath] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const heading = useId();

  useEffect(() => {
    let live = true;
    setPath(undefined);
    fetch(`/api/content-logo?page=${encodeURIComponent(page ?? "")}`)
      .then((r) => r.json())
      .then((res) => { if (live) setPath(res.ok ? res.path : null); })
      .catch(() => { if (live) setPath(null); });
    return () => { live = false; };
  }, [page]);

  async function upload(f: File | undefined) {
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      const small = await shrink(f);
      const form = new FormData();
      form.set("logo", small, small.type === "image/jpeg" ? "logo.jpg" : "logo.png");
      if (page) form.set("page", page);
      const res = await fetch("/api/content-logo", { method: "POST", body: form }).then((r) => r.json());
      if (!res.ok) return setError(res.error);
      setPath(res.path);
      // a first logo is wanted on the posters: put it somewhere rather than leave it off
      if (!spot) onSpot("tr");
    } catch {
      setError("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะครับ (รูป HEIC จากไอโฟน ให้แปลงเป็น PNG หรือ JPG ก่อน)");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const chip = (on: boolean) =>
    `flex min-h-tap min-w-11 items-center justify-center rounded-lg border px-2 text-sm disabled:opacity-40 ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)]"}`;

  return (
    <div role="group" aria-labelledby={heading} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span id={heading} className="text-sm font-medium">โลโก้{page ? "ของเพจนี้" : ""}</span>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        <button type="button" disabled={busy || path === undefined} onClick={() => file.current?.click()} className="inline-flex min-h-tap items-center text-xs font-medium text-[var(--ct-accent)] disabled:opacity-50">
          {busy ? "กำลังอัป…" : path ? "เปลี่ยนโลโก้" : "อัปโลโก้"}
        </button>
      </div>
      {path && (
        <div className="flex items-center gap-3">
          {/* the grid behind shows a transparent logo as transparent */}
          <span className="flex h-12 w-24 items-center justify-center rounded-md border border-[var(--ct-hair)] bg-[var(--ct-ground)] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private logo through our own route */}
            <img src={logoUrl(path)} alt="โลโก้" className="max-h-full max-w-full object-contain" />
          </span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="ตำแหน่งโลโก้">
            <button type="button" role="radio" aria-checked={spot === null} onClick={() => onSpot(null)} className={chip(spot === null)}>ไม่ใส่</button>
            {LOGO_SPOTS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={spot === s} aria-label={LOGO_SPOT_LABEL[s]} title={LOGO_SPOT_LABEL[s]} onClick={() => onSpot(s)} className={chip(spot === s)}>
                {LOGO_SPOT_ARROW[s]}
              </button>
            ))}
          </div>
        </div>
      )}
      {path === null && <p className="text-xs text-[var(--ct-mute)]">ยังไม่มีโลโก้ — อัปครั้งเดียว ทุกโปสเตอร์ของ{page ? "เพจนี้" : "คุณ"}ใส่ให้เอง (PNG พื้นใสดีที่สุด)</p>}
      {error && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-2 text-xs text-[var(--ct-alert)]">{error}</p>}
    </div>
  );
}
