"use client";
import { useState } from "react";
import { redrawPromptPicture } from "./actions";

/**
 * วาดฉาก N ใหม่ (owner's mockup, 2026-10-16): under a finished คลิปตามโจทย์, one button a scene.
 * The clip goes back to "กำลังสร้าง" once the picture is taken; the voice is not asked again.
 */
export function RedrawScenes({ id, scenes, price, onStarted }: {
  id: string;
  scenes: number;
  /** a picture's price in baht, "1"; null where it is free */
  price: string | null;
  /** asks the list again, so the clip shows as being made */
  onStarted: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redraw(scene: number) {
    setBusy(scene);
    setError(null);
    try {
      const r = await redrawPromptPicture(id, scene);
      if (!r.ok) setError(r.error);
      onStarted();
    } catch {
      setError("ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium">ไม่ถูกใจรูปไหน วาดใหม่เฉพาะฉากนั้น ({price ? `฿${price} ต่อรูป` : "ไม่เสียเงิน"} ไม่ต้องพากย์ใหม่)</span>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: scenes }, (_, i) => (
          <button
            key={i} type="button" disabled={busy !== null} onClick={() => redraw(i)}
            className="min-h-9 rounded-lg border border-[var(--ct-accent)] px-2.5 text-xs text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50"
          >
            {busy === i ? "กำลังเริ่ม…" : `วาดฉาก ${i + 1} ใหม่`}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{error}</p>}
      <p className="text-xs text-[var(--ct-mute)]">ถ้าตัดคลิปใหม่ไม่สำเร็จ ไม่คิดเงินค่ารูป และคลิปเดิมยังอยู่</p>
    </div>
  );
}
