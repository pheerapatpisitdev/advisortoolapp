"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FX_MODE_LABEL, FX_MODES, type FxMode } from "@/lib/quote-video/fx-mode";
import { Card } from "../ui";
import { setFxSwitch } from "./actions";

/**
 * ลูกเล่นคลิปใหม่ (src/lib/quote-video/fx.ts): who gets the music, the sound effects and the moving icons on the clips
 * they make — the owner alone first (owner chose ก, 2026-10-20), everyone once the owner has seen it, or nobody.
 */
export function FxSwitch({ mode }: { mode: FxMode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(next: FxMode) {
    if (next === mode) return;
    setBusy(true);
    setMsg(null);
    const res = await setFxSwitch(next).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: `ลูกเล่นคลิปใหม่: ${FX_MODE_LABEL[next]}` } : { ok: false, text: res.error });
    router.refresh();
  }

  return (
    <Card title="ลูกเล่นคลิปใหม่" hint="เพลงพื้นหลัง เสียงประกอบ หัวข้อเบลอแล้วชัด เปลี่ยนฉากแบบปาด และไอคอนขยับ ในคลิปวิดีโอนำเสนอ สรุป FHC และคลิปเล่าเรื่อง · มีผลกับคลิปที่สร้างหลังเปลี่ยน คลิปเก่าไม่เปลี่ยน · ราคาคลิปเท่าเดิม">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mb-3 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]" : "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]"}`}>{msg.text}</p>
      )}
      <div role="radiogroup" aria-label="ใครได้ลูกเล่นคลิปใหม่" className="flex flex-wrap gap-2">
        {FX_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={m === mode}
            disabled={busy}
            onClick={() => pick(m)}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${m === mode ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white" : "border-[var(--bot-line)] text-[var(--bot-ink)]"}`}
          >
            {FX_MODE_LABEL[m]}
          </button>
        ))}
      </div>
    </Card>
  );
}
