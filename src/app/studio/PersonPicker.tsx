"use client";
import { useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { POSES, type PiecePerson } from "@/lib/content/people";

export interface PersonOption {
  id: string;
  name: string;
}

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3.5 py-1.5 text-sm disabled:opacity-50 ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;

/**
 * Who from the people library goes into the picture, and how they stand. None is the
 * default, and with nobody in the library the picker says where to add someone instead.
 *
 * The heading is the picker's own, with the way to the library at the end of its line: the
 * link used to take a row of its own between the heading and the list, underlined and longer
 * than either, so the one thing to choose read as the least of the three.
 */
export function PersonPicker({ people, value, onChange, disabled, confirmLeave }: {
  people: PersonOption[];
  value: PiecePerson | null;
  onChange: (next: PiecePerson | null) => void;
  /** the picture can no longer be redrawn here */
  disabled?: boolean;
  /** asked before the link to the library leaves the page; false stays */
  confirmLeave?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const toLibrary = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!confirmLeave || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (await confirmLeave()) router.push("/studio/people");
  };
  const heading = useId();
  const library = (label: string) => (
    <Link
      href="/studio/people" onClick={toLibrary} title="เพิ่ม แก้ไข หรือลบคนในคลัง"
      className="-mr-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 text-xs font-medium text-[var(--ct-accent)] hover:underline"
    >
      {label} <span aria-hidden="true">›</span>
    </Link>
  );
  const head = (
    <div className="flex items-center justify-between gap-2">
      <span id={heading} className="text-sm font-medium">ใส่บุคคลในภาพ</span>
      {/* the link keeps its full tap height but lends it to the gap, so the heading row stays a line */}
      {people.length > 0 && <span className="-my-3">{library("คลังบุคคล")}</span>}
    </div>
  );
  if (people.length === 0) {
    return (
      <div className="space-y-1.5">
        {head}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--ct-line)] pl-3 pr-2">
          <span className="text-sm text-[var(--ct-mute)]">ยังไม่มีใครในคลัง</span>
          {library("เพิ่มคน")}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {head}
      <select
        value={value?.id ?? ""}
        disabled={disabled}
        aria-labelledby={heading}
        onChange={(e) => onChange(e.target.value ? { id: e.target.value, pose: value?.pose ?? "auto" } : null)}
        className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm disabled:opacity-60"
      >
        <option value="">ไม่ใส่</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {value && (
        <div role="radiogroup" aria-label="ท่าทาง" className="flex flex-wrap gap-1.5">
          {POSES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={value.pose === p.id} disabled={disabled} onClick={() => onChange({ ...value, pose: p.id })} className={chip(value.pose === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
