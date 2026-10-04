"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AD_TAB_KEYS, type AdTabKey } from "@/lib/ads/campaign-view";
import { writeCount } from "@/lib/ads/ad-card";
import type { PersonOption } from "../PersonPicker";
import { generateRound } from "../draw";
import { AdCard } from "./AdCard";
import { AdEditor, type Room } from "./AdEditor";
import { CampaignSettings } from "./CampaignSettings";
import type { AdRules } from "./rules";
import { TONES } from "./styles";

/**
 * A campaign's room (/studio/ads/[id]): its settings on the left, its ads on the right under
 * five tabs — ทั้งหมด, ร่าง, อนุมัติแล้ว, ส่งแล้ว, ถังขยะ — and the editor full screen over both when an ad is
 * pressed. A round of writing takes 20–40 seconds and shows its seconds as it goes; one press
 * at a time. Arriving from a new campaign (?write=1), the first round starts by itself, once.
 */

const TAB_LABEL: Record<AdTabKey, string> = { all: "ทั้งหมด", draft: "ร่าง", approved: "อนุมัติแล้ว", sent: "ส่งแล้ว", trash: "ถังขยะ" };
const TAB_EMPTY: Record<AdTabKey, string> = {
  all: "ยังไม่มีแอด — กด “เขียนแอดเพิ่ม” ที่แผงตั้งค่า",
  draft: "ยังไม่มีแอดร่าง — กด “เขียนแอดเพิ่ม” ที่แผงตั้งค่า",
  approved: "ยังไม่มีแอดที่อนุมัติ",
  sent: "ยังไม่มีแอดที่ส่งไป Facebook",
  trash: "ถังขยะว่าง",
};

type RoundNote = { tone: keyof typeof TONES; text: string } | null;

/** ?write=1 came in once; a reload should not write another round */
function dropWriteParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("write")) return;
    url.searchParams.delete("write");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* the address keeps it; the guard below still writes only once */ }
}

export function CampaignRoom({ room, productName, rules, people, autoWrite }: {
  room: Room;
  productName: string;
  rules: AdRules;
  people: PersonOption[];
  /** arrived from สร้างแคมเปญ: write the first round now */
  autoWrite: boolean;
}) {
  const router = useRouter();
  const { campaign, pieces, counts } = room;
  const [tab, setTab] = useState<AdTabKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [making, setMaking] = useState(0);
  const [roundNote, setRoundNote] = useState<RoundNote>(null);
  // the press is held here as well as in state: two quick presses land before a re-render
  const running = useRef(false);

  const [writingFor, setWritingFor] = useState(0);
  useEffect(() => {
    if (making === 0) { setWritingFor(0); return; }
    const start = Date.now();
    const tick = window.setInterval(() => setWritingFor(Math.round((Date.now() - start) / 1000)), 1000);
    // leaving mid-round: the ads are still written and saved, but the browser asks first
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("beforeunload", stay);
    };
  }, [making]);

  async function write(count: number) {
    if (running.current) return;
    running.current = true;
    setMaking(count);
    setRoundNote(null);
    try {
      let res;
      try {
        // the campaign's plan, Page, angles, tones, colour and hint stand in for everything else
        res = await generateRound({ format: "ad", campaignId: campaign.id, count: 1, href: "", angle: "", custom: "", length: null, hookTemplateId: null });
      } catch {
        // the server carries on and saves the ads whatever happened to the connection
        setRoundNote({ tone: "warn", text: "การเชื่อมต่อหลุดระหว่างรอ แอดอาจเขียนเสร็จแล้ว ดูในแท็บ “ร่าง” ก่อนกดเขียนใหม่นะครับ" });
        setTab("draft");
        router.refresh();
        return;
      }
      if (res.ok) {
        setRoundNote(res.missing > 0
          ? { tone: "warn", text: `ได้ ${res.items.length} จาก ${count} แบบ — อีก ${res.missing} แบบเขียนไม่สำเร็จ กดเขียนเพิ่มได้` }
          : { tone: "ok", text: `เขียนเสร็จ ${res.items.length} แบบ อยู่ในแท็บ “ร่าง”` });
      } else {
        setRoundNote({ tone: "bad", text: res.saved ? `${res.error} — บันทึกไว้แล้ว ${res.saved} แบบ` : res.error });
      }
      setTab("draft");
      router.refresh();
    } finally {
      running.current = false;
      setMaking(0);
    }
  }

  // a new campaign's first round, once, however the effect is run
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoWrite || autoStarted.current) return;
    autoStarted.current = true;
    dropWriteParam();
    void write(writeCount(campaign.angles, campaign.tones));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const shown = pieces.filter((p) => (tab === "all" ? p.tab !== "trash" : p.tab === tab));
  const open = openId ? pieces.find((p) => p.id === openId) ?? null : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="min-w-0 space-y-1">
        <Link href={`/studio/ads?page=${encodeURIComponent(campaign.pageId)}`} className="inline-flex min-h-11 items-center text-sm text-[var(--ct-mute)] hover:underline">
          ← แคมเปญทั้งหมด
        </Link>
        <h1 className="break-words text-xl font-semibold">{campaign.title}</h1>
        <p className="text-sm text-[var(--ct-mute)]">Ads Studio · เพจ {campaign.pageName ?? campaign.pageId}</p>
        {!campaign.pageConnected && (
          <p role="alert" className={`mt-2 rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
            เพจนี้ไม่ได้เชื่อมกับระบบแล้ว — ยังแก้แอดได้ แต่ยิงแอดไม่ได้จนกว่าจะเชื่อมเพจอีกครั้ง
          </p>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <CampaignSettings campaign={campaign} productName={productName} rules={rules} writing={making > 0} onWrite={write} />

        <section aria-label="แอดในแคมเปญ" className="min-w-0 space-y-4">
          <div role="tablist" aria-label="สถานะแอด" className="flex gap-1 overflow-x-auto border-b border-[var(--ct-hair)]">
            {AD_TAB_KEYS.map((t) => (
              <button
                key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm ${tab === t ? "border-[var(--ct-solid)] font-semibold" : "border-transparent text-[var(--ct-mute)] hover:text-inherit"}`}
              >
                {TAB_LABEL[t]}
                <span className="rounded-full bg-[var(--ct-ground)] px-2 text-xs tabular-nums">{counts[t]}</span>
              </button>
            ))}
          </div>

          {making > 0 && (
            <div role="status" className="space-y-2">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-[var(--ct-accent)]">
                <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                กำลังเขียนแอด {making} แบบ…
                <span className="font-normal tabular-nums text-[var(--ct-mute)]">
                  {writingFor} วินาที{writingFor > 60 ? " — นานกว่าปกติ แต่ยังทำงานอยู่" : " (ปกติ 20–40 วินาที)"}
                </span>
              </p>
              {/* time, not a stage: a bar that fills to 40 seconds and waits near the end */}
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[var(--ct-hair)]">
                <div className="h-full rounded-full bg-[var(--ct-accent)] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(92, (writingFor / 40) * 100)}%` }} />
              </div>
            </div>
          )}
          {roundNote && (
            <p role={roundNote.tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${TONES[roundNote.tone]}`}>{roundNote.text}</p>
          )}

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">{TAB_EMPTY[tab]}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => (
                <li key={p.id}>
                  <AdCard piece={p} productName={productName} fold={rules.limits.fold} onOpen={() => setOpenId(p.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {open && <AdEditor key={open.id} piece={open} room={room} rules={rules} people={people} productName={productName} onClose={() => setOpenId(null)} />}
    </div>
  );
}
