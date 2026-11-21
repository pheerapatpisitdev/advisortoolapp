"use client";
import QRCode from "qrcode";
import { useEffect, useState, useTransition } from "react";
import { FormError } from "@/components/auth/fields";
import { MUTE, PRIMARY, SECONDARY } from "@/components/auth/styles";
import type { AgentNotify } from "@/lib/line/agent-line";
import type { LineView } from "@/lib/line/link-view";
import { myLine, sendMyLineTest, setMyLineNotify, startMyLineLink, unlinkMyLine } from "./actions";
import { Switch } from "./PayPrefsForm";

const GREEN = "inline-block rounded-lg bg-[var(--line-oa-green)] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90";
const SMALL = "rounded-lg border border-[var(--ct-hair)] px-3.5 py-2 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";
const CARD = "space-y-1 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5";
/** how often the page asks whether LINE took the code yet */
const POLL_MS = 4_000;
/** the agent's fixed QR never runs out, so the page asks for a while after it opens, as UnitOS does */
const TEAM_POLL_FOR_MS = 15 * 60_000;

const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

const SWITCHES: { key: AgentNotify; label: string; hint: string }[] = [
  { key: "clipDone", label: "คลิปทำเสร็จ", hint: "ส่งชื่อคลิปและลิงก์ไปดูคลิป" },
  { key: "clipFailed", label: "คลิปทำไม่สำเร็จ", hint: "บอกว่าคืนเงินหรือคืนสิทธิ์แล้ว และลิงก์ไปทำใหม่" },
  { key: "moneyLow", label: "เงินในกระเป๋าใกล้หมด", hint: "เมื่อเหลือต่ำกว่า ฿50 แจ้งครั้งเดียว จนกว่าจะเติมเงิน" },
];

/** The waiting code's QR, drawn here from the link (it opens the chat with the words typed). */
function LinkQr({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: 256, errorCorrectionLevel: "M" })
      .then((s) => { if (live) setSrc(s); })
      .catch(() => { if (live) setSrc(""); });
    return () => { live = false; };
  }, [url]);
  return (
    <div className="h-32 w-32 shrink-0 rounded-lg border border-[var(--ct-hair)] bg-white p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="QR สำหรับเชื่อม LINE" className="h-full w-full" />}
    </div>
  );
}

/**
 * เชื่อม LINE ของฉัน (owner chose ข, 2026-11-19; mockup https://claude.ai/artifact/DtxS7imFDnoq3EYjweC7aa):
 * a code and its QR, then — once the chat took it — which alerts come to that LINE.
 */
export function LineLinkForm({ initial, locked }: { initial: LineView | null; locked: boolean }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  // while a code waits: ask every few seconds, until linked or the code has run out
  const waiting = view && !view.linked && view.pending ? view.pending.until : null;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(async () => {
      if (Date.parse(waiting) <= Date.now()) {
        clearInterval(id);
        setView((v) => (v ? { ...v, pending: null } : v));
        return;
      }
      const next = await myLine().catch(() => null);
      if (next && (next.linked || !next.pending)) setView(next);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting]);

  // the fixed QR (owner chose ง): the page cannot know when it was scanned, so it asks for a while
  const team = view && !view.linked && !view.pending ? view.team : null;
  useEffect(() => {
    if (!team) return;
    const until = Date.now() + TEAM_POLL_FOR_MS;
    const id = setInterval(async () => {
      if (document.hidden) return;
      if (Date.now() > until) {
        clearInterval(id);
        return;
      }
      const next = await myLine().catch(() => null);
      if (next?.linked) setView(next);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [team]);

  const [tested, setTested] = useState(false);
  const test = () => {
    setError(undefined);
    setTested(false);
    start(async () => {
      const r = await sendMyLineTest();
      if (r.ok) setTested(true);
      else setError(r.error);
    });
  };

  const recheck = () => {
    setError(undefined);
    start(async () => {
      const next = await myLine().catch(() => null);
      if (next) setView(next);
      else setError("ตรวจไม่สำเร็จ ลองใหม่อีกครั้ง");
    });
  };

  const ask = () => {
    setError(undefined);
    start(async () => {
      const r = await startMyLineLink();
      if (r.ok) setView(r.view);
      else setError(r.error);
    });
  };

  const unlink = () => {
    setError(undefined);
    start(async () => {
      const r = await unlinkMyLine();
      if (r.ok) setView((v) => (v ? { ...v, linked: false, linkedAt: null, pending: null } : v));
      else setError(r.error);
    });
  };

  const flip = (key: AgentNotify, on: boolean) => {
    if (!view) return;
    const before = view;
    setView({ ...view, notify: { ...view.notify, [key]: on } });
    setError(undefined);
    setSaved(false);
    start(async () => {
      const r = await setMyLineNotify(key, on);
      if (r.ok) setSaved(true);
      else {
        setView(before);
        setError(r.error);
      }
    });
  };

  return (
    <section className={CARD} aria-label="เชื่อม LINE ของฉัน">
      <div className="pb-3">
        <h2 className="flex flex-wrap items-center gap-2 font-semibold">
          เชื่อม LINE ของฉัน
          {view?.linked && (view.friend?.friend === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ct-warn-bg)] px-2.5 py-0.5 text-xs font-normal text-[var(--ct-warn-ink)]">
              <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
              เชื่อมแล้ว · ยังไม่ได้เพิ่มเพื่อน
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--bot-ok)_15%,transparent)] px-2.5 py-0.5 text-xs font-normal">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--bot-ok)]" />
              เชื่อมแล้ว{view.friend?.name ? ` · ${view.friend.name}` : ""}{view.linkedAt ? ` ${day(view.linkedAt)}` : ""}
            </span>
          ))}
        </h2>
        <p className={`mt-1 text-sm ${MUTE}`}>เชื่อมครั้งเดียว แล้ว LINE advisortool จะแจ้งเตือนเรื่องของคุณเข้า LINE ของคุณเอง</p>
      </div>

      {locked || !view ? (
        <p className={`text-sm ${MUTE}`}>{locked ? "บัญชีทดลองใช้ร่วมกันหลายคน จึงเชื่อม LINE ไม่ได้" : "อ่านสถานะ LINE ไม่ได้ตอนนี้ ลองเปิดหน้านี้ใหม่"}</p>
      ) : view.linked ? (
        <>
          {view.friend?.friend === false && (
            <div className="mb-3 space-y-2 rounded-lg bg-[var(--ct-warn-bg)] p-3 text-sm">
              <p><b className="text-[var(--ct-warn-ink)]">แจ้งเตือนยังส่งมาไม่ได้</b> LINE ส่งข้อความได้เฉพาะคนที่เพิ่ม advisortool เป็นเพื่อนแล้ว</p>
              <div className="flex flex-wrap gap-2">
                <a href={view.addFriend} target="_blank" rel="noreferrer" className={`${GREEN} no-underline`}>เพิ่มเพื่อน advisortool</a>
                <button type="button" className={SMALL} disabled={pending} onClick={recheck}>ตรวจอีกครั้ง</button>
              </div>
            </div>
          )}
          {SWITCHES.map((s) => (
            <Switch
              key={s.key} id={`line-${s.key}`} label={s.label} hint={s.hint}
              checked={view.notify[s.key]} disabled={pending} onChange={(v) => flip(s.key, v)}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button type="button" className={PRIMARY} disabled={pending} onClick={test}>ส่งข้อความทดสอบ</button>
            <button type="button" className={SECONDARY} disabled={pending} onClick={unlink}>ยกเลิกการเชื่อม</button>
            <span className="text-sm text-[var(--bot-ok)]" role="status">
              {pending ? "กำลังทำ…" : tested ? "ส่งแล้ว ดูใน LINE ของคุณ" : saved ? "บันทึกแล้ว" : ""}
            </span>
          </div>
        </>
      ) : view.pending ? (
        <div className="flex flex-wrap items-start gap-4">
          <div className="hidden sm:block"><LinkQr url={view.pending.url} /></div>
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            {view.pending.words ? (
              <ol className={`list-decimal space-y-1 pl-5 ${MUTE}`}>
                <li>สแกน QR ด้วยกล้องมือถือ หรือกด เปิดใน LINE · LINE จะเปิดแชต advisortool พร้อมข้อความ <b className="text-[var(--bot-ink,inherit)]">{view.pending.words}</b></li>
                <li><b className="text-[var(--bot-ink,inherit)]">กดปุ่มส่ง ➤ ในแชต</b> ถ้า LINE ถาม ให้กดเพิ่มเพื่อนด้วย</li>
                <li>หน้านี้จะขึ้นว่าเชื่อมแล้วเอง</li>
              </ol>
            ) : (
              <p className={MUTE}>สแกน QR ด้วยมือถือที่มี LINE ของคุณ หรือถ้าเปิดหน้านี้บนมือถืออยู่แล้ว กด เปิดใน LINE</p>
            )}
            <p className={MUTE}>ใช้ได้ถึง {clock(view.pending.until)} น.{view.pending.words ? "" : " · ใช้ได้ครั้งเดียว"} · หน้านี้จะเปลี่ยนเองเมื่อเชื่อมแล้ว</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={view.pending.url} target="_blank" rel="noreferrer" className={`block text-center no-underline ${PRIMARY}`}>เปิดใน LINE</a>
              <button type="button" className={SECONDARY} disabled={pending} onClick={ask}>{view.pending.words ? "ขอรหัสใหม่" : "ขอลิงก์ใหม่"}</button>
            </div>
          </div>
        </div>
      ) : view.team ? (
        <div className="space-y-3">
          <p className={`text-sm ${MUTE}`}>ยังไม่ได้เชื่อม · สแกน QR ด้วยมือถือ แล้วกรอกรหัสตัวแทน 6 หลักของคุณ</p>
          <div className="flex flex-wrap items-start gap-4">
            <div className="hidden sm:block"><LinkQr url={view.team} /></div>
            <div className="min-w-0 flex-1 space-y-1.5 text-sm">
              <a href={view.team} target="_blank" rel="noreferrer" className={`block text-center no-underline ${PRIMARY}`}>เปิดใน LINE</a>
              <p className={MUTE}>เปิดเว็บบนมือถืออยู่แล้ว กดปุ่มนี้แทนการสแกน</p>
              <p className={MUTE}>เชื่อมเสร็จ หน้านี้เปลี่ยนเป็น &quot;เชื่อมแล้ว&quot; เอง</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className={`text-sm ${MUTE}`}>แจ้งเมื่อคลิปทำเสร็จ คลิปไม่สำเร็จ และเงินในกระเป๋าใกล้หมด เปิดปิดแต่ละเรื่องได้หลังเชื่อม</p>
          <button type="button" className={PRIMARY} disabled={pending} onClick={ask}>{pending ? "กำลังเตรียม…" : "เชื่อม LINE"}</button>
        </div>
      )}
      {error && <div className="pt-2"><FormError>{error}</FormError></div>}
    </section>
  );
}
