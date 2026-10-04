"use client";
import { useId } from "react";
import {
  addRow, canTick, DIMENSION_KEYS, DIMENSION_LABEL, DIMENSION_MAX, DIMENSION_NOTE_MAX, DIMENSION_TEXT_MAX, editRow,
  fromEdit, tickedCount, type DimensionKey, type EditDims,
} from "@/lib/ads/dimension-edit";
import { field } from "./styles";

/**
 * The four dimensions a campaign is written along — ฮุก, กลุ่มคน, มุมขาย, สไตล์ภาพ — as lists to
 * tick off, reword and add to. Each keeps at least one ticked; the hooks stop at twelve and the
 * others at five. Rows ticked off stay on screen to tick back. The wizard shows it open; the
 * room folds each list (`folded`) so the panel stays short.
 */

const HINT: Record<DimensionKey, string> = {
  hooks: "ประโยคเปิดที่หยุดนิ้วคนเลื่อนฟีด",
  personas: "คนที่แอดพูดด้วย",
  angles: "เหตุผลที่ควรซื้อ",
  styles: "ลักษณะภาพที่ AI วาด",
};

function List({ k, value, onChange, disabled, folded }: {
  k: DimensionKey;
  value: EditDims;
  onChange: (next: EditDims) => void;
  disabled: boolean;
  folded: boolean;
}) {
  const id = useId();
  const rows = value[k];
  const on = tickedCount(rows);
  const kept = fromEdit(value)[k].length;
  const more = canTick(value, k);
  return (
    <details open={!folded} className="group rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0">
          <span className="text-sm font-semibold">{DIMENSION_LABEL[k]}</span>
          <span className="ml-2 text-xs text-[var(--ct-mute)]">{HINT[k]}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 text-xs tabular-nums ${kept === 0 ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)]"}`}>
            {kept}/{DIMENSION_MAX[k]}
          </span>
          <span aria-hidden className="text-[var(--ct-mute)] transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="space-y-2 border-t border-[var(--ct-hair)] p-3">
        {kept === 0 && <p role="alert" className="text-xs font-medium text-[var(--ct-alert)]">ต้องติ๊กไว้อย่างน้อย 1 ข้อ</p>}
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className={`flex items-start gap-2 ${r.on ? "" : "opacity-60"}`}>
              <input
                type="checkbox" checked={r.on} disabled={disabled || (!r.on && !more)}
                aria-label={`ใช้${DIMENSION_LABEL[k]}ข้อ ${i + 1}`}
                onChange={(e) => onChange(editRow(value, k, r.id, { on: e.target.checked }))}
                className="mt-3 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  id={`${id}-${r.id}`} value={r.text} maxLength={DIMENSION_TEXT_MAX} disabled={disabled}
                  aria-label={`${DIMENSION_LABEL[k]}ข้อ ${i + 1}`} placeholder={`พิมพ์${DIMENSION_LABEL[k]}`}
                  onChange={(e) => onChange(editRow(value, k, r.id, { text: e.target.value }))}
                  className={field}
                />
                <input
                  value={r.note} maxLength={DIMENSION_NOTE_MAX} disabled={disabled}
                  aria-label={`คำอธิบาย${DIMENSION_LABEL[k]}ข้อ ${i + 1}`} placeholder="คำอธิบายสั้นๆ (ไม่ใส่ก็ได้)"
                  onChange={(e) => onChange(editRow(value, k, r.id, { note: e.target.value }))}
                  className="w-full rounded-md border border-transparent bg-transparent px-3 py-1 text-xs text-[var(--ct-mute)] outline-none hover:border-[var(--ct-hair)] focus:border-[var(--ct-accent)] disabled:opacity-50"
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button" disabled={disabled} onClick={() => onChange(addRow(value, k))}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50"
          >
            + เพิ่ม{DIMENSION_LABEL[k]}
          </button>
          {!more && <span className="text-xs text-[var(--ct-mute)]">ติ๊กได้สูงสุด {DIMENSION_MAX[k]} ข้อ (ติ๊กอยู่ {on})</span>}
        </div>
      </div>
    </details>
  );
}

export function DimensionsEditor({ value, onChange, disabled = false, folded = false }: {
  value: EditDims;
  onChange: (next: EditDims) => void;
  disabled?: boolean;
  /** start each list closed (the room's narrow panel) */
  folded?: boolean;
}) {
  return (
    <div className="space-y-2">
      {DIMENSION_KEYS.map((k) => <List key={k} k={k} value={value} onChange={onChange} disabled={disabled} folded={folded} />)}
    </div>
  );
}
