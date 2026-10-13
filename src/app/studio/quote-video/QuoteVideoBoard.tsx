"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CostView } from "@/lib/quote-video/make";
import type { VideoStart } from "@/lib/quote-video/link";
import type { Product, VideoInput, VideoLength, VideoStyle } from "@/lib/quote-video/script";
import type { ElevenChoice } from "@/lib/voice/elevenlabs";
import { priceBaht, type Prices } from "@/lib/wallet/prices";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { SaveVideoButton } from "./SaveVideoButton";
import { addToCalendar, calendarCaption, makeFhcVideo, makeVideo, myCost, myVideos, previewQuote, removeVideo, voiceQuota, type FhcChoice, type Preview, type VideoItem, type VoiceQuota } from "./actions";
import { voiceFullNotice } from "@/lib/quote-video/voice-quota";

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const card = "rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm no-underline hover:bg-[var(--ct-soft)] inline-flex items-center";
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const STATUS: Record<VideoItem["status"], string> = { drawing: "กำลังทำเสียงและภาพ…", rendering: "กำลังรวมเป็นวิดีโอ…", done: "เสร็จ", failed: "ไม่สำเร็จ" };

/** what the next clip costs, under the button */
function costLine(c: CostView | null, style: VideoStyle | "fhc"): { text: string; blocked: boolean; topUp: boolean } | null {
  if (!c) return null;
  if (c.kind === "staff") return { text: "เจ้าของใช้ฟรี", blocked: false, topUp: false };
  if (c.kind === "free") return { text: `ใช้วิดีโอฟรี 1 ครั้ง · เหลือ ${c.left}/${c.of} ครั้ง`, blocked: false, topUp: false };
  if (c.kind === "closed") return { text: "ใช้วิดีโอฟรีครบแล้ว", blocked: true, topUp: false };
  const p = c.prices[style];
  return p.enough
    ? { text: `ใช้วิดีโอฟรีครบแล้ว · หักจากกระเป๋า ${p.price} (ยอดคงเหลือ ${c.balance})`, blocked: false, topUp: false }
    : { text: `ยอดในกระเป๋าไม่พอ (คลิปนี้ ${p.price} · ยอดคงเหลือ ${c.balance})`, blocked: true, topUp: true };
}

const PRODUCTS: { code: Product; name: string; page: string }[] = [
  { code: "LIFEPROTECT", name: "Life Protect", page: "/lifeprotect" },
  { code: "ISHIELD", name: "iShield", page: "/ishield" },
  { code: "IHEALTHY", name: "iHealthy Ultra", page: "/ihealthy-ultra" },
  { code: "PENSION", name: "บำนาญ 95", page: "/bumnan95" },
];
/** the plans with a list of paying terms by variant */
const termed = (p: Product): p is "LIFEPROTECT" | "ISHIELD" => p === "LIFEPROTECT" || p === "ISHIELD";
type PensionPay = "6" | "untilAnnuity";
const PENSION_STARTS = [55, 60, 65, 70];
/** the monthly pension in a sum, as the engine and the page say it (calc/pension/engine.ts MONTHLY_FACTOR_FIRST) */
const pensionMonthly = (sum: number) => Math.round(sum * 0.0127);
const TERMS: Record<"LIFEPROTECT" | "ISHIELD", { variant: string; years: number }[]> = {
  // จ่ายถึงอายุ 99 is Life Protect's third term (owner, 2026-10-11: it had gone missing)
  LIFEPROTECT: [{ variant: "WLF09H", years: 9 }, { variant: "WLF19H", years: 19 }, { variant: "WLF99H", years: 99 }],
  ISHIELD: [{ variant: "WLCI05", years: 5 }, { variant: "WLCI10", years: 10 }, { variant: "WLCI15", years: 15 }, { variant: "WLCI20", years: 20 }],
};
const NARRATOR_KEY = "quote-video-narrator";
const SIZE_KEY = "quote-video-size";
/** the rest of step 4, remembered too (owner, 2026-10-12) */
const LENGTH_KEY = "quote-video-length";
const STYLE_KEY = "quote-video-style";
/** the three shapes (owner, 2026-10-11, mockup https://claude.ai/artifact/8bhEgAdp4pCBiv581F1weq) */
const SIZE_CHOICES: { size: VideoSize; name: string; use: string; shape: [number, number]; hint: string }[] = [
  { size: "portrait", name: "แนวตั้ง 9:16", use: "Reels · Stories · TikTok · LINE VOOM", shape: [16, 28], hint: "เหมาะกับดูบนมือถือและลงเพจเป็น Reels" },
  { size: "square", name: "จัตุรัส 1:1", use: "ฟีด Facebook / Instagram · แชท LINE", shape: [24, 24], hint: "ดูได้เต็มช่องในฟีดและแชท ไม่ต้องหมุนมือถือ · ลงปฏิทินเพจไม่ได้ (Reels รับแค่แนวตั้ง)" },
  { size: "landscape", name: "แนวนอน 16:9", use: "YouTube · เปิดให้ลูกค้าดูบน iPad / ทีวี", shape: [32, 18], hint: "เหมาะเปิดบน iPad / ทีวี หรือ YouTube · บนมือถือจะเป็นแถบสั้นๆ ถ้าไม่หมุนจอ · ลงปฏิทินเพจไม่ได้" },
];
const ASPECT: Record<VideoSize, string> = { portrait: "9 / 16", square: "1 / 1", landscape: "16 / 9" };

/** one numbered step of the form, with what it holds in a few words beside its heading */
function Step({ n, title, summary, first, children }: { n: number; title: string; summary: string; first?: boolean; children: React.ReactNode }) {
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

function SizePicker({ size, pick }: { size: VideoSize; pick: (s: VideoSize) => void }) {
  const hint = SIZE_CHOICES.find((c) => c.size === size)?.hint;
  return (
    <div>
      <span className={label}>ขนาดวิดีโอ</span>
      <div className="flex flex-wrap gap-2">
        {SIZE_CHOICES.map((c) => (
          <button key={c.size} type="button" onClick={() => pick(c.size)}
            className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${size === c.size ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}>
            <span aria-hidden className="shrink-0 rounded-[3px] border-2 border-current opacity-80" style={{ width: c.shape[0], height: c.shape[1] }} />
            <span><span className="block font-medium">{c.name}</span><span className="block text-xs opacity-80">{c.use}</span></span>
          </button>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-[var(--ct-mute)]">{hint}</p>}
    </div>
  );
}
const VOICE_KEY = "quote-video-eleven";
/** Gemini's two narrators and their samples (owner, 2026-10-11) */
const GEMINI = [
  { n: "F" as const, name: "ผู้หญิง", tag: "Kore", sample: "/voice-samples/gemini-F.mp3" },
  { n: "M" as const, name: "ผู้ชาย", tag: "Orus", sample: "/voice-samples/gemini-M.mp3" },
];
const DEFAULT_TERM = { LIFEPROTECT: "WLF19H", ISHIELD: "WLCI10" } as const;
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
  // one sample plays at a time
  const player = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  function playSample(src: string) {
    const was = player.current;
    was?.pause();
    if (playing === src) { setPlaying(null); return; }
    const a = new Audio(src);
    a.onended = () => setPlaying(null);
    player.current = a;
    setPlaying(src);
    a.play().catch(() => setPlaying(null));
  }
  useEffect(() => () => player.current?.pause(), []);
  const [plan, setPlan] = useState(start?.plan && ihuPlans.some((p) => p.code === start.plan) ? start.plan : "GOLD");
  const [compare, setCompare] = useState<string[]>([]);
  const [sex, setSex] = useState<"M" | "F">(start?.sex ?? "M");
  const [age, setAge] = useState(String(start?.age ?? 35));
  const [sum, setSum] = useState((start?.sumAssured ?? 1_000_000).toLocaleString("en-US"));
  const [variant, setVariant] = useState(startVariant);
  const [customer, setCustomer] = useState("");
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
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; text: string } | null>(null);

  // the owner's calendar panel, one clip at a time
  const [cal, setCal] = useState<{ id: string; page: string; caption: string; busy: boolean; error?: string; done?: string } | null>(null);
  async function openCalendar(id: string) {
    setCal({ id, page: pages[0]?.id ?? "", caption: "", busy: true });
    const r = await calendarCaption(id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setCal((c) => (c?.id === id ? (r.ok ? { ...c, caption: r.caption, busy: false } : { ...c, busy: false, error: r.error }) : c));
  }
  async function sendCalendar() {
    if (!cal) return;
    setCal({ ...cal, busy: true, error: undefined });
    const r = await addToCalendar(cal.id, cal.page, cal.caption).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setCal((c) => (c ? (r.ok ? { ...c, busy: false, done: r.pageId } : { ...c, busy: false, error: r.error }) : c));
  }

  async function remove(id: string) {
    setDeleteError(null);
    const r = await removeVideo(id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setConfirming(null);
    if (!r.ok) { setDeleteError({ id, text: r.error }); return; }
    setItems((was) => was?.filter((v) => v.id !== id) ?? was);
  }
  const [cost, setCost] = useState<CostView | null>(firstCost);
  // the voice-used-up warning (owner, 2026-10-12, mockup ข): gone by itself when the day turns over
  const [quota, setQuota] = useState<VoiceQuota | null>(firstQuota);
  useEffect(() => {
    if (!quota) return;
    const t = setTimeout(() => setQuota(null), Math.max(0, Date.parse(quota.until) - Date.now()) + 5000);
    return () => clearTimeout(t);
  }, [quota]);
  const refreshQuota = () => voiceQuota().then(setQuota).catch(() => undefined);
  /** an ElevenLabs voice instead, of the narrator's sex where there is one */
  const elevenInstead = eleven.find((v) => v.sex === narrator) ?? eleven[0];
  const [style, setStyle] = useState<VideoStyle>("classic");
  const [length, setLength] = useState<VideoLength>("full");
  // step 4 as it was left last time, in this browser only (owner, 2026-10-12)
  useEffect(() => {
    try {
      if (localStorage.getItem(STYLE_KEY) === "motion") setStyle("motion");
      if (localStorage.getItem(LENGTH_KEY) === "short") setLength("short");
    } catch { /* storage closed: the defaults stand */ }
  }, []);
  function pickStyle(v: VideoStyle) {
    setStyle(v);
    try { localStorage.setItem(STYLE_KEY, v); } catch { /* not remembered, still used */ }
  }
  function pickLength(v: VideoLength) {
    setLength(v);
    try { localStorage.setItem(LENGTH_KEY, v); } catch { /* not remembered, still used */ }
  }
  // where the clip begins: a sum (or plan), or what the customer can save each month / year
  const [source, setSource] = useState<"sum" | "month" | "year">("sum");
  const [budget, setBudget] = useState("3,000");
  // an FHC summary has its own price, whatever its look (owner, 2026-10-12: ฿3)
  const line = costLine(cost, kind === "fhc" ? "fhc" : style);

  const budgetOf = () => (source === "sum" ? undefined : { baht: Number(budget.replace(/[^\d]/g, "")), per: source });
  const look = { narrator, ...(voice ? { voice } : {}), style, length, size, budget: budgetOf() };
  const input = (): VideoInput => (product === "IHEALTHY"
    ? { product, sex, age: Number(age), plan, compare: compare.filter((c) => c !== plan), ...look }
    : product === "PENSION"
      ? {
          product, sex, age: Number(age), annuityAge: pensionStart, pay, ...look,
          // from the monthly pension typed, or the page's own sum; a budget works the sum out itself
          sumAssured: pensionSum ?? 0,
          ...(source === "sum" && pensionSum === undefined ? { monthly: Number(monthly.replace(/[^\d]/g, "")) } : {}),
        }
      : { product, variant, sex, age: Number(age), sumAssured: Number(sum.replace(/[^\d]/g, "")), narrator, ...(voice ? { voice } : {}), style, length, size, budget: budgetOf() });

  function pickProduct(p: Product) {
    setProduct(p);
    // an age the new product does not sell at is pulled onto its range
    setAge((a) => String(Math.min(ages[p].max, Math.max(ages[p].min, Number(a) || 35))));
    if (termed(p)) setVariant(DEFAULT_TERM[p]);
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
  }, [kind, product, sex, age, sum, variant, plan, compare, source, budget, pensionStart, pay, monthly, pensionSum]);

  // a clip still being made is asked about every few seconds
  const pending = items?.some((v) => v.status === "drawing" || v.status === "rendering");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { myVideos().then(setItems).catch(() => undefined); }, 4000);
    return () => {
      clearInterval(t);
      // a clip that ended may have given a free clip or money back, or found the voice used up
      myCost().then(setCost).catch(() => undefined);
      refreshQuota();
    };
  }, [pending]);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = kind === "fhc"
        ? await makeFhcVideo(fhcId, withName, { narrator, ...(voice ? { voice } : {}), size })
        : await makeVideo(input(), customer);
      if (!r.ok) {
        setError({ text: r.error, contact: r.needContact });
        refreshQuota();
      } else setItems(await myVideos());
      setCost(await myCost());
    } catch {
      setError({ text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  async function copy(v: VideoItem) {
    if (!v.share) return;
    try {
      await navigator.clipboard.writeText(v.share);
      setCopied(v.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("คัดลอกลิงก์นี้", v.share);
    }
  }

  const ok = preview && !("error" in preview) ? preview : null;
  const resolvedPlan = ok?.resolved.plan ? ihuPlans.find((p) => p.code === ok.resolved.plan)?.name : undefined;
  /** what the budget bought, to keep and adjust by hand */
  function keepResolved() {
    if (!ok) return;
    if (ok.resolved.sum) setSum(ok.resolved.sum.toLocaleString("en-US"));
    if (ok.resolved.plan) setPlan(ok.resolved.plan);
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
  const sizeLocked = kind === "quote" && (length === "short" || style !== "motion");
  const shownSize = sizeLocked ? "portrait" : size;
  // a Gemini-voiced clip would only fail while the voice is used up
  const voiceBlocked = Boolean(quota) && !voice;
  const voiceWord = voice ? eleven.find((v) => v.id === voice)?.name ?? "ElevenLabs" : narrator === "M" ? "เสียงชาย" : "เสียงหญิง";
  const summary = {
    what: kind === "fhc" ? "สรุป FHC" : PRODUCTS.find((p) => p.code === product)?.name ?? "",
    who: kind === "fhc"
      ? fhcPick?.name ?? ""
      : `${sex === "M" ? "ชาย" : "หญิง"} ${age}${customer.trim() && length === "full" ? ` · คุณ${customer.trim()}` : ""}`,
    plan: product === "IHEALTHY"
      ? (source === "sum" ? ihuPlans.find((p) => p.code === plan)?.name ?? "" : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`)
      : product === "PENSION"
        ? `${source === "sum" ? `บำนาญเดือนละ ${monthly}` : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`} · รับ ${pensionStart} · ${pay === "6" ? "จ่าย 6 ปี" : "จ่ายจนรับ"}`
      : `${source === "sum" ? sumWord(Number(sum.replace(/[^\d]/g, "")) || 0) : `งบ${source === "month" ? "เดือน" : "ปี"}ละ ${budget}`} · ${termWord(variant)}`,
    look: [
      kind === "quote" ? (length === "short" ? "สั้น" : "เต็ม") : "",
      kind === "quote" ? (style === "motion" ? "Motion" : "ปกติ") : "",
      SIZE_CHOICES.find((c) => c.size === shownSize)?.name.split(" ")[0] ?? "",
      voiceWord,
    ].filter(Boolean).join(" · "),
  };
  const money = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8));
    return n ? n.toLocaleString("en-US") : "";
  };
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`${card} pb-0 lg:pb-5`}>
        <Step n={1} title="ทำวิดีโอเรื่อง" summary={summary.what} first>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((p) => <button key={p.code} type="button" className={chip(kind === "quote" && product === p.code)} onClick={() => { setKind("quote"); pickProduct(p.code); }}>{p.name}</button>)}
            <button type="button" className={chip(kind === "fhc")} onClick={() => setKind("fhc")}>สรุป FHC</button>
          </div>
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
              <div className="grid gap-4 sm:grid-cols-2">
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
              {length === "full" ? (
                <div>
                  <label htmlFor="qv-customer" className={label}>ชื่อลูกค้า (ไม่บังคับ)</label>
                  <input id="qv-customer" className={field} value={customer} maxLength={40} placeholder="เช่น สมชาย" onChange={(e) => setCustomer(e.target.value)} />
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">ใส่แล้วเสียงพากย์จะทักชื่อ และขึ้นชื่อบนภาพในคลิป</p>
                </div>
              ) : (
                <p className="text-xs text-[var(--ct-mute)]">คลิปสั้นไม่ใส่ชื่อลูกค้า (ทำไว้ลงเพจ)</p>
              )}
            </Step>

            <Step n={3} title="แผน" summary={summary.plan}>
              {product === "PENSION" && (
                <div className="grid gap-4 sm:grid-cols-2">
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
                  <button type="button" className={chip(source === "sum")} onClick={() => setSource("sum")}>{product === "IHEALTHY" ? "เลือกแผนเอง" : product === "PENSION" ? "บำนาญต่อเดือน" : "ทุนประกัน"}</button>
                  <button type="button" className={chip(source === "month")} onClick={() => setSource("month")}>งบต่อเดือน</button>
                  <button type="button" className={chip(source === "year")} onClick={() => setSource("year")}>งบต่อปี</button>
                </div>
              </div>
              {(source !== "sum" || product !== "IHEALTHY") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {source !== "sum" ? (
                    <div>
                      <label htmlFor="qv-budget" className={label}>{source === "month" ? "งบที่ลูกค้าออมไหวต่อเดือน (บาท)" : "งบที่ลูกค้าออมไหวต่อปี (บาท)"}</label>
                      <input id="qv-budget" inputMode="numeric" className={field} value={budget} onChange={(e) => setBudget(money(e))} />
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">{product === "IHEALTHY" ? "ระบบเลือกแผนที่วงเงินสูงสุดที่เบี้ยไม่เกินงบ" : product === "PENSION" ? "ระบบคิดทุนจากงบนี้ ด้วยเครื่องคิดเดียวกับหน้า บำนาญ 95" : "ระบบเลือกทุนสูงสุด (ทีละ 50,000) ที่เบี้ยไม่เกินงบ"}</p>
                    </div>
                  ) : product === "PENSION" ? (
                    <div>
                      <label htmlFor="qv-monthly" className={label}>บำนาญที่อยากได้ต่อเดือน (บาท)</label>
                      <input id="qv-monthly" inputMode="numeric" className={field} value={monthly} onChange={(e) => { setMonthly(money(e)); setPensionSum(undefined); }} />
                      <p className="mt-1 text-xs text-[var(--ct-mute)]">ทุนประกัน 75,000 – 20 ล้านบาท</p>
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
                      <span className={label}>ชำระเบี้ย</span>
                      <div className="flex flex-wrap gap-2">
                        {TERMS[product].map((x) => <button key={x.variant} type="button" className={chip(variant === x.variant)} onClick={() => setVariant(x.variant)}>{x.years === 99 ? "ถึงอายุ 99" : `${x.years} ปี`}</button>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {product === "IHEALTHY" && (
                <>
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
                    <p className="mt-1 text-xs text-[var(--ct-mute)]">ไม่เลือก = ไม่มีช่วงเทียบแผน · พื้นที่ประเทศไทย ทุนชีวิต 50,000 ค่าชดเชยรายวัน 1,000 ตามค่าเริ่มต้นหน้า iHealthy Ultra</p>
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
                        {ok.resolved.sum ? `คิดทุนให้: ${ok.resolved.sum.toLocaleString("en-US")} บาท` : `เลือกแผนให้: ${resolvedPlan ?? ""}`}{" "}
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

        <Step n={4} title="หน้าตาวิดีโอ" summary={summary.look}>
          {kind === "quote" && (
            <>
              <div>
                <span className={label}>ความยาว</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={chip(length === "full")} onClick={() => pickLength("full")}>เต็ม · ~50 วินาที</button>
                  <button type="button" className={chip(length === "short")} onClick={() => pickLength("short")}>สั้น · ~15 วินาที (Reels)</button>
                </div>
                <p className="mt-1 text-xs text-[var(--ct-mute)]">{length === "short" ? "3 ฉาก: ตัวเลขเด่น · ราคา · ชวนทัก ไม่ใส่ชื่อลูกค้า เหมาะลงเพจเป็น Reels" : "เล่าครบ 5 ฉากพร้อมตารางมูลค่า ใส่ชื่อลูกค้าได้"}</p>
              </div>
              <div>
                <span className={label}>สไตล์</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={chip(style === "classic")} onClick={() => pickStyle("classic")}>แบบปกติ · {priceBaht(prices.videoClassic)} บาท</button>
                  <button type="button" className={chip(style === "motion")} onClick={() => pickStyle("motion")}>Motion Graphic · {priceBaht(prices.videoMotion)} บาท</button>
                </div>
                <p className="mt-1 text-xs text-[var(--ct-mute)]">{style === "motion" ? "พื้นน้ำเงิน ไอคอนและกราฟเคลื่อนไหวอธิบายทีละเรื่อง ใช้เวลาสร้างนานกว่าเล็กน้อย" : "การ์ด รูปครอบครัว และตารางมูลค่า แบบเดียวกับใบเสนอ"}</p>
              </div>
            </>
          )}
          {sizeLocked ? (
            <div>
              <span className={label}>ขนาดวิดีโอ</span>
              <p className="text-xs text-[var(--ct-mute)]">{length === "short" ? "คลิปสั้นเป็นแนวตั้งเสมอ (ทำไว้ลง Reels)" : "แบบปกติเป็นแนวตั้ง · เลือกจัตุรัสหรือแนวนอนได้ที่ Motion Graphic"}</p>
            </div>
          ) : (
            <SizePicker size={size} pick={pickSize} />
          )}
          <div>
            <span className={label}>เสียงพากย์</span>
            <div className="flex flex-wrap items-center gap-2">
              {GEMINI.map((g) => (
                <span key={g.n} className="inline-flex items-center gap-2">
                  <button type="button" className={chip(!voice && narrator === g.n)} onClick={() => { pickVoice(""); pickNarrator(g.n); }}>{g.name} <span className="font-normal opacity-80">· {g.tag}</span></button>
                  <button type="button" className={small} onClick={() => playSample(g.sample)} aria-label={`ฟังตัวอย่างเสียง${g.name}`}>{playing === g.sample ? "■ หยุด" : "▶ ฟัง"}</button>
                </span>
              ))}
              {eleven.map((v) => (
                <span key={v.id} className="inline-flex items-center gap-2">
                  <button type="button" className={chip(voice === v.id)} onClick={() => pickVoice(v.id)}>{v.name} <span className="font-normal opacity-80">· ElevenLabs +{priceBaht(prices.elevenExtra)} บาท</span></button>
                  <button type="button" className={small} onClick={() => playSample(v.sample)} aria-label={`ฟังตัวอย่างเสียง ${v.name}`}>{playing === v.sample ? "■ หยุด" : "▶ ฟัง"}</button>
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--ct-mute)]">{voice ? "เสียงเหมือนคนพูด ใช้เสียงในบัญชี ElevenLabs" : "เสียง AI ของ Google ราคาเดิม"} · ครั้งหน้าเปิดมาเป็นค่าเดิมทั้งขั้นนี้</p>
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
            <p role="status" className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]">
              {voiceFullNotice(quota.clock)}
              {elevenInstead && (
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
          <button
            type="button" onClick={make} disabled={busy || (kind === "fhc" ? !fhcPick : !ok) || Boolean(line?.blocked) || voiceBlocked}
            className="w-full rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50 lg:w-auto"
          >
            {busy ? "กำลังเริ่ม…" : "สร้างวิดีโอ"}
          </button>
          <p className="hidden text-xs text-[var(--ct-mute)] lg:block">ใช้เวลาประมาณ 1–2 นาที ปิดหน้านี้ได้ คลิปจะขึ้นในรายการ</p>
        </div>
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="font-semibold">วิดีโอที่สร้างแล้ว</h2>
        {items === null && <p className="text-sm text-[var(--ct-mute)]">อ่านรายการไม่ได้ตอนนี้</p>}
        {items?.length === 0 && <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีวิดีโอ</p>}
        {items?.map((v) => (
          <div key={v.id} className="space-y-2 rounded-lg border border-[var(--ct-line)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{v.title}</p>
                <p className="text-xs text-[var(--ct-mute)]">{when(v.createdAt)}{v.paid ? ` · ${v.paid}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${v.status === "done" ? "bg-[var(--ct-soft)] text-[var(--ct-accent)]" : v.status === "failed" ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-ground)] text-[var(--ct-mute)]"}`}>
                {STATUS[v.status]}
              </span>
            </div>
            {v.status === "failed" && v.error && <p className="text-xs text-[var(--ct-alert)]">{v.error}</p>}
            {v.voiceFull && <p className="text-xs text-[var(--ct-mute)]">ไม่เสียเงิน และไม่นับเป็นคลิปฟรี</p>}
            {v.watch && <video src={v.watch} controls playsInline preload="metadata" className={`w-full rounded-lg ${v.size === "landscape" ? "max-w-[300px]" : v.size === "square" ? "max-w-[260px]" : "max-w-[220px]"}`} style={{ aspectRatio: ASPECT[v.size] }} />}
            <div className="flex flex-wrap gap-2">
              {v.status === "done" && v.save && v.watch && <SaveVideoButton href={v.save} watch={v.watch} filename={v.fileName} className={small} />}
              {v.status === "done" && <button type="button" className={small} onClick={() => copy(v)}>{copied === v.id ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>}
              {v.status === "done" && pages.length > 0 && !v.named && !v.personal && v.size === "portrait" && (
                <button type="button" className={small} onClick={() => openCalendar(v.id)}>เพิ่มลงปฏิทินเพจ</button>
              )}
              {(v.status === "done" || v.status === "failed") && (
                <button type="button" className={`${small} text-[var(--ct-alert)]`} onClick={() => setConfirming(v.id)}>ลบ</button>
              )}
            </div>
            {confirming === v.id && (
              <div role="alertdialog" aria-label="ยืนยันการลบ" className="space-y-2 rounded-lg bg-[var(--ct-alert-bg)] p-2 text-xs text-[var(--ct-alert)]">
                <p>ลบวิดีโอนี้? ลิงก์ที่ส่งให้ลูกค้าไปแล้วจะเปิดไม่ได้</p>
                <div className="flex gap-2">
                  <button type="button" className="min-h-9 rounded-lg bg-[var(--ct-alert)] px-3 text-sm text-[var(--ct-panel)]" onClick={() => remove(v.id)}>ลบเลย</button>
                  <button type="button" className={small} onClick={() => setConfirming(null)}>ไม่ลบ</button>
                </div>
              </div>
            )}
            {deleteError?.id === v.id && <p role="alert" className="text-xs text-[var(--ct-alert)]">{deleteError.text}</p>}
            {v.status === "done" && pages.length > 0 && (v.named || v.personal || v.size !== "portrait") && (
              <p className="text-xs text-[var(--ct-mute)]">{v.personal ? "วิดีโอสรุป FHC เป็นข้อมูลส่วนตัวของลูกค้า ไม่มีปุ่มลงเพจ" : v.named ? "คลิปที่มีชื่อลูกค้าไม่มีปุ่มลงเพจ" : "ลงปฏิทินเพจ (Reels) ได้เฉพาะคลิปแนวตั้ง"}</p>
            )}
            {cal?.id === v.id && (
              <div className="space-y-2 rounded-lg border border-[var(--ct-line)] p-2 text-sm">
                {cal.done ? (
                  <p>เพิ่มลงปฏิทินแล้ว · <Link href={`/studio/calendar?page=${encodeURIComponent(cal.done)}`} className="underline">ไปที่ปฏิทินโพสต์</Link> (อยู่ในแถบรอตั้งเวลา)</p>
                ) : (
                  <>
                    <label htmlFor={`cal-page-${v.id}`} className="block text-xs font-medium">ลงเพจ</label>
                    <select id={`cal-page-${v.id}`} className={field} value={cal.page} onChange={(e) => setCal({ ...cal, page: e.target.value })}>
                      {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <label htmlFor={`cal-cap-${v.id}`} className="block text-xs font-medium">แคปชัน (แก้ได้)</label>
                    <textarea id={`cal-cap-${v.id}`} rows={6} className={field} value={cal.caption} onChange={(e) => setCal({ ...cal, caption: e.target.value })} />
                    <p className="text-xs text-[var(--ct-mute)]">ท้ายคลิปมีชื่อ เบอร์ และ LINE ของคุณ ลูกค้าที่เห็นโพสต์จะทักคุณโดยตรง</p>
                    {cal.error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{cal.error}</p>}
                    <div className="flex gap-2">
                      <button type="button" disabled={cal.busy || !cal.page} onClick={sendCalendar} className="min-h-9 rounded-lg bg-[var(--ct-solid)] px-3 text-sm text-[var(--ct-solid-ink)] disabled:opacity-50">{cal.busy ? "กำลังเพิ่ม…" : "เพิ่มลงปฏิทิน"}</button>
                      <button type="button" className={small} onClick={() => setCal(null)}>ปิด</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
