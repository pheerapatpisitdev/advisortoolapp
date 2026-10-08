"use client";
import Link from "next/link";
import { useState } from "react";
import { splitPrompt } from "@/lib/content/describe";
import { DescribePicker, type DescribeOk } from "../ui/DescribePicker";

/** The result as one card per heading, each with its own copy button, and one to copy the lot. */
export function DescribeBoard() {
  const [result, setResult] = useState<DescribeOk | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  const btn = "min-h-9 shrink-0 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)]";
  return (
    <div className="mt-5">
      <div className="flex justify-start"><DescribePicker onDone={(r) => { setResult(r); setCopied(null); setCopyFailed(false); }} /></div>
      {result && (
        <div className="mt-5">
          <p className="text-sm text-[var(--ct-mute)]">รูปนี้: {result.summaryTh} · ใช้ไป ฿{result.costThb.toFixed(2)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={btn} onClick={() => copy("all", result.prompt)}>{copied === "all" ? "ก๊อปแล้ว" : "ก๊อปทั้งหมด"}</button>
            <Link href="/studio/write" className={`${btn} inline-flex items-center`}>ใช้วาดรูป</Link>
            <span className="text-xs text-[var(--ct-mute)]">วางในช่องบรีฟภาพเพิ่มเติมของ Organic Studio</span>
          </div>
          {copyFailed && <p role="alert" className="mt-2 text-sm text-[var(--ct-alert)]">ก๊อปไม่ได้ เลือกข้อความแล้วคัดลอกเอง</p>}
          <ul className="mt-3 space-y-2">
            {splitPrompt(result.prompt).map(({ heading, text }) => (
              <li key={heading} className="flex items-start gap-3 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--ct-mute)]">{heading}</p>
                  <p className="mt-0.5 text-sm">{text}</p>
                </div>
                <button type="button" className={btn} onClick={() => copy(heading, `${heading}: ${text}`)}>{copied === heading ? "ก๊อปแล้ว" : "ก๊อป"}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
