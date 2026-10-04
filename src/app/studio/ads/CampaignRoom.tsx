"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/lib/content/store";
import { AD_TAB_KEYS, type AdTabKey } from "@/lib/ads/campaign-view";
import { styleRequest } from "@/lib/ads/dimension-edit";
import { inBin, sendBlocker, settledPictures, type WriteCount } from "@/lib/ads/room-view";
import { sentRows } from "@/lib/ads/sent-view";
import type { PersonOption } from "../PersonPicker";
import { drawPicture, generateRound } from "../draw";
import { AdCard, type PictureState } from "./AdCard";
import { AdEditor, type Room } from "./AdEditor";
import { CampaignSettings } from "./CampaignSettings";
import { Columns } from "./Columns";
import { QueueBar } from "./QueueBar";
import type { AdRules } from "./rules";
import { SendDialog } from "./SendDialog";
import { SentRail } from "./SentRail";
import { SentTab } from "./SentTab";
import { solid, TONES } from "./styles";

/**
 * The campaign open in Ads Studio, in Organic Studio's three columns: in the tools, under the
 * Page and campaign pickers Ads Studio hands in, its settings and dimensions with the button that
 * writes the next 1, 2 or 4 ads from the queue; in the middle the ads under five tabs — ทั้งหมด,
 * ร่าง, อนุมัติแล้ว, ส่งแล้ว (the sends), ถังขยะ — with ส่งขึ้น Facebook (N) at the end of the row
 * and the queue strip under it; on the right the sent rail; the editor full screen over all
 * three when an ad is pressed.
 *
 * A round is one press at a time. When it is back, each new ad's picture is drawn, one after
 * another, from its picture style (the standard painter); its card says so meanwhile and offers
 * to draw again if it fails. A drawn picture stays "done" until the refreshed piece shows it, so
 * the card never offers a paid draw in between; a piece binned while waiting is not drawn. Arriving from the wizard (?write=<n>), the first round starts by
 * itself, once.
 */

const TAB_LABEL: Record<AdTabKey, string> = { all: "ทั้งหมด", draft: "ร่าง", approved: "อนุมัติแล้ว", sent: "ส่งแล้ว", trash: "ถังขยะ" };
const TAB_EMPTY: Record<AdTabKey, string> = {
  all: "ยังไม่มีแอด — กด “สร้าง” ที่แผงเครื่องมือ",
  draft: "ยังไม่มีแอดร่าง — กด “สร้าง” ที่แผงเครื่องมือ",
  approved: "ยังไม่มีแอดที่อนุมัติ — กด ✓ อนุมัติ บนการ์ด",
  sent: "",
  trash: "ถังขยะว่าง",
};

type RoundNote = { tone: keyof typeof TONES; text: string } | null;
type Job = { id: string; style: string };

/** ?write=<n> came in once; a reload should not write another round */
function dropWriteParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("write")) return;
    url.searchParams.delete("write");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* the address keeps it; the guard below still writes only once */ }
}

export function CampaignRoom({ room, pickers, productName, rules, people, autoWrite }: {
  room: Room;
  /** the Page and campaign pickers, at the top of the tools */
  pickers: ReactNode;
  productName: string;
  rules: AdRules;
  people: PersonOption[];
  /** arrived from the wizard: write this many now (0 for none) */
  autoWrite: WriteCount | 0;
}) {
  const router = useRouter();
  const { campaign, pieces, counts, queue, connection } = room;
  const [tab, setTab] = useState<AdTabKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [making, setMaking] = useState(0);
  const [roundNote, setRoundNote] = useState<RoundNote>(null);
  const [pictures, setPictures] = useState<Record<string, PictureState>>({});
  // the press is held here as well as in state: two quick presses land before a re-render
  const running = useRef(false);
  const jobs = useRef<Job[]>([]);
  const drawing = useRef(false);
  // the dimensions the pictures are drawn from: the newest, whatever was saved meanwhile
  const dims = useRef(campaign.dimensions);
  useEffect(() => { dims.current = campaign.dimensions; }, [campaign.dimensions]);
  // the pieces as last refreshed, for the drawing line: a piece binned meanwhile is skipped
  const latest = useRef(pieces);
  useEffect(() => { latest.current = pieces; }, [pieces]);
  // a drawn picture is "done" until the refreshed piece has its background; then it is forgotten
  useEffect(() => { setPictures((p) => settledPictures(p, pieces)); }, [pieces]);

  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (making === 0) { setSeconds(0); return; }
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [making]);

  // leaving mid-round or mid-drawing: what is done is saved, but the browser asks first
  const busy = making > 0 || Object.values(pictures).some((p) => p === "wait" || p === "drawing");
  useEffect(() => {
    if (!busy) return;
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [busy]);

  /** Draws the waiting pictures one at a time; a second call while drawing only adds to the line. */
  async function drain() {
    if (drawing.current) return;
    drawing.current = true;
    try {
      while (jobs.current.length > 0) {
        const job = jobs.current[0];
        if (inBin(latest.current, job.id)) {
          jobs.current.shift();
          setPictures((p) => {
            const next = { ...p };
            delete next[job.id];
            return next;
          });
          continue;
        }
        setPictures((p) => ({ ...p, [job.id]: "drawing" }));
        const res = await drawPicture(job.id, styleRequest(dims.current, job.style), "standard");
        jobs.current.shift();
        setPictures((p) => {
          const next = { ...p };
          // drawn: no draw button until the refreshed piece shows the picture (the effect above clears it)
          next[job.id] = res.ok ? "done" : { error: res.error };
          return next;
        });
        if (res.ok) router.refresh();
      }
    } finally {
      drawing.current = false;
    }
  }

  function draw(list: Job[]) {
    const fresh = list.filter((j) => !jobs.current.some((q) => q.id === j.id));
    if (fresh.length === 0) return;
    jobs.current.push(...fresh);
    setPictures((p) => ({ ...p, ...Object.fromEntries(fresh.map((j) => [j.id, "wait" as const])) }));
    void drain();
  }

  const jobsOf = (items: ContentItem[]): Job[] => items.flatMap((i) => (i.output.ad?.style ? [{ id: i.id, style: i.output.ad.style }] : []));

  async function write(count: WriteCount) {
    if (running.current) return;
    running.current = true;
    setMaking(count);
    setRoundNote(null);
    let made: ContentItem[] = [];
    try {
      let res;
      try {
        // only the campaign and the count are read: its plan, Page, dimensions, focus and voice stand in for the rest
        res = await generateRound({ format: "ad", campaignId: campaign.id, count, href: "", angle: "", custom: "", length: null, hookTemplateId: null });
      } catch {
        // the server carries on and saves the ads whatever happened to the connection
        setRoundNote({ tone: "warn", text: "การเชื่อมต่อหลุดระหว่างรอ แอดอาจสร้างเสร็จแล้ว ดูในแท็บ “ร่าง” ก่อนกดสร้างใหม่ — ชิ้นที่ยังไม่มีรูปกด “วาดรูป” บนการ์ดได้" });
        setTab("draft");
        router.refresh();
        return;
      }
      if (res.ok) {
        made = res.items;
        setRoundNote(res.missing > 0
          ? { tone: "warn", text: `ได้ ${res.items.length} จาก ${count} ชิ้น — อีก ${res.missing} ชิ้นเขียนไม่สำเร็จ กดสร้างเพิ่มได้` }
          : { tone: "ok", text: `สร้างเสร็จ ${res.items.length} ชิ้น อยู่ในแท็บ “ร่าง” กำลังวาดรูปทีละชิ้น` });
      } else {
        // a round that stopped part way says how many were kept and why (the ceiling, the queue's end…)
        made = res.items ?? [];
        setRoundNote({ tone: made.length > 0 ? "warn" : "bad", text: res.error });
      }
      setTab("draft");
      router.refresh();
    } finally {
      running.current = false;
      setMaking(0);
      draw(jobsOf(made));
    }
  }

  // a new campaign's first round, once, however the effect is run
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoWrite || autoStarted.current) return;
    autoStarted.current = true;
    dropWriteParam();
    void write(autoWrite);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const shown = pieces.filter((p) => (tab === "all" ? p.tab !== "trash" : p.tab === tab));
  const open = openId ? pieces.find((p) => p.id === openId) ?? null : null;
  const approved = pieces.filter((p) => p.tab === "approved");
  const blocked = sendBlocker({ approved: approved.length, accounts: connection.accounts, thIdentity: connection.thIdentity, pageConnected: campaign.pageConnected });

  const rows = sentRows(room.sends, room.legacy);
  const desk = useRef<HTMLElement>(null);
  function showSent() {
    setTab("sent");
    // below xl the rail sits under the tools, away from the ads: bring them into view
    if (!window.matchMedia("(min-width: 80rem)").matches) desk.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <Columns
        note="ตั้งค่าแคมเปญแล้วกดสร้าง แอดจะไปอยู่ที่ “ร่าง”"
        deskRef={desk}
        tools={(folded) => (
          <>
            <div className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>{pickers}</div>
            <CampaignSettings
              key={campaign.dimensions ? "with-dimensions" : "without"}
              campaign={campaign} productName={productName} queue={queue} sent={counts.sent > 0} folded={folded}
              writing={making > 0} onWrite={write}
              onAnalysed={(fallback) => setRoundNote(fallback
                ? { tone: "warn", text: "AI ตอบไม่ได้ในรอบนี้ เลยใช้รายการตั้งต้นให้ก่อน — แก้มิติได้ที่แผงเครื่องมือ แล้วกดสร้าง" }
                : { tone: "ok", text: "AI เสนอมิติแล้ว — แก้ได้ที่แผงเครื่องมือ แล้วกดสร้าง" })}
            />
          </>
        )}
        desk={(
          <>
            {!campaign.pageConnected && (
              <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
                เพจนี้ไม่ได้เชื่อมกับระบบแล้ว — ยังแก้แอดได้ แต่สร้างและส่งแอดไม่ได้จนกว่าจะเชื่อมเพจอีกครั้ง
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" aria-label="สถานะแอด" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
                {AD_TAB_KEYS.map((t) => (
                  <button
                    key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm ${tab === t ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
                  >
                    {TAB_LABEL[t]} <span className="tabular-nums">{counts[t]}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSending(true)} disabled={blocked !== null} className={solid}>
                ส่งขึ้น Facebook ({approved.length})
              </button>
            </div>
            {blocked && approved.length > 0 && <p className="text-right text-xs text-[var(--ct-warn-ink)]">{blocked}</p>}

            <QueueBar queue={queue} making={making} seconds={seconds} />

            {roundNote && (
              <p role={roundNote.tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${TONES[roundNote.tone]}`}>{roundNote.text}</p>
            )}

            {tab === "sent" ? (
              <SentTab room={room} productName={productName} onOpen={setOpenId} />
            ) : shown.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">{TAB_EMPTY[tab]}</p>
            ) : (
              <ul className="grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">
                {shown.map((p) => (
                  <li key={p.id} className="grid">
                    <AdCard
                      piece={p} productName={productName} fold={rules.limits.fold} picture={pictures[p.id]}
                      onOpen={() => setOpenId(p.id)}
                      onDraw={() => p.variant && draw([{ id: p.id, style: p.variant.style }])}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        rail={<SentRail rows={rows} pieces={pieces} productName={productName} onShow={showSent} />}
      />

      {sending && (
        <SendDialog
          room={room} pieces={approved} productName={productName}
          onClose={() => setSending(false)}
          onShowSent={() => { setSending(false); setTab("sent"); }}
        />
      )}
      {open && <AdEditor key={open.id} piece={open} room={room} rules={rules} people={people} productName={productName} onClose={() => setOpenId(null)} />}
    </>
  );
}
