"use client";
import { useState, useTransition, type ReactNode } from "react";
import { FormError } from "@/components/auth/fields";
import { MUTE } from "@/components/auth/styles";
import type { SharePlan } from "@/lib/share-text/plans";
import { DRAFT_MAX, SLOT } from "@/lib/share-text/template";
import { arrangeMyShareText, putMyShareTextToUse } from "./share-actions";

const CARD = "space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const BOX = "whitespace-pre-wrap break-words rounded-lg border border-[var(--ct-hair)] p-3 text-sm leading-relaxed";
const BTN = "rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
const MAIN = `${BTN} bg-[var(--ct-accent)] text-white`;
const QUIET = `${BTN} border border-[var(--ct-hair)]`;
const NOTE = "rounded-lg bg-[color-mix(in_srgb,var(--ct-accent)_12%,transparent)] p-3 text-sm";

export interface SharePlanView {
  key: SharePlan;
  name: string;
  /** who the example quote is */
  who: string;
  /** the system's own text for the example */
  standard: string;
}

export interface ShareTextView {
  draft: string;
  template: string;
  removed: { text: string; why: string }[];
  own: string[];
  /** the latest arrangement with the example's figures */
  preview: string;
  /** the template the pages send now; null = the standard text */
  live: string | null;
}

/** The template with each slot drawn as a chip, so a member sees where the system writes. */
function Chips({ template }: { template: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of template.matchAll(SLOT)) {
    parts.push(template.slice(last, m.index));
    parts.push(
      <span key={m.index} className="rounded bg-[color-mix(in_srgb,var(--ct-accent)_18%,transparent)] px-1 text-[0.85em] font-medium">{m[1]}</span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(template.slice(last));
  return <div className={BOX}>{parts}</div>;
}

/**
 * ข้อความส่งให้ลูกค้า (owner, 2026-11-14, ง on mockup https://claude.ai/artifact/6v1b98UZnP7jpCa6AL6opV):
 * draft, let the AI arrange, check the example, save. One plan at a time; a plan with nothing
 * saved keeps the standard text.
 */
export function ShareTextForm({ plans, initial, left: leftAtFirst, locked }: {
  plans: SharePlanView[];
  initial: Partial<Record<SharePlan, ShareTextView>>;
  left: number;
  locked: boolean;
}) {
  const [plan, setPlan] = useState<SharePlan>(plans[0].key);
  const [texts, setTexts] = useState(initial);
  const [drafts, setDrafts] = useState<Partial<Record<SharePlan, string>>>(
    () => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v.draft])),
  );
  const [left, setLeft] = useState(leftAtFirst);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [pending, start] = useTransition();

  const view = plans.find((p) => p.key === plan)!;
  const text = texts[plan];
  const draft = drafts[plan] ?? "";
  // the arrangement on screen is the one in use
  const inUse = Boolean(text?.live) && text?.live === text?.template;

  const arrange = () => {
    setError(undefined);
    setSaved(undefined);
    start(async () => {
      const r = await arrangeMyShareText(plan, draft);
      if (r.left !== undefined) setLeft(r.left);
      if (!r.ok) return setError(r.error);
      setTexts((all) => ({ ...all, [plan]: { ...r.arranged, draft, preview: r.preview, live: all[plan]?.live ?? null } }));
    });
  };
  const use = (on: boolean) => {
    setError(undefined);
    setSaved(undefined);
    start(async () => {
      const r = await putMyShareTextToUse(plan, on);
      if (!r.ok) return setError(r.error);
      setTexts((all) => (all[plan] ? { ...all, [plan]: { ...all[plan]!, live: r.live } } : all));
      setSaved(on ? "บันทึกแล้ว · หน้าคำนวณของคุณจะส่งข้อความนี้" : "กลับไปใช้ข้อความมาตรฐานแล้ว");
    });
  };

  return (
    <section className={CARD} aria-label="ข้อความส่งให้ลูกค้า">
      <div>
        <h2 className="font-semibold">ข้อความส่งให้ลูกค้า</h2>
        <p className={`mt-1 text-sm ${MUTE}`}>
          เขียนข้อความตามสไตล์ของคุณ แล้วให้ AI จัดเรียง ระบบจะเติมตัวเลขจริงของแต่ละใบเสนอราคาให้เองทุกครั้งที่กด “ส่งให้ลูกค้า” หรือ “คัดลอก” ในหน้าคำนวณ มีผลกับคุณคนเดียว
        </p>
      </div>

      <div className="grid gap-1">
        <label htmlFor="share-plan" className="text-sm font-medium">แบบประกัน</label>
        <select
          id="share-plan" value={plan} disabled={pending}
          onChange={(e) => { setPlan(e.target.value as SharePlan); setError(undefined); setSaved(undefined); }}
          className="rounded-lg border border-[var(--ct-hair)] bg-transparent px-3 py-2 text-base"
        >
          {plans.map((p) => (
            <option key={p.key} value={p.key}>{p.name}{texts[p.key]?.live ? " · ใช้ข้อความของคุณ" : ""}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <label htmlFor="share-draft" className="text-sm font-medium">1 · ร่างข้อความของคุณ</label>
        <textarea
          id="share-draft" rows={7} value={draft} maxLength={DRAFT_MAX} disabled={locked || pending}
          onChange={(e) => setDrafts((d) => ({ ...d, [plan]: e.target.value }))}
          placeholder="เช่น สวัสดีครับพี่ ส่งแผนที่คุยกันมาให้ครับ ทุนล้านนึง จ่ายปีละประมาณสองหมื่นแปด สนใจทักได้เลยครับ สมชาย 08x-xxx-xxxx"
          className="rounded-lg border border-[var(--ct-hair)] bg-transparent px-3 py-2 text-base leading-relaxed outline-none focus-visible:border-[var(--ct-accent)]"
        />
        <p className={`text-sm ${MUTE}`}>ตัวเลขพิมพ์คร่าว ๆ หรือเว้นไว้ก็ได้ ระบบใช้ตัวเลขจริงแทนให้</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={MAIN} onClick={arrange} disabled={locked || pending || left <= 0 || draft.trim().length < 20}>
          {pending ? "กำลังทำงาน…" : "✨ ให้ AI จัดเรียง"}
        </button>
        {locked ? null : <span className={`text-sm ${MUTE}`}>ฟรี · วันนี้เหลือ {left} ครั้ง · ใช้เวลาราวครึ่งนาที</span>}
      </div>

      {text?.template ? (
        <>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">2 · AI จัดเรียงแล้ว <span className={`font-normal ${MUTE}`}>(แถบสีคือช่องที่ระบบเติมตัวเลข)</span></h3>
            <Chips template={text.template} />
            {text.removed.map((r) => (
              <p key={r.text} className={NOTE}><b className="font-medium">AI ตัดออก:</b> “{r.text}”{r.why ? ` — ${r.why}` : ""}</p>
            ))}
            {text.own.map((o) => (
              <p key={o} className={NOTE}><b className="font-medium">ตัวเลขที่คุณพิมพ์เอง:</b> “{o}” ระบบไม่ได้รับรอง จะส่งตามที่พิมพ์</p>
            ))}
            <p className={`text-sm ${MUTE}`}>ไม่ตรงใจ? แก้ร่างข้างบนแล้วกดจัดเรียงอีกครั้ง</p>
          </div>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">3 · ตัวอย่างที่ลูกค้าจะเห็น <span className={`font-normal ${MUTE}`}>(ตัวเลขตัวอย่าง: {view.who})</span></h3>
            <div className={BOX}>{text.preview}</div>
            <p className={`text-sm ${MUTE}`}>หมายเหตุท้ายข้อความเป็นของระบบ ต่อท้ายให้เสมอ</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={MAIN} onClick={() => use(true)} disabled={locked || pending || inUse}>
                {inUse ? "✓ ใช้ข้อความนี้อยู่" : "บันทึกใช้ข้อความนี้"}
              </button>
              {text.live ? (
                <button type="button" className={QUIET} onClick={() => use(false)} disabled={locked || pending}>กลับไปใช้ข้อความมาตรฐาน</button>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">ข้อความมาตรฐานที่ใช้อยู่ตอนนี้ <span className={`font-normal ${MUTE}`}>(ตัวเลขตัวอย่าง: {view.who})</span></h3>
          <div className={BOX}>{view.standard}</div>
        </div>
      )}

      <div className="text-sm" role="status">
        {locked ? <span className={MUTE}>บัญชีทดลองใช้ร่วมกันหลายคน จึงใช้ข้อความมาตรฐานเสมอ</span>
          : error ? <FormError>{error}</FormError>
            : saved ? <span className="text-[var(--bot-ok)]">{saved}</span> : null}
      </div>
    </section>
  );
}
