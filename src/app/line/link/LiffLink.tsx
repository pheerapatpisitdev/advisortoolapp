"use client";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { INPUT, MUTE } from "@/components/auth/styles";

/**
 * เชื่อมบัญชี inside LINE (owner chose ง, 2026-11-21, mockup https://claude.ai/artifact/52AkfnWSkmEs9AgQUVjatx):
 * a copy of UnitOS's LinkScreen. LINE signs the person in, they type their 6-digit agent code (a
 * member's one-time link needs nothing typed), and the page then takes them to add the account
 * as a friend — without that no alert reaches them.
 */

/** LINE's own LIFF script, the v2 line LINE keeps current */
const SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";
const AUTO_SEC = 2;
const GREEN = "w-full rounded-lg bg-[var(--line-oa-green)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

interface Liff {
  init(o: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(o?: { redirectUri?: string }): void;
  getIDToken(): string | null;
  getFriendship(): Promise<{ friendFlag: boolean }>;
  isInClient(): boolean;
  closeWindow(): void;
}
declare global {
  interface Window { liff?: Liff }
}

type Stage =
  | { at: "load" }
  | { at: "error"; text: string }
  | { at: "form"; already: boolean }
  | { at: "linking" }
  | { at: "done"; name: string };

async function call(body: Record<string, string>): Promise<{ ok: boolean; linked?: boolean; name?: string; error?: string }> {
  const res = await fetch("/api/line/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: false, error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" }));
}

/** a friend goes straight to the chat; anybody else, or when LINE cannot say, to add-friend */
async function goToOa(oa: string) {
  const id = encodeURIComponent(oa);
  let friend = false;
  try { friend = Boolean((await window.liff?.getFriendship())?.friendFlag); } catch { /* not known: add-friend */ }
  location.href = friend ? `https://line.me/R/oaMessage/${id}/` : `https://line.me/R/ti/p/${id}`;
}

export function LiffLink({ liffId, oa }: { liffId: string; oa: string }) {
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>({ at: "load" });
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const token = useRef("");

  const link = useCallback(async (body: Record<string, string>) => {
    setStage({ at: "linking" });
    setErr("");
    const r = await call({ idToken: token.current, ...body });
    if (r.ok) setStage({ at: "done", name: r.name ?? "" });
    else if (body.lt) setStage({ at: "error", text: r.error ?? "เชื่อมไม่สำเร็จ" });
    else {
      setErr(r.error ?? "เชื่อมไม่สำเร็จ");
      setStage({ at: "form", already: false });
    }
  }, []);

  useEffect(() => {
    if (!ready || !window.liff) return;
    const liff = window.liff;
    (async () => {
      try {
        await liff.init({ liffId });
        // opened in a browser rather than the LINE app: LINE's own sign-in first, then back here
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: location.href });
          return;
        }
        token.current = liff.getIDToken() ?? "";
        const lt = new URLSearchParams(location.search).get("lt");
        if (lt) {
          await link({ lt });
          return;
        }
        const me = await call({ idToken: token.current });
        if (!me.ok) setStage({ at: "error", text: me.error ?? "เข้าสู่ระบบ LINE ไม่สำเร็จ" });
        else setStage({ at: "form", already: Boolean(me.linked) });
      } catch (e) {
        console.error("liff init failed:", e);
        setStage({ at: "error", text: "เปิดหน้านี้ใน LINE ไม่สำเร็จ ปิดแล้วสแกนใหม่อีกครั้ง" });
      }
    })();
  }, [ready, liffId, link]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setErr("กรอกรหัสตัวแทนให้ครบ 6 หลัก");
      return;
    }
    void link({ code });
  };

  return (
    <>
      <Script src={SDK} strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setStage({ at: "error", text: "โหลดหน้าของ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" })} />
      <section className="space-y-4 rounded-2xl border border-[var(--bot-line)] bg-[var(--bot-surface)] p-5">
        <h1 className="text-lg font-semibold">{stage.at === "done" ? "เชื่อมสำเร็จ ✅" : "เชื่อมบัญชี · advisortool"}</h1>
        {stage.at === "load" || stage.at === "linking" ? (
          <p className={`text-sm ${MUTE}`}>{stage.at === "load" ? "กำลังเปิด…" : "กำลังเชื่อม…"}</p>
        ) : stage.at === "error" ? (
          <p className="text-sm text-[var(--bot-red-ink)]" role="alert">{stage.text}</p>
        ) : stage.at === "form" ? (
          <form className="space-y-4" onSubmit={submit}>
            <p className={`text-sm ${MUTE}`}>
              {stage.already
                ? "LINE นี้เชื่อมกับ advisortool อยู่แล้ว กรอกรหัสอีกครั้งถ้าต้องการเปลี่ยนเป็นบัญชีอื่น"
                : "ทำครั้งแรกครั้งเดียว แล้ว advisortool จะแจ้งเตือนเรื่องของคุณใน LINE นี้"}
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">รหัสตัวแทน 6 หลัก</span>
              <input
                id="agent-code" className={`${INPUT} text-center text-xl tracking-[0.4em]`} inputMode="numeric" autoComplete="off" maxLength={6}
                value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
              />
              <span className={`block text-xs ${MUTE}`}>รหัสเดียวกับที่ใช้เข้าเว็บ advisortool</span>
            </label>
            {err && <p className="text-sm text-[var(--bot-red-ink)]" role="alert">{err}</p>}
            <button type="submit" className={GREEN}>เชื่อมบัญชี</button>
          </form>
        ) : (
          <Done name={stage.name} oa={oa} />
        )}
      </section>
    </>
  );
}

/** linked: counts down, then takes them to add the account (or to its chat, when already a friend) */
function Done({ name, oa }: { name: string; oa: string }) {
  const [left, setLeft] = useState(AUTO_SEC);
  useEffect(() => {
    if (!left) return;
    const t = setTimeout(() => {
      if (left === 1) void goToOa(oa);
      setLeft(left - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [left, oa]);
  const who = name.trim() ? (name.trim().startsWith("คุณ") ? name.trim() : `คุณ${name.trim()}`) : "";
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {who && <><b>{who}</b><br /></>}
        จะแจ้งเตือนในแชท advisortool เมื่อคลิปทำเสร็จหรือไม่สำเร็จ เปิดปิดแต่ละเรื่องได้ที่หน้า ตั้งค่าส่วนตัว
      </p>
      <button type="button" className={GREEN} onClick={() => { setLeft(0); void goToOa(oa); }}>เพิ่มเพื่อน &amp; ไปที่แชท</button>
      {left > 0 && (
        <p className={`text-center text-xs ${MUTE}`}>
          กำลังพาไปใน {left} วินาที…{" "}
          <button type="button" className="underline" onClick={() => setLeft(0)}>อยู่หน้านี้ต่อ</button>
        </p>
      )}
    </div>
  );
}
