"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import type { CostView } from "@/lib/quote-video/make";
import { STORY_PLANS, type StoryPlan } from "@/lib/story/plans";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { voiceFullNotice } from "@/lib/quote-video/voice-quota";
import { CROWD_HERO, crowdOf, DEFAULT_HERO_FACE, DEFAULT_NARRATOR_FACE, FACE_PAPER, FACES, faceSrc, type FaceTag } from "@/lib/story/faces";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import { makeStoryVideo, myCost, myVideos, previewStoryFigure, voiceQuota, type VideoItem, type VoiceQuota } from "../quote-video/actions";
import { ClipList } from "../quote-video/ClipList";
import { costLine, GEMINI, SizePicker, Step } from "../quote-video/QuoteVideoBoard";

/**
 * คลิปเล่าเรื่อง's form (owner, 2026-10-15, mockup https://claude.ai/artifact/FmDZmdTf6Mwgb2Dza8hQtM):
 * the story, the characters, a plan's real premium if wanted, the clip's look — and beside it a
 * still of the opening, the crowd as the clip will draw it.
 */

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const card = "rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";

/** the stories still to come, as the mockup listed them */
const COMING = ["เสาหลักหายไป", "แม่คือเสาหลักอีกต้น", "หนี้ไม่ตายตามเจ้าของ", "ซื้อตอนหนุ่มถูกกว่า", "เกษียณแล้วเงินพอไหม", "ทุนประกัน กับ เบี้ย", "แถลงสุขภาพให้ครบ", "ลดหย่อนภาษีปลายปี", "“ยังหนุ่ม ไม่ต้องมี”"];
const TAG_WORD: Record<FaceTag, string> = { glasses: "ใส่แว่น", curly: "ผมหยิก", hat: "ใส่หมวก" };
const DEFAULT_TERM: Record<StoryPlan, string> = { ISHIELD: "WLCI10", LIFEPROTECT: "WLF19H" };
/** what each plan's figure makes of the story (story.ts storyEvent) */
const PLAN_STORY: Record<StoryPlan, string> = { ISHIELD: "คลิปเล่าว่าป่วยเป็นโรคร้ายแรง", LIFEPROTECT: "คลิปเล่าว่าจากไปไม่ทันตั้งตัว เงินไปถึงครอบครัว" };

const NARRATOR_KEY = "story-narrator-face";
const LOOK_KEY = "story-look";
interface Look { size: VideoSize; palette: "reveal" | "color"; narrator: "F" | "M"; voice: string }
const DEFAULT_LOOK: Look = { size: "portrait", palette: "reveal", narrator: "F", voice: "" };

function readLook(): Look {
  try {
    const raw = JSON.parse(localStorage.getItem(LOOK_KEY) ?? "null") as Partial<Look> | null;
    if (!raw) return DEFAULT_LOOK;
    return {
      size: raw.size === "square" || raw.size === "landscape" ? raw.size : "portrait",
      palette: raw.palette === "color" ? "color" : "reveal",
      narrator: raw.narrator === "M" ? "M" : "F",
      voice: typeof raw.voice === "string" ? raw.voice : "",
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

/** a grid of faces to pick one from, narrowed by sex and by look */
function FacePicker({ id, value, onPick, sex, exclude }: { id: string; value: string; onPick: (f: string) => void; sex?: "M" | "F"; exclude?: string }) {
  const [tag, setTag] = useState<FaceTag | null>(null);
  const shown = FACES.filter((f) => (!sex || f.sex === sex) && f.id !== exclude && (!tag || f.tags.includes(tag)));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="กรองหน้า">
        <button type="button" className={chip(tag === null)} onClick={() => setTag(null)}>ทั้งหมด</button>
        {(Object.keys(TAG_WORD) as FaceTag[]).map((t) => <button key={t} type="button" className={chip(tag === t)} onClick={() => setTag(t)}>{TAG_WORD[t]}</button>)}
      </div>
      <div id={id} className="flex max-h-[200px] flex-wrap gap-2 overflow-y-auto rounded-lg p-1" role="radiogroup">
        {shown.map((f) => (
          <button
            key={f.id} type="button" role="radio" aria-checked={value === f.id} aria-label={`หน้า ${f.id}`} onClick={() => onPick(f.id)}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border ${value === f.id ? "border-[var(--ct-solid)] ring-2 ring-[var(--ct-solid)]" : "border-[var(--ct-hair)]"}`}
            style={{ background: FACE_PAPER }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faceSrc(f.id)} alt="" width={56} height={56} loading="lazy" className="h-full w-full" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** the opening as the clip draws it: the 48, grey until covered (or in colour), the hero among them */
function OpeningPreview({ hero, narrator, palette, size }: { hero: string; narrator: string; palette: "reveal" | "color"; size: VideoSize }) {
  const crowd = crowdOf(hero, narrator);
  const cols = size === "landscape" ? 12 : size === "square" ? 8 : 6;
  return (
    <div className="rounded-[26px] p-2.5" style={{ background: STORY_CLIP_COLORS.bezel }}>
      <div className="relative flex flex-col items-center overflow-hidden rounded-[18px] px-[9%] pt-[7%]" style={{ background: FACE_PAPER, aspectRatio: size === "landscape" ? "16 / 9" : size === "square" ? "1 / 1" : "9 / 16", color: STORY_CLIP_COLORS.ink }}>
        <p className="text-2xl font-semibold leading-tight">48 คน</p>
        <p className="mb-3 text-center text-[11px]">ถ้ามีคนหนึ่งเจอเรื่องใหญ่ จะเป็นใคร?</p>
        <div className="grid w-full gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {crowd.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={faceSrc(f, palette === "reveal")} alt="" loading="lazy" className={`aspect-square w-full ${i === CROWD_HERO ? "rounded-full ring-2" : ""}`} style={i === CROWD_HERO ? { boxShadow: `0 0 0 2px ${STORY_CLIP_COLORS.red}` } : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StoryClipBoard({ initial, cost: firstCost, prices, quota: firstQuota, pages, eleven }: {
  initial: VideoItem[] | null;
  cost: CostView | null;
  prices: Prices;
  quota: VoiceQuota | null;
  pages: { id: string; name: string }[];
  eleven: ElevenChoice[];
}) {
  const [narratorFace, setNarratorFace] = useState(DEFAULT_NARRATOR_FACE);
  const [heroSex, setHeroSex] = useState<"M" | "F">("F");
  const [heroFace, setHeroFace] = useState(DEFAULT_HERO_FACE.F);
  const [customer, setCustomer] = useState("");
  const [withFigure, setWithFigure] = useState(false);
  const [plan, setPlan] = useState<StoryPlan>("ISHIELD");
  const [variant, setVariant] = useState(DEFAULT_TERM.ISHIELD);
  const [age, setAge] = useState("35");
  const [sum, setSum] = useState("1,000,000");
  const [figure, setFigure] = useState<{ annual: number; monthly: number } | { error: string } | null>(null);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; contact?: boolean } | null>(null);
  const [items, setItems] = useState<VideoItem[] | null>(initial);
  const [cost, setCost] = useState<CostView | null>(firstCost);
  const [quota, setQuota] = useState<VoiceQuota | null>(firstQuota);

  // the narrator's face and the clip's look, as they were left in this browser
  useEffect(() => {
    try {
      const f = localStorage.getItem(NARRATOR_KEY);
      if (f && FACES.some((x) => x.id === f)) setNarratorFace(f);
    } catch { /* the default stands */ }
    setLook(readLook());
  }, []);
  function pickNarratorFace(f: string) {
    setNarratorFace(f);
    if (f === heroFace) setHeroFace(FACES.find((x) => x.sex === heroSex && x.id !== f)!.id);
    try { localStorage.setItem(NARRATOR_KEY, f); } catch { /* not remembered, still used */ }
  }
  function pickLook(next: Partial<Look>) {
    setLook((was) => {
      const l = { ...was, ...next };
      try { localStorage.setItem(LOOK_KEY, JSON.stringify(l)); } catch { /* not remembered, still used */ }
      return l;
    });
  }
  function pickSex(s: "M" | "F") {
    setHeroSex(s);
    const d = DEFAULT_HERO_FACE[s];
    setHeroFace(d === narratorFace ? FACES.find((x) => x.sex === s && x.id !== narratorFace)!.id : d);
  }

  // the premium, worked out as the form changes
  const sumBaht = Number(sum.replace(/[^\d]/g, "")) || 0;
  useEffect(() => {
    if (!withFigure) return;
    setFigure(null);
    const t = setTimeout(() => {
      previewStoryFigure({ plan, variant, sex: heroSex, age: Number(age), sumAssured: sumBaht })
        .then(setFigure).catch(() => setFigure({ error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    }, 300);
    return () => clearTimeout(t);
  }, [withFigure, plan, variant, heroSex, age, sumBaht]);

  // Gemini's voice used up for the day: the warning goes by itself when the day turns over
  useEffect(() => {
    if (!quota) return;
    const t = setTimeout(() => setQuota(null), Math.max(0, Date.parse(quota.until) - Date.now()) + 5000);
    return () => clearTimeout(t);
  }, [quota]);

  // a clip still being made is asked about every few seconds
  const pending = items?.some((v) => v.status === "drawing" || v.status === "rendering");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { myVideos("story").then(setItems).catch(() => undefined); }, 4000);
    return () => {
      clearInterval(t);
      myCost().then(setCost).catch(() => undefined);
      voiceQuota().then(setQuota).catch(() => undefined);
    };
  }, [pending]);

  // one voice sample plays at a time
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  function playSample(src: string) {
    player.current?.pause();
    if (playing === src) { setPlaying(null); return; }
    const a = new Audio(src);
    a.onended = () => setPlaying(null);
    player.current = a;
    setPlaying(src);
    a.play().catch(() => setPlaying(null));
  }
  useEffect(() => () => player.current?.pause(), []);

  const figureOk = withFigure && figure && !("error" in figure) ? figure : null;
  const voiceBlocked = Boolean(quota) && !look.voice;
  const line = costLine(cost, "videoStory");
  const ready = !withFigure || Boolean(figureOk);
  const name = customer.trim();

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = await makeStoryVideo({
        topic: "pool48", size: look.size, palette: look.palette, narrator: look.narrator, ...(look.voice ? { voice: look.voice } : {}),
        faces: { narrator: narratorFace, hero: heroFace },
        ...(withFigure ? { figure: { plan, variant, sex: heroSex, age: Number(age), sumAssured: sumBaht } } : {}),
      }, customer);
      if (!r.ok) {
        setError({ text: r.error, contact: r.needContact });
        voiceQuota().then(setQuota).catch(() => undefined);
      } else setItems(await myVideos("story"));
      setCost(await myCost());
    } catch {
      setError({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  const terms = STORY_PLANS.find((p) => p.code === plan)!.terms;
  const voiceWord = look.voice ? eleven.find((v) => v.id === look.voice)?.name ?? "ElevenLabs" : look.narrator === "M" ? "เสียงชาย" : "เสียงหญิง";

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${card} pb-0 lg:pb-5`}>
          <Step n={1} title="เลือกเรื่อง" summary="กองกลาง 48 คน" first>
            <div className="flex items-start gap-3 rounded-xl border border-[var(--ct-solid)] bg-[var(--ct-soft)] p-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: FACE_PAPER }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faceSrc("m14")} alt="" className="absolute -left-1 top-1 h-9 w-9" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={faceSrc("w04")} alt="" className="absolute -bottom-1 -right-1 h-9 w-9" />
              </span>
              <span>
                <b className="block text-sm">กองกลาง 48 คน</b>
                <span className="block text-xs text-[var(--ct-mute)]">ทุกคนหยอดคนละนิด ใครเจอเรื่องใหญ่ เงินกองกลางไปช่วย · 6 ฉาก ประมาณ 45 วินาที</span>
              </span>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-[var(--ct-mute)]">เรื่องต่อไป · เร็ว ๆ นี้</span>
              <div className="flex flex-wrap gap-1.5">
                {COMING.map((c) => <span key={c} className="rounded-full border border-dashed border-[var(--ct-line)] px-3 py-1 text-xs text-[var(--ct-mute)]">{c}</span>)}
              </div>
            </div>
          </Step>

          <Step n={2} title="ตัวละคร" summary={`ผู้เล่า: คุณ · ตัวเอก: ${name ? `คุณ${name}` : "คนทั่วไป"}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <span className={label}>ผู้เล่าเรื่อง (คุณ)</span>
                <p className="text-xs text-[var(--ct-mute)]">ขึ้นท้ายคลิปพร้อมชื่อ เบอร์ และ LINE จากบัญชีของฉัน · เลือกครั้งเดียว จำไว้ในเครื่องนี้</p>
                <FacePicker id="sc-narrator" value={narratorFace} onPick={pickNarratorFace} exclude={heroFace} />
              </div>
              <div className="min-w-0 space-y-2">
                <label htmlFor="sc-customer" className={label}>ตัวเอกของเรื่อง</label>
                <input id="sc-customer" className={field} value={customer} maxLength={40} placeholder="ชื่อลูกค้า เช่น นิด (เว้นว่าง = คนทั่วไป ลงเพจได้)" onChange={(e) => setCustomer(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" className={chip(heroSex === "F")} onClick={() => pickSex("F")}>หญิง</button>
                  <button type="button" className={chip(heroSex === "M")} onClick={() => pickSex("M")}>ชาย</button>
                </div>
                <FacePicker id="sc-hero" value={heroFace} onPick={setHeroFace} sex={heroSex} exclude={narratorFace} />
              </div>
            </div>
            <p className="text-xs text-[var(--ct-mute)]">อีก 47 คนในโหล ระบบเลือกจากคลัง ชายหญิงครึ่งต่อครึ่ง</p>
          </Step>

          <Step n={3} title="ข้อมูลจากแบบประกัน" summary={withFigure ? `ตัวเลขจริง · ${STORY_PLANS.find((p) => p.code === plan)!.name}` : "ไม่ใช้"}>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => setWithFigure(false)} className={`rounded-xl border p-3 text-left ${!withFigure ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-hair)]"}`}>
                <b className="block text-sm">ไม่ใช้</b><span className="text-xs text-[var(--ct-mute)]">เรื่องทั่วไป ไม่มีตัวเลขเบี้ย ลงเพจหรือทำแอดได้</span>
              </button>
              <button type="button" onClick={() => setWithFigure(true)} className={`rounded-xl border p-3 text-left ${withFigure ? "border-[var(--ct-solid)] bg-[var(--ct-soft)]" : "border-[var(--ct-hair)]"}`}>
                <b className="block text-sm">ใส่ตัวเลขจริง</b><span className="text-xs text-[var(--ct-mute)]">ดึงเบี้ยจากตารางในระบบ ขึ้นเป็นโน้ตในฉากที่ 4</span>
              </button>
              <div className="rounded-xl border border-dashed border-[var(--ct-hair)] p-3 text-[var(--ct-mute)]">
                <b className="block text-sm">ลูกค้า FHC</b><span className="text-xs">เร็ว ๆ นี้</span>
              </div>
            </div>
            {withFigure && (
              <div className="space-y-3 rounded-xl border border-dashed border-[var(--ct-line)] p-3">
                <div>
                  <span className={label}>แบบที่ใช้เป็นตัวอย่าง</span>
                  <div className="flex flex-wrap gap-2">
                    {STORY_PLANS.map((p) => <button key={p.code} type="button" className={chip(plan === p.code)} onClick={() => { setPlan(p.code); setVariant(DEFAULT_TERM[p.code]); }}>{p.name}</button>)}
                  </div>
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">{PLAN_STORY[plan]} ให้ตรงกับสิ่งที่แบบนี้จ่ายจริง</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="sc-term" className={label}>ระยะชำระ</label>
                    <select id="sc-term" className={field} value={variant} onChange={(e) => setVariant(e.target.value)}>
                      {terms.map((t) => <option key={t.variant} value={t.variant}>{t.short}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sc-age" className={label}>อายุ ({heroSex === "F" ? "หญิง" : "ชาย"})</label>
                    <select id="sc-age" className={field} value={age} onChange={(e) => setAge(e.target.value)}>
                      {Array.from({ length: 71 }, (_, i) => i).map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sc-sum" className={label}>ทุนประกัน (บาท)</label>
                    <input id="sc-sum" inputMode="numeric" className={field} value={sum}
                      onChange={(e) => { const v = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8)); setSum(v ? v.toLocaleString("en-US") : ""); }} />
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--ct-soft)] px-4 py-3 text-sm tabular-nums">
                  {figureOk
                    ? <p><b className="text-base">ปีละ {figureOk.annual.toLocaleString("en-US")} บาท</b> <span className="text-[var(--ct-mute)]">หรือเดือนละ {figureOk.monthly.toLocaleString("en-US")} บาท · ขึ้นในฉากที่ 4 เป็นโน้ตแปะ</span></p>
                    : <p className="text-[var(--ct-mute)]">{figure && "error" in figure ? figure.error : "กำลังคิดเบี้ย…"}</p>}
                </div>
              </div>
            )}
          </Step>

          <Step n={4} title="หน้าตาคลิป" summary={[look.palette === "reveal" ? "ขาวดำแล้วลงสี" : "สีทั้งคลิป", voiceWord].join(" · ")}>
            <SizePicker size={look.size} pick={(size) => pickLook({ size })} />
            <div>
              <span className={label}>สีของตัวละคร</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(look.palette === "reveal")} onClick={() => pickLook({ palette: "reveal" })}>ขาวดำ แล้วลงสีเมื่อมีประกัน</button>
                <button type="button" className={chip(look.palette === "color")} onClick={() => pickLook({ palette: "color" })}>สีทั้งคลิป</button>
              </div>
            </div>
            <div>
              <span className={label}>เสียงพากย์</span>
              <div className="flex flex-wrap items-center gap-2">
                {GEMINI.map((g) => (
                  <span key={g.n} className="inline-flex items-center gap-2">
                    <button type="button" className={chip(!look.voice && look.narrator === g.n)} onClick={() => pickLook({ voice: "", narrator: g.n })}>{g.name} <span className="font-normal opacity-80">· {g.tag}</span></button>
                    <button type="button" className={small} onClick={() => playSample(g.sample)} aria-label={`ฟังตัวอย่างเสียง${g.name}`}>{playing === g.sample ? "■ หยุด" : "▶ ฟัง"}</button>
                  </span>
                ))}
              </div>
              {eleven.length > 0 && (["M", "F"] as const).map((sex) => (
                <div key={sex} className="mt-3">
                  <span className="mb-1 block text-xs font-medium text-[var(--ct-mute)]">ElevenLabs {sex === "M" ? "ผู้ชาย" : "ผู้หญิง"} · เหมือนคนพูด +{priceBaht(prices.elevenExtra)} บาท</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {eleven.filter((v) => v.sex === sex).map((v) => (
                      <span key={v.id} className="inline-flex items-center gap-1.5">
                        <button type="button" className={chip(look.voice === v.id)} onClick={() => pickLook({ voice: v.id, narrator: v.sex })}>{v.name} <span className="font-normal opacity-80">· {v.tag}{v.adminOnly ? " · แอดมิน" : ""}</span></button>
                        <button type="button" className={small} onClick={() => playSample(v.sample)} aria-label={`ฟังตัวอย่างเสียง ${v.name}`}>{playing === v.sample ? "■" : "▶"}</button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Step>

          {/* the cost and the button: pinned to the foot of a phone's screen, so they are always in view */}
          <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-5 pb-4 pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] lg:static lg:mx-0 lg:px-0 lg:pb-0 lg:shadow-none">
            {error && (
              <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
                {error.text}{" "}
                {error.contact && <Link href="/studio/account" className="font-medium underline">ไปที่บัญชีของฉัน</Link>}
              </p>
            )}
            {voiceBlocked && quota && (
              <p role="status" className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]">{voiceFullNotice(quota.clock)}</p>
            )}
            {line && (
              <p className={`rounded-lg px-3 py-2 text-sm ${line.blocked ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-soft)]"}`}>
                {line.text}{" "}
                {line.topUp && <Link href="/studio/wallet" className="font-medium underline">เติมเงิน</Link>}
              </p>
            )}
            <button
              type="button" onClick={make} disabled={busy || !ready || Boolean(line?.blocked) || voiceBlocked}
              className="w-full rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50 lg:w-auto"
            >
              {busy ? "กำลังเริ่ม…" : "สร้างคลิป"}
            </button>
            <p className="hidden text-xs text-[var(--ct-mute)] lg:block">ใช้เวลาประมาณ 2–3 นาที ปิดหน้านี้ได้ คลิปจะขึ้นในรายการ</p>
          </div>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start" aria-label="ตัวอย่างฉากเปิด">
          <div className="mx-auto max-w-[300px] lg:max-w-none">
            <OpeningPreview hero={heroFace} narrator={narratorFace} palette={look.palette} size={look.size} />
          </div>
          <p className="text-center text-xs text-[var(--ct-mute)]">ฉากเปิด · วงแดงคือตัวเอก{name ? ` (คุณ${name})` : ""}</p>
        </aside>
      </div>

      <ClipList items={items} setItems={setItems} pages={pages} />
    </div>
  );
}
