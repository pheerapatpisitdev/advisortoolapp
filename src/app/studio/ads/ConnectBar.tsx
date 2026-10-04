"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorNote, Note, type NoteState } from "../ui/editor-fields";
import { chooseAdManageAccounts, type Connection } from "./actions";
import { solid, TONES } from "./styles";

/**
 * The ad accounts connected for making ads, as a strip at the top of the campaign list: which
 * account (LuckyPlanner · THB), the button to connect again, and what a Facebook login that
 * just came back here (?fb=, ?warn=, ?detail=) has to say. A login that reached more than one
 * ad account leaves a choice waiting; it is made here.
 */

/** what each outcome of the Facebook login says; the callback redirects here with ?fb=<one of these> */
const OUTCOMES: Record<string, { tone: keyof typeof TONES; text: string }> = {
  connected: { tone: "ok", text: "เชื่อมบัญชีโฆษณาสำหรับสร้างแอดแล้ว" },
  choose: { tone: "warn", text: "เข้าสู่ระบบ Facebook แล้ว เหลือเลือกบัญชีโฆษณา" },
  cancelled: { tone: "warn", text: "ยกเลิกจากหน้า Facebook ยังไม่ได้เชื่อมต่ออะไร" },
  state: { tone: "bad", text: "ลิงก์เชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อใหม่อีกครั้ง" },
  noscope: { tone: "bad", text: "Facebook ไม่ได้ให้สิทธิ์ ads_management — ตรวจ Login Configuration ของการสร้างแอดบน Meta dashboard ว่าติ๊กสิทธิ์นี้ไว้" },
  noaccounts: { tone: "bad", text: "บัญชี Facebook นี้ไม่มีสิทธิ์จัดการบัญชีโฆษณาไหนเลย" },
  unconfigured: { tone: "bad", text: "ยังไม่ได้ตั้งค่าการเชื่อมบัญชีโฆษณาสำหรับสร้างแอด — ต้องมี FB_APP_ID, FB_APP_SECRET และ FB_ADS_MANAGE_CONFIG_ID" },
  failed: { tone: "bad", text: "เชื่อมต่อไม่สำเร็จ" },
};

const EXPIRY_WARN_MS = 7 * 86_400_000;
const dayOnly = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });

/** One account on the strip: its name and currency, and a word only when something needs doing. */
function Account({ a, now }: { a: Connection["accounts"][number]; now: number }) {
  const soon = a.expiresAt !== null && new Date(a.expiresAt).getTime() - now < EXPIRY_WARN_MS;
  return (
    <li className="min-w-0">
      <span className="font-medium">{a.name}</span>
      <span className="text-[var(--ct-mute)]">{a.currency ? ` · ${a.currency}` : ""}</span>
      {a.tokenValid === false ? (
        <span className="block text-xs text-[var(--ct-alert)]">สิทธิ์เชื่อมต่อใช้ไม่ได้แล้ว — กดเชื่อมใหม่แล้วเลือกบัญชีนี้อีกครั้ง</span>
      ) : soon && a.expiresAt ? (
        <span className="block text-xs font-medium text-[var(--ct-warn-ink)]">สิทธิ์หมดอายุ {dayOnly(a.expiresAt)} — กดเชื่อมใหม่ก่อนวันนั้น</span>
      ) : a.expiresAt ? (
        <span className="block text-xs text-[var(--ct-mute)]">สิทธิ์หมดอายุ {dayOnly(a.expiresAt)}</span>
      ) : null}
      {a.currency !== null && a.currency !== "THB" && (
        <span className="block text-xs text-[var(--ct-warn-ink)]">รองรับเฉพาะบัญชีสกุลบาท (THB) บัญชีนี้ยิงแอดไม่ได้</span>
      )}
    </li>
  );
}

/**
 * A finished login's ad accounts, any number of them picked at once (owner, 2026-10-04). Nothing
 * is ticked to begin with: the login may reach twenty accounts, and only the ones ticked are kept.
 */
function Choices({ choices, connected }: { choices: Connection["choices"]; connected: Set<string> }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<NoteState>(null);

  const toggle = (id: string) => setChosen((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  async function choose() {
    setBusy(true);
    setNote(null);
    try {
      const res = await chooseAdManageAccounts([...chosen]);
      if (res.ok) router.refresh();
      else setNote(errorNote(res.error));
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-[var(--ct-hair)] pt-3">
      <p className="text-sm">เข้าสู่ระบบแล้ว ติ๊กบัญชีโฆษณาที่จะใช้สร้างแอด เลือกได้หลายบัญชี</p>
      <ul className="divide-y divide-[var(--ct-hair)] rounded-lg border border-[var(--ct-hair)]">
        {choices.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} disabled={busy} className="size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {c.name}
                  {connected.has(c.id) && <span className="ml-2 text-xs font-normal text-[var(--ct-mute)]">เชื่อมแล้ว</span>}
                </span>
                <span className="block break-all text-xs text-[var(--ct-mute)]">{c.id}{c.currency ? ` · ${c.currency}` : ""}</span>
                {c.currency !== null && c.currency !== "THB" && (
                  <span className="block text-xs text-[var(--ct-warn-ink)]">ยิงแอดไม่ได้ (ไม่ใช่สกุลบาท)</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" disabled={busy || chosen.size === 0} onClick={choose} className={solid}>
        {busy ? "กำลังเชื่อมต่อ…" : chosen.size > 0 ? `เชื่อม ${chosen.size} บัญชี` : "เลือกบัญชีก่อน"}
      </button>
      <Note note={note} />
    </div>
  );
}

export function ConnectBar({ connection, outcome, warn, detail }: {
  connection: Connection;
  /** the ?fb= the Facebook login came back with */
  outcome: string | null;
  /** the ?warn= the login came back with; "pages" means the Page inbox permission may have been dropped */
  warn: string | null;
  /** Facebook's own words for a failed login, from ?detail= */
  detail: string | null;
}) {
  const [now] = useState(() => Date.now());
  const shown = outcome ? OUTCOMES[outcome] : undefined;
  const { accounts, choices, configured, missing } = connection;

  return (
    <div className="space-y-3">
      {warn === "pages" && (
        <p role="alert" className={`rounded-lg border px-3 py-3 text-sm font-medium ${TONES.bad}`}>
          สิทธิ์อินบ็อกซ์ของเพจ (pages_messaging) อาจหลุดไปตอนเชื่อมบัญชีโฆษณานี้ — บอทอาจตอบข้อความไม่ได้แล้ว
          ไปเชื่อมเพจใหม่ที่ <a href="/admin/messenger" className="underline">/admin/messenger</a> ตอนนี้เลย
        </p>
      )}
      {shown && <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${TONES[shown.tone]}`}>{shown.text}</p>}
      {outcome && detail && (
        <p className="break-all text-xs text-[var(--ct-mute)]">ข้อความจาก Facebook (ส่งให้คนดูแลระบบได้เลย): {detail}</p>
      )}

      <section aria-label="บัญชีโฆษณา" className="space-y-3 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <span className="mr-2 text-xs text-[var(--ct-mute)]">บัญชีโฆษณา</span>
            {accounts.length > 0 ? (
              <ul className="inline-flex flex-wrap gap-x-4 gap-y-1 align-top">
                {accounts.map((a) => <Account key={a.id} a={a} now={now} />)}
              </ul>
            ) : (
              <span className="text-[var(--ct-mute)]">ยังไม่ได้เชื่อม — กดเชื่อมแล้วเข้าสู่ระบบ Facebook ด้วยบัญชีที่ดูแลบัญชีโฆษณา</span>
            )}
          </div>
          {configured ? (
            <a href="/api/facebook/connect?for=ads-manage" className={`${accounts.length ? "min-h-11 rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm hover:bg-[var(--ct-soft)]" : solid} inline-flex shrink-0 items-center no-underline`}>
              {accounts.length ? "เชื่อมใหม่ / เพิ่มบัญชี" : "เชื่อมบัญชีโฆษณา"}
            </a>
          ) : (
            <span aria-disabled="true" className={`${solid} inline-flex shrink-0 items-center opacity-50`}>เชื่อมบัญชีโฆษณา</span>
          )}
        </div>
        {!configured && (
          <p className="text-xs text-[var(--ct-mute)]">
            ยังเชื่อมไม่ได้ — เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่า{" "}
            {missing.map((name, i) => (
              <span key={name}>{i > 0 ? ", " : ""}<code className="break-all">{name}</code></span>
            ))}{" "}
            (บน Vercel หรือ .env.local แล้วรีสตาร์ท ขั้นตอนอยู่ใน docs/ads-manage-permission.md)
          </p>
        )}
        {choices.length > 0 && <Choices choices={choices} connected={new Set(accounts.map((a) => a.id))} />}
      </section>
    </div>
  );
}
