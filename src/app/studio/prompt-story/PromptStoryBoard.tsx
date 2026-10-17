"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CostView } from "@/lib/quote-video/make";
import { totalLine } from "@/lib/prompt-story/total";
import { BRIEF_MAX, type PictureStyle, type PromptStoryInput } from "@/lib/prompt-story/types";
import { DEFAULT_NARRATOR_FACE, FACES } from "@/lib/story/faces";
import { voiceNotice } from "@/lib/quote-video/voice-quota";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { pictureSatang, priceBaht, type Prices } from "@/lib/wallet/prices";
import { myCost, myVideos, voiceQuota, type VideoItem, type VoiceQuota } from "../quote-video/actions";
import { ClipList } from "../quote-video/ClipList";
import { Step } from "../quote-video/QuoteVideoBoard";
import { makePromptStory, writePromptStory } from "./actions";
import { DEFAULT_FIGURE, FigurePicker, type FigureChoice } from "./FigurePicker";
import { LookStep, type Look } from "./LookStep";
import { ScriptEditor, type Draft } from "./ScriptEditor";

/**
 * คลิปตามโจทย์ (owner, 2026-10-16, mockup https://claude.ai/artifact/4SfQNZjNuNR86jKo83D4Bn): the
 * brief, the script written for free and edited, then the clip paid for. The tools are on the left
 * as in คลิปเล่าเรื่อง; the script and the clips on the desk beside them.
 */

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const STYLES: { id: PictureStyle; name: string }[] = [{ id: "cartoon", name: "ลายเส้นการ์ตูน" }, { id: "real", name: "ภาพสมจริง" }, { id: "flat", name: "มินิมอลแบน" }];
const PAINTERS: { id: PromptStoryInput["painter"]; name: string }[] = [{ id: "standard", name: "มาตรฐาน" }, { id: "sharp", name: "คมชัด" }, { id: "gemini", name: "Gemini" }];
const SCENES = [3, 5, 8] as const;
const LOOK_KEY = "prompt-story-look";
const FACE_KEY = "story-narrator-face";
const DEFAULT_LOOK: Look = { size: "portrait", narrator: "F", voice: "" };

function readLook(): Look {
  try {
    const raw = JSON.parse(localStorage.getItem(LOOK_KEY) ?? "null") as Partial<Look> | null;
    if (!raw) return DEFAULT_LOOK;
    return { size: raw.size === "square" || raw.size === "landscape" ? raw.size : "portrait", narrator: raw.narrator === "M" ? "M" : "F", voice: typeof raw.voice === "string" ? raw.voice : "" };
  } catch {
    return DEFAULT_LOOK;
  }
}

/** what the script was written from: the clip is made from these, not from a form edited since */
interface Written { brief: string; scenes: 3 | 5 | 8; figure: FigureChoice | null }

export function PromptStoryBoard({ initial, cost: firstCost, prices, quota: firstQuota, pages, eleven }: {
  initial: VideoItem[] | null;
  cost: CostView | null;
  prices: Prices;
  quota: VoiceQuota | null;
  pages: { id: string; name: string }[];
  eleven: ElevenChoice[];
}) {
  const [brief, setBrief] = useState("");
  const [scenes, setScenes] = useState<3 | 5 | 8>(5);
  const [style, setStyle] = useState<PictureStyle>("cartoon");
  const [painter, setPainter] = useState<PromptStoryInput["painter"]>("standard");
  const [withFigure, setWithFigure] = useState(false);
  const [figure, setFigure] = useState<FigureChoice>(DEFAULT_FIGURE);
  const [premium, setPremium] = useState<number | null>(null);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [face, setFace] = useState(DEFAULT_NARRATOR_FACE);
  const [customer, setCustomer] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notes, setNotes] = useState<number[]>([]);
  const [written, setWritten] = useState<Written | null>(null);
  const [writing, setWriting] = useState(false);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<{ text: string; contact?: boolean } | null>(null);
  const [items, setItems] = useState<VideoItem[] | null>(initial);
  const [cost, setCost] = useState<CostView | null>(firstCost);
  const [quota, setQuota] = useState<VoiceQuota | null>(firstQuota);

  // the clip's look and the narrator's face, as they were left in this browser
  useEffect(() => {
    try {
      const f = localStorage.getItem(FACE_KEY);
      if (f && FACES.some((x) => x.id === f)) setFace(f);
    } catch { /* the default stands */ }
    // a voice no longer listed (the cloned ones, gone 2026-10-17) falls back to Gemini's
    const kept = readLook();
    setLook(eleven.some((v) => v.id === kept.voice) ? kept : { ...kept, voice: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, as the page opens
  }, []);
  function pickLook(next: Partial<Look>) {
    setLook((was) => {
      const l = { ...was, ...next };
      try { localStorage.setItem(LOOK_KEY, JSON.stringify(l)); } catch { /* not remembered, still used */ }
      return l;
    });
  }
  function pickFace(f: string) {
    setFace(f);
    try { localStorage.setItem(FACE_KEY, f); } catch { /* not remembered, still used */ }
  }

  // Gemini's voice used up for the day: the warning goes by itself when the day turns over
  useEffect(() => {
    if (!quota?.until) return;
    const t = setTimeout(() => setQuota(null), Math.max(0, Date.parse(quota.until) - Date.now()) + 5000);
    return () => clearTimeout(t);
  }, [quota]);

  // a clip still being made is asked about every few seconds
  const pending = items?.some((v) => v.status === "drawing" || v.status === "rendering");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { myVideos("prompt").then(setItems).catch(() => undefined); }, 4000);
    return () => {
      clearInterval(t);
      myCost().then(setCost).catch(() => undefined);
      voiceQuota().then(setQuota).catch(() => undefined);
    };
  }, [pending]);

  const figureAsked = withFigure ? figure : null;
  const briefOk = brief.trim().length > 0 && brief.length <= BRIEF_MAX;
  const stale = Boolean(written) && (written!.brief !== brief || written!.scenes !== scenes || JSON.stringify(written!.figure) !== JSON.stringify(figureAsked));
  const notice = quota && !look.voice ? voiceNotice(quota, true) : null;
  const voiceBlocked = Boolean(notice?.blocked);
  const total = totalLine({ scenes: draft?.scenes.length ?? scenes, painter, voice: look.voice || undefined, prices, kind: cost?.kind ?? "wallet", walletOff: cost?.kind === "free" && cost.walletOff });
  const closed = cost?.kind === "closed";

  async function write() {
    setWriting(true);
    setError(null);
    try {
      const r = await writePromptStory({ brief, scenes, ...(figureAsked ? { figure: figureAsked } : {}) });
      if (!r.ok) { setError({ text: r.error }); return; }
      setDraft({ id: r.id, title: r.title, caption: r.caption, scenes: r.scenes });
      setNotes(r.notes);
      setWritten({ brief, scenes, figure: figureAsked });
    } catch {
      setError({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setWriting(false);
    }
  }

  async function make() {
    if (!draft || !written) return;
    setMaking(true);
    setError(null);
    try {
      const r = await makePromptStory({
        draftId: draft.id, brief: written.brief, title: draft.title, caption: draft.caption, scenes: draft.scenes,
        style, painter, size: look.size, narrator: look.narrator, ...(look.voice ? { voice: look.voice } : {}),
        faces: { narrator: face }, ...(written.figure ? { figure: written.figure } : {}),
      }, customer);
      if (!r.ok) {
        setError({ text: r.error, contact: r.needContact });
        voiceQuota().then(setQuota).catch(() => undefined);
      } else {
        // the draft is the clip's now: a second press would be refused
        setDraft(null);
        setWritten(null);
        setItems(await myVideos("prompt"));
      }
      setCost(await myCost());
    } catch {
      setError({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setMaking(false);
    }
  }

  const figureReady = !withFigure || premium !== null;
  const painterWord = (id: string) => `฿${priceBaht(pictureSatang(prices, id) ?? 0)}/รูป`;

  return (
    <div className="mt-5 grid items-start gap-3 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="@container min-w-0 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 pb-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <div className="-mx-4 -mt-4 mb-4 border-b border-[var(--ct-hair)] px-4 py-2.5">
          <h2 className="font-semibold">เครื่องมือ</h2>
          <p className="mt-0.5 text-xs text-[var(--ct-mute)]">พิมพ์โจทย์ → เขียนบท (ฟรี) → แก้บท → สร้างคลิป</p>
        </div>
        <Step n={1} title="โจทย์" summary={`${brief.length}/${BRIEF_MAX}`} first>
          <textarea
            aria-label="โจทย์" value={brief} maxLength={BRIEF_MAX} rows={5} onChange={(e) => setBrief(e.target.value)}
            placeholder="เช่น ลูกค้าเป็นพ่อค้าออนไลน์ อายุ 40 ไม่มีประกันกลุ่ม กลัวป่วยแล้วร้านต้องหยุด อยากเล่าให้เห็นว่าเงินก้อนช่วยร้านได้ยังไง"
            className="min-h-[110px] w-full resize-y rounded-lg border border-[var(--ct-line)] bg-[var(--ct-ground)] px-3 py-2 text-sm"
          />
          <p className="text-xs text-[var(--ct-mute)]">เรื่องประกันและการเงินครอบครัวเท่านั้น · {brief.length}/{BRIEF_MAX} ตัวอักษร</p>
        </Step>
        <Step n={2} title="จำนวนฉาก และสไตล์รูป" summary={`${scenes} ฉาก`}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="จำนวนฉาก">
            {SCENES.map((n) => <button key={n} type="button" role="radio" aria-checked={scenes === n} className={chip(scenes === n)} onClick={() => setScenes(n)}>{n} ฉาก</button>)}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="สไตล์รูป">
            {STYLES.map((s) => <button key={s.id} type="button" role="radio" aria-checked={style === s.id} className={chip(style === s.id)} onClick={() => setStyle(s.id)}>{s.name}</button>)}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="คุณภาพรูป">
            {PAINTERS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={painter === p.id} className={chip(painter === p.id)} onClick={() => setPainter(p.id)}>{p.name} {painterWord(p.id)}</button>)}
          </div>
        </Step>
        <Step n={3} title="ใส่เบี้ยจริงจากตาราง (ไม่ใส่ก็ได้)" summary={withFigure ? "ใส่เบี้ยจริง" : "ไม่ใส่"}>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!withFigure)} onClick={() => setWithFigure(false)}>ไม่ใส่</button>
            <button type="button" className={chip(withFigure)} onClick={() => setWithFigure(true)}>ใส่เบี้ยจริง</button>
          </div>
          {withFigure && <FigurePicker value={figure} onChange={setFigure} onPremium={setPremium} />}
        </Step>
        <Step n={4} title="หน้าตาคลิป" summary="">
          <LookStep look={look} pick={pickLook} face={face} pickFace={pickFace} customer={customer} setCustomer={setCustomer} eleven={eleven} prices={prices} />
        </Step>

        {/* what it costs and the buttons: pinned to the foot of the tools, always in view */}
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-4 pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
          {error && (
            <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
              {error.text}{" "}
              {error.contact && <Link href="/studio/account" className="font-medium underline">ไปที่บัญชีของฉัน</Link>}
              {!error.contact && error.text.includes("กระเป๋า") && <Link href="/studio/wallet" className="font-medium underline">เติมเงิน</Link>}
            </p>
          )}
          {notice && (
            <p role="status" className={notice.ok ? "rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]" : "rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]"}>{notice.text}</p>
          )}
          {draft && (
            <>
              {stale && <p role="status" className="text-xs text-[var(--ct-warn-ink)]">แก้โจทย์หรือตัวเลือกหลังเขียนบทแล้ว คลิปจะทำจากบทนี้ กด “เขียนใหม่” ถ้าอยากให้เขียนตามที่แก้</p>}
              <p className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm tabular-nums">
                <b>ยอดตอนกดสร้างคลิป</b><br />{total.text}
                {cost?.kind === "wallet" && <><br /><span className="text-xs text-[var(--ct-mute)]">ยอดคงเหลือ {cost.balance}</span></>}
              </p>
              <button
                type="button" onClick={make} disabled={making || writing || closed || voiceBlocked || Boolean(total.blocked)}
                className="w-full rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50"
              >
                {making ? "กำลังเริ่ม…" : total.baht === "0" || total.blocked ? "สร้างคลิป" : `สร้างคลิป ฿${total.baht}`}
              </button>
            </>
          )}
          {closed && <p className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">ใช้วิดีโอฟรีครบแล้ว</p>}
          <button
            type="button" onClick={write} disabled={writing || making || !briefOk || !figureReady}
            className={draft ? "w-full rounded-lg border border-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)] disabled:opacity-50" : "w-full rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50"}
          >
            {writing ? "กำลังเขียนบท…" : draft ? "เขียนใหม่ทั้งบท (ฟรี)" : "เขียนบท (ฟรี)"}
          </button>
          <p className="text-xs text-[var(--ct-mute)]">เขียนได้ 20 ครั้งต่อชั่วโมง กดเขียนใหม่กี่ครั้งก็ได้ จ่ายเมื่อกด “สร้างคลิป” เท่านั้น</p>
        </div>
      </aside>

      <section aria-label="บทและวิดีโอ" className="studio-desk min-w-0 space-y-4 rounded-xl border border-[var(--ct-hair)] p-3 lg:min-h-[70dvh] lg:self-stretch">
        {draft && <ScriptEditor draft={draft} notes={notes} onChange={setDraft} />}
        <ClipList items={items} setItems={setItems} pages={pages} />
      </section>
    </div>
  );
}
