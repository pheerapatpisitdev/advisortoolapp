"use client";
import Link from "next/link";
import { useFreshLinks } from "./fresh-links";
import { useEffect, useRef, useState } from "react";
import type { CostView } from "@/lib/quote-video/make";
import type { VideoStart } from "@/lib/quote-video/link";
import type { Product, VideoInput, VideoLength, VideoStyle } from "@/lib/quote-video/script";
import type { PlbVariant } from "@/lib/quote-video/plb";
import { DEFAULT_THEME, readTheme, THEME_KEYS, THEME_LABELS, type ThemeKey } from "@/lib/quote-video/theme-keys";
import { PLB_SUMS } from "@/lib/quote-pdf/pages";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, videoPriceKey, type PriceKey, type Prices } from "@/lib/wallet/prices";
import { formatBaht } from "@/lib/wallet/money";
import type { VideoBrief, WrittenLines } from "@/lib/quote-video/brief";
import { REWRITES, StoryBrief, type ScriptState } from "./StoryBrief";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { ClipList } from "./ClipList";
import { geminiOf, VoicePicker } from "./VoicePicker";
import { GEMINI_DEFAULT, geminiVoice, type GeminiChoice } from "@/lib/voice/gemini";
import { makeFhcVideo, makeVideo, myCost, myVideos, previewQuote, previewScript, voiceQuota, type FhcChoice, type Preview, type VideoItem, type VoiceQuota } from "./actions";
import { useClipWatch } from "./useClipWatch";
import { ELEVEN_TO_GOOGLE, voiceNotice } from "@/lib/quote-video/voice-quota";
import { useElevenOff } from "./useElevenOff";
import { VIDEO_LANGS, type VideoLang } from "@/lib/quote-video/video-words";
import { LANG_NAME } from "@/lib/ihealthy-lang";

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";

/** what the next clip costs, under the button (คลิปเล่าเรื่อง's board too) */
/**
 * `total`: the clip's whole price when its voice or AI cut-outs add to the look's (previewQuote),
 * said as the look plus the extra, so the button never says less than the wallet will hold
 * (owner, 2026-10-18)
 */
export function costLine(c: CostView | null, key: PriceKey, total?: number): { text: string; blocked: boolean; topUp: boolean } | null {
  if (!c) return null;
  if (c.kind === "staff") return { text: "เจ้าของใช้ฟรี", blocked: false, topUp: false };
  if (c.kind === "free") return { text: `ใช้วิดีโอฟรี 1 ครั้ง · เหลือ ${c.left}/${c.of} ครั้ง`, blocked: false, topUp: false };
  // an agent who never had free clips is not told they used them up (owner, 2026-10-18)
  if (c.kind === "closed") return { text: c.noFree ? "ตอนนี้ยังใช้เครดิตและกระเป๋าเงินไม่ได้" : "ใช้วิดีโอฟรีครบแล้ว", blocked: true, topUp: false };
  const base = c.prices[key];
  if (!base) return null;
  const extra = total !== undefined && Number.isFinite(total) ? total - base.satang : 0;
  const p = extra > 0
    ? { price: `${formatBaht(total!)} (คลิป ${base.price} + เสียง/ภาพ ${formatBaht(extra)})`, enough: c.satang >= total! }
    : base;
  // a member's pass pays from its credit first, then their own money (owner, 2026-10-17)
  if (c.credit) {
    return p.enough
      ? { text: `หักจากเครดิตและกระเป๋า ${p.price} (คงเหลือ ${c.balance})`, blocked: false, topUp: false }
      : { text: `เครดิตและเงินในกระเป๋าไม่พอ (คลิปนี้ ${p.price} · คงเหลือ ${c.balance})`, blocked: true, topUp: true };
  }
  return p.enough
    ? { text: `ใช้วิดีโอฟรีครบแล้ว · หักจากกระเป๋า ${p.price} (ยอดคงเหลือ ${c.balance})`, blocked: false, topUp: false }
    : { text: `ยอดในกระเป๋าไม่พอ (คลิปนี้ ${p.price} · ยอดคงเหลือ ${c.balance})`, blocked: true, topUp: true };
}

const PRODUCTS: { code: Product; name: string; page: string }[] = [
  { code: "LIFEPROTECT", name: "Life Protect", page: "/lifeprotect" },
  { code: "ISHIELD", name: "iShield", page: "/ishield" },
  { code: "IHEALTHY", name: "iHealthy Ultra", page: "/ihealthy-ultra" },
  { code: "PENSION", name: "บำนาญ 95", page: "/bumnan95" },
  { code: "LEGACY", name: "มรดก", page: "/legacy" },
  { code: "PLB", name: "Protection Life", page: "/plb" },
  { code: "GSAVING", name: "Global Savings 15/8", page: "/global-saving" },
];
/** Global Savings' index returns the agent picks the clip's example at (owner, 2026-10-20): −1% to +5% */
const GS_RATE_CHOICES = [-1, 0, 1, 2, 3, 4, 5];
const gsRateWord = (r: number) => `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}%`;
/** Protection Life's sums as its page's slider steps them (owner, 2026-10-14): "3 แสน", "1.5 ล้าน" */
const plbSumWord = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000} ล้าน` : `${n / 100_000} แสน`);
/** มรดก's sizes (owner, 2026-10-14): the bundle's ten tiers, a million each */
const LEGACY_TIERS = Array.from({ length: 10 }, (_, i) => i + 1);
/** the plans with a list of paying terms by variant */
const termed = (p: Product): p is "LIFEPROTECT" | "ISHIELD" | "PLB" => p === "LIFEPROTECT" || p === "ISHIELD" || p === "PLB";
type PensionPay = "6" | "untilAnnuity";
const PENSION_STARTS = [55, 60, 65, 70];
/** the monthly pension in a sum, as the engine and the page say it (calc/pension/engine.ts MONTHLY_FACTOR_FIRST) */
const pensionMonthly = (sum: number) => Math.round(sum * 0.0127);
const TERMS: Record<"LIFEPROTECT" | "ISHIELD" | "PLB", { variant: string; years: number }[]> = {
  // จ่ายถึงอายุ 99 is Life Protect's third term (owner, 2026-10-11: it had gone missing)
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }, { variant: "WLF99H", years: 99 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
  // Protection Life (owner, 2026-10-14): paid and covered alike
  PLB: [{ variant: "PLB05", years: 5 }, { variant: "PLB10", years: 10 }, { variant: "PLB12", years: 12 }, { variant: "PLB15", years: 15 }],
};
const NARRATOR_KEY = "quote-video-narrator";
const SIZE_KEY = "quote-video-size";
/** the rest of step 4, remembered too (owner, 2026-10-12) */
const LENGTH_KEY = "quote-video-length";
/** the language an iHealthy clip was told in last time (owner, 2026-10-15) */
const LANG_KEY = "quote-video-lang";
const STYLE_KEY = "quote-video-style";
const THEME_KEY = "quote-video-theme";
const PIECES_KEY = "quote-video-pieces";
/** โจทย์การเล่า as it was left: the technique, the customer, the loop (owner, 2026-10-13) */
const BRIEF_KEY = "quote-video-brief";
/** the four lengths (owner, 2026-10-13: up to 2 minutes; told.ts sceneOrder) */
const LENGTH_CHOICES: { length: VideoLength; name: string; hint: string }[] = [
  { length: "short", name: "สั้น · ~15 วินาที", hint: "3 ฉาก: ตัวเลขเด่น · ราคา · ชวนทัก ไม่ใส่ชื่อลูกค้า เหมาะลงเพจเป็น Reels" },
  { length: "full", name: "เต็ม · ~50 วินาที", hint: "เล่าครบ 5 ฉากพร้อมตารางมูลค่า ใส่ชื่อลูกค้าได้" },
  { length: "long", name: "ยาว · ~90 วินาที", hint: "7 ฉาก: เพิ่มเรื่องของลูกค้า และถาม-ตอบ 2 ข้อ" },
  { length: "max", name: "2 นาที", hint: "9 ฉาก: เพิ่มเรื่องของลูกค้า เทียบกับเก็บเงินเอง ถาม-ตอบ และขั้นตอนเริ่มต้น · ยาวเกิน Reels ส่งให้ลูกค้าโดยตรง" },
];
/** the three shapes (owner, 2026-10-11, mockup https://claude.ai/artifact/8bhEgAdp4pCBiv581F1weq); icons only (owner ก, 2026-10-20, mockup https://claude.ai/artifact/5sAgpnxR8WqbzoB5QrQu4t) */
const SIZE_CHOICES: { size: VideoSize; name: string; ratio: string; shape: [number, number] }[] = [
  { size: "portrait", name: "แนวตั้ง 9:16", ratio: "9:16", shape: [16, 28] },
  { size: "square", name: "จัตุรัส 1:1", ratio: "1:1", shape: [24, 24] },
  { size: "landscape", name: "แนวนอน 16:9", ratio: "16:9", shape: [32, 18] },
];
const HOOK_WORD: Record<VideoBrief["hook"], string> = { question: "ถามสะกิด", shock: "ตัวเลขช็อก", myth: "สวนความเชื่อ", story: "เล่าเรื่อง", list: "ลิสต์ 3 ข้อ", plain: "ตรงไปตรงมา", auto: "ระบบเลือกฮุก" };

/** one numbered step of the form, with what it holds in a few words beside its heading */
export function Step({ n, title, summary, first, children }: { n: number; title: string; summary: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section className={`space-y-3 ${first ? "pb-4" : "border-t border-[var(--ct-hair)] py-4"}`}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ct-solid)] text-xs font-semibold text-[var(--ct-solid-ink)]">{n}</span>
        <h2 className="font-semibold">{title}</h2>
        {summary && <span className="ml-auto min-w-0 truncate text-right text-xs text-[var(--ct-mute)]">{summary}</span>}
      </div>
      {children}
    </section>
  );
}

export function SizePicker({ size, pick }: { size: VideoSize; pick: (s: VideoSize) => void }) {
  return (
    <div>
      <span className={label}>ขนาดวิดีโอ</span>
      <div className="flex flex-wrap gap-2">
        {SIZE_CHOICES.map((c) => (
          <button key={c.size} type="button" onClick={() => pick(c.size)} title={c.name} aria-label={c.name} aria-pressed={size === c.size}
            className={`flex h-[72px] w-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border text-xs tabular-nums ${size === c.size ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}>
            <span aria-hidden className="shrink-0 rounded-[3px] border-2 border-current opacity-80" style={{ width: c.shape[0], height: c.shape[1] }} />
            <span aria-hidden>{c.ratio}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const VOICE_KEY = "quote-video-eleven";
const GEMINI_KEY = "quote-video-gemini";
/**
 * a voice's sample in the clip's language: the 15-second iHealthy lines, read by Kore or Orus (owner,
 * 2026-10-15); the other 28 have their Thai sample only
 */
const sampleIn = (g: GeminiChoice, lang: VideoLang) => (lang === "th" || g.name !== GEMINI_DEFAULT[g.sex] ? g.sample : `/voice-samples/gemini-${g.sex}-${lang}.mp3`);
const DEFAULT_TERM = { LIFEPROTECT: "WLF19H", ISHIELD: "WLCI10", PLB: "PLB12" } as const;
/** the plans a clip compares, the main one included (owner, 2026-10-11: three fit a phone screen) */
const MAX_COMPARE = 3;

export interface PlanChoice { code: string; name: string }

export function QuoteVideoBoard({ ihuPlans, ages, pensionAges, initial, cost: firstCost, start, pages, eleven, fhc, quota: firstQuota, prices }: {
  ihuPlans: PlanChoice[]; initial: VideoItem[] | null; cost: CostView | null; start?: VideoStart;
  /** the owner's price list (/admin/wallet), for the prices on the chips */
  prices: Prices;
  /** Gemini's voice used up for the day, and when it comes back; null while it is there */
  quota: VoiceQuota | null;
  /** the agent's FHC customers, for วิดีโอสรุป FHC (owner, 2026-10-12) */
  fhc: FhcChoice[];
  /** the ages each product sells at, for the age dropdown */
  ages: Record<Product, { min: number; max: number }>;
  /** บำนาญ 95: the pension ages each age may choose, for each way of paying */
  pensionAges: Record<PensionPay, Record<number, number[]>>;
  /** the Pages the owner may put a clip on; empty for everyone else, who see no button */
  pages: { id: string; name: string }[];
  /** the ElevenLabs voices this viewer may pick; empty hides the AI-voice switch */
  eleven: ElevenChoice[];
}) {
  // a plan page's shortcut (owner, 2026-10-11) fills the form with the quote it was showing
  const startProduct = start?.product && start.product !== "FHC" ? start.product : "LIFEPROTECT";
  // a quote, or one FHC customer's summary (the customer page's button opens this one)
  const [kind, setKind] = useState<"quote" | "fhc">(start?.product === "FHC" ? "fhc" : "quote");
  const [fhcId, setFhcId] = useState(start?.fhc && fhc.some((c) => c.id === start.fhc) ? start.fhc : fhc[0]?.id ?? "");
  // the name goes in unless the agent takes the tick off (owner, 2026-10-12)
  const [withName, setWithName] = useState(true);
  const fhcPick = fhc.find((c) => c.id === fhcId);
  // the size picked last time, kept in this browser only (owner, 2026-10-11: like the voice)
  const [size, setSize] = useState<VideoSize>("portrait");
  useEffect(() => {
    try {
      const kept = localStorage.getItem(SIZE_KEY);
      if (kept === "square" || kept === "landscape") setSize(kept);
    } catch { /* storage closed: portrait stands */ }
  }, []);
  function pickSize(s: VideoSize) {
    setSize(s);
    try { localStorage.setItem(SIZE_KEY, s); } catch { /* not remembered, still used */ }
  }
  const startVariant = termed(startProduct) && start?.variant && TERMS[startProduct].some((x) => x.variant === start.variant)
    ? start.variant : termed(startProduct) ? DEFAULT_TERM[startProduct] : DEFAULT_TERM.LIFEPROTECT;
  const [product, setProduct] = useState<Product>(startProduct);
  const [narrator, setNarrator] = useState<"F" | "M">("F");
  // the voice picked last time, kept in this browser only (owner, 2026-10-11)
  useEffect(() => {
    try { if (localStorage.getItem(NARRATOR_KEY) === "M") setNarrator("M"); } catch { /* storage closed: the default stands */ }
  }, []);
  function pickNarrator(n: "F" | "M") {
    setNarrator(n);
    try { localStorage.setItem(NARRATOR_KEY, n); } catch { /* not remembered, still used */ }
  }
  // the AI-voice switch (owner, 2026-10-11): an ElevenLabs voice's id, or "" for Gemini
  const [voice, setVoice] = useState("");
  useEffect(() => {
    try {
      const kept = localStorage.getItem(VOICE_KEY) ?? "";
      if (eleven.some((v) => v.id === kept)) setVoice(kept);
    } catch { /* storage closed: Gemini stands */ }
  }, [eleven]);
  function pickVoice(id: string) {
    setVoice(id);
    try { localStorage.setItem(VOICE_KEY, id); } catch { /* not remembered, still used */ }
  }
  // one of Gemini's 30 voices (owner, 2026-10-17), or "" for the narrator's own; kept like the others
  const [gemini, setGemini] = useState("");
  useEffect(() => {
    try {
      const kept = geminiVoice(localStorage.getItem(GEMINI_KEY));
      if (kept) setGemini(kept.name);
    } catch { /* storage closed: the narrator's own stands */ }
  }, []);
  function pickGemini(name: string) {
    setGemini(name);
    try { localStorage.setItem(GEMINI_KEY, name); } catch { /* not remembered, still used */ }
  }
  const [plan, setPlan] = useState(start?.plan && ihuPlans.some((p) => p.code === start.plan) ? start.plan : "GOLD");
  const [compare, setCompare] = useState<string[]>([]);
  // iHealthy from its page (owner, 2026-10-14): the page's base, sum, territory, coverage and riders
  const [setup, setSetup] = useState(startProduct === "IHEALTHY" ? start?.setup : undefined);
  // Life Protect from its page (owner, 2026-10-17, 1ก): the riders its price included
  const [riders, setRiders] = useState(startProduct === "LIFEPROTECT" ? start?.riders : undefined);
  const [sex, setSex] = useState<"M" | "F">(start?.sex ?? "M");
  const [age, setAge] = useState(String(start?.age ?? 35));
  const [sum, setSum] = useState((start?.sumAssured ?? 1_000_000).toLocaleString("en-US"));
  const [variant, setVariant] = useState(startVariant);
  const [customer, setCustomer] = useState("");
  // Global Savings (owner, 2026-10-20): the yearly premium, and the index return the clip's example is worked at
  const [gsPremium, setGsPremium] = useState((start?.premium ?? 50_000).toLocaleString("en-US"));
  const [gsRate, setGsRate] = useState(3);
  // มรดก (owner, 2026-10-14): how many millions the family receives
  const [tier, setTier] = useState(start?.tier ?? 1);
  // บำนาญ 95 (owner, 2026-10-13): when the pension starts, how it is paid for, and how much a month
  const [annuityAge, setAnnuityAge] = useState(start?.annuityAge ?? 60);
  const [pay, setPay] = useState<PensionPay>(start?.pay ?? "untilAnnuity");
  const startPension = startProduct === "PENSION" ? start?.sumAssured : undefined;
  const [monthly, setMonthly] = useState((startPension ? pensionMonthly(startPension) : 10_000).toLocaleString("en-US"));
  // the page's own sum, sent as it is until the monthly figure is typed over, so the clip prices as the page did
  const [pensionSum, setPensionSum] = useState<number | undefined>(startPension);
  const startsFor = (a: number, p: PensionPay) => pensionAges[p]?.[a] ?? [];
  const pensionStart = (() => {
    const ok = startsFor(Number(age), pay);
    return ok.includes(annuityAge) ? annuityAge : ok[ok.length - 1] ?? annuityAge;
  })();
  const pensionYears = pay === "6" ? 6 : Math.max(0, pensionStart - Number(age));
  const [preview, setPreview] = useState<Preview | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; contact?: boolean } | null>(null);
  const [items, setItems] = useState<VideoItem[] | null>(initial);
  const [cost, setCost] = useState<CostView | null>(firstCost);
  // the voice-used-up warning (owner, 2026-10-12, mockup ข): gone by itself when the day turns over
  const [quota, setQuota] = useState<VoiceQuota | null>(firstQuota);
  useEffect(() => {
    if (!quota?.until) return;
    const t = setTimeout(() => setQuota(null), Math.max(0, Date.parse(quota.until) - Date.now()) + 5000);
    return () => clearTimeout(t);
  }, [quota]);
  const refreshQuota = () => voiceQuota().then(setQuota).catch(() => undefined);
  /** an ElevenLabs voice instead, of the narrator's sex where there is one */
  const elevenInstead = eleven.find((v) => v.sex === narrator) ?? eleven[0];
  const [style, setStyle] = useState<VideoStyle>("classic");
  // ธีม (owner, 2026-10-17): the Motion Graphic look, remembered in this browser
  const [theme, setTheme] = useState<ThemeKey>(DEFAULT_THEME);
  // คอลลาจ's cut-outs (owner, 2026-10-17): drawn new by AI unless the library's were asked for here before
  const [aiPieces, setAiPieces] = useState(true);
  const [pickedLength, setLength] = useState<VideoLength>("full");
  // ภาษาในวิดีโอ (owner, 2026-10-15, mockup https://claude.ai/artifact/H3HkP5iMpLD1rvEiCtdngb): iHealthy Ultra only
  // the iHealthy page's shortcut opens in the language the page was read in; otherwise the one kept
  const fromPage = start?.product === "IHEALTHY";
  const [lang, setLang] = useState<VideoLang>(fromPage ? start?.lang ?? "th" : "th");
  useEffect(() => {
    if (fromPage) return;
    try {
      const kept = localStorage.getItem(LANG_KEY);
      if ((VIDEO_LANGS as readonly string[]).includes(kept ?? "")) setLang(kept as VideoLang);
    } catch { /* storage closed: Thai stands */ }
  }, [fromPage]);
  function pickLang(l: VideoLang) {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* not remembered, still used */ }
  }
  /** another language: fixed lines, Gemini's narrator, the 15-second clip or the whole one */
  const foreign = kind === "quote" && product === "IHEALTHY" && lang !== "th";
  const length: VideoLength = foreign && pickedLength !== "short" ? "full" : pickedLength;
  // โจทย์การเล่า (owner, 2026-10-13): a new agent starts on ให้ระบบเลือก, so every clip opens on a hook
  const [brief, setBriefState] = useState<VideoBrief>({ hook: "auto" });
  const [script, setScript] = useState<ScriptState | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [rewrites, setRewrites] = useState(REWRITES);
  const [seed, setSeed] = useState(0);
  function setBrief(b: VideoBrief) {
    setBriefState(b);
    try { localStorage.setItem(BRIEF_KEY, JSON.stringify({ hook: b.hook, audience: b.audience, loop: b.loop })); } catch { /* not remembered, still used */ }
  }
  // step 4 as it was left last time, in this browser only (owner, 2026-10-12)
  useEffect(() => {
    try {
      if (localStorage.getItem(STYLE_KEY) === "motion") setStyle("motion");
      setTheme(readTheme(localStorage.getItem(THEME_KEY)));
      if (localStorage.getItem(PIECES_KEY) === "library") setAiPieces(false);
      const l = localStorage.getItem(LENGTH_KEY);
      if (l === "short" || l === "long" || l === "max") setLength(l);
      const b = JSON.parse(localStorage.getItem(BRIEF_KEY) ?? "null") as Partial<VideoBrief> | null;
      if (b && typeof b.hook === "string") setBrief({ hook: b.hook, ...(b.audience ? { audience: b.audience } : {}), ...(b.loop ? { loop: true } : {}) });
    } catch { /* storage closed: the defaults stand */ }
  }, []);
  function pickStyle(v: VideoStyle) {
    setStyle(v);
    try { localStorage.setItem(STYLE_KEY, v); } catch { /* not remembered, still used */ }
  }
  function pickPieces(ai: boolean) {
    setAiPieces(ai);
    try { localStorage.setItem(PIECES_KEY, ai ? "ai" : "library"); } catch { /* not remembered, still used */ }
  }
  function pickTheme(v: ThemeKey) {
    setTheme(v);
    try { localStorage.setItem(THEME_KEY, v); } catch { /* not remembered, still used */ }
  }
  function pickLength(v: VideoLength) {
    setLength(v);
    try { localStorage.setItem(LENGTH_KEY, v); } catch { /* not remembered, still used */ }
  }
  // where the clip begins: a sum (or plan), or what the customer can save each month / year
  const [source, setSource] = useState<"sum" | "month" | "year">("sum");
  // the page's riders go with the page's own sum: a budget prices the plan alone
  const lpRiders = product === "LIFEPROTECT" && source === "sum" ? riders : undefined;
  const [budget, setBudget] = useState("3,000");
  // an FHC summary has its own price, whatever its look (owner, 2026-10-12: ฿3); a quote clip its look's and length's
  const line = costLine(cost, kind === "fhc" ? "videoFhc" : videoPriceKey(style, length), kind === "fhc" || !preview || "error" in preview ? undefined : preview.clipSatang);

  const budgetOf = () => (source === "sum" ? undefined : { baht: Number(budget.replace(/[^\d]/g, "")), per: source });
  const themed = style === "motion" && theme !== DEFAULT_THEME ? { theme, ...(theme === "collage" && size === "portrait" && aiPieces ? { pieces: "ai" as const } : {}) } : {};
  const look = foreign
    ? { narrator, ...(gemini ? { gemini } : {}), style, ...themed, length, size, budget: budgetOf() }
    : { narrator, ...(voice ? { voice } : {}), ...(gemini ? { gemini } : {}), style, ...themed, length, size, budget: budgetOf(), brief, ...(script?.lines ? { lines: script.lines } : {}) };
  const input = (): VideoInput => (product === "IHEALTHY"
    ? { product, sex, age: Number(age), plan, compare: compare.filter((c) => c !== plan), ...(setup ? { setup } : {}), ...(foreign ? { lang } : {}), ...look }
    : product === "PENSION"
      ? {
          product, sex, age: Number(age), annuityAge: pensionStart, pay, ...look,
          // from the monthly pension typed, or the page's own sum; a budget works the sum out itself
          sumAssured: pensionSum ?? 0,
          ...(source === "sum" && pensionSum === undefined ? { monthly: Number(monthly.replace(/[^\d]/g, "")) } : {}),
        }
      : product === "LEGACY"
        // a budget works the tier out itself
        ? { product, sex, age: Number(age), tier, ...look }
      : product === "PLB"
        ? { product, variant: variant as PlbVariant, sex, age: Number(age), sumAssured: Number(sum.replace(/[^\d]/g, "")), ...look }
      : product === "GSAVING"
        // a budget works the premium out itself
        ? { product, sex, age: Number(age), premium: Number(gsPremium.replace(/[^\d]/g, "")), rate: gsRate, ...look }
        : { product, variant, sex, age: Number(age), sumAssured: Number(sum.replace(/[^\d]/g, "")), ...(lpRiders ? { riders: lpRiders } : {}), ...look });

  function pickProduct(p: Product) {
    setProduct(p);
    // an age the new product does not sell at is pulled onto its range
    setAge((a) => String(Math.min(ages[p].max, Math.max(ages[p].min, Number(a) || 35))));
    if (termed(p)) setVariant(DEFAULT_TERM[p]);
    // Protection Life's sums are its page's steps: anything else opens on its page's 1 ล้าน
    if (p === "PLB") setSum((was) => (PLB_SUMS.includes(Number(was.replace(/[^\d]/g, ""))) ? was : "1,000,000"));
  }
  function toggleCompare(code: string) {
    if (code === plan) return;
    setCompare((was) => (was.includes(code) ? was.filter((c) => c !== code) : was.length < MAX_COMPARE - 1 ? [...was, code] : was));
  }

  // the figures under the form follow what is typed, a moment after typing stops
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    if (kind === "fhc") return;
    const t = setTimeout(() => {
      previewQuote(input()).then((p) => { if (n === seq.current) setPreview(p); }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, product, sex, age, sum, variant, plan, compare, source, budget, pensionStart, pay, monthly, pensionSum, tier, setup, lpRiders]);

  // the script shown is the one for what the form holds: anything changed, and it is written again
  useEffect(() => {
    setScript(null);
    setScriptError(null);
  }, [kind, product, sex, age, sum, variant, plan, compare, source, budget, pensionStart, pay, monthly, pensionSum, length, brief, customer, narrator, voice, gemini, setup, lang, lpRiders]);

  /** ดูสคริปต์: written to the brief (again: another try), or the agent's edits read back */
  async function showScript(again: boolean) {
    setScriptBusy(true);
    setScriptError(null);
    const next = again ? seed + 1 : seed;
    try {
      const edited = !again && script?.lines;
      const r = await previewScript(input(), customer, next, !edited);
      if ("error" in r) setScriptError(r.error);
      else {
        setScript(r);
        if (again) { setSeed(next); setRewrites((n) => n - 1); }
      }
    } catch {
      setScriptError("เขียนสคริปต์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setScriptBusy(false);
    }
  }

  // links renewed when the agent comes back to a board left open past the hour they last
  useFreshLinks(() => { myVideos().then(setItems).catch(() => undefined); });
  // a clip still being made is asked after every few seconds, alone (useClipWatch); when it ends:
  useClipWatch("quote", items, setItems, () => {
    // a clip that ended may have given a free clip or money back, or found the voice used up
    myCost().then(setCost).catch(() => undefined);
    refreshQuota();
  });

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = kind === "fhc"
        ? await makeFhcVideo(fhcId, withName, { narrator, ...(voice ? { voice } : {}), ...(gemini ? { gemini } : {}), size, theme })
        : await makeVideo(input(), customer);
      if (!r.ok) {
        setError({ text: r.error, contact: r.needContact });
        refreshQuota();
      } else {
        setItems(await myVideos());
        // the next clip gets its own three tries
        setRewrites(REWRITES);
        setScript(null);
      }
      setCost(await myCost());
    } catch {
      setError({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  const ok = preview && !("error" in preview) ? preview : null;
  const resolvedPlan = ok?.resolved.plan ? ihuPlans.find((p) => p.code === ok.resolved.plan)?.name : undefined;
  /** what the budget bought, to keep and adjust by hand */
  function keepResolved() {
    if (!ok) return;
    if (ok.resolved.sum) setSum(ok.resolved.sum.toLocaleString("en-US"));
    if (ok.resolved.plan) setPlan(ok.resolved.plan);
    if (ok.resolved.tier) setTier(ok.resolved.tier);
    if (ok.resolved.monthly) {
      setMonthly(ok.resolved.monthly.toLocaleString("en-US"));
      setPensionSum(ok.resolved.sum);
    }
    setSource("sum");
  }
  // what each step holds, in a few words beside its heading (mockup https://claude.ai/artifact/3eguSuTE45fiV8WnHymyfC)
  const termWord = (v: string) => {
    const x = termed(product) ? TERMS[product].find((t) => t.variant === v) : undefined;
    return x ? (x.years === 99 ? "ถึงอายุ 99" : `${x.years} ปี`) : "";
  };
  const sumWord = (n: number) => (n % 1_000_000 === 0 ? `${n / 1_000_000} ล้าน` : n.toLocaleString("en-US"));
  // every clip comes in every shape (owner, 2026-10-13)
  const shownSize = size;
  // a Gemini-voiced clip would only fail while the voice is used up
  const elevenIsOff = useElevenOff(eleven.length > 0);
  const notice = voice && !foreign && elevenIsOff ? ELEVEN_TO_GOOGLE : quota && (!voice || foreign) ? voiceNotice(quota, !foreign) : null;
  const voiceBlocked = Boolean(notice?.blocked);
  const named = geminiOf({ narrator, gemini });
  const voiceWord = voice && !foreign ? eleven.find((v) => v.id === voice)?.name ?? "ElevenLabs"
    : named.name !== GEMINI_DEFAULT[named.sex] ? `เสียง ${named.name}` : narrator === "M" ? "เสียงชาย" : "เสียงหญิง";
  // the Motion Graphic look: วิดีโอนำเสนอ's in Motion, and สรุป FHC's (owner, 2026-10-17)
  const themeChips = (
    <div>
      <span className={label}>ธีม</span>
      <div className="flex flex-wrap gap-2">
        {THEME_KEYS.map((k) => (
          <button key={k} type="button" className={chip(theme === k)} onClick={() => pickTheme(k)}>
            <span aria-hidden className="inline-block h-3.5 w-5 shrink-0 rounded-[3px] border border-black/15" style={{ background: THEME_LABELS[k].swatch }} />
            {THEME_LABELS[k].name}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-[var(--ct-mute)]">{THEME_LABELS[theme].note} · ราคาเท่ากันทุกธีม</p>
    </div>
  );
  const summary = {
    brief: [HOOK_WORD[brief.hook], brief.loop ? "วนลูป" : ""].filter(Boolean).join(" · "),
    what: kind === "fhc" ? "สรุป FHC" : `${PRODUCTS.find((p) => p.code === product)?.name ?? ""}${foreign ? ` · ${LANG_NAME[lang]}` : ""}`,
    who: kind === "fhc"
      ? fhcPick?.name ?? ""
      : `${sex === "M" ? "ชาย" : "หญิง"} ${age}${customer.trim() && length !== "short" ? ` · ${foreign ? "" : "คุณ"}${customer.trim()}` : ""}`,
    plan: product === "IHEALTHY"
      ? (source === "sum" ? ihuPlans.find((p) => p.code === plan)?.name ?? "" : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`)
      : product === "PENSION"
        ? `${source === "sum" ? `บำนาญเดือนละ ${monthly}` : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`} · รับ ${pensionStart} · ${pay === "6" ? "จ่าย 6 ปี" : "จ่ายจนรับ"}`
      : product === "LEGACY"
        ? (source === "sum" ? `มรดก ${tier} ล้าน` : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`)
      : `${source === "sum" ? sumWord(Number(sum.replace(/[^\d]/g, "")) || 0) : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`} · ${termWord(variant)}`,
    look: [
      kind === "quote" ? ({ short: "สั้น", full: "เต็ม", long: "90 วิ", max: "2 นาที" } as const)[length] : "",
      kind === "quote" ? (style === "motion" ? "Motion" : "ปกติ") : THEME_LABELS[theme].name,
      SIZE_CHOICES.find((c) => c.size === shownSize)?.name.split(" ")[0] ?? "",
      voiceWord,
    ].filter(Boolean).join(" · "),
  };
  const money = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8));
    return n ? n.toLocaleString("en-US") : "";
  };
  // หน้าตาวิดีโอ: under both columns on a wide screen for a quote, its fields in two columns there;
  // a FHC summary has no โจทย์การเล่า, so there it fills the right column
  const lookStep = (
    <Step n={kind === "quote" ? 5 : 4} title="หน้าตาวิดีโอ" summary={summary.look}>
      <div className={kind === "quote" ? "space-y-3 xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-5 xl:gap-y-3 xl:space-y-0" : "space-y-3"}>
        {kind === "quote" && (
          <>
            <div>
              <span className={label}>ความยาว</span>
              <div className="flex flex-wrap gap-2">
                {LENGTH_CHOICES.filter((c) => !foreign || c.length === "short" || c.length === "full").map((c) => (
                  <button key={c.length} type="button" className={chip(length === c.length)} onClick={() => pickLength(c.length)}>
                    {c.name} <span className="font-normal opacity-80">· {priceBaht(prices[videoPriceKey(style, c.length)])} บาท</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--ct-mute)]">{LENGTH_CHOICES.find((c) => c.length === length)?.hint}</p>
            </div>
            <div>
              <span className={label}>สไตล์</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chip(style === "classic")} onClick={() => pickStyle("classic")}>แบบปกติ · {priceBaht(prices[videoPriceKey("classic", length)])} บาท</button>
                <button type="button" className={chip(style === "motion")} onClick={() => pickStyle("motion")}>Motion Graphic · {priceBaht(prices[videoPriceKey("motion", length)])} บาท</button>
              </div>
              <p className="mt-1 text-xs text-[var(--ct-mute)]">{style === "motion" ? "ไอคอนและกราฟเคลื่อนไหวอธิบายทีละเรื่อง ใช้เวลาสร้างนานกว่าเล็กน้อย" : "การ์ด รูปครอบครัว และตารางมูลค่า แบบเดียวกับใบเสนอ"}</p>
            </div>
            {style === "motion" && themeChips}
            {style === "motion" && theme === "collage" && (
              <div>
                <span className={label}>ภาพตัดแปะ</span>
                {size === "portrait" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={chip(aiPieces)} onClick={() => pickPieces(true)}>AI คิดและวาดใหม่ <span className="font-normal opacity-80">· ภาพละ {priceBaht(prices.drawStandard)} บาท</span></button>
                      <button type="button" className={chip(!aiPieces)} onClick={() => pickPieces(false)}>ภาพจากคลัง <span className="font-normal opacity-80">· ไม่มีค่าภาพ</span></button>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ct-mute)]">{aiPieces ? "AI อ่านบทแล้ววาดภาพให้คลิปนี้โดยเฉพาะ ฉากละ 1 ภาพ (ฉากราคา คุ้มครอง ติดต่อ) ใช้เวลาเพิ่มประมาณ 1 นาที ภาพไหนวาดไม่สำเร็จ ใช้ภาพจากคลังแทนและไม่คิดเงินภาพนั้น" : "ใช้ภาพตัดแปะที่วาดไว้ในคลังแล้ว"}</p>
                  </>
                ) : <p className="text-xs text-[var(--ct-mute)]">ภาพตัดแปะในฉากมีเฉพาะคลิปแนวตั้ง</p>}
              </div>
            )}
          </>
        )}
        {kind === "fhc" && (
          <>
            {themeChips}
            {theme === "collage" && (
              <p className="text-xs text-[var(--ct-mute)]">{size === "portrait" ? "ภาพตัดแปะ: AI เลือกจากคลังให้ตรงกับแต่ละฉาก วางในฉากที่มีที่ว่าง ไม่มีค่าภาพ" : "ภาพตัดแปะในฉากมีเฉพาะคลิปแนวตั้ง"}</p>
            )}
          </>
        )}
        <SizePicker size={size} pick={pickSize} />
        <VoicePicker
          id="qv-voice" pick={{ narrator, voice, gemini }} eleven={eleven} extraBaht={priceBaht(prices.elevenExtra)} foreign={foreign}
          onPick={(p) => { pickVoice(p.voice); if (!p.voice) { pickNarrator(p.narrator); pickGemini(p.gemini); } }}
          sampleOf={(g) => sampleIn(g, foreign ? lang : "th")}
          note={`${foreign
            ? `เสียง AI ของ Google พูด ${LANG_NAME[lang]} · เสียง ElevenLabs ซ่อนไว้ เพราะเป็นเสียงคนไทย`
            : voice ? `เสียงเหมือนคนพูด ใช้เสียงในบัญชี ElevenLabs · +${priceBaht(prices.elevenExtra)} บาท` : "เสียง AI ของ Google ราคาเดิม"} · ครั้งหน้าเปิดมาเป็นค่าเดิมทั้งขั้นนี้`}
        />
      </div>
    </Step>
  );
  return (
    // Organic Studio's desk (owner, 2026-10-15, mockup https://claude.ai/artifact/8B39tj4VDgrd9RsdCC23RL, option ค):
    // the form in a tools column that scrolls on its own, the clips on the squared desk beside it;
    // on a wide screen the tools column splits in two, steps 1–3 left, โจทย์การเล่า right and
    // หน้าตาวิดีโอ across both underneath (owner chose ก, mockup https://claude.ai/artifact/M7JUpGcpRLPpRh69dDRV29)
    <div className="mt-5 grid items-start gap-3 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[640px_minmax(0,1fr)]">
      <aside className="@container min-w-0 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 pb-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <div className="-mx-4 -mt-4 mb-4 border-b border-[var(--ct-hair)] px-4 py-2.5">
          <h2 className="font-semibold">เครื่องมือ</h2>
          <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เลือกแล้วกดสร้าง คลิปจะขึ้นบนโต๊ะ “กำลังสร้าง”</p>
        </div>
        <div className="xl:grid xl:grid-cols-2">
        <div className="min-w-0 xl:pr-5">
        <Step n={1} title="ทำวิดีโอเรื่อง" summary={summary.what} first>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((p) => <button key={p.code} type="button" className={chip(kind === "quote" && product === p.code)} onClick={() => { setKind("quote"); pickProduct(p.code); }}>{p.name}</button>)}
            <button type="button" className={chip(kind === "fhc")} onClick={() => setKind("fhc")}>สรุป FHC</button>
          </div>
          {kind === "quote" && product === "IHEALTHY" && (
            <div>
              <span className={label}>ภาษาในวิดีโอ</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="ภาษาในวิดีโอ">
                {VIDEO_LANGS.map((l) => <button key={l} type="button" lang={l} className={chip(lang === l)} onClick={() => pickLang(l)}>{LANG_NAME[l]}</button>)}
              </div>
              <p className="mt-1 text-xs text-[var(--ct-mute)]">
                {foreign
                  ? "เสียงพากย์ คำบรรยาย และตัวหนังสือบนจอเป็นภาษานี้ทั้งคลิป บทแปลไว้ตายตัว ตัวเลขจากใบเสนอเดิม · ครั้งหน้าเปิดมาเป็นภาษาเดิม"
                  : "เลือกภาษาอื่นได้ สำหรับลูกค้าต่างชาติ · ครั้งหน้าเปิดมาเป็นภาษาเดิม"}
              </p>
            </div>
          )}
        </Step>

        {kind === "fhc" ? (
          <>
            <Step n={2} title="ลูกค้า" summary={summary.who}>
              {fhc.length === 0 ? (
                <p className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm">
                  ยังไม่มีลูกค้า FHC — ตรวจสุขภาพการเงินกับลูกค้าแล้วกดเก็บรายชื่อก่อน{" "}
                  <Link href="/fhc" className="font-medium underline">ไปที่ Financial Health Check</Link>
                </p>
              ) : (
                <>
                  <div>
                    <label htmlFor="qv-fhc" className={label}>ลูกค้า (จากรายชื่อ FHC ของฉัน)</label>
                    <select id="qv-fhc" className={field} value={fhcId} onChange={(e) => setFhcId(e.target.value)}>
                      {fhc.map((c) => <option key={c.id} value={c.id}>{`${c.name} · ${c.line}`}</option>)}
                    </select>
                    {fhcPick && <p className="mt-1 text-xs text-[var(--ct-mute)]">{fhcPick.open}</p>}
                  </div>
                  <label className="flex items-start gap-2 text-sm" htmlFor="qv-fhc-name">
                    <input id="qv-fhc-name" type="checkbox" className="mt-1 h-4 w-4" checked={withName} onChange={(e) => setWithName(e.target.checked)} />
                    <span>
                      ใส่ชื่อ &quot;คุณ{fhcPick?.name ?? "…"}&quot; ในเสียงและบนจอ
                      <span className="block text-xs text-[var(--ct-mute)]">เอาติ๊กออก = เสียงพูด &quot;สวัสดีค่ะ&quot; เฉยๆ</span>
                    </span>
                  </label>
                </>
              )}
            </Step>
            <Step n={3} title="ผลตรวจ" summary="จากวันที่เก็บ">
              <p className="text-xs text-[var(--ct-mute)]">
                Motion Graphic 6 ฉาก ~70 วินาที: ผล 6 ด้าน · ขาดเท่าไร · 5 เหตุการณ์ · แผนที่แนะนำ · ช่องทางติดต่อ ·
                ตัวเลขมาจากผลตรวจวันที่เก็บ ไม่โชว์รายได้ ค่าใช้จ่าย หนี้ เป็นข้อมูลส่วนตัว ส่งให้ลูกค้าคนนี้เท่านั้น ลงเพจไม่ได้
              </p>
            </Step>
          </>
        ) : (
          <>
            <Step n={2} title="ลูกค้า" summary={summary.who}>
              <div className="grid gap-4 @sm:grid-cols-2">
                <div>
                  <span className={label}>เพศ</span>
                  <div className="flex gap-2">
                    <button type="button" className={chip(sex === "M")} onClick={() => setSex("M")}>ชาย</button>
                    <button type="button" className={chip(sex === "F")} onClick={() => setSex("F")}>หญิง</button>
                  </div>
                </div>
                <div>
                  <label htmlFor="qv-age" className={label}>อายุ</label>
                  <select id="qv-age" className={field} value={age} onChange={(e) => setAge(e.target.value)}>
                    {Array.from({ length: ages[product].max - ages[product].min + 1 }, (_, i) => ages[product].min + i).map((a) => (
                      <option key={a} value={String(a)}>{a} ปี</option>
                    ))}
                  </select>
                </div>
              </div>
              {length !== "short" ? (
                <div>
                  <label htmlFor="qv-customer" className={label}>ชื่อลูกค้า (ไม่บังคับ)</label>
                  <input id="qv-customer" className={field} value={customer} maxLength={40} placeholder={foreign ? "เช่น Anna" : "เช่น สมชาย"} onChange={(e) => setCustomer(e.target.value)} />
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">
                    {foreign
                      ? `พิมพ์ชื่อเป็นตัวอังกฤษ เสียงพากย์จะทัก "Hello, ${customer.trim() || "Anna"}" และขึ้นชื่อบนภาพในคลิป`
                      : "ใส่แล้วเสียงพากย์จะทักชื่อ และขึ้นชื่อบนภาพในคลิป"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--ct-mute)]">คลิปสั้นไม่ใส่ชื่อลูกค้า (ทำไว้ลงเพจ)</p>
              )}
            </Step>

            <Step n={3} title="แผน" summary={summary.plan}>
              {product === "PENSION" && (
                <div className="grid gap-4 @sm:grid-cols-2">
                  <div>
                    <span className={label}>เริ่มรับบำนาญอายุ</span>
                    <div className="flex flex-wrap gap-2">
                      {PENSION_STARTS.map((a) => (
                        <button key={a} type="button" className={`${chip(pensionStart === a)} disabled:cursor-not-allowed disabled:opacity-40`} onClick={() => setAnnuityAge(a)}
                          disabled={!startsFor(Number(age), pay).includes(a)}>{a}</button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-[var(--ct-mute)]">รับบำนาญถึงอายุ 95 · อายุที่เลือกไม่ได้จะกดไม่ได้</p>
                  </div>
                  <div>
                    <span className={label}>ชำระเบี้ย</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={chip(pay === "6")} onClick={() => setPay("6")}>6 ปี</button>
                      <button type="button" className={chip(pay === "untilAnnuity")} onClick={() => setPay("untilAnnuity")}>
                        {pay === "untilAnnuity" && pensionYears > 0 ? `จนถึงอายุรับบำนาญ (${pensionYears} ปี)` : "จนถึงอายุรับบำนาญ"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <span className={label}>เริ่มจาก</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={chip(source === "sum")} onClick={() => setSource("sum")}>{product === "IHEALTHY" ? "เลือกแผนเอง" : product === "PENSION" ? "บำนาญต่อเดือน" : product === "LEGACY" ? "ขนาดมรดก" : product === "PLB" ? "ทุน" : product === "GSAVING" ? "เบี้ยต่อปี" : "ทุนประกัน"}</button>
                  <button type="button" className={chip(source === "month")} onClick={() => setSource("month")}>{product === "LEGACY" || product === "PLB" ? "งบเดือน" : "งบต่อเดือน"}</button>
                  <button type="button" className={chip(source === "year")} onClick={() => setSource("year")}>{product === "LEGACY" || product === "PLB" ? "งบปี" : "งบต่อปี"}</button>
                </div>
              </div>
              {product === "LEGACY" && source === "sum" && (
                <div>
                  <span className={label}>ขนาดมรดก</span>
                  <div className="flex flex-wrap gap-2">
                    {LEGACY_TIERS.map((n) => <button key={n} type="button" className={chip(tier === n)} onClick={() => setTier(n)}>{n} ล้าน</button>)}
                  </div>
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">ครอบครัวได้รับเท่านี้ (ก่อนอายุ 60 ได้มากกว่า) · รับอายุ 20–65 ปี</p>
                </div>
              )}
              {(source !== "sum" || (product !== "IHEALTHY" && product !== "LEGACY")) && (
                <div className={`grid gap-4 ${product === "PLB" ? "" : "@sm:grid-cols-2"}`}>
                  {source !== "sum" ? (
                    <div>
                      <label htmlFor="qv-budget" className={label}>{product === "LEGACY" || product === "PLB"
                        ? (source === "month" ? "งบที่ลูกค้าจ่ายไหวต่อเดือน (บาท)" : "งบที่ลูกค้าจ่ายไหวต่อปี (บาท)")
                        : source === "month" ? "งบที่ลูกค้าออมไหวต่อเดือน (บาท)" : "งบที่ลูกค้าออมไหวต่อปี (บาท)"}</label>
                      <input id="qv-budget" inputMode="numeric" className={field} value={budget} onChange={(e) => setBudget(money(e))} />
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">{product === "IHEALTHY" ? "ระบบเลือกแผนที่วงเงินสูงสุดที่เบี้ยไม่เกินงบ" : product === "PENSION" ? "ระบบคิดทุนจากงบนี้ ด้วยเครื่องคิดเดียวกับหน้า บำนาญ 95"
                        : product === "LEGACY" ? "ระบบเลือกขนาดมรดกที่ใหญ่ที่สุดที่ค่าใช้จ่ายปีแรกไม่เกินงบ · รายเดือนขั้นต่ำ 1,000 บาท"
                        : product === "PLB" ? "ระบบเลือกทุนสูงสุด (ตามขั้นของหน้า Protection Life) ที่ค่าใช้จ่ายไม่เกินงบ ในระยะที่เลือก · รายเดือนขั้นต่ำ 1,000 บาท"
                        : product === "GSAVING" ? "แบบนี้จ่ายรายปี งบต่อเดือนคิดเป็นเบี้ยปีละ 12 เท่า · ขั้นต่ำปีละ 20,000 บาท" : "ระบบเลือกทุนสูงสุด (ทีละ 50,000) ที่เบี้ยไม่เกินงบ"}</p>
                    </div>
                  ) : product === "PENSION" ? (
                    <div>
                      <label htmlFor="qv-monthly" className={label}>บำนาญที่อยากได้ต่อเดือน (บาท)</label>
                      <input id="qv-monthly" inputMode="numeric" className={field} value={monthly} onChange={(e) => { setMonthly(money(e)); setPensionSum(undefined); }} />
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">ทุนประกัน 75,000 – 20 ล้านบาท</p>
                    </div>
                  ) : product === "GSAVING" ? (
                    <div>
                      <label htmlFor="qv-gs-premium" className={label}>เบี้ยต่อปี (บาท)</label>
                      <input id="qv-gs-premium" inputMode="numeric" className={field} value={gsPremium} onChange={(e) => setGsPremium(money(e))} />
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">ขั้นต่ำ 20,000 · จ่าย 8 ปี ครบสัญญา 15 ปี · รับอายุ 0–75 ปี</p>
                    </div>
                  ) : product === "PLB" ? (
                    <div>
                      <span className={label}>ทุนประกัน</span>
                      <div className="flex flex-wrap gap-2">
                        {PLB_SUMS.map((n) => <button key={n} type="button" className={chip(Number(sum.replace(/[^\d]/g, "")) === n)} onClick={() => setSum(n.toLocaleString("en-US"))}>{plbSumWord(n)}</button>)}
                      </div>
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">ถ้าเป็นอะไรไปในช่วงสัญญา ครอบครัวได้เท่าทุน · รับอายุ 20–59 ปี</p>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="qv-sum" className={label}>ทุนประกัน (บาท)</label>
                      <input id="qv-sum" inputMode="numeric" className={field} value={sum} onChange={(e) => setSum(money(e))} />
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">ทีละ 50,000</p>
                    </div>
                  )}
                  {termed(product) && (
                    <div>
                      <span className={label}>{product === "PLB" ? "ระยะเวลา (จ่ายเท่าไหร่ คุ้มครองเท่านั้น)" : "ชำระเบี้ย"}</span>
                      <div className="flex flex-wrap gap-2">
                        {TERMS[product].map((x) => <button key={x.variant} type="button" className={chip(variant === x.variant)} onClick={() => setVariant(x.variant)}>{x.years === 99 ? "ถึงอายุ 99" : `${x.years} ปี`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {product === "GSAVING" && (
                <div>
                  <span className={label}>ดัชนีต่อปี (ตัวอย่างในคลิป)</span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="ดัชนีต่อปี">
                    {GS_RATE_CHOICES.map((r) => <button key={r} type="button" aria-pressed={gsRate === r} className={chip(gsRate === r)} onClick={() => setGsRate(r)}>{gsRateWord(r)}</button>)}
                  </div>
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">ใช้กับโบนัสในฉากที่ 4 และเสียง · ส่วนการันตีเท่าเดิมทุกค่า · คลิปบอกว่า “ประมาณ” และ “ไม่การันตี” ทุกครั้ง</p>
                </div>
              )}
              {product === "LIFEPROTECT" && source === "sum" && (riders ? (
                <div className="space-y-1 rounded-lg border-[1.5px] border-[var(--ct-accent)] px-4 py-3 text-sm">
                  <p className="font-semibold">ใช้สัญญาเพิ่มเติมจากหน้า Life Protect</p>
                  {ok?.riders && <p>สัญญาเพิ่มเติม: {ok.riders}</p>}
                  <button type="button" className="text-xs text-[var(--ct-mute)] underline" onClick={() => setRiders(undefined)}>ไม่ใส่สัญญาเพิ่มเติม</button>
                </div>
              ) : (
                <p className="text-xs text-[var(--ct-mute)]">อยากใส่สัญญาเพิ่มเติม ให้กด “ทำวิดีโอ” จากหน้า Life Protect</p>
              ))}
              {product === "IHEALTHY" && (
                <>
                  {setup && (
                    <div className="space-y-1 rounded-lg border-[1.5px] border-[var(--ct-accent)] px-4 py-3 text-sm">
                      <p className="font-semibold">ใช้แผนจากหน้า iHealthy Ultra</p>
                      {ok?.setup && (
                        <ul className="list-disc pl-5">
                          <li>{ok.setup.line}</li>
                          <li>สัญญาเพิ่มเติม: {ok.setup.riders}</li>
                        </ul>
                      )}
                      <button type="button" className="text-xs text-[var(--ct-mute)] underline" onClick={() => setSetup(undefined)}>กลับไปใช้ค่าเริ่มต้น</button>
                    </div>
                  )}
                  {source === "sum" && (
                    <div>
                      <span className={label}>แผนหลัก</span>
                      <div className="flex flex-wrap gap-2">
                        {ihuPlans.map((p) => <button key={p.code} type="button" className={chip(plan === p.code)} onClick={() => { setPlan(p.code); setCompare((c) => c.filter((x) => x !== p.code)); }}>{p.name}</button>)}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className={label}>แผนที่จะเทียบในวิดีโอ (ไม่บังคับ เลือกได้อีก {MAX_COMPARE - 1} แผน)</span>
                    <div className="flex flex-wrap gap-2">
                      {ihuPlans.filter((p) => p.code !== plan).map((p) => (
                        <button key={p.code} type="button" className={chip(compare.includes(p.code))} onClick={() => toggleCompare(p.code)}
                          disabled={!compare.includes(p.code) && compare.length >= MAX_COMPARE - 1}>{p.name}</button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-[var(--ct-mute)]">ไม่เลือก = ไม่มีช่วงเทียบแผน{setup ? "" : " · พื้นที่ประเทศไทย ทุนชีวิต 50,000 ค่าชดเชยรายวัน 1,000 ตามค่าเริ่มต้นหน้า iHealthy Ultra"}</p>
                  </div>
                </>
              )}
              <div className="rounded-lg bg-[var(--ct-soft)] px-4 py-3 text-sm tabular-nums">
                {ok ? (
                  <div className="space-y-0.5">
                    <div className="flex justify-between gap-2"><span>{ok.lead.label}</span><b>{ok.lead.amount} บาท</b></div>
                    {ok.prices.map((p) => (
                      <div key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><b>{p.amount} บาท</b></div>
                    ))}
                    {source !== "sum" && (
                      <p className="font-medium">
                        {ok.resolved.tier ? `เลือกขนาดให้: มรดก ${ok.resolved.tier} ล้าน` : ok.resolved.sum ? `คิดทุนให้: ${ok.resolved.sum.toLocaleString("en-US")} บาท` : `เลือกแผนให้: ${resolvedPlan ?? ""}`}{" "}
                        <button type="button" className="underline" onClick={keepResolved}>ใช้ค่านี้แล้วแก้เอง</button>
                      </p>
                    )}
                    <p className="text-xs text-[var(--ct-mute)]">{ok.mark} · ตัวเลขชุดเดียวกับหน้า {PRODUCTS.find((p) => p.code === product)?.page}</p>
                  </div>
                ) : (
                  <p className="text-[var(--ct-mute)]">{preview && "error" in preview ? preview.error : "กำลังคิดราคา…"}</p>
                )}
              </div>
            </Step>
          </>
        )}
        </div>

        {/* the right column: its first step drops the top rule, the column rule stands in for it */}
        <div className="min-w-0 xl:border-l xl:border-[var(--ct-hair)] xl:pl-5 xl:[&>section:first-child]:border-t-0 xl:[&>section:first-child]:pt-0">
        {kind === "quote" && foreign && (
          <Step n={4} title="โจทย์การเล่า" summary="บทมาตรฐาน">
            <p className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm">
              {LANG_NAME[lang]} ใช้บทมาตรฐานที่แปลไว้ตายตัว ตรวจคำได้ทุกคำ ขั้นนี้จึงไม่ต้องเลือก · อยากใช้โจทย์การเล่า เลือกภาษา <b>ไทย</b>
            </p>
          </Step>
        )}
        {kind === "quote" && !foreign && (
          <Step n={4} title="โจทย์การเล่า" summary={summary.brief}>
            <StoryBrief
              brief={brief} setBrief={setBrief} stories={ok?.stories ?? []} longClip={length === "long" || length === "max"}
              script={script} setLines={(l: WrittenLines) => setScript((was) => (was ? { ...was, lines: l } : was))}
              busy={scriptBusy} rewritesLeft={rewrites} onPreview={(again) => void showScript(again)} error={scriptError}
            />
          </Step>
        )}
        {kind === "fhc" && lookStep}
        </div>
        {kind === "quote" && <div className="min-w-0 xl:col-span-2">{lookStep}</div>}
        </div>

        {/* the cost and the button: pinned to the foot of a phone's screen, so they are always in view;
            on a wide screen the notes sit left of the button */}
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-4 pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] xl:grid xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center xl:gap-3 xl:space-y-0">
          <div className="min-w-0 space-y-2">
          {error && (
            <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">
              {error.text}{" "}
              {error.contact && <Link href="/studio/account" className="font-medium underline">ไปที่บัญชีของฉัน</Link>}
            </p>
          )}
          {notice && (
            <p role="status" className={notice.ok ? "rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm text-[var(--ct-accent)]" : "rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]"}>
              {notice.text}
              {notice.blocked && elevenInstead && !foreign && (
                <>{" "}หรือ <button type="button" className="font-semibold underline" onClick={() => pickVoice(elevenInstead.id)}>เปลี่ยนไปใช้เสียง ElevenLabs</button> ซึ่งทำได้ทันที</>
              )}
            </p>
          )}
          {line && (
            <p className={`rounded-lg px-3 py-2 text-sm ${line.blocked ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-soft)]"}`}>
              {line.text}{" "}
              {line.topUp && <Link href="/studio/wallet" className="font-medium underline">เติมเงิน</Link>}
            </p>
          )}
          <p className="hidden text-xs text-[var(--ct-mute)] xl:block">ใช้เวลาประมาณ 1–2 นาที ปิดหน้านี้ได้ คลิปจะขึ้นบนโต๊ะ</p>
          </div>
          <button
            type="button" onClick={make} disabled={busy || (kind === "fhc" ? !fhcPick : !ok) || Boolean(line?.blocked) || voiceBlocked}
            className="w-full rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "กำลังเริ่ม…" : "สร้างวิดีโอ"}
          </button>
          <p className="hidden text-xs text-[var(--ct-mute)] lg:block xl:hidden">ใช้เวลาประมาณ 1–2 นาที ปิดหน้านี้ได้ คลิปจะขึ้นบนโต๊ะ</p>
        </div>
      </aside>

      <section aria-label="วิดีโอที่สร้างแล้ว" className="studio-desk min-w-0 rounded-xl border border-[var(--ct-hair)] p-3 lg:min-h-[70dvh] lg:self-stretch">
        <ClipList items={items} setItems={setItems} pages={pages} />
      </section>
    </div>
  );
}
