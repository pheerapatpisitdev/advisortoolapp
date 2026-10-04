"use client";
import { useRef, useState, useTransition } from "react";
import type { Product } from "@/lib/assistant/choose";
import { CHOOSE_ISHIELD, CHOOSE_LEGACY, CHOOSE_LIFE } from "@/lib/assistant/choose";
import { defaultWelcomeText, MAX_PICTURES, MAX_TEXT, WELCOME_PLANS, type PageWelcome, type WelcomeMode } from "@/lib/assistant/page-welcome";
import { withoutParticles } from "@/lib/assistant/voice";
import { Card } from "../ui";
import { resetWelcomeAction, saveWelcomeAction, type Result } from "./actions";

/** The same look as /admin/wallet. Every control is at least 44px tall: the owner uses this on a phone. */
const input = "min-h-11 w-full rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm";
const primary = "min-h-11 rounded bg-[var(--bot-navy)] px-4 text-sm text-[var(--bot-surface)] disabled:opacity-40";
const quiet = "min-h-11 rounded border border-[var(--bot-line-strong)] px-3 text-sm font-medium text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

/** the buttons under the menu: fixed, because a tapped one is read back as the plan it names */
const MENU_BUTTONS = [CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD];
const MAX_SIDE = 1600;

/** A phone photo at MAX_SIDE on its long side at most, as JPEG — well under the upload limit. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.88));
}

function Status({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span role="status" className={`text-xs ${ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
      {ok ? "✓ " : ""}{text}
    </span>
  );
}

export function WelcomeEditor({ pageId, pageName, initial, saved }: {
  pageId: string;
  pageName: string;
  initial: PageWelcome;
  /** null when the Page greets with the built-in menu */
  saved: (PageWelcome & { updatedAt: string }) | null;
}) {
  const [mode, setMode] = useState<WelcomeMode>(initial.mode);
  const [product, setProduct] = useState<Product>(initial.product ?? "lifeprotect");
  const [text, setText] = useState(initial.text);
  const [pictures, setPictures] = useState<string[]>(initial.pictures);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  // words still exactly the default follow the choice; words the owner wrote are left alone
  const switchTo = (m: WelcomeMode, p: Product) => {
    if (text === defaultWelcomeText(mode, product)) setText(defaultWelcomeText(m, p));
    setMode(m);
    setProduct(p);
  };

  const move = (i: number, by: number) => setPictures((ps) => {
    const next = [...ps];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    return next;
  });

  async function upload(f: File) {
    setStatus(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("picture", await shrink(f), "picture.jpg");
      const res = await fetch("/api/page-welcome-picture", { method: "POST", body: form });
      const r = (await res.json().catch(() => null)) as { ok: boolean; url?: string; error?: string } | null;
      if (r?.ok && r.url) setPictures((ps) => [...ps, r.url!]);
      else setStatus({ ok: false, text: r?.error ?? "อัปโหลดรูปไม่สำเร็จ" });
    } catch {
      setStatus({ ok: false, text: "อ่านรูปนี้ไม่ได้ ลองรูปอื่น หรือบันทึกเป็น JPG ก่อน" });
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }

  const act = (fn: () => Promise<Result>, ok: string) => start(async () => {
    setStatus(null);
    try {
      const r = await fn();
      setStatus(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error });
    } catch {
      setStatus({ ok: false, text: "บันทึกไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" });
    }
  });

  const save = () => act(() => saveWelcomeAction(pageId, { mode, product, text, pictures }), "บันทึกแล้ว ข้อความถัดไปใช้แบบนี้");
  const reset = () => {
    if (!confirm(`ให้ ${pageName} กลับไปใช้เมนู 3 แบบตามเดิม และลบรูปที่ใส่ไว้?`)) return;
    act(async () => {
      const r = await resetWelcomeAction(pageId);
      if (r.ok) {
        setMode("menu");
        setText(defaultWelcomeText("menu"));
        setPictures([]);
      }
      return r;
    }, "กลับไปใช้ค่าเดิมแล้ว");
  };

  const busy = pending || uploading;
  const when = saved && new Date(saved.updatedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

  return (
    <Card title={pageName} hint={saved ? `ตั้งค่าเองแล้ว · แก้ล่าสุด ${when}` : "ใช้ค่าเริ่มต้น (เมนู 3 แบบ)"}>
      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-medium text-[var(--bot-ink-mute)]">แบบการต้อนรับ</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded border border-[var(--bot-line-strong)] px-3 text-sm">
            <input type="radio" name={`mode-${pageId}`} checked={mode === "menu"} onChange={() => switchTo("menu", product)} />
            เมนู 3 แบบ ให้ลูกค้าเลือก
          </label>
          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded border border-[var(--bot-line-strong)] px-3 text-sm">
            <input type="radio" name={`mode-${pageId}`} checked={mode === "one_plan"} onChange={() => switchTo("one_plan", product)} />
            แบบประกันเดียว
          </label>
        </div>
        {mode === "one_plan" && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs text-[var(--bot-ink-mute)]">แบบประกันที่เพจนี้ขาย — ลูกค้าที่ไม่ได้บอกว่าสนใจแบบไหน จะได้คิดเบี้ยแบบนี้</span>
            <select className={input} value={product} onChange={(e) => switchTo("one_plan", e.target.value as Product)}>
              {WELCOME_PLANS.map((p) => <option key={p.product} value={p.product}>{p.label}</option>)}
            </select>
          </label>
        )}
      </fieldset>

      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-[var(--bot-ink-mute)]">
          ข้อความ {mode === "menu" && "— ปุ่ม 3 ปุ่มใต้ข้อความแก้ไม่ได้ ถ้าเขียนรายการ 1-2-3 ให้เรียงตามปุ่ม"}
        </span>
        <textarea className={`${input} min-h-40`} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} />
        <span className="mt-1 flex justify-between text-xs text-[var(--bot-ink-mute)]">
          <button type="button" className="underline" onClick={() => setText(defaultWelcomeText(mode, product))}>ใช้ข้อความตั้งต้น</button>
          <span>{text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}</span>
        </span>
      </label>

      <div className="mb-4">
        <span className="mb-1 block text-xs font-medium text-[var(--bot-ink-mute)]">
          รูป ส่งก่อนข้อความตามลำดับนี้ เฉพาะข้อความแรกของการคุย ({pictures.length}/{MAX_PICTURES})
        </span>
        <ul className="flex flex-wrap gap-3">
          {pictures.map((p, i) => (
            <li key={p} className="w-28">
              {/* eslint-disable-next-line @next/next/no-img-element -- an upload in storage, not a site asset */}
              <img src={p} alt={`รูปที่ ${i + 1}`} className="aspect-square w-28 rounded border border-[var(--bot-line)] object-cover" />
              <div className="mt-1 flex gap-1">
                <button type="button" className={`${quiet} flex-1 px-0`} disabled={i === 0} onClick={() => move(i, -1)} aria-label="เลื่อนขึ้นก่อน">←</button>
                <button type="button" className={`${quiet} flex-1 px-0`} disabled={i === pictures.length - 1} onClick={() => move(i, 1)} aria-label="เลื่อนไปหลัง">→</button>
                <button type="button" className={`${quiet} flex-1 px-0`} onClick={() => setPictures((ps) => ps.filter((x) => x !== p))} aria-label="เอารูปนี้ออก">✕</button>
              </div>
            </li>
          ))}
          {pictures.length < MAX_PICTURES && (
            <li>
              <label className={`${quiet} flex aspect-square w-28 cursor-pointer flex-col items-center justify-center text-center`}>
                {uploading ? "กำลังอัปโหลด…" : "+ เพิ่มรูป"}
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
              </label>
            </li>
          )}
        </ul>
      </div>

      <div className="mb-4 rounded-lg bg-[var(--bot-band)] p-3">
        <div className="mb-2 text-xs font-medium text-[var(--bot-ink-mute)]">ตัวอย่างที่ลูกค้าเห็น</div>
        <div className="flex flex-col items-start gap-2">
          {pictures.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- a preview of an upload
            <img key={p} src={p} alt={`รูปที่ ${i + 1}`} className="w-40 rounded-2xl" />
          ))}
          <p className="max-w-sm whitespace-pre-wrap rounded-2xl bg-[var(--bot-surface)] px-3 py-2 text-sm">{withoutParticles(text)}</p>
          {mode === "menu" && (
            <div className="flex flex-wrap gap-1">
              {MENU_BUTTONS.map((b) => <span key={b} className="rounded-full border border-[var(--bot-navy)] px-3 py-1 text-xs text-[var(--bot-navy)]">{b}</span>)}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-[var(--bot-ink-mute)]">ระบบตัด ครับ/ค่ะ ออกตอนส่งให้ลูกค้า</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={busy || !text.trim()} onClick={save}>{pending ? "กำลังบันทึก…" : "บันทึก"}</button>
        {saved && <button type="button" className={quiet} disabled={busy} onClick={reset}>คืนค่าเดิม</button>}
        {status && <Status {...status} />}
      </div>
    </Card>
  );
}
