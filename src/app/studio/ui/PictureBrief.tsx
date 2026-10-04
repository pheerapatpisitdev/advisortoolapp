"use client";
import { MAX_DIRECTION } from "@/lib/content/background";

/**
 * บรีฟภาพเพิ่มเติม: the owner's free direction for every picture of a round, on top of the fixed
 * rules. It was on แบบประกัน's form only; the owner asked for it on every form that draws
 * (2026-10-01). One brief, shared by the forms and remembered on this device, as the painter
 * and the person are.
 *
 * On รีวิวเคลม the papers are the poster's words, so a brief steers only the picture behind
 * them — drawBackground never has the model draw words over a claim's papers.
 */
export function PictureBrief({ value, onChange, papers = false, note }: {
  value: string;
  onChange: (next: string) => void;
  papers?: boolean;
  /** what the brief is used for, where it is not one round's (an Ads Studio campaign keeps its own) */
  note?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">บรีฟภาพเพิ่มเติม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} maxLength={MAX_DIRECTION} rows={3}
        placeholder="เช่น โทนอบอุ่นแบบภาพยนตร์ ครอบครัวในสวนตอนเย็น มุมกว้าง ไม่เอาภาพในโรงพยาบาล"
        className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]"
      />
      <span className="mt-1 block text-xs text-[var(--ct-mute)]">
        {note ?? (papers
          ? "ใช้กับภาพพื้นหลังหลังเอกสารทุกชิ้นในรอบนี้"
          : "ใช้กับภาพทุกชิ้นในรอบนี้ ถ้าใส่ AI วาดทั้งโปสเตอร์รวมตัวหนังสือ ต้องตรวจตัวสะกดและตัวเลขก่อนโพสต์")}
        {" · "}{value.length}/{MAX_DIRECTION}
      </span>
    </label>
  );
}
