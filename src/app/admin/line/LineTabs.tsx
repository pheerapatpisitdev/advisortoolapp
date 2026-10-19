"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Friends } from "@/lib/line/client";
import type { Broadcast, Part, Reply } from "@/lib/line/broadcasts";
import type { OwnerLine } from "@/lib/line/owner-alert";
import { HEALTH_LABEL, healthLabel, type Health } from "@/lib/ai/health-rules";
import { Card, Empty } from "../ui";
import {
  broadcastAction, cancelBroadcastAction, notifyAiDownAction, notifyNewMemberAction, rebuildMenusAction, setBotAction, startLinkAction,
  testAlertAction, unlinkAction, type Result,
} from "./actions";

export interface LineView {
  hook: { ok: boolean; detail: string; endpoint: string | null };
  friends: Friends | null;
  quota: { limit: number | null; used: number } | null;
  chats: { last: string | null; people7d: number } | null;
  botOn: boolean;
  /** null when it could not be read */
  owner: OwnerLine | null;
  /** each AI provider's standing from the last check; null when it could not be read */
  health: Health[] | null;
  broadcasts: Broadcast[] | null;
  replyChoices: Reply[];
  maxParts: number;
  menus: { name: string; alias: string; bar: string; columns: number; buttons: { title: string; sub: string }[] }[];
}

/** The same look as /admin/welcome. Every control is at least 44px tall: the owner uses this on a phone. */
const input = "min-h-11 w-full rounded border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm";
const primary = "min-h-11 rounded bg-[var(--line-oa-green)] px-4 text-sm font-semibold text-white disabled:opacity-40";
const quiet = "min-h-11 rounded border border-[var(--bot-line-strong)] px-3 text-sm font-medium text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-40";

const TABS = [
  { id: "status", label: "สถานะ" },
  { id: "broadcast", label: "บรอดแคสต์" },
  { id: "menu", label: "เมนูด้านล่าง" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const n = (v: number) => v.toLocaleString("en-US");
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", {
  timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "mute"; children: React.ReactNode }) {
  const c = {
    ok: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
    warn: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]",
    bad: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]",
    mute: "bg-[var(--bot-band)] text-[var(--bot-ink-mute)]",
  }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

function Figure({ label, value, note, children }: { label: string; value: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--bot-line)] bg-[var(--bot-surface)] px-3 py-2.5">
      <p className="text-xs text-[var(--bot-ink-mute)]">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-[var(--bot-ink)]">{value}</p>
      {note && <p className="text-xs text-[var(--bot-ink-faint)]">{note}</p>}
      {children}
    </div>
  );
}

function Said({ result }: { result: Result | null }) {
  if (!result) return null;
  return result.ok
    ? (result.note ? <p className="mt-2 rounded-md bg-[var(--bot-ok-soft)] px-3 py-2 text-sm text-[var(--bot-ok)]">{result.note}</p> : null)
    : <p className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">{result.error}</p>;
}

export function LineTabs({ view }: { view: LineView }) {
  const [tab, setTab] = useState<Tab>("status");
  // a link to /admin/line#broadcast opens on that tab
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some((t) => t.id === h)) setTab(h as Tab);
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  return (
    <>
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-[var(--bot-line)]">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => choose(t.id)}
            className={`min-h-11 border-b-2 px-3 text-sm ${tab === t.id ? "border-[var(--bot-navy)] font-semibold text-[var(--bot-ink)]" : "border-transparent text-[var(--bot-ink-mute)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "status" && <Status view={view} />}
      {tab === "broadcast" && <Broadcasting view={view} />}
      {tab === "menu" && <Menus view={view} />}
    </>
  );
}

/* ── สถานะ ──────────────────────────────────────────────────────────────────────────────── */

function Status({ view }: { view: LineView }) {
  const { friends: f, quota: q, chats: c, hook } = view;
  const share = q?.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="เพื่อนทั้งหมด" value={f ? n(f.followers) : "—"} note={f ? `บล็อก ${n(f.blocks)} คน` : "LINE ยังนับไม่เสร็จ"} />
        <Figure label="ส่งถึงได้" value={f ? n(f.reach) : "—"} note={f ? "คนที่ไม่ได้บล็อก" : undefined} />
        <Figure label="ข้อความเดือนนี้" value={q ? `${n(q.used)} / ${q.limit === null ? "ไม่จำกัด" : n(q.limit)}` : "—"} note={q ? undefined : "อ่านไม่สำเร็จ"}>
          {q?.limit ? (
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--bot-band)]">
              <div className="h-full bg-[var(--bot-ok)]" style={{ width: `${share}%` }} />
            </div>
          ) : null}
        </Figure>
        <Figure label="คนทักใน 7 วัน" value={c ? n(c.people7d) : "—"} note={c ? undefined : "อ่านไม่สำเร็จ"} />
      </div>

      <Card title="การเชื่อมต่อ">
        <dl className="text-sm">
          <Row k="ระบบรับข้อความ">
            {hook.ok ? <Pill tone="ok">ทำงาน</Pill> : <Pill tone="bad">มีปัญหา</Pill>}{" "}
            <span className="text-[var(--bot-ink-mute)]">ทดสอบกับ LINE เมื่อเปิดหน้านี้: {hook.detail}</span>
          </Row>
          <Row k="ที่อยู่ที่ LINE ส่งมา">{hook.endpoint ?? <span className="text-[var(--bot-red-ink)]">ยังไม่ได้เปิดใช้ใน LINE Developers</span>}</Row>
          <Row k="แชทล่าสุด">{c?.last ? when(c.last) : "ยังไม่มี"}</Row>
          {f && <Row k="นับเพื่อนเมื่อ">{f.date} (LINE นับวันละครั้ง)</Row>}
        </dl>
      </Card>

      <OwnerAlerts owner={view.owner} health={view.health} />
      <BotSwitch on={view.botOn} />
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-[var(--bot-line)] py-2 last:border-0">
      <dt className="w-40 shrink-0 text-[var(--bot-ink-mute)]">{k}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

/**
 * The owner's own LINE, linked once by typing a code into the account's chat, so the account
 * can tell the owner when a member joins (owner chose ก, 2026-10-15).
 */
function OwnerAlerts({ owner, health }: { owner: OwnerLine | null; health: Health[] | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [code, setCode] = useState<{ code: string; until: string } | null>(
    owner?.pendingCode && owner.pendingUntil ? { code: owner.pendingCode, until: owner.pendingUntil } : null,
  );
  const run = (fn: () => Promise<Result>) => start(async () => {
    setResult(await fn());
    router.refresh();
  });
  const newCode = () => start(async () => {
    const r = await startLinkAction();
    setResult(r.ok ? null : r);
    if (r.ok && r.code && r.until) setCode({ code: r.code, until: r.until });
  });

  return (
    <Card title="แจ้งเตือนเข้า LINE ของฉัน" hint="แต่ละครั้งที่แจ้งใช้โควตา 1 จาก 300 ข้อความต่อเดือน (โควตาเดียวกับบรอดแคสต์)">
      {owner === null ? <Empty>อ่านการตั้งค่าไม่สำเร็จ ลองเปิดหน้านี้ใหม่</Empty> : owner.linked ? (
        <div className="space-y-2 text-sm">
          <p><Pill tone="ok">ผูกแล้ว</Pill>{owner.linkedAt && <span className="ml-2 text-[var(--bot-ink-mute)]">เมื่อ {when(owner.linkedAt)}</span>}</p>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox" checked={owner.notifyNewMember} disabled={pending} className="h-5 w-5 accent-[var(--bot-ok)]"
              onChange={() => run(() => notifyNewMemberAction(!owner.notifyNewMember))}
            />
            แจ้งเมื่อมีสมาชิกใหม่
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox" checked={owner.notifyAiDown} disabled={pending} className="h-5 w-5 accent-[var(--bot-ok)]"
              onChange={() => run(() => notifyAiDownAction(!owner.notifyAiDown))}
            />
            แจ้งเมื่อ AI เจ้าไหนใช้ไม่ได้
          </label>
          <AiStanding health={health} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quiet} disabled={pending} onClick={() => run(testAlertAction)}>ส่งข้อความทดสอบ</button>
            <button type="button" className={quiet} disabled={pending} onClick={() => run(unlinkAction)}>ยกเลิกการผูก</button>
          </div>
        </div>
      ) : code && Date.parse(code.until) > Date.now() ? (
        <div className="space-y-2 text-sm">
          <p>พิมพ์ข้อความนี้ในแชทกับบัญชี LINE OA จากมือถือของคุณ ภายใน {when(code.until)} น.</p>
          <p className="inline-block rounded-lg bg-[var(--bot-navy-soft)] px-3 py-1.5 text-2xl font-bold tracking-widest tabular-nums">ผูก {code.code}</p>
          <p><Pill tone="warn">รอคุณพิมพ์รหัส</Pill></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quiet} disabled={pending} onClick={() => router.refresh()}>พิมพ์แล้ว ตรวจอีกครั้ง</button>
            <button type="button" className={quiet} disabled={pending} onClick={newCode}>ขอรหัสใหม่</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p>ผูก LINE ของคุณครั้งเดียว แล้วบัญชี LINE OA จะส่งข้อความหาคุณทันทีเมื่อมีคนสมัครสมาชิกใหม่ด้วย Google และเมื่อ AI เจ้าไหนใช้ไม่ได้</p>
          <button type="button" className={quiet} disabled={pending} onClick={newCode}>ขอรหัสผูก LINE</button>
        </div>
      )}
      <Said result={result} />
    </Card>
  );
}

const ORDER = Object.keys(HEALTH_LABEL);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

/** Each provider as the last 30-minute check left it: green answering, red down since a time. */
function AiStanding({ health }: { health: Health[] | null }) {
  if (health === null) return <p className="ml-8 text-xs text-[var(--bot-ink-mute)]">อ่านสถานะ AI ไม่สำเร็จ</p>;
  if (health.length === 0) return <p className="ml-8 text-xs text-[var(--bot-ink-mute)]">ยังไม่ได้ตรวจ ระบบตรวจทุก 30 นาที</p>;
  const rows = [...health].sort((a, b) => ORDER.indexOf(a.provider) - ORDER.indexOf(b.provider));
  const last = rows.map((h) => h.lastChecked).filter((s): s is string => Boolean(s)).sort().at(-1);
  return (
    <div className="ml-8 space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {rows.map((h) => (
          <Pill key={h.provider} tone={h.ok ? "ok" : h.alerted ? "bad" : "warn"}>
            {healthLabel(h.provider)}{!h.ok && h.downSince ? ` · ${h.alerted ? "" : "พลาด 1 รอบ "}${clock(h.downSince)}` : ""}
          </Pill>
        ))}
      </div>
      {last && <p className="text-xs text-[var(--bot-ink-mute)]">ตรวจล่าสุด {clock(last)} น. · ตรวจทุก 30 นาที · เสียงพากย์ Gemini ทุก 2 ชม.</p>}
    </div>
  );
}

function BotSwitch({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const flip = () => start(async () => setResult(await setBotAction(!on)));
  return (
    <Card title="บอทตอบอัตโนมัติใน LINE" hint="ปิดเมื่ออยากตอบลูกค้าเองใน LINE OA Manager · บอทไม่รู้ว่าแอดมินพิมพ์อะไรใน OA Manager ถ้าเปิดไว้บอทจะตอบซ้อน">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={on} disabled={pending} onChange={flip} className="h-5 w-5 accent-[var(--bot-ok)]" />
        {on ? "เปิดอยู่ บอทตอบทุกแชท" : "ปิดอยู่ ข้อความลูกค้าเก็บไว้ แต่บอทไม่ตอบ"}
      </label>
      <Said result={result} />
    </Card>
  );
}

/* ── บรอดแคสต์ ──────────────────────────────────────────────────────────────────────────── */

/** A picture at 1040px on its long side, as JPEG: LINE shows it whole and takes it under 1 MB. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1040 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.85));
}

type Draft = (Part & { key: number })[];
let nextKey = 1;

function Broadcasting({ view }: { view: LineView }) {
  const router = useRouter();
  const reach = view.friends?.reach ?? null;
  const q = view.quota;
  const scheduled = (view.broadcasts ?? []).filter((b) => b.status === "scheduled").length;
  const left = q?.limit != null ? q.limit - q.used : null;
  const leftAfterScheduled = left !== null && reach !== null ? left - scheduled * reach : left;

  const [parts, setParts] = useState<Draft>([{ type: "text", text: "", key: nextKey++ }]);
  const [replies, setReplies] = useState<string[]>([]);
  const [later, setLater] = useState(false);
  const [at, setAt] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  const filled = parts.filter((p) => (p.type === "text" ? p.text.trim() : p.url));
  const short = leftAfterScheduled !== null && reach !== null && reach > leftAfterScheduled;
  const ready = filled.length > 0 && !uploading && !short && (!later || at);

  const setText = (key: number, text: string) => setParts((ps) => ps.map((p) => (p.key === key ? { ...p, text } as Draft[number] : p)));
  const remove = (key: number) => setParts((ps) => ps.filter((p) => p.key !== key));
  const addText = () => setParts((ps) => [...ps, { type: "text", text: "", key: nextKey++ }]);
  const addPicture = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("picture", await shrink(file), "picture.jpg");
      const res = await fetch("/api/line/broadcast-picture", { method: "POST", body: form });
      const d = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!d.ok || !d.url) setResult({ ok: false, error: d.error ?? "อัปโหลดรูปไม่สำเร็จ" });
      else setParts((ps) => [...ps, { type: "image", url: d.url!, key: nextKey++ }]);
    } catch {
      setResult({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setUploading(false);
    }
  };

  const send = () => start(async () => {
    const r = await broadcastAction({
      parts: filled.map((p) => (p.type === "text" ? { type: "text", text: p.text } : { type: "image", url: p.url })),
      replies,
      sendAt: later && at ? new Date(at).toISOString() : null,
    });
    setResult(r);
    setConfirming(false);
    if (r.ok) {
      setParts([{ type: "text", text: "", key: nextKey++ }]);
      setReplies([]);
      setLater(false);
      setAt("");
    }
    router.refresh();
  });

  const who = reach === null ? "เพื่อนทุกคน" : `เพื่อน ${n(reach)} คน`;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card title="ส่งข้อความหาเพื่อนทุกคน" hint={`ส่งได้ครั้งละ 1–${view.maxParts} ชิ้น (ข้อความ / รูป) · ปุ่มตอบด่วนติดท้ายชิ้นสุดท้าย กดแล้วบอทตอบต่อให้`}>
          <div className="space-y-3">
            {parts.map((p, i) => (
              <div key={p.key} className="rounded-lg border border-dashed border-[var(--bot-line-strong)] p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--bot-ink-mute)]">
                  <span>ชิ้นที่ {i + 1} · {p.type === "text" ? "ข้อความ" : "รูป"}</span>
                  {parts.length > 1 && <button type="button" className={quiet} onClick={() => remove(p.key)}>ลบ</button>}
                </div>
                {p.type === "text" ? (
                  <textarea
                    id={`part-${p.key}`} aria-label={`ข้อความชิ้นที่ ${i + 1}`} rows={5} maxLength={5000}
                    className={input} value={p.text} onChange={(e) => setText(p.key, e.target.value)}
                    placeholder="พิมพ์ข้อความที่จะส่ง"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={`รูปชิ้นที่ ${i + 1}`} className="max-h-48 rounded" />
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={quiet} disabled={parts.length >= view.maxParts} onClick={addText}>+ ข้อความ</button>
              <label className={`${quiet} inline-flex cursor-pointer items-center ${parts.length >= view.maxParts || uploading ? "pointer-events-none opacity-40" : ""}`}>
                {uploading ? "กำลังอัปโหลด…" : "+ รูป"}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                  onChange={(e) => { void addPicture(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
            </div>

            <fieldset>
              <legend className="mb-1 text-sm text-[var(--bot-ink-mute)]">ปุ่มตอบด่วน (ไม่บังคับ)</legend>
              <div className="flex flex-wrap gap-2">
                {view.replyChoices.map((r) => {
                  const on = replies.includes(r.text);
                  return (
                    <button
                      key={r.text} type="button" aria-pressed={on}
                      onClick={() => setReplies((rs) => (on ? rs.filter((x) => x !== r.text) : [...rs, r.text]))}
                      className={`min-h-11 rounded-full border px-3 text-sm ${on ? "border-[var(--line-oa-green)] bg-[var(--line-oa-green)] text-white" : "border-[var(--bot-line-strong)] text-[var(--bot-ink-foot)]"}`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-lg bg-[var(--bot-navy-soft)] px-3 py-2.5 text-sm">
              {reach === null ? (
                <p>LINE ยังไม่บอกจำนวนเพื่อนของเมื่อวาน ส่งได้ แต่บอกโควตาที่ใช้ล่วงหน้าไม่ได้</p>
              ) : (
                <p>ส่งถึง <b className="tabular-nums">{n(reach)} คน</b> = ใช้โควตา <b className="tabular-nums">{n(reach)}</b> ข้อความ</p>
              )}
              {leftAfterScheduled !== null && q?.limit != null && (
                <p>
                  เหลือเดือนนี้หลังส่ง <b className="tabular-nums">{n(Math.max(0, leftAfterScheduled - (reach ?? 0)))} / {n(q.limit)}</b>
                  {scheduled > 0 && <span className="text-[var(--bot-ink-mute)]"> (หักที่ตั้งเวลาไว้ {scheduled} รายการแล้ว)</span>}
                  {" "}· รอบใหม่เริ่มวันที่ 1
                </p>
              )}
              <p className="text-xs text-[var(--bot-ink-mute)]">LINE นับต่อคน ไม่ใช่ต่อชิ้น ส่ง 2 ชิ้นก็นับคนละ 1 · ถ้าโควตาไม่พอ ปุ่มส่งจะกดไม่ได้</p>
              {short && <p className="mt-1 font-medium text-[var(--bot-red-ink)]">โควตาไม่พอสำหรับการส่งครั้งนี้</p>}
            </div>

            <fieldset className="rounded-lg border border-[var(--bot-line)] p-3">
              <legend className="px-1 text-sm text-[var(--bot-ink-mute)]">เวลาส่ง</legend>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="when" checked={!later} onChange={() => setLater(false)} /> ส่งทันที</label>
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="when" checked={later} onChange={() => setLater(true)} /> ตั้งเวลา</label>
                {later && (
                  <input
                    id="send-at" type="datetime-local" aria-label="วันเวลาที่จะส่ง" className={`${input} w-auto`}
                    value={at} onChange={(e) => setAt(e.target.value)}
                  />
                )}
              </div>
              {later && <p className="mt-1 text-xs text-[var(--bot-ink-mute)]">เวลาไทย · ระบบเช็กทุก 5 นาที จึงส่งช้ากว่าเวลาที่ตั้งได้ไม่เกิน 5 นาที</p>}
            </fieldset>

            {!confirming ? (
              <button type="button" className={primary} disabled={!ready || pending} onClick={() => { setResult(null); setConfirming(true); }}>
                {later ? `ตั้งเวลาส่งหา${who}` : `ส่งหา${who}`}
              </button>
            ) : (
              <div className="space-y-2 rounded-lg border-2 border-[var(--bot-red)] bg-[var(--bot-red-soft)] p-3 text-sm">
                <p className="font-semibold">
                  {later ? `ยืนยันตั้งเวลาส่งหา${who} ${at ? when(new Date(at).toISOString()) : ""}?` : `ยืนยันส่งหา${who}?`}
                </p>
                <p>{later ? "ยกเลิกได้ก่อนถึงเวลา" : "ส่งแล้วดึงกลับไม่ได้"}{reach !== null && ` · ใช้โควตา ${n(reach)}`}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primary} disabled={pending} onClick={send}>{pending ? "กำลังส่ง…" : later ? "ยืนยัน ตั้งเวลา" : "ยืนยัน ส่งเลย"}</button>
                  <button type="button" className={quiet} disabled={pending} onClick={() => setConfirming(false)}>ยกเลิก</button>
                </div>
              </div>
            )}
            <Said result={result} />
          </div>
        </Card>

        <Preview parts={filled} replies={view.replyChoices.filter((r) => replies.includes(r.text))} />
      </div>

      <History list={view.broadcasts} />
    </>
  );
}

/** The chat as a friend sees it, from the parts as they are typed. */
function Preview({ parts, replies }: { parts: Draft; replies: Reply[] }) {
  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <p className="mb-1.5 text-xs text-[var(--bot-ink-mute)]">ลูกค้าจะเห็นแบบนี้</p>
      <div className="overflow-hidden rounded-[28px] border-8 border-[var(--line-oa-frame)] bg-[var(--line-oa-chat)]">
        <div className="bg-[var(--line-oa-frame)] px-3 py-1.5 text-xs text-white">advisortool.app</div>
        <div className="grid min-h-80 content-start gap-2 px-2.5 py-3">
          {parts.length === 0 && <p className="text-center text-xs text-white/80">ยังไม่มีข้อความ</p>}
          {parts.map((p, i) => (
            <div key={p.key} className="flex items-start gap-1.5">
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--bot-navy)] text-[10px] text-white ${i ? "invisible" : ""}`}>AT</div>
              {p.type === "text"
                ? <div className="max-w-[210px] whitespace-pre-wrap break-words rounded-2xl bg-white px-2.5 py-2 text-[13px] text-[var(--bot-ink)]">{p.text}</div>
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={p.url} alt="" className="max-w-[190px] rounded-xl" />}
            </div>
          ))}
        </div>
        {replies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pb-3">
            {replies.map((r) => <span key={r.text} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--line-oa-green)]">{r.label}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS: Record<Broadcast["status"], { tone: "ok" | "warn" | "bad" | "mute"; label: string }> = {
  scheduled: { tone: "warn", label: "ตั้งเวลาไว้" },
  sending: { tone: "warn", label: "กำลังส่ง" },
  sent: { tone: "ok", label: "ส่งแล้ว" },
  failed: { tone: "bad", label: "ส่งไม่สำเร็จ" },
  cancelled: { tone: "mute", label: "ยกเลิกแล้ว" },
};

function firstWords(b: Broadcast): string {
  const text = b.parts.find((p) => p.type === "text") as { text: string } | undefined;
  const pics = b.parts.filter((p) => p.type === "image").length;
  const words = text ? (text.text.length > 60 ? `${text.text.slice(0, 60)}…` : text.text) : "";
  return [words, pics ? `รูป ${pics}` : ""].filter(Boolean).join(" · ");
}

function History({ list }: { list: Broadcast[] | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const cancel = (id: string) => start(async () => {
    setResult(await cancelBroadcastAction(id));
    router.refresh();
  });
  return (
    <div className="mt-5">
      <Card title="ประวัติการส่ง" hint="LINE บอกยอดคนอ่านเฉพาะครั้งที่ส่งถึง 20 คนขึ้นไป">
        {list === null ? <Empty>อ่านประวัติไม่สำเร็จ ลองเปิดหน้านี้ใหม่</Empty>
          : list.length === 0 ? <Empty>ยังไม่เคยส่งบรอดแคสต์</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[var(--bot-navy)] text-left text-white">
                    <th className="px-2.5 py-2 font-medium">วันที่</th>
                    <th className="px-2.5 py-2 font-medium">ข้อความ</th>
                    <th className="px-2.5 py-2 font-medium">ส่งถึง</th>
                    <th className="px-2.5 py-2 font-medium">สถานะ</th>
                    <th className="px-2.5 py-2 font-medium">คนอ่าน</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => (
                    <tr key={b.id} className="align-top">
                      <td className="whitespace-nowrap border-b border-[var(--bot-line)] px-2.5 py-2 tabular-nums">{when(b.sentAt ?? b.sendAt)}</td>
                      <td className="min-w-48 border-b border-[var(--bot-line)] px-2.5 py-2">
                        {firstWords(b)}
                        {b.status === "failed" && b.error && <p className="mt-0.5 text-xs text-[var(--bot-red-ink)]">{b.error}</p>}
                      </td>
                      <td className="border-b border-[var(--bot-line)] px-2.5 py-2 tabular-nums">{b.recipients ?? "—"}</td>
                      <td className="whitespace-nowrap border-b border-[var(--bot-line)] px-2.5 py-2">
                        <Pill tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Pill>
                        {b.status === "scheduled" && (
                          <button type="button" className={`${quiet} ml-2`} disabled={pending} onClick={() => cancel(b.id)}>ยกเลิก</button>
                        )}
                      </td>
                      <td className="border-b border-[var(--bot-line)] px-2.5 py-2 tabular-nums">{b.seen ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <Said result={result} />
      </Card>
    </div>
  );
}

/* ── เมนูด้านล่าง ──────────────────────────────────────────────────────────────────────── */

function Menus({ view }: { view: LineView }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const rebuild = () => start(async () => {
    setResult(await rebuildMenusAction());
    setConfirming(false);
  });
  return (
    <Card title="เมนูใต้แชท" hint="ปุ่มแต่ละปุ่มพิมพ์คำให้ลูกค้า บอทอ่านแล้วตอบต่อ · แก้ข้อความบนปุ่มได้ในโค้ดเท่านั้น">
      <div className="grid gap-3 sm:grid-cols-2">
        {view.menus.map((m) => (
          <div key={m.name} className="rounded-lg border border-[var(--bot-line)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <b className="text-sm">{m.name === "start" ? "เมนูเริ่มต้น" : "หลังได้ราคา Life Protect"}</b>
              {m.name === "start" ? <Pill tone="ok">ทุกคนเห็น</Pill> : <Pill tone="warn">เฉพาะคนที่ได้ราคา</Pill>}
            </div>
            <div className="grid gap-0.5 rounded bg-[var(--bot-navy)] p-0.5" style={{ gridTemplateColumns: `repeat(${m.columns}, minmax(0, 1fr))` }}>
              {m.buttons.map((b) => (
                <div key={b.title} className="bg-[var(--bot-navy-lift)] px-2 py-3 text-center text-xs text-white">
                  {b.title}<span className="block text-[10px] opacity-75">{b.sub}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--bot-ink-mute)]">ป้ายแถบ: {m.bar} · {m.alias}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        {!confirming ? (
          <button type="button" className={quiet} onClick={() => { setResult(null); setConfirming(true); }}>สร้างเมนูใหม่จากโค้ดล่าสุด</button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>สร้างใหม่ทั้ง 2 เมนู และลบชุดเก่า?</span>
            <button type="button" className={quiet} disabled={pending} onClick={rebuild}>{pending ? "กำลังสร้าง…" : "ยืนยัน"}</button>
            <button type="button" className={quiet} disabled={pending} onClick={() => setConfirming(false)}>ยกเลิก</button>
          </div>
        )}
        <p className="mt-1 text-xs text-[var(--bot-ink-mute)]">ไม่ใช้โควตาข้อความ</p>
      </div>
      <Said result={result} />
    </Card>
  );
}
