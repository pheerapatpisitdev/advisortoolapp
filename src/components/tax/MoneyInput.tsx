'use client';

import { useId, useState } from 'react';
import { formatMoney, parseMoney } from '@/lib/tax/money';

interface Props {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  children?: React.ReactNode;
}

export function MoneyInput({ label, hint, value, onChange, suffix = 'บาท', children }: Props) {
  const id = useId();
  // ระหว่างพิมพ์ใช้ข้อความที่ผู้ใช้พิมพ์ (draft) เมื่อไม่ได้พิมพ์แสดงค่าจริงจัดคอมมาแล้ว
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ? formatMoney(value) : '');

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[15px] font-medium">
        {label}
      </label>
      {hint && <p className="text-sm text-tx-muted">{hint}</p>}
      <div className="flex items-center rounded-xl border border-tx-line bg-tx-surface focus-within:border-tx-accent">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          className="num w-full min-w-0 bg-transparent px-3.5 py-3 text-lg outline-none"
          value={shown}
          onFocus={() => setDraft(value ? formatMoney(value) : '')}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(parseMoney(e.target.value));
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="pr-3.5 text-sm text-tx-muted">{suffix}</span>
      </div>
      {children}
    </div>
  );
}
