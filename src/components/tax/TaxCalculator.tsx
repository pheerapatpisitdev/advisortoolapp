"use client";
import { useState } from "react";
import Link from "next/link";
import { clipLength, helpClip } from "@/lib/help/clips";
import { loadState, saveState } from "@/lib/tax/storage";
import { useHydrated } from "@/lib/tax/useHydrated";
import { CompanyTab } from "./CompanyTab";
import { CompareTab } from "./CompareTab";
import { Guide } from "./Guide";
import { PersonalTab } from "./PersonalTab";

/**
 * คำนวณภาษี 2569: the four pages of the stand-alone tax app in one, in that app's own look
 * (owner, 2026-11-15, ก on mockup https://claude.ai/artifact/LxPPda9hhH7jKNkpgvRavL — the
 * first round redrew them in the calculators' look and the owner asked for the original back).
 * Everything typed stays in this browser, so the modes are drawn only once it can be read.
 */
const MODES = [
  { id: "personal", label: "บุคคล" },
  { id: "company", label: "บริษัท" },
  { id: "compare", label: "เทียบ" },
  { id: "guide", label: "คู่มือ" },
] as const;
type ModeId = (typeof MODES)[number]["id"];
const MODE_KEY = "tax-2569-tab";

export function TaxCalculator() {
  return useHydrated() ? <Modes /> : <div className="h-96" aria-busy="true" />;
}

function Modes() {
  const [mode, setMode] = useState<ModeId>(() => {
    const saved = loadState<string>(MODE_KEY, "personal");
    return MODES.some((m) => m.id === saved) ? (saved as ModeId) : "personal";
  });
  const pick = (id: ModeId) => { setMode(id); saveState(MODE_KEY, id); window.scrollTo({ top: 0 }); };

  return (
    <>
      <nav aria-label="โหมดคำนวณ" className="mb-5 flex items-center gap-1">
        <span className="mr-auto flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-tx-accent text-sm text-tx-accent-ink">฿</span>
          {/* the phone's row has four modes to fit beside the badge */}
          <span className="max-[24rem]:sr-only">คิดภาษี 69</span>
        </span>
        {MODES.map((m) => (
          <button
            key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => pick(m.id)}
            className={`rounded-lg px-2.5 py-1.5 text-sm ${mode === m.id ? "bg-tx-surface-2 font-semibold text-tx-ink" : "text-tx-muted hover:bg-tx-surface-2 hover:text-tx-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </nav>
      {/* the how-to clip (owner, 2026-11-15, ก on question 3) */}
      <Link href="/help#tax" className="-mt-2 mb-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-tx-accent underline-offset-2 hover:underline">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-2 5.2 6 3.8-6 3.8z" /></svg>
        ดูวิธีใช้ ({clipLength(helpClip("tax")?.seconds ?? 0)} นาที)
      </Link>
      {mode === "personal" && <PersonalTab />}
      {mode === "company" && <CompanyTab />}
      {mode === "compare" && <CompareTab />}
      {mode === "guide" && <Guide />}
    </>
  );
}
