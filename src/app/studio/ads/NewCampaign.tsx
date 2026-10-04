"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/content/poster";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "../ThemeSwatches";
import { errorNote, Note, type NoteState } from "../ui/editor-fields";
import { writeCount } from "@/lib/ads/ad-card";
import { createAdCampaign } from "./actions";
import { upTo, type AdRules } from "./rules";
import { chip, field, plain, solid } from "./styles";

/**
 * A new campaign on the Page the list is of: the plan it sells, a name if the owner wants one,
 * how many selling angles in how many tones, and the posters' colour. Made, it opens its room,
 * which starts writing the first ads by itself (?write=1).
 */
export function NewCampaign({ pageId, pageName, products, rules, onClose }: {
  pageId: string;
  pageName: string;
  products: { href: string; name: string }[];
  rules: AdRules;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [planHref, setPlanHref] = useState("");
  const [name, setName] = useState("");
  const [angles, setAngles] = useState(Math.min(2, rules.maxAngles));
  const [tones, setTones] = useState(Math.min(2, rules.maxTones));
  const [theme, setTheme] = useState<ThemeChoice>(AUTO_THEME);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<NoteState>(null);

  async function create() {
    if (!planHref || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await createAdCampaign({
        pageId, planHref, name: name.trim() || null, angles, tones,
        theme: theme === AUTO_THEME ? null : (theme as Theme),
      });
      if (!res.ok) { setNote(errorNote(res.error)); setBusy(false); return; }
      // busy stays on until the room opens: a second press would make a second campaign
      router.push(`/studio/ads/${res.id}?write=1`);
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง — ถ้าแคมเปญขึ้นในรายการแล้ว ไม่ต้องสร้างซ้ำ"));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-2xl border border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4 sm:p-5">
      <div>
        <h2 id={`${id}-title`} className="font-semibold">สร้างแคมเปญ</h2>
        <p className="mt-0.5 text-xs text-[var(--ct-mute)]">หนึ่งแคมเปญต่อหนึ่งแบบประกัน ของเพจ {pageName} · สร้างแล้วเริ่มเขียนแอดชุดแรกให้ทันที</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">แบบประกัน</span>
        <select value={planHref} onChange={(e) => setPlanHref(e.target.value)} disabled={busy} className={field}>
          <option value="">เลือกแบบประกัน…</option>
          {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">ชื่อแคมเปญ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ ใช้ชื่อแบบประกันแทน)</span></span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={busy} className={field} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div role="group" aria-labelledby={`${id}-angles`}>
          <span id={`${id}-angles`} className="mb-1.5 block text-sm font-medium">มุมขาย</span>
          <div className="flex flex-wrap gap-2">
            {upTo(rules.maxAngles).map((n) => (
              <button key={n} type="button" aria-pressed={angles === n} disabled={busy} onClick={() => setAngles(n)} className={chip(angles === n)}>{n}</button>
            ))}
          </div>
        </div>
        <div role="group" aria-labelledby={`${id}-tones`}>
          <span id={`${id}-tones`} className="mb-1.5 block text-sm font-medium">น้ำเสียงต่อมุม</span>
          <div className="flex flex-wrap gap-2">
            {upTo(rules.maxTones).map((n) => (
              <button key={n} type="button" aria-pressed={tones === n} disabled={busy} onClick={() => setTones(n)} className={chip(tones === n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์</span>
        <ThemeSwatches<ThemeChoice> value={theme} onChange={setTheme} allowAuto />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={create} disabled={busy || !planHref} className={solid}>
          {busy ? "กำลังสร้าง…" : `สร้างแล้วเขียนแอด ${writeCount(angles, tones)} แบบ`}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className={plain}>ยกเลิก</button>
      </div>
      <Note note={note} />
    </section>
  );
}
