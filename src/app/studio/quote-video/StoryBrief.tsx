"use client";
import { AUDIENCES, HEADLINE_MAX, HOOKS, NOTE_MAX, type Audience, type HookKind, type VideoBrief, type WrittenLines } from "@/lib/quote-video/brief";
import type { SceneKey, SceneScript } from "@/lib/quote-video/script";

/**
 * โจทย์การเล่า, step 4 of the วิดีโอนำเสนอ form (owner, 2026-10-13; mockup
 * https://claude.ai/artifact/G36jyJWaHD7yj248ReEk3E §2, §6): how the clip opens, the story, who
 * the customer is, whether it loops — and ดูสคริปต์, the whole voice before the clip is made, its
 * written lines editable. The board keeps the state; this draws it.
 */

const chip = (on: boolean, off = false) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${off ? "cursor-not-allowed opacity-40" : ""} ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)] inline-flex items-center disabled:opacity-50";

const SCENE_WORD: Record<SceneKey, string> = {
  lead: "เปิด", price: "ราคา", cover: "คุ้มครอง", value: "มูลค่า", compare: "เทียบแผน", critical: "โรคร้ายแรง", contact: "ปิด",
  story: "เรื่องลูกค้า", versus: "เทียบ", qa: "ถาม-ตอบ", steps: "เริ่มต้น",
};
/** how many times a clip's lines may be written again (owner, 2026-10-13: 3) */
export const REWRITES = 3;

export interface ScriptState {
  script: SceneScript[];
  lines?: WrittenLines;
  written: boolean;
}

export function StoryBrief({ brief, setBrief, stories, longClip, script, setLines, busy, rewritesLeft, onPreview, error }: {
  brief: VideoBrief;
  setBrief: (b: VideoBrief) => void;
  /** the stories this quote backs, from the server (brief.ts storiesFor) */
  stories: { key: string; name: string }[];
  /** a ~90 s or 2-minute clip: it tells the customer's story too */
  longClip: boolean;
  script: ScriptState | null;
  setLines: (l: WrittenLines) => void;
  busy: boolean;
  rewritesLeft: number;
  onPreview: (again: boolean) => void;
  error: string | null;
}) {
  const plain = brief.hook === "plain";
  const set = (patch: Partial<VideoBrief>) => setBrief({ ...brief, ...patch });
  const l = script?.lines;
  const edit = (patch: Partial<WrittenLines>) => l && setLines({ ...l, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <span className={label}>เทคนิคเปิดฮุก</span>
        <div className="flex flex-wrap gap-2">
          {HOOKS.map((h) => (
            <button key={h.kind} type="button" className={chip(brief.hook === h.kind)} onClick={() => set({ hook: h.kind as HookKind, ...(h.kind === "plain" ? { loop: false } : {}) })}>{h.name}</button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--ct-mute)]">{HOOKS.find((h) => h.kind === brief.hook)?.hint}</p>
      </div>
      {!plain && (
        <>
          <div>
            <span className={label}>เรื่องที่เล่า</span>
            <div className="flex flex-wrap gap-2">
              {stories.map((s) => <button key={s.key} type="button" className={chip((brief.story ?? stories[0]?.key) === s.key)} onClick={() => set({ story: s.key })}>{s.name}</button>)}
            </div>
            <p className="mt-1 text-xs text-[var(--ct-mute)]">มีเฉพาะเรื่องที่แผนนี้มีข้อมูลรองรับ</p>
          </div>
          <div>
            <span className={label}>ลูกค้าเป็นใคร <span className="font-normal text-[var(--ct-mute)]">(ไม่บังคับ)</span></span>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button key={a.key} type="button" className={chip(brief.audience === a.key)} onClick={() => set({ audience: brief.audience === a.key ? undefined : (a.key as Audience) })}>{a.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="qv-note" className={label}>สิ่งที่อยากเน้น <span className="font-normal text-[var(--ct-mute)]">(ไม่บังคับ · {NOTE_MAX} ตัวอักษร)</span></label>
            <input id="qv-note" className={field} maxLength={NOTE_MAX} value={brief.note ?? ""} placeholder="เช่น ลูกค้าเพิ่งซื้อบ้าน ผ่อนอีก 20 ปี" onChange={(e) => set({ note: e.target.value })} />
          </div>
        </>
      )}
      <label htmlFor="qv-loop" className={`flex min-h-11 items-start gap-2.5 rounded-lg border p-3 text-sm ${plain ? "opacity-50" : "cursor-pointer"} ${brief.loop ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-line)]"}`}>
        <input id="qv-loop" type="checkbox" className="mt-0.5 size-5 shrink-0" checked={Boolean(brief.loop)} disabled={plain} onChange={(e) => set({ loop: e.target.checked })} />
        <span>
          <span className="font-medium">คลิปวนลูป ↻</span> <span className="text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span>
          <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">
            ประโยคปิดพูดค้างไว้ แล้ววนกลับไปต่อที่ประโยคเปิด คนดูจะดูซ้ำโดยไม่รู้ตัว · การชวนทักแชทย้ายไปไว้กลางคลิป · ไม่มีการ์ดตัวแทนตอนท้าย
            {plain ? " · ใช้กับฮุก ตรงไปตรงมา ไม่ได้" : ""}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-10 rounded-lg bg-[var(--ct-solid)] px-4 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50" disabled={busy} onClick={() => onPreview(false)}>
          {busy ? "กำลังเขียนสคริปต์…" : script ? "ดูสคริปต์อีกครั้ง" : "ดูสคริปต์"}
        </button>
        {script?.lines && (
          <button type="button" className={small} disabled={busy || rewritesLeft <= 0} onClick={() => onPreview(true)}>↻ สุ่มใหม่ (เหลือ {rewritesLeft})</button>
        )}
        <span className="text-xs text-[var(--ct-mute)]">ฟรี · ไม่กดดูก็สร้างได้ ระบบเขียนให้ตอนสร้าง</span>
      </div>
      {error && <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{error}</p>}

      {script && (
        <div className="space-y-2 rounded-lg border border-dashed border-[var(--ct-line)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-sm">สคริปต์ที่จะพากย์</b>
            <span className="text-xs text-[var(--ct-mute)]">
              {script.lines ? (script.written ? "เขียนใหม่ตามโจทย์ · ตัวเลขตรงใบเสนอ" : "ใช้ประโยคสำเร็จรูป (ระบบเขียนไม่ทัน) · ตัวเลขตรงใบเสนอ") : "แบบเดิม"}
            </span>
          </div>
          <ol className="divide-y divide-[var(--ct-hair)] text-sm">
            {script.script.map((s, i) => {
              const own = Boolean(l) && (s.key === "lead" || s.key === "contact" || s.key === "story");
              return (
                <li key={i} className={`grid grid-cols-[5rem_minmax(0,1fr)] gap-2 py-2 ${own ? "rounded bg-[var(--ct-soft)] px-2" : ""}`}>
                  <span className="pt-0.5 text-xs font-medium text-[var(--ct-mute)]">{`ฉาก ${i + 1} ${SCENE_WORD[s.key]}`}</span>
                  <span>{s.voice}</span>
                </li>
              );
            })}
            {brief.loop && script.script[0] && (
              <li className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 py-2 text-xs text-[var(--ct-mute)]">
                <span className="font-medium text-[var(--ct-accent)]">↻ วนกลับ</span>
                <span>ต่อด้วยประโยคเปิด: “{script.script[0].voice.slice(0, 60)}…” ลองอ่านต่อกันดู</span>
              </li>
            )}
          </ol>
          {l && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">✎ แก้ประโยคที่เขียนใหม่เอง</summary>
              <div className="mt-2 space-y-3">
                <div>
                  <label htmlFor="qv-hook" className={label}>ประโยคเปิด (ฮุก)</label>
                  <textarea id="qv-hook" className={field} rows={2} maxLength={150} value={l.hook} onChange={(e) => edit({ hook: e.target.value })} />
                </div>
                <div>
                  <span className={label}>พาดหัวบนจอ (บรรทัดละไม่เกิน {HEADLINE_MAX} ตัวอักษร)</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[0, 1].map((k) => (
                      <input key={k} id={`qv-head-${k}`} aria-label={`พาดหัวบรรทัด ${k + 1}`} className={field} maxLength={HEADLINE_MAX} value={l.headline[k] ?? ""}
                        onChange={(e) => { const h = [...l.headline]; h[k] = e.target.value; edit({ headline: h.filter((x, i) => x || i === 0) }); }} />
                    ))}
                  </div>
                </div>
                {brief.loop ? (
                  <div>
                    <label htmlFor="qv-loopclose" className={label}>ประโยควนลูป (พูดค้าง ไม่ลงท้าย ค่ะ/ครับ)</label>
                    <input id="qv-loopclose" className={field} maxLength={70} value={l.loopClose ?? ""} onChange={(e) => edit({ loopClose: e.target.value })} />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="qv-close" className={label}>ประโยคปิด</label>
                    <input id="qv-close" className={field} maxLength={80} value={l.close ?? ""} onChange={(e) => edit({ close: e.target.value })} />
                  </div>
                )}
                {longClip && (
                  <div>
                    <label htmlFor="qv-story" className={label}>เรื่องของลูกค้า</label>
                    <textarea id="qv-story" className={field} rows={3} maxLength={260} value={l.story ?? ""} onChange={(e) => edit({ story: e.target.value })} />
                  </div>
                )}
                <p className="text-xs text-[var(--ct-mute)]">ตอนกดสร้าง ระบบตรวจอีกครั้ง: ตัวเลขต้องอยู่ในใบเสนอ ไม่ใช้คำว่า เบี้ย เสียชีวิต เวนคืน · กดดูสคริปต์อีกครั้งเพื่อฟังลำดับที่แก้แล้ว</p>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
