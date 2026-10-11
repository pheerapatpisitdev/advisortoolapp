"use client";
import { useRef, useState, useTransition } from "react";
import { shrink } from "../welcome/WelcomeEditor";
import { resetIntro, saveIntro } from "./intro-actions";
import type { IntroRow } from "@/lib/chat/intro-store";
import type { PageChoice } from "./TestChat";

/**
 * รูปที่บอทส่ง: the pictures sent once ahead of a customer's first quotation (Life Protect and
 * iShield, Messenger and LINE). One set for every Page and LINE, and a Page's own where the
 * owner sets one (owner, 2026-10-11).
 */

const EVERY = "*";
const MOST = 3;
const small = "rounded border border-[var(--bot-line-strong)] px-2 py-1 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

export function IntroPictures({ rows, builtIn, pages }: { rows: IntroRow[]; builtIn: string; pages: PageChoice[] }) {
  const own = (scope: string) => rows.find((r) => r.scope === scope);
  const every = own(EVERY)?.pictures ?? [builtIn];
  return (
    <section className="grid gap-4">
      <p className="text-sm text-[var(--bot-ink-mute)]">
        รูปที่บอทส่งครั้งเดียว ก่อนใบเสนอราคาแรกของ Life Protect และ iShield ทั้ง Messenger และ LINE
        บันทึกแล้วมีผลกับลูกค้าคนถัดไปภายใน 1 นาที · ไม่มีรูป = ส่งใบเสนอราคาเลย
      </p>
      <Editor
        key={EVERY}
        scope={EVERY}
        title="ชุดกลาง · ทุกเพจและ LINE"
        hint="เพจที่ไม่ได้ตั้งรูปเองจะใช้ชุดนี้"
        initial={every}
        hasOwn={Boolean(own(EVERY))}
        resetLabel="คืนรูปเดิม"
        builtIn={builtIn}
      />
      {pages.filter((p) => !p.expat).map((p) => (
        <Editor
          key={p.id}
          scope={p.id}
          title={p.name}
          hint={own(p.id) ? "ใช้รูปของเพจนี้เอง" : "ใช้ชุดกลางอยู่"}
          initial={own(p.id)?.pictures ?? every}
          hasOwn={Boolean(own(p.id))}
          resetLabel="กลับไปใช้ชุดกลาง"
          builtIn={builtIn}
          followsEvery
        />
      ))}
    </section>
  );
}

function Editor({ scope, title, hint, initial, hasOwn, resetLabel, builtIn, followsEvery = false }: {
  scope: string; title: string; hint: string; initial: string[]; hasOwn: boolean;
  resetLabel: string; builtIn: string; followsEvery?: boolean;
}) {
  const [pictures, setPictures] = useState(initial);
  const [custom, setCustom] = useState(hasOwn || !followsEvery);
  const [own, setOwn] = useState(hasOwn);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  /** where the next upload lands: the end, or in place of the picture at this index */
  const target = useRef<number>(-1);
  const busy = pending || uploading;

  async function upload(f: File) {
    setStatus(undefined);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("picture", await shrink(f), "picture.jpg");
      const res = await fetch("/api/page-welcome-picture", { method: "POST", body: form });
      const r = (await res.json().catch(() => null)) as { ok: boolean; url?: string; error?: string } | null;
      if (!r?.ok || !r.url) { setStatus({ ok: false, text: r?.error ?? "อัปโหลดรูปไม่สำเร็จ" }); return; }
      const at = target.current;
      setPictures((ps) => (at >= 0 ? ps.map((p, i) => (i === at ? r.url! : p)) : [...ps, r.url!]));
    } catch {
      setStatus({ ok: false, text: "อ่านรูปนี้ไม่ได้ ลองรูปอื่น หรือบันทึกเป็น JPG ก่อน" });
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }

  const pick = (at: number) => { target.current = at; file.current?.click(); };
  const move = (i: number, by: number) => setPictures((ps) => {
    const next = [...ps];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    return next;
  });

  function save() {
    setStatus(undefined);
    start(async () => {
      const r = await saveIntro(scope, pictures);
      if (!r.ok) { setStatus({ ok: false, text: r.error }); return; }
      setOwn(true);
      setStatus({ ok: true, text: pictures.length ? "บันทึกแล้ว" : "บันทึกแล้ว · ไม่ส่งรูปก่อนราคา" });
    });
  }

  function reset() {
    setStatus(undefined);
    start(async () => {
      const r = await resetIntro(scope);
      if (!r.ok) { setStatus({ ok: false, text: r.error }); return; }
      setOwn(false);
      if (followsEvery) setCustom(false);
      else setPictures([builtIn]);
      setStatus({ ok: true, text: followsEvery ? "กลับไปใช้ชุดกลางแล้ว" : "คืนรูปเดิมแล้ว" });
    });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-[var(--bot-ink-mute)]">{own || !followsEvery ? hint : "ใช้ชุดกลางอยู่"}</span>
      </div>

      {!custom ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {initial.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- a picture in storage or /public, any size
              <img key={i} src={p} alt="" className="h-20 w-auto rounded-md border border-[var(--bot-line)] opacity-70" />
            ))}
            {!initial.length && <span className="text-xs text-[var(--bot-ink-mute)]">ชุดกลางไม่มีรูป</span>}
          </div>
          <button type="button" className={small} onClick={() => setCustom(true)}>ตั้งรูปเองสำหรับเพจนี้</button>
        </div>
      ) : (
        <>
          <ol className="grid gap-2">
            {pictures.map((p, i) => (
              <li key={`${p}-${i}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--bot-line)] p-2">
                <span className="w-5 text-center text-sm font-semibold text-[var(--bot-navy)]">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- a picture in storage or /public, any size */}
                <img src={p} alt={`รูปที่ ${i + 1}`} className="h-24 w-auto max-w-[60%] rounded-md border border-[var(--bot-line)]" />
                <span className="ml-auto flex flex-wrap gap-1.5">
                  <button type="button" className={small} disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น">↑</button>
                  <button type="button" className={small} disabled={busy || i === pictures.length - 1} onClick={() => move(i, 1)} aria-label="เลื่อนลง">↓</button>
                  <button type="button" className={small} disabled={busy} onClick={() => pick(i)}>เปลี่ยนรูป</button>
                  <button
                    type="button" disabled={busy} onClick={() => setPictures((ps) => ps.filter((_, j) => j !== i))}
                    className="rounded border border-[var(--bot-red)] px-2 py-1 text-xs text-[var(--bot-red-ink)] hover:bg-[var(--bot-red-soft)] disabled:opacity-40"
                  >
                    ลบ
                  </button>
                </span>
              </li>
            ))}
          </ol>
          {!pictures.length && <p className="text-xs text-[var(--bot-ink-mute)]">ไม่มีรูป · บอทจะส่งใบเสนอราคาเลย</p>}
          {pictures.length < MOST && (
            <button
              type="button" disabled={busy} onClick={() => pick(-1)}
              className="rounded-lg border-2 border-dashed border-[var(--bot-line)] px-3 py-3 text-sm font-medium text-[var(--bot-navy)] hover:bg-[var(--bot-band)] disabled:opacity-40"
            >
              {uploading ? "กำลังอัปโหลด…" : `+ เพิ่มรูป (สูงสุด ${MOST} รูป)`}
            </button>
          )}
          <input
            ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-[var(--bot-navy)] px-3 py-1.5 text-sm text-[var(--bot-surface)] disabled:opacity-40">
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            {(own || followsEvery) && (
              <button type="button" onClick={reset} disabled={busy} className={small}>{resetLabel}</button>
            )}
          </div>
        </>
      )}
      {status && (
        <span role="status" className={`text-xs ${status.ok ? "text-[var(--bot-ok)]" : "text-[var(--bot-red-ink)]"}`}>
          {status.ok ? "✓ " : ""}{status.text}
        </span>
      )}
    </div>
  );
}
