"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AgentVoice } from "@/lib/voice/mine";
import { PREVIEW_REDOS, TAKE_MAX_SEC, TAKE_MIN_SEC, type VoiceSex } from "@/lib/voice/mine-words";
import { encodeWav, loudness, QUIET, TAKE_RATE } from "@/lib/voice/wav-encode";
import { beginVoice, keepVoice, makeClone, recordAgain, removeMyVoice, type VoiceResult } from "./actions";

/**
 * เสียงของฉัน's steps (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m):
 * consent → four takes read aloud → the clone heard back → sent to the Super Admin; then the
 * voice in use, to delete or record again. Each take is recorded here and only here — there is
 * no file to upload — and goes up as a WAV made in the browser.
 */

const CARD = "space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
const BTN = "min-h-11 rounded-lg bg-[var(--ct-solid)] px-5 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] hover:opacity-90 disabled:opacity-50";
const GHOST = "min-h-11 rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 py-1.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)]"}`;

function Steps({ at }: { at: number }) {
  const names = ["ยินยอม", "อัดเสียง", "ฟังตัวอย่าง", "อนุมัติ"];
  return (
    <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="ขั้นตอน">
      {names.map((n, i) => (
        <li key={n} aria-current={i === at ? "step" : undefined} className={`rounded-full border px-2.5 py-0.5 ${i === at ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]" : i < at ? "border-[var(--ct-new,var(--ct-line))] text-[var(--ct-mute)]" : "border-[var(--ct-hair)] text-[var(--ct-mute)]"}`}>
          {n}{i < at ? " ✓" : ""}
        </li>
      ))}
    </ol>
  );
}

/** the recorded blob, decoded, made mono at TAKE_RATE */
async function toTake(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * TAKE_RATE), TAKE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    void ctx.close();
  }
}

function Recorder({ voice, texts, onDone }: { voice: AgentVoice; texts: { title: string; text: string }[]; onDone: (r: VoiceResult) => void }) {
  const [at, setAt] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => texts.map(() => false));
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("เปิดไมค์ไม่ได้ อนุญาตให้เว็บนี้ใช้ไมโครโฟนก่อน");
      return;
    }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream);
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    const began = Date.now();
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      setLevel(Math.min(1, loudness(buf) * 6));
      const s = (Date.now() - began) / 1000;
      setSeconds(s);
      if (s >= TAKE_MAX_SEC) { stop(); return; }
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      if (mr.state !== "inactive") mr.stop();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      rec.current = null;
      setRecording(false);
      setLevel(0);
    };
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => { void finish(new Blob(chunks, { type: mr.mimeType })); };
    rec.current = { stop };
    mr.start();
    setRecording(true);
    setSeconds(0);
    raf = requestAnimationFrame(tick);
  }

  async function finish(blob: Blob) {
    setBusy("กำลังตรวจเสียง…");
    try {
      const samples = await toTake(blob);
      const secs = samples.length / TAKE_RATE;
      if (secs < TAKE_MIN_SEC) throw new Error(`ท่อนนี้สั้นเกินไป อ่านให้ครบประโยค (อย่างน้อย ${TAKE_MIN_SEC} วินาที)`);
      if (loudness(samples) < QUIET) throw new Error("เสียงเบาเกินไป ขยับเข้าใกล้ไมค์แล้วอัดใหม่");
      setBusy("กำลังส่งเสียง…");
      const form = new FormData();
      form.append("id", voice.id);
      form.append("n", String(at + 1));
      form.append("take", new Blob([encodeWav(samples).buffer as ArrayBuffer], { type: "audio/wav" }), `take-${at + 1}.wav`);
      const res = await fetch("/api/voice/take", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "ส่งเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
      const next = done.map((d, i) => d || i === at);
      setDone(next);
      const left = next.findIndex((d) => !d);
      if (left >= 0) setAt(left);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัดเสียงไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  async function clone() {
    setBusy("กำลังโคลนเสียง ใช้เวลาประมาณ 30 วินาที…");
    setError(null);
    const r = await makeClone(voice.id).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setBusy(null);
    if (!r.ok) setError(r.error);
    else onDone(r);
  }

  const all = done.every(Boolean);
  const t = texts[at];
  return (
    <div className={CARD}>
      <Steps at={1} />
      {!all && (
        <>
          <div className="rounded-xl border-2 border-[var(--ct-ink,currentColor)] bg-[var(--ct-ground)] p-4">
            <span className="mb-1 block text-xs text-[var(--ct-mute)]">ท่อนที่ {at + 1} จาก {texts.length} · {t.title} · อ่านเสียงปกติ เหมือนคุยกับลูกค้า</span>
            <p className="text-lg leading-relaxed">{t.text}</p>
          </div>
          <div className="flex items-center gap-3" aria-live="polite">
            {recording && <span className="inline-block h-3 w-3 rounded-full bg-[var(--ct-alert)]" aria-hidden />}
            <b className="tabular-nums">{Math.floor(seconds / 60)}:{String(Math.floor(seconds % 60)).padStart(2, "0")}</b>
            <span className="h-2 w-40 overflow-hidden rounded-full bg-[var(--ct-hair)]" aria-hidden><span className="block h-full bg-[var(--ct-solid)]" style={{ width: `${Math.round(level * 100)}%` }} /></span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recording
              ? <button type="button" className={BTN} onClick={() => rec.current?.stop()}>■ หยุด</button>
              : <button type="button" className={BTN} onClick={start} disabled={Boolean(busy)}>● เริ่มอัดท่อนที่ {at + 1}</button>}
          </div>
        </>
      )}
      <ul className="space-y-1 text-sm">
        {texts.map((x, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={done[i] ? "text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}>{done[i] ? "✓" : "○"}</span>
            <button type="button" className="text-left underline-offset-2 hover:underline disabled:no-underline" disabled={recording || Boolean(busy)} onClick={() => setAt(i)}>ท่อน {i + 1} · {x.title}{done[i] ? " (อัดใหม่ได้)" : ""}</button>
          </li>
        ))}
      </ul>
      {all && <button type="button" className={BTN} onClick={clone} disabled={Boolean(busy)}>โคลนเสียงจาก 4 ท่อนนี้</button>}
      {busy && <p role="status" className="text-sm text-[var(--ct-mute)]">{busy}</p>}
      {error && <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{error}</p>}
      <p className="text-xs text-[var(--ct-mute)]">อัดในหน้านี้เท่านั้น อัปโหลดไฟล์เสียงไม่ได้ เพื่อกันการโคลนเสียงของคนอื่น · ท่อนละ {TAKE_MIN_SEC}–{TAKE_MAX_SEC} วินาที</p>
    </div>
  );
}

export function VoiceBoard({ name, price, extra, pending, texts, previewUrl, active, redosLeft, rejected }: {
  name: string;
  /** the clone's price in baht, or null when it is free (the owner, or the wallet off) */
  price: string | null;
  extra: string;
  pending: AgentVoice | null;
  texts: { title: string; text: string }[] | null;
  previewUrl: string | null;
  active: { id: string; sample: string | null } | null;
  redosLeft: number;
  rejected: string | null;
}) {
  const router = useRouter();
  const [sex, setSex] = useState<VoiceSex>("F");
  const [ticks, setTicks] = useState([false, false, false]);
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function step(run: () => Promise<VoiceResult>) {
    setBusy(true);
    setError(null);
    const r = await run().catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setBusy(false);
    if (!r.ok) setError(r.error);
    else { setAgain(false); router.refresh(); }
  }

  const alert = error && <p role="alert" className="rounded-lg bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{error}</p>;

  if (pending?.status === "recording" && texts) {
    return <Recorder key={pending.id + pending.code} voice={pending} texts={texts} onDone={() => router.refresh()} />;
  }
  if (pending?.status === "preview") {
    const left = PREVIEW_REDOS - pending.redoUsed;
    return (
      <div className={CARD}>
        <Steps at={2} />
        <b className="block">นี่คือเสียงโคลนของคุณ</b>
        {previewUrl ? <audio controls src={previewUrl} className="w-full" /> : <p className="text-sm text-[var(--ct-mute)]">ทำตัวอย่างเสียงไม่สำเร็จ แต่เสียงโคลนพร้อมแล้ว</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} disabled={busy} onClick={() => step(() => keepVoice(pending.id))}>ใช้เสียงนี้ ส่งให้แอดมินตรวจ</button>
          <button type="button" className={GHOST} disabled={busy || left <= 0} onClick={() => step(() => recordAgain(pending.id))}>ไม่เหมือน อัดใหม่ (ฟรีอีก {Math.max(0, left)} ครั้ง)</button>
        </div>
        {alert}
        <p className="text-xs text-[var(--ct-mute)]">ไฟล์เสียงที่อัดถูกลบแล้ว เก็บไว้แค่เสียงโคลน และท่อนประโยคยินยอมเป็นหลักฐาน</p>
      </div>
    );
  }
  if (pending?.status === "review") {
    return (
      <div className={CARD}>
        <Steps at={3} />
        <div className="flex items-center gap-2"><b>เสียงของฉัน</b><span className="rounded-full bg-[var(--ct-warn-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-warn-ink)]">รอแอดมินตรวจ</span></div>
        <p className="text-sm">ปกติใช้เวลาไม่เกิน 1 วันทำการ ระหว่างนี้ใช้เสียงอื่นทำคลิปได้ตามปกติ{price ? ` · ถ้าไม่ผ่าน คืนเงิน ฿${price} เข้ากระเป๋าอัตโนมัติ` : ""}</p>
      </div>
    );
  }

  const consent = (
    <div className={CARD}>
      <Steps at={0} />
      <b className="block">{active ? "อัดเสียงของฉันใหม่" : "โคลนเสียงของคุณ ใช้พากย์ทุกคลิป"}</b>
      <p className="rounded-lg bg-[var(--ct-soft)] px-3 py-2 text-sm">
        {active ? `อัดใหม่ฟรี เหลือ ${redosLeft} ครั้งในปีนี้ · เสียงเดิมใช้ได้จนเสียงใหม่ผ่านการตรวจ`
          : price ? `ค่าเปิดใช้ ฿${price} ครั้งเดียว · หลังจากนั้นคลิปละ +฿${extra} เท่าเสียง ElevenLabs · ถ้าไม่ผ่านการตรวจ คืนเงินเต็มจำนวน`
          : `เปิดใช้ฟรี · คลิปละ +฿${extra} เท่าเสียง ElevenLabs`}
      </p>
      <div>
        <span className="mb-1 block text-sm font-medium">เสียงของคุณเป็นเสียง</span>
        <div className="flex gap-2">
          <button type="button" className={chip(sex === "F")} onClick={() => setSex("F")}>ผู้หญิง (ลงท้าย ค่ะ)</button>
          <button type="button" className={chip(sex === "M")} onClick={() => setSex("M")}>ผู้ชาย (ลงท้าย ครับ)</button>
        </div>
      </div>
      {[
        "เสียงที่อัดเป็นเสียงของฉันเอง ไม่ใช่ของคนอื่น",
        "ยินยอมให้ใช้เสียงนี้สร้างเสียงสังเคราะห์ เฉพาะคลิปของฉันในแอปนี้ และลบได้ทุกเมื่อ",
        "อ่านนโยบายความเป็นส่วนตัว เรื่องข้อมูลเสียงแล้ว",
      ].map((label, i) => (
        <label key={i} className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={ticks[i]} onChange={(e) => setTicks(ticks.map((t, j) => (j === i ? e.target.checked : t)))} />
          <span>{label}{i === 2 && <> · <Link href="/privacy#voice" className="underline" target="_blank">อ่าน</Link></>}</span>
        </label>
      ))}
      <p className="text-sm text-[var(--ct-mute)]">ต้องมี: ห้องเงียบ · ไมค์โทรศัพท์หรือหูฟังที่มีไมค์ · เวลา 5 นาที · ชื่อในประโยคยินยอมคือ “{name || "ชื่อในบัญชีของฉัน"}”</p>
      <button type="button" className={BTN} disabled={busy || !ticks.every(Boolean)} onClick={() => step(() => beginVoice(sex, true))}>
        ตกลง เริ่มอัดเสียง{price && !active ? ` (หักจากกระเป๋า ฿${price} ตอนโคลนเสร็จ)` : ""}
      </button>
      {alert}
    </div>
  );

  if (active && !again) {
    return (
      <div className="space-y-4">
        <div className={CARD}>
          <div className="flex items-center gap-2"><b>เสียงของฉัน</b><span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">ใช้งานอยู่</span></div>
          {active.sample && <audio controls src={active.sample} className="w-full" />}
          <p className="text-sm text-[var(--ct-mute)]">เลือก “เสียงของฉัน” ได้ในขั้นเสียงพากย์ของทุกหน้าสร้างคลิป</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={GHOST} disabled={busy || redosLeft <= 0} onClick={() => setAgain(true)}>อัดใหม่ (ฟรีเหลือ {redosLeft} ครั้งในปีนี้)</button>
            <button type="button" className={GHOST} disabled={busy} onClick={() => { if (window.confirm("ลบเสียงของฉัน? คลิปที่ทำไว้แล้วยังอยู่")) void step(() => removeMyVoice(active.id)); }}>ลบเสียงของฉัน</button>
          </div>
          {alert}
          <p className="text-xs text-[var(--ct-mute)]">ลบแล้ว ระบบลบเสียงโคลนออกจาก ElevenLabs ทันที</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {rejected !== null && <p className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 py-2 text-sm text-[var(--ct-warn-ink)]">เสียงครั้งก่อนไม่ผ่านการตรวจ{rejected ? `: ${rejected}` : ""} · คืนเงินเข้ากระเป๋าแล้ว อัดใหม่ได้</p>}
      {consent}
    </div>
  );
}
