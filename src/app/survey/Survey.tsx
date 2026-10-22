"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LABEL, PANEL } from "@/components/plan/fields";
import {
  BUDGETS, CARE_LABEL, COMPANIES, DECIDER_LABEL, HELP_LABEL, HOUSEHOLD_LABEL, PLACE_LABEL, REASON_LABEL, TIE_LABEL,
  WORRIES, WORRY_LABEL, WORRY_WHY, ageOn, cleanSurvey, nextDays, thaiDay, yearlyOf,
  type Budget, type Care, type Company, type Decider, type Help, type Household, type Place, type Reason,
  type SurveyAnswers, type Tie, type WorryKey,
} from "@/lib/survey/answers";
import { scriptLine, type LineKey } from "@/lib/survey/script";
import { summarize, summaryText } from "@/lib/survey/summary";
import { saveSurvey, speakSurveyLine } from "./actions";
import { SurveySummary } from "./SurveySummary";

/**
 * สำรวจความคุ้มครอง as the agent runs it (owner approved mockup SWVNeW6CQii59D6nhzUWpx,
 * 2026-10-22): five parts one screen at a time, a line to say above each question, and on
 * saving, the customer in the FHC list with a "สรุปก่อนนัด". The lines end in ครับ or ค่ะ as the
 * agent picks once; the choice stays in this browser. Each line plays in the clips' AI voice
 * (owner, 2026-10-22, mockup 6eXVC2yugSk2rhBRok4Kv2 ข), made once on the server and kept.
 */

const STEPS = ["ประกันที่มีอยู่", "การดูแล", "เรื่องที่ห่วง", "งบ & ผู้ตัดสินใจ", "นัดหมาย"] as const;
const VOICE_KEY = "survey-voice";
const CHIP = "rounded-sm border px-2 py-2.5 text-sm leading-snug transition-colors";
const ON = "lg-metal-face border-[var(--lg-gold)] font-medium";
const OFF = "border-[var(--lg-panel-line)] text-[var(--lg-mute)]";
const INPUT = "mt-1 w-full rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base tabular-nums text-[var(--lg-white)]";
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const PERIODS = { morning: ["09:00", "10:00", "11:00"], afternoon: ["13:00", "14:00", "15:00", "16:00"], evening: ["17:00", "18:00", "19:00"] } as const;
const PERIOD_LABEL = { morning: "ช่วงเช้า", afternoon: "ช่วงบ่าย", evening: "ช่วงเย็น" } as const;
type Period = keyof typeof PERIODS;
/** a tenth of a second of silence, played inside the tap so iPhone lets the line play once it arrives */
const SILENT = "data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
type VoiceState = "wait" | "on" | null;

const entries = <K extends string>(o: Record<K, string>) => Object.entries(o) as [K, string][];

function Chips<T extends string | number>({ options, value, onPick, cols = 2, label }: {
  options: [T, string][]; value: T[]; onPick: (v: T) => void; cols?: 2 | 3 | 4; label: string;
}) {
  const grid = cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2";
  return (
    <div className={`grid gap-2 ${grid}`} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" aria-pressed={value.includes(v)} onClick={() => onPick(v)}
                className={`${CHIP} ${value.includes(v) ? ON : OFF}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** the line the agent says, set apart from what they tap, with ▶ ฟัง to hear it read */
function Say({ text, state, onPlay }: { text: string; state: VoiceState; onPlay: () => void }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 text-sm leading-relaxed text-[var(--lg-mute)]">
      <button
        type="button" onClick={onPlay} aria-label={state === "on" ? "หยุดเสียง" : "ฟังบทพูดนี้"}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs ${
          state === "on" ? ON : state === "wait" ? "border-[var(--lg-panel-line)] text-[var(--lg-mute)]" : "border-[var(--lg-gold)] text-[var(--lg-gold)]"
        }`}
      >
        {state === "wait" ? "กำลังเตรียมเสียง…" : state === "on" ? <>■ หยุด</> : <>▶ ฟัง</>}
      </button>
      <span>“{text}”</span>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={PANEL}>
      <h2 className="text-base font-medium text-[var(--lg-white)]">
        {title}{hint && <span className="ml-1 text-sm font-normal text-[var(--lg-mute)]">({hint})</span>}
      </h2>
      {children}
    </section>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** `voiceUrls`: links to the lines already made, by voice and words, so a tap plays at once */
export function Survey({ agentName, today, voiceUrls = {} }: { agentName: string; today: string; voiceUrls?: Record<string, string> }) {
  const [female, setFemale] = useState(false);
  useEffect(() => {
    try { setFemale(localStorage.getItem(VOICE_KEY) === "F"); } catch { /* the default stands */ }
  }, []);
  useEffect(() => () => { player.current?.pause(); }, []);
  function setVoice(f: boolean) {
    setFemale(f);
    try { localStorage.setItem(VOICE_KEY, f ? "F" : "M"); } catch { /* this visit only */ }
  }

  const [step, setStep] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [none, setNone] = useState(false);
  const [tie, setTie] = useState<Tie | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [years, setYears] = useState("");
  const [care, setCare] = useState<Care | null>(null);
  const [help, setHelp] = useState<Help[]>([]);
  const [noHelp, setNoHelp] = useState(false);
  const [planned, setPlanned] = useState<boolean | null>(null);
  const [top, setTop] = useState<WorryKey | null>(null);
  const [also, setAlso] = useState<WorryKey[]>([]);
  const [kids, setKids] = useState("");
  const [eldest, setEldest] = useState("");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [decider, setDecider] = useState<Decider | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [weekend, setWeekend] = useState<boolean | null>(null);
  const [date, setDate] = useState("");
  const [period, setPeriod] = useState<Period | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bDay, setBDay] = useState("");
  const [bMonth, setBMonth] = useState("");
  const [bYear, setBYear] = useState("");
  const [sex, setSex] = useState<"M" | "F" | null>(null);
  const [address, setAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; answers: SurveyAnswers } | null>(null);
  const [copied, setCopied] = useState("");
  // the line playing or being made, by voice and words; one at a time
  const [voice, setVoiceLine] = useState<{ id: string; state: Exclude<VoiceState, null> } | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  const wanted = useRef("");
  const urls = useRef(new Map<string, string>(Object.entries(voiceUrls)));

  const holds = companies.length > 0;
  const education = top === "education" || also.includes("education");
  const thisYearBE = Number(today.slice(0, 4)) + 543;
  const birth = bDay && bMonth && bYear
    ? `${Number(bYear) - 543}-${String(bMonth).padStart(2, "0")}-${String(bDay).padStart(2, "0")}`
    : "";
  const age = birth ? ageOn(birth, today) : null;
  const num = (v: string) => (v === "" ? null : Number(v));

  /** the worry cards go none → ห่วงด้วย → ห่วงที่สุด; one card holds ห่วงที่สุด */
  function tapWorry(k: WorryKey) {
    if (top === k) { setTop(null); setAlso(also.filter((x) => x !== k)); return; }
    if (also.includes(k)) {
      setAlso([...also.filter((x) => x !== k), ...(top ? [top] : [])]);
      setTop(k);
      return;
    }
    setAlso([...also, k]);
  }

  const ctx = { female, agentName, top, decider };

  const answers = {
    companies, tie, reasons, household, years: num(years), care, help, planned, top, also,
    kids: num(kids), eldest: num(eldest), budget, decider, place, date, time, name, phone, birth, sex, address,
  };

  function stopVoice() {
    wanted.current = "";
    player.current?.pause();
    setVoiceLine(null);
  }

  async function play(k: LineKey) {
    const text = scriptLine(k, ctx);
    const id = `${female ? "F" : "M"}|${text}`;
    if (voice?.id === id) { stopVoice(); return; }
    stopVoice();
    setVoiceError("");
    wanted.current = id;
    const a = player.current ?? (player.current = new Audio());
    // the silence below ends at once; only the line's own end stops the button
    a.onended = null;
    let url = urls.current.get(id);
    if (!url) {
      // unlocks this player inside the tap; the line itself arrives a few seconds later
      a.src = SILENT;
      a.play().catch(() => {});
      setVoiceLine({ id, state: "wait" });
      const r = await speakSurveyLine(k, { female, top, decider })
        .catch(() => ({ ok: false as const, error: "ทำเสียงไม่สำเร็จ ลองกดอีกครั้งนะครับ" }));
      if (wanted.current !== id) return;
      if (!r.ok) { stopVoice(); setVoiceError(r.error); return; }
      url = r.url;
      urls.current.set(id, url);
    }
    a.src = url;
    a.onended = () => { if (wanted.current === id) stopVoice(); };
    setVoiceLine({ id, state: "on" });
    a.play().catch(() => { if (wanted.current === id) { stopVoice(); setVoiceError("เปิดเสียงไม่ได้ กดฟังอีกครั้งนะครับ"); } });
  }

  /** the script line for `k`, with its play button */
  const say = (k: LineKey) => {
    const text = scriptLine(k, ctx);
    const id = `${female ? "F" : "M"}|${text}`;
    return <Say text={text} state={voice?.id === id ? voice.state : null} onPlay={() => void play(k)} />;
  };

  function go(next: number) {
    stopVoice();
    setError("");
    // no policy: part 2 (the agent's care) has nothing to ask about
    if (next === 1 && !holds) next = step === 0 ? 2 : 0;
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    if (!consent) { setError("ติ๊กยืนยันว่าลูกค้ายินยอมก่อนเก็บชื่อ"); return; }
    const a = cleanSurvey(answers, today);
    if (typeof a === "string") { setError(a); return; }
    setError("");
    setSaving(true);
    const r = await saveSurvey(answers, consent).catch(() => ({ ok: false as const, error: "เก็บรายชื่อไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" }));
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved({ id: r.id, answers: a });
    window.scrollTo({ top: 0 });
  }

  if (saved) {
    const s = summarize(saved.answers, today);
    const text = summaryText(saved.answers, s);
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-sm border border-[var(--lg-gold)] p-3 text-sm text-[var(--lg-white)]">
          เก็บคุณ{saved.answers.name}เข้ารายชื่อลูกค้าแล้ว
        </p>
        <h2 className="lg-figure text-2xl text-[var(--lg-white)]">สรุปก่อนนัด · คุณ{saved.answers.name}</h2>
        <SurveySummary a={saved.answers} s={s} />
        <div className="grid grid-cols-2 gap-2">
          {s.calcs[0] && (
            <Link href={s.calcs[0].href} className="lg-metal-face col-span-2 rounded-sm border border-[var(--lg-gold)] py-3 text-center text-sm font-medium">
              เปิด {s.calcs[0].name} พร้อมตัวเลข
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              try { await navigator.clipboard.writeText(text); setCopied("คัดลอกสรุปแล้ว"); } catch { setCopied("คัดลอกไม่สำเร็จ"); }
            }}
            className="rounded-sm border border-[var(--lg-gold)] py-3 text-sm text-[var(--lg-gold)]"
          >
            คัดลอกสรุป
          </button>
          <Link href={`/fhc/customers/${saved.id}`} className="rounded-sm border border-[var(--lg-gold)] py-3 text-center text-sm text-[var(--lg-gold)]">
            ดูในรายชื่อลูกค้า
          </Link>
          <a href="/survey" className="col-span-2 rounded-sm border border-[var(--lg-panel-line)] py-3 text-center text-sm text-[var(--lg-mute)]">
            เริ่มสำรวจลูกค้าคนใหม่
          </a>
        </div>
        {copied && <p role="status" className="text-center text-sm text-[var(--lg-gold)]">{copied}</p>}
      </div>
    );
  }

  const days = weekend === null ? [] : nextDays(today, weekend);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-[var(--lg-mute)]">
          <span>ช่วงที่ {step + 1} จาก {STEPS.length}</span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-sm bg-[var(--lg-panel)]">
          <div className="h-full bg-[var(--lg-gold)]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="flex items-center justify-end gap-2 text-xs text-[var(--lg-mute)]">
          บทพูดลงท้าย
          {([[false, "ครับ"], [true, "ค่ะ"]] as const).map(([f, w]) => (
            <button key={w} type="button" aria-pressed={female === f} onClick={() => setVoice(f)}
                    className={`rounded-sm border px-2.5 py-1 ${female === f ? ON : OFF}`}>{w}</button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <>
          <section className={PANEL}>
            {say("open")}
          </section>
          <Q title="มีประกันชีวิตกับบริษัทไหนอยู่บ้าง" hint="เลือกได้หลายบริษัท">
            {say("companies")}
            <Chips label="บริษัท" options={COMPANIES.map((c): [Company, string] => [c, c])} value={companies}
                   onPick={(c) => { setCompanies(toggle(companies, c)); setNone(false); }} />
            <Chips label="ยังไม่มีประกัน" options={[["none", "ยังไม่มีประกัน"]]} value={none ? ["none"] : []}
                   onPick={() => { setNone(!none); setCompanies([]); }} cols={2} />
            {none && <p className="text-sm text-[var(--bot-sand-line)]">ยังไม่มีประกัน: กดถัดไปแล้วข้ามไปช่วงที่ 3 เลย</p>}
          </Q>
          {holds && (
            <>
              <Q title="ตัวแทนที่ดูแลเป็นใคร">
                {say("tie")}
                <Chips label="ตัวแทน" options={entries(TIE_LABEL)} value={tie ? [tie] : []} onPick={(v) => setTie(tie === v ? null : v)} />
              </Q>
              <Q title="ตอนนั้นทำเพราะอะไร" hint="เลือกได้หลายข้อ">
                {say("reasons")}
                <Chips label="เหตุผล" options={entries(REASON_LABEL)} value={reasons} onPick={(v) => setReasons(toggle(reasons, v))} />
              </Q>
              <Q title="คนในบ้านมีประกันครบไหม">
                {say("household")}
                <Chips label="คนในบ้าน" cols={3} options={entries(HOUSEHOLD_LABEL)} value={household ? [household] : []}
                       onPick={(v) => setHousehold(household === v ? null : v)} />
                <label className="block">
                  <span className={LABEL}>ถือมากี่ปีแล้ว</span>
                  <input inputMode="numeric" className={INPUT} placeholder="ปี" value={years}
                         onChange={(ev) => setYears(ev.target.value.replace(/\D/g, "").slice(0, 2))} />
                </label>
              </Q>
            </>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <Q title="ตัวแทนยังดูแลอยู่ไหม">
            {say("care")}
            <Chips label="การดูแล" cols={3} options={entries(CARE_LABEL)} value={care ? [care] : []} onPick={(v) => setCare(care === v ? null : v)} />
          </Q>
          <Q title="อยากให้ช่วยเรื่องไหน" hint="เลือกได้หลายข้อ">
            {say("help")}
            <Chips label="ช่วยเรื่อง" options={entries(HELP_LABEL)} value={help} onPick={(v) => { setHelp(toggle(help, v)); setNoHelp(false); }} />
            <Chips label="ไม่ต้องช่วย" options={[["none", "ไม่ต้องช่วยอะไร"]]} value={noHelp ? ["none"] : []}
                   onPick={() => { setNoHelp(!noHelp); setHelp([]); }} />
            <p className="text-xs text-[var(--lg-mute)]">เรื่องที่รับปากไว้จะขึ้นในสรุปก่อนนัด กันลืม</p>
          </Q>
        </>
      )}

      {step === 2 && (
        <>
          <Q title="เคยมีคนวางแผนการเงินให้ไหม">
            {say("planned")}
            <Chips label="เคยวางแผน" options={[["yes", "เคย"], ["no", "ไม่เคย"]]}
                   value={planned === null ? [] : [planned ? "yes" : "no"]}
                   onPick={(v) => setPlanned(planned === (v === "yes") ? null : v === "yes")} />
          </Q>
          <Q title="ถ้าจะมีเพิ่มอีกฉบับ เรื่องไหนสำคัญ">
            {say("worries")}
            <div className="space-y-2">
              {WORRIES.map((k, i) => {
                const state = top === k ? "top" : also.includes(k) ? "also" : "";
                return (
                  <button
                    key={k} type="button" onClick={() => tapWorry(k)} aria-pressed={state !== ""}
                    className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-sm border bg-[var(--lg-raise)] px-3 py-2.5 text-left ${
                      state === "top" ? "border-[var(--lg-gold)] ring-1 ring-[var(--lg-gold)]" : "border-[var(--lg-panel-line)]"
                    }`}
                  >
                    <span className="lg-figure text-lg leading-tight text-[var(--lg-gold)]">{i + 1}</span>
                    <span className="font-medium text-[var(--lg-white)]">{WORRY_LABEL[k]}</span>
                    <span className={`whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs ${
                      state === "top" ? ON : state === "also" ? "border-[var(--lg-gold)] text-[var(--lg-gold)]" : OFF
                    }`}>
                      {state === "top" ? "ห่วงที่สุด" : state === "also" ? "ห่วงด้วย" : "แตะเพื่อเลือก"}
                    </span>
                    <span className="col-start-2 col-end-4 text-sm text-[var(--lg-mute)]">{WORRY_WHY[k]}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--lg-mute)]">แตะครั้งแรก = ห่วงด้วย · แตะซ้ำ = ห่วงที่สุด (เรื่องเดียว) · แตะอีกครั้ง = ยกเลิก</p>
          </Q>
          {education && (
            <Q title="ลูกกี่คน อายุเท่าไร">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={LABEL}>จำนวนลูก</span>
                  <input inputMode="numeric" className={INPUT} placeholder="คน" value={kids}
                         onChange={(ev) => setKids(ev.target.value.replace(/\D/g, "").slice(0, 1))} />
                </label>
                <label className="block">
                  <span className={LABEL}>อายุลูกคนโต</span>
                  <input inputMode="numeric" className={INPUT} placeholder="ปี" value={eldest}
                         onChange={(ev) => setEldest(ev.target.value.replace(/\D/g, "").slice(0, 2))} />
                </label>
              </div>
            </Q>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <Q title="เก็บเพิ่มได้เดือนละเท่าไร">
            {say("budget")}
            <Chips label="งบต่อเดือน" cols={3}
                   options={[...BUDGETS.map((b): [Budget, string] => [b, b.toLocaleString("en-US")]), ["more", "มากกว่า"], ["unsure", "ยังไม่แน่ใจ"]]}
                   value={budget === null ? [] : [budget]} onPick={(v) => setBudget(budget === v ? null : v)} />
            {typeof budget === "number" && (
              <div className="flex items-baseline justify-between rounded-sm bg-[var(--lg-raise)] px-3 py-2 text-sm">
                <span className="text-[var(--lg-mute)]">คิดเป็นปีละ</span>
                <span><b className="lg-figure font-medium tabular-nums text-[var(--lg-gold)]">{yearlyOf(budget).toLocaleString("en-US")}</b> บาท</span>
              </div>
            )}
          </Q>
          <Q title="ตัดสินใจเองได้ไหม">
            {say("decider")}
            <Chips label="ผู้ตัดสินใจ" options={entries(DECIDER_LABEL)} value={decider ? [decider] : []} onPick={(v) => setDecider(decider === v ? null : v)} />
          </Q>
        </>
      )}

      {step === 4 && (
        <>
          <Q title="ที่ไหน">
            {say("place")}
            <Chips label="สถานที่" options={entries(PLACE_LABEL)} value={place ? [place] : []} onPick={(v) => setPlace(place === v ? null : v)} />
          </Q>
          <Q title="วันไหน เวลาไหน">
            {say("when")}
            <Chips label="วันธรรมดาหรือเสาร์อาทิตย์" options={[["weekday", "วันธรรมดา"], ["weekend", "เสาร์-อาทิตย์"]]}
                   value={weekend === null ? [] : [weekend ? "weekend" : "weekday"]}
                   onPick={(v) => { setWeekend(v === "weekend"); setDate(""); }} />
            {days.length > 0 && (
              <Chips label="วัน" options={days.map((d): [string, string] => [d, thaiDay(d)])} value={date ? [date] : []} onPick={setDate} />
            )}
            {date && (
              <>
                {say("period")}
                <Chips label="ช่วงเวลา" cols={3} options={entries(PERIOD_LABEL)} value={period ? [period] : []}
                       onPick={(v) => { setPeriod(v); setTime(""); }} />
              </>
            )}
            {period && (
              <Chips label="เวลา" cols={PERIODS[period].length === 4 ? 4 : 3}
                     options={PERIODS[period].map((t): [string, string] => [t, t])} value={time ? [time] : []} onPick={setTime} />
            )}
            {date && time && say("close")}
          </Q>
          <Q title="ข้อมูลติดต่อ">
            {say("contact")}
            <label className="block">
              <span className={LABEL}>ชื่อลูกค้า</span>
              <input className={INPUT} value={name} maxLength={100} onChange={(ev) => setName(ev.target.value)} />
            </label>
            <label className="block">
              <span className={LABEL}>เบอร์โทร</span>
              <input inputMode="tel" className={INPUT} value={phone} maxLength={30} onChange={(ev) => setPhone(ev.target.value)} />
            </label>
            <div>
              <span className={LABEL}>วันเกิด</span>
              <div className="grid grid-cols-[1fr_1.6fr_1.3fr] gap-2">
                <select aria-label="วัน" className={INPUT} value={bDay} onChange={(ev) => setBDay(ev.target.value)}>
                  <option value="">วัน</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select aria-label="เดือน" className={INPUT} value={bMonth} onChange={(ev) => setBMonth(ev.target.value)}>
                  <option value="">เดือน</option>
                  {THAI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select aria-label="ปี พ.ศ." className={INPUT} value={bYear} onChange={(ev) => setBYear(ev.target.value)}>
                  <option value="">ปี พ.ศ.</option>
                  {Array.from({ length: 90 }, (_, i) => thisYearBE - 1 - i).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {birth && <p className="mt-1 text-xs text-[var(--lg-mute)]">{age === null ? "วันเกิดนี้ไม่มีจริง ตรวจวันกับเดือนอีกครั้ง" : `อายุ ${age} ปี ใช้คิดเบี้ยในเครื่องคิด`}</p>}
            </div>
            <div>
              <span className={LABEL}>เพศ</span>
              <Chips label="เพศ" options={[["M", "ชาย"], ["F", "หญิง"]]} value={sex ? [sex] : []} onPick={setSex} />
            </div>
            <label className="block">
              <span className={LABEL}>ที่อยู่ (ไม่บังคับ)</span>
              <input className={INPUT} value={address} maxLength={200} onChange={(ev) => setAddress(ev.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-sm text-[var(--lg-white)]">
              <input type="checkbox" className="mt-1 accent-[var(--bot-navy)]" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} />
              ลูกค้ายินยอมให้เก็บชื่อและเบอร์ไว้ในรายชื่อลูกค้าของคุณ
            </label>
          </Q>
        </>
      )}

      {voiceError && <p role="status" className="text-sm text-[var(--bot-red)]">{voiceError}</p>}
      {error && <p role="alert" className="rounded-sm border border-[var(--bot-red)] p-3 text-sm text-[var(--lg-white)]">{error}</p>}

      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0 || saving}
                className="rounded-sm border border-[var(--lg-panel-line)] py-3 text-sm text-[var(--lg-mute)] disabled:opacity-40">
          ย้อนกลับ
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => go(step + 1)} className="lg-metal-face rounded-sm border border-[var(--lg-gold)] py-3 text-sm font-medium">
            ถัดไป
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={saving}
                  className="lg-metal-face rounded-sm border border-[var(--lg-gold)] py-3 text-sm font-medium disabled:opacity-60">
            {saving ? "กำลังบันทึก…" : "บันทึก · ดูสรุป"}
          </button>
        )}
      </div>
    </div>
  );
}
