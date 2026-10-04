"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LaunchRow } from "@/lib/ads/launch-store";
import { ask } from "../ask";
import { AutoTextarea, errorNote, Note, okNote, type NoteState } from "../ui/editor-fields";
import { budgetBaht, formReady, overCap } from "./form-ready";
import { activateAd, chooseAdManageAccount, launchAd, type AdsLaunchSetup, type LaunchView } from "./actions";

/**
 * Puts one ad piece on Facebook as a paused ad, and switches it on in a second press.
 *
 * Saving never spends: every step is made PAUSED. The button that can spend is a separate one
 * that asks first, and shows the account, the Page and the daily budget it is about to spend
 * — read from the launch itself, because that is what is on Facebook, not what the form says now.
 */

const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)] disabled:opacity-50";
const button = "min-h-11 rounded-lg px-4 py-2 text-sm disabled:opacity-50";
const solid = `${button} bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]`;
const plain = `${button} border border-[var(--ct-line)] hover:bg-[var(--ct-soft)]`;
const card = "rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:p-5";

/** what each outcome of the Facebook login says; the callback redirects here with ?fb=<one of these> */
const OUTCOMES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "เชื่อมบัญชีโฆษณาสำหรับสร้างแอดแล้ว" },
  choose: { tone: "warn", text: "เข้าสู่ระบบ Facebook แล้ว เหลือเลือกบัญชีโฆษณา" },
  cancelled: { tone: "warn", text: "ยกเลิกจากหน้า Facebook ยังไม่ได้เชื่อมต่ออะไร" },
  state: { tone: "bad", text: "ลิงก์เชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อใหม่อีกครั้ง" },
  noscope: { tone: "bad", text: "Facebook ไม่ได้ให้สิทธิ์ ads_management — ตรวจ Login Configuration ของการสร้างแอดบน Meta dashboard ว่าติ๊กสิทธิ์นี้ไว้" },
  noaccounts: { tone: "bad", text: "บัญชี Facebook นี้ไม่มีสิทธิ์จัดการบัญชีโฆษณาไหนเลย" },
  unconfigured: { tone: "bad", text: "ยังไม่ได้ตั้งค่าการเชื่อมบัญชีโฆษณาสำหรับสร้างแอด — ต้องมี FB_APP_ID, FB_APP_SECRET และ FB_ADS_MANAGE_CONFIG_ID" },
  failed: { tone: "bad", text: "เชื่อมต่อไม่สำเร็จ" },
};

const TONES = {
  ok: "border-[var(--ct-hair)] bg-[var(--ct-soft)]",
  warn: "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]",
  bad: "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]",
};

/** the four things a launch makes on Meta, in order; the key is the launch row's `step` once it is done */
const STEPS = [
  { key: "campaign", label: "แคมเปญ" },
  { key: "adset", label: "ชุดโฆษณา (งบและกลุ่มเป้าหมาย)" },
  { key: "creative", label: "ครีเอทีฟ (รูปและข้อความ)" },
  { key: "ad", label: "โฆษณา" },
] as const;
const STEP_NAME: Record<string, string> = { campaign: "แคมเปญ", adset: "ชุดโฆษณา", creative: "ครีเอทีฟ", ad: "โฆษณา" };

/** Meta's effective_status in the words the owner reads; anything not listed is shown as Meta says it */
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "กำลังวิ่ง",
  PAUSED: "หยุดไว้",
  CAMPAIGN_PAUSED: "หยุดไว้ (ที่แคมเปญ)",
  ADSET_PAUSED: "หยุดไว้ (ที่ชุดโฆษณา)",
  PENDING_REVIEW: "รอ Meta ตรวจ",
  IN_PROCESS: "Meta กำลังประมวลผล",
  DISAPPROVED: "Meta ไม่อนุมัติ",
  WITH_ISSUES: "มีปัญหา",
  ARCHIVED: "เก็บถาวร",
  DELETED: "ถูกลบ",
};
const BAD_STATUS = new Set(["DISAPPROVED", "WITH_ISSUES"]);

const EXPIRY_WARN_MS = 7 * 86_400_000;
const dayOnly = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** Thai counts by code point, as Facebook's fold is measured (the vowels and tone marks each count) */
const count = (s: string) => [...s].length;

/** a launch row as the page draws it, for what a result hands back before the page is read again */
function toView(r: LaunchRow): LaunchView {
  return {
    id: r.id, actId: r.actId, pageId: r.pageId, step: r.step, adId: r.adId, error: r.error,
    activatedAt: r.activatedAt, effectiveStatus: null, dailyBudgetBaht: r.dailyBudgetMinor / 100,
  };
}

function Count({ text, limit, note }: { text: string; limit: number; note?: string }) {
  const n = count(text);
  const over = n > limit;
  return (
    <span className={`text-xs tabular-nums ${over ? "font-medium text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>
      {n}/{limit}{over && note ? ` — ${note}` : ""}
    </span>
  );
}

/** The four steps with a mark on each: made, the one that broke (with Meta's reason), or not yet. */
function Progress({ launch }: { launch: LaunchView }) {
  const done = launch.step === "none" ? -1 : STEPS.findIndex((s) => s.key === launch.step);
  return (
    <ol className="space-y-1.5 text-sm">
      {STEPS.map((s, i) => {
        const failed = launch.error !== null && i === done + 1;
        const made = i <= done;
        return (
          <li key={s.key} className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-0.5 w-4 shrink-0 text-center ${failed ? "text-[var(--ct-alert)]" : made ? "text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}`}>
              {failed ? "✕" : made ? "✓" : "·"}
            </span>
            <span className="min-w-0">
              <span className={made ? "" : "text-[var(--ct-mute)]"}>{s.label}</span>
              <span className="sr-only">{failed ? " ไม่สำเร็จ" : made ? " ทำแล้ว (หยุดไว้)" : " ยังไม่ได้ทำ"}</span>
              {failed && <span className="mt-0.5 block break-words text-[var(--ct-alert)]">ขั้น{STEP_NAME[s.key]}ไม่สำเร็จ — {launch.error}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Connect({ setup, outcome }: { setup: AdsLaunchSetup; outcome: string | null }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(setup.choices[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<NoteState>(null);
  const [now] = useState(() => Date.now());

  async function choose() {
    setBusy(true);
    setNote(null);
    try {
      const res = await chooseAdManageAccount(chosen);
      if (res.ok) router.refresh();
      else setNote(errorNote(res.error));
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง"));
    } finally {
      setBusy(false);
    }
  }

  const link = setup.configured ? (
    <a href="/api/facebook/connect?for=ads-manage" className={`${solid} inline-flex items-center no-underline`}>
      {setup.accounts.length ? "เชื่อมบัญชีเพิ่ม / เชื่อมใหม่" : "เชื่อมบัญชีโฆษณาสำหรับสร้างแอด"}
    </a>
  ) : (
    <div className="rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-3 text-sm">
      <span aria-disabled="true" className={`${solid} inline-flex items-center opacity-50`}>เชื่อมบัญชีโฆษณาสำหรับสร้างแอด</span>
      <p className="mt-2 text-[var(--ct-mute)]">
        ยังเชื่อมไม่ได้ — เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่า{" "}
        {setup.missing.map((name, i) => (
          <span key={name}>{i > 0 ? ", " : ""}<code>{name}</code></span>
        ))}{" "}
        (บน Vercel หรือ .env.local แล้วรีสตาร์ท ขั้นตอนอยู่ใน docs/ads-manage-permission.md)
      </p>
    </div>
  );

  const shown = outcome ? OUTCOMES[outcome] : undefined;
  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="text-sm font-medium">บัญชีโฆษณา</h2>
        <p className="mt-0.5 text-xs text-[var(--ct-mute)]">การเชื่อมนี้ให้สิทธิ์สร้างและเปิดแอดได้ ต่างจากหน้าโฆษณาในหลังบ้านที่อ่านตัวเลขอย่างเดียว</p>
      </div>

      {shown && <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${TONES[shown.tone]}`}>{shown.text}</p>}

      {setup.choices.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm">เข้าสู่ระบบแล้ว เลือกบัญชีโฆษณาที่จะใช้สร้างแอด</p>
          <ul className="divide-y divide-[var(--ct-hair)] rounded-lg border border-[var(--ct-hair)]">
            {setup.choices.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input type="radio" name="ads-manage-choice" checked={chosen === c.id} onChange={() => setChosen(c.id)} disabled={busy} className="size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block break-all text-xs text-[var(--ct-mute)]">{c.id}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || !chosen} onClick={choose} className={solid}>{busy ? "กำลังเชื่อมต่อ…" : "ใช้บัญชีนี้"}</button>
          <Note note={note} />
        </div>
      )}

      {setup.accounts.length === 0 && setup.choices.length === 0 && (
        <p className="text-sm text-[var(--ct-mute)]">ยังไม่ได้เชื่อมบัญชีโฆษณา กดปุ่มข้างล่าง แล้วเข้าสู่ระบบ Facebook ด้วยบัญชีที่ดูแลบัญชีโฆษณา</p>
      )}

      {setup.accounts.length > 0 && (
        <ul className="space-y-2">
          {setup.accounts.map((a) => {
            const soon = a.expiresAt !== null && new Date(a.expiresAt).getTime() - now < EXPIRY_WARN_MS;
            return (
              <li key={a.id} className="rounded-lg border border-[var(--ct-hair)] p-3 text-sm">
                <p className="font-medium">{a.name} <span className="break-all font-normal text-[var(--ct-mute)]">{a.id}{a.currency ? ` · ${a.currency}` : ""}</span></p>
                {a.tokenValid === false ? (
                  <p className="mt-1 text-xs text-[var(--ct-alert)]">สิทธิ์เชื่อมต่อใช้ไม่ได้แล้ว — กดเชื่อมใหม่แล้วเลือกบัญชีนี้อีกครั้ง</p>
                ) : a.expiresAt ? (
                  <p className={`mt-1 text-xs ${soon ? "font-medium text-[var(--ct-warn-ink)]" : "text-[var(--ct-mute)]"}`}>
                    สิทธิ์เชื่อมต่อหมดอายุ {dayOnly(a.expiresAt)}{soon && " — ใกล้หมดแล้ว กดเชื่อมใหม่ก่อนวันนั้น"}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--ct-mute)]">ตรวจวันหมดอายุของสิทธิ์เชื่อมต่อไม่ได้ในตอนนี้</p>
                )}
                {a.currency !== null && a.currency !== "THB" && (
                  <p className="mt-1 text-xs text-[var(--ct-warn-ink)]">รอบแรกรองรับเฉพาะบัญชีสกุลบาท (THB) บัญชีนี้ยิงแอดไม่ได้</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div>{link}</div>
    </section>
  );
}

export function AdsLaunch({ setup, outcome, warn = null, detail, limits }: {
  setup: AdsLaunchSetup;
  /** the ?fb= the Facebook login came back with */
  outcome: string | null;
  /** the ?warn= the login came back with; "pages" means the Page inbox permission may have been dropped */
  warn?: string | null;
  /** Facebook's own words for a failed login, from ?detail= */
  detail: string | null;
  /** AD_LIMITS, handed down so this file does not carry the writer's prompts into the browser */
  limits: { fold: number; headline: number; description: number };
}) {
  const router = useRouter();
  const first = setup.pieces[0];
  const [pieceId, setPieceId] = useState(first?.id ?? "");
  const [headline, setHeadline] = useState(first?.headline ?? "");
  const [primaryText, setPrimaryText] = useState(first?.primaryText ?? "");
  const [description, setDescription] = useState(first?.description ?? "");
  const [actId, setActId] = useState((setup.accounts.find((a) => a.currency === "THB") ?? setup.accounts[0])?.id ?? "");
  const [pageId, setPageId] = useState(setup.pages[0]?.pageId ?? "");
  const [link, setLink] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState<"save" | "activate" | null>(null);
  const [note, setNote] = useState<NoteState>(null);
  // launches the page has heard of since it was read, by piece and account; null is "none"
  const [fresh, setFresh] = useState<Record<string, LaunchView>>({});
  useEffect(() => { setFresh({}); }, [setup]);

  const piece = setup.pieces.find((p) => p.id === pieceId);
  const account = setup.accounts.find((a) => a.id === actId);
  const key = `${pieceId}|${actId}`;
  const launch: LaunchView | null = fresh[key] ?? piece?.launches.find((l) => l.actId === actId) ?? null;
  const pageName = (id: string) => setup.pages.find((p) => p.pageId === id)?.pageName ?? id;
  const nonBaht = account !== undefined && account.currency !== "THB";
  const baht = budgetBaht(budget);
  const tooMuch = overCap(budget, setup.maxDailyBudgetThb);
  const ready = formReady({ hasPoster: piece?.hasPoster === true, nonBaht, link, budget, pageId, actId, maxDailyBudgetThb: setup.maxDailyBudgetThb });

  function pick(id: string) {
    const p = setup.pieces.find((x) => x.id === id);
    setPieceId(id);
    setHeadline(p?.headline ?? "");
    setPrimaryText(p?.primaryText ?? "");
    setDescription(p?.description ?? "");
    setNote(null);
  }

  async function save(recreate: boolean) {
    setBusy("save");
    setNote(null);
    try {
      const res = await launchAd({ pieceId, actId, pageId, link, dailyBudgetBaht: baht, headline, primaryText, description, recreate });
      if (res.launch) setFresh((f) => ({ ...f, [key]: toView(res.launch!) }));
      if (res.ok) setNote(okNote("บันทึกเป็นแอดหยุดไว้แล้ว ยังไม่เสียเงิน ตรวจใน Ads Manager แล้วกดเปิดใช้ข้างล่างเมื่อพร้อม"));
      // a step that broke is told under that step; anything else has no row to hang it on
      else if (!res.launch || res.step === "check") setNote(errorNote(res.error));
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่รู้ว่าสร้างไปถึงไหน — เปิดหน้านี้ใหม่เพื่อดูสถานะก่อนกดซ้ำ"));
    } finally {
      setBusy(null);
    }
  }

  async function recreate() {
    const ok = await ask(
      "สร้างแอดชุดใหม่แทนชุดเดิม?\n\nระบบจะหยุดแคมเปญเดิมบน Facebook ก่อน (ไม่ว่าจะเปิดใช้อยู่หรือไม่) และชุดเดิมจะไม่ถูกใช้ต่อ (ยังเห็นอยู่ใน Ads Manager)\nชุดใหม่ใช้ค่าตามฟอร์มตอนนี้ และเริ่มจากสถานะหยุดไว้",
      "สร้างใหม่",
    );
    if (ok) await save(true);
  }

  async function activate() {
    if (!launch) return;
    const acct = setup.accounts.find((a) => a.id === launch.actId);
    const ok = await ask(
      [
        "เปิดใช้แอดนี้?",
        "",
        `บัญชีโฆษณา: ${acct ? `${acct.name} (${acct.id})` : launch.actId}`,
        `เพจ: ${pageName(launch.pageId)}`,
        `งบ: ฿${launch.dailyBudgetBaht.toLocaleString("en-US")} ต่อวัน`,
        "",
        "กดแล้ว Facebook จะเริ่มใช้เงินจากบัญชีโฆษณานี้ทันที (หลังผ่านการตรวจของ Meta)",
      ].join("\n"),
      "เปิดใช้เลย",
    );
    if (!ok) return;
    setBusy("activate");
    setNote(null);
    try {
      const res = await activateAd(launch.id);
      if (res.ok) {
        setFresh((f) => ({ ...f, [key]: { ...launch, activatedAt: new Date().toISOString(), effectiveStatus: null } }));
        setNote(okNote("เปิดใช้แล้ว"));
      } else {
        // not kept on the launch, so this is the only place the reason is seen
        setNote(errorNote(res.error));
      }
      router.refresh();
    } catch {
      setNote(errorNote("การเชื่อมต่อหลุด ยังไม่รู้ว่าเปิดใช้ได้หรือไม่ — เปิดหน้านี้ใหม่เพื่อดูสถานะ"));
    } finally {
      setBusy(null);
    }
  }

  const resume = launch !== null && launch.step !== "ad";
  const statusText = launch?.effectiveStatus ? `${STATUS_LABEL[launch.effectiveStatus] ?? launch.effectiveStatus} (${launch.effectiveStatus})` : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {warn === "pages" && (
        <p role="alert" className={`rounded-lg border px-3 py-3 text-sm font-medium ${TONES.bad}`}>
          สิทธิ์อินบ็อกซ์ของเพจ (pages_messaging) อาจหลุดไปตอนเชื่อมบัญชีโฆษณานี้ — บอทอาจตอบข้อความไม่ได้แล้ว
          ไปเชื่อมเพจใหม่ที่ <a href="/admin/messenger" className="underline">/admin/messenger</a> ตอนนี้เลย
        </p>
      )}
      <Connect setup={setup} outcome={outcome} />
      {outcome && detail && (
        <p className="-mt-3 break-all text-xs text-[var(--ct-mute)]">ข้อความจาก Facebook (ส่งให้คนดูแลระบบได้เลย): {detail}</p>
      )}

      {setup.accounts.length > 0 && (
        <section className={`${card} space-y-4`}>
          <div>
            <h2 className="text-sm font-medium">ยิงแอดจากชิ้นโฆษณา</h2>
            <p className="mt-0.5 text-xs text-[var(--ct-mute)]">รูปโปสเตอร์ 1:1 ปุ่ม “ดูเพิ่มเติม” ไปที่ลิงก์ที่ใส่ แสดงในประเทศไทย บันทึกแล้วแอดยังหยุดไว้ ไม่เสียเงิน</p>
          </div>

          {setup.pieces.length === 0 ? (
            <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีชิ้นโฆษณา — เขียนโฆษณาที่ <a href="/studio/write" className="font-medium text-[var(--ct-accent)] underline">Organic Studio</a> ก่อน</p>
          ) : setup.pages.length === 0 ? (
            <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีเพจที่เชื่อมกับระบบ — เชื่อมเพจที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a> ก่อน</p>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">ชิ้นโฆษณา</span>
                <select value={pieceId} onChange={(e) => pick(e.target.value)} disabled={busy !== null} className={field}>
                  {setup.pieces.map((p) => (
                    <option key={p.id} value={p.id}>{p.headline || "(ไม่มีหัวข้อ)"}{p.hasPoster ? "" : " — ไม่มีโปสเตอร์"}</option>
                  ))}
                </select>
              </label>
              {piece && !piece.hasPoster && (
                <p className="text-sm text-[var(--ct-warn-ink)]">ชิ้นนี้ยังไม่มีโปสเตอร์ สร้างโปสเตอร์ใน Studio ก่อนจึงจะยิงได้</p>
              )}

              <label className="block space-y-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-[var(--ct-mute)]"><span>หัวข้อ (ใต้รูป)</span><Count text={headline} limit={limits.headline} note="ยาวเกิน อาจถูกตัด" /></span>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} disabled={busy !== null} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-[var(--ct-mute)]"><span>ข้อความหลัก</span><Count text={primaryText} limit={limits.fold} note="ส่วนที่เกินจะถูกพับ ต้องกด “ดูเพิ่มเติม”" /></span>
                <AutoTextarea minRows={4} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} disabled={busy !== null} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-[var(--ct-mute)]"><span>คำอธิบายสั้น</span><Count text={description} limit={limits.description} note="ยาวเกิน อาจถูกตัด" /></span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy !== null} className={field} />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0 space-y-1">
                  <span className="text-xs text-[var(--ct-mute)]">บัญชีโฆษณา</span>
                  <select value={actId} onChange={(e) => { setActId(e.target.value); setNote(null); }} disabled={busy !== null} className={field}>
                    {setup.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.currency ? ` · ${a.currency}` : ""}</option>)}
                  </select>
                </label>
                <label className="block min-w-0 space-y-1">
                  <span className="text-xs text-[var(--ct-mute)]">เพจที่ขึ้นชื่อบนแอด</span>
                  <select value={pageId} onChange={(e) => setPageId(e.target.value)} disabled={busy !== null} className={field}>
                    {setup.pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
                  </select>
                </label>
              </div>
              {nonBaht && <p className="text-sm text-[var(--ct-warn-ink)]">รอบแรกรองรับเฉพาะบัญชีสกุลบาท (THB) เลือกบัญชีอื่น</p>}

              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">ลิงก์ปลายทางของปุ่ม</span>
                <input value={link} onChange={(e) => setLink(e.target.value)} disabled={busy !== null} inputMode="url" autoCapitalize="none" placeholder="https://…" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">งบต่อวัน (บาท) · สูงสุด {setup.maxDailyBudgetThb.toLocaleString("en-US")}</span>
                <input
                  value={budget} onChange={(e) => setBudget(e.target.value)} disabled={busy !== null}
                  type="number" inputMode="numeric" min={1} max={setup.maxDailyBudgetThb} step={1} className={field}
                />
                {tooMuch && (
                  <span role="alert" className="block text-xs font-medium text-[var(--ct-alert)]">
                    เกินเพดาน {setup.maxDailyBudgetThb.toLocaleString("en-US")} บาทต่อวัน — ลดงบก่อนจึงจะบันทึกได้
                  </span>
                )}
              </label>

              {launch === null && (
                <button type="button" disabled={busy !== null || !ready} onClick={() => save(false)} className={solid}>
                  {busy === "save" ? "กำลังสร้างบน Facebook… (ราว 10–30 วินาที)" : "บันทึกเป็นแอดหยุดไว้"}
                </button>
              )}
            </>
          )}
          {launch === null && <Note note={note} />}
        </section>
      )}

      {launch && piece && (
        <section className={`${card} space-y-3`} aria-live="polite">
          <h2 className="text-sm font-medium">แอดของชิ้นนี้ใน {account?.name ?? launch.actId}</h2>
          <Progress launch={launch} />
          {resume && (
            <p className="text-xs text-[var(--ct-mute)]">ลองใหม่จะทำต่อจากขั้นที่ค้าง ไม่สร้างซ้ำขั้นที่ทำแล้ว และใช้ค่าที่บันทึกไว้ตอนเริ่ม ({`฿${launch.dailyBudgetBaht.toLocaleString("en-US")}`} ต่อวัน)</p>
          )}
          {launch.step === "ad" && (
            <div className="space-y-1 text-sm">
              <p>เพจ {pageName(launch.pageId)} · งบ ฿{launch.dailyBudgetBaht.toLocaleString("en-US")} ต่อวัน</p>
              {launch.activatedAt ? (
                <p>เปิดใช้แล้ว {when(launch.activatedAt)}</p>
              ) : (
                <p className="text-[var(--ct-mute)]">หยุดไว้ — ยังไม่เสียเงิน</p>
              )}
              {statusText && (
                <p className={launch.effectiveStatus && BAD_STATUS.has(launch.effectiveStatus) ? "font-medium text-[var(--ct-alert)]" : ""}>
                  สถานะจาก Meta: {statusText}
                  {launch.effectiveStatus && BAD_STATUS.has(launch.effectiveStatus) && " — ดูเหตุผลใน Ads Manager"}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {resume && (
              <button type="button" disabled={busy !== null || !ready} onClick={() => save(false)} className={solid}>
                {busy === "save" ? "กำลังสร้าง…" : "ลองใหม่"}
              </button>
            )}
            {launch.step === "ad" && !launch.activatedAt && (
              <button type="button" disabled={busy !== null} onClick={activate} className={solid}>
                {busy === "activate" ? "กำลังเปิดใช้…" : "เปิดใช้"}
              </button>
            )}
            <button type="button" disabled={busy !== null || !ready} onClick={recreate} className={plain}>สร้างใหม่</button>
          </div>
          {!ready && <p className="text-xs text-[var(--ct-mute)]">ปุ่มลองใหม่และสร้างใหม่ใช้ค่าในฟอร์มข้างบน กรอกลิงก์และงบให้ครบก่อน</p>}
          <Note note={note} />
        </section>
      )}
    </div>
  );
}
