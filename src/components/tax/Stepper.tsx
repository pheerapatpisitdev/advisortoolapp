'use client';

interface Props {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}

export function Stepper({ label, hint, value, onChange, max = 10 }: Props) {
  const btn =
    'grid h-10 w-10 place-items-center rounded-full border border-tx-line bg-tx-surface text-xl leading-none disabled:opacity-30';
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        {hint && <p className="text-sm text-tx-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" className={btn} aria-label={`ลด ${label}`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <span className="num w-6 text-center text-lg font-semibold" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} aria-label={`เพิ่ม ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
      </div>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-sm text-tx-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-tx-surface-2 ring-1 ring-tx-line transition peer-checked:bg-tx-accent peer-focus-visible:outline-2 peer-focus-visible:outline-tx-accent after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-tx-surface after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}
