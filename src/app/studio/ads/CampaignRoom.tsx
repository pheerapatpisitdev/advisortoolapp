"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/lib/content/store";
import { AD_TABS, type AdTab } from "@/lib/ads/campaign-view";
import { pictureRequest } from "@/lib/ads/picture-picks";
import { AUTO } from "@/lib/content/models";
import { inBin, pruneTicks, sendBlocker, settledPictures } from "@/lib/ads/room-view";
import type { PersonOption } from "../PersonPicker";
import { drawPicture, generateRound } from "../draw";
import { AdCard, type PictureState } from "./AdCard";
import { AdEditor, type Room } from "./AdEditor";
import { CampaignSettings } from "./CampaignSettings";
import { Columns } from "./Columns";
import type { AdRules } from "./rules";
import { SendDialog } from "./SendDialog";
import { SentTab } from "./SentTab";
import { solid, TONES } from "./styles";
import { WriteForm, type WriteInput } from "./WriteForm";

/**
 * The campaign open in Ads Studio, in two columns (owner, 2026-10-05). The tools, top to bottom:
 * the Page and campaign pickers Ads Studio hands in, the writing form, ตั้งค่าแคมเปญ and
 * ตั้งค่าเพจ (both folded), and the press pinned at the foot. The desk: the ads under ร่าง ·
 * ส่งแล้ว (the sends) · ถังขยะ, with ส่งขึ้น Facebook (N) at the end of the row; the editor full
 * screen over both when an ad is pressed.
 *
 * Ticks live here only and are never saved: a draft card's เลือกส่ง adds it, the send takes the
 * ticked drafts, and they are cleared once a send is back. A ticked piece that leaves ร่าง (binned,
 * or sent from another tab) drops out when the room is read again.
 *
 * A round is one press at a time. When it is back, each new ad's picture is drawn, one after
 * another, from the campaign's ภาพและโมเดล (painter, person, brief) — an empty request lets the
 * drawing choose the look, as Organic does; its card says so meanwhile and offers to draw again if
 * it fails. A drawn picture stays "done" until the refreshed piece shows it, so the card never
 * offers a paid draw in between; a piece binned while waiting is not drawn.
 */

const TAB_LABEL: Record<AdTab, string> = { draft: "ร่าง", sent: "ส่งแล้ว", trash: "ถังขยะ" };
const TAB_EMPTY: Record<AdTab, string> = {
  draft: "ยังไม่มีแอดร่าง — กด “สร้าง” ที่แผงเครื่องมือ",
  sent: "",
  trash: "ถังขยะว่าง",
};

type RoundNote = { tone: keyof typeof TONES; text: string } | null;

export function CampaignRoom({ room, pickers, pageSettings, productName, rules, people }: {
  room: Room;
  /** the Page and campaign pickers, at the top of the tools */
  pickers: ReactNode;
  /** ตั้งค่าเพจ, the last fold of the tools; told whether the tools are folded */
  pageSettings: (folded: boolean) => ReactNode;
  productName: string;
  rules: AdRules;
  people: PersonOption[];
}) {
  const router = useRouter();
  const { campaign, pieces, counts, connection } = room;
  const [tab, setTab] = useState<AdTab>("draft");
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [making, setMaking] = useState(0);
  const [roundNote, setRoundNote] = useState<RoundNote>(null);
  const [pictures, setPictures] = useState<Record<string, PictureState>>({});
  // the press is held here as well as in state: two quick presses land before a re-render
  const running = useRef(false);
  const jobs = useRef<string[]>([]);
  const drawing = useRef(false);
  // what ตั้งค่าแคมเปญ hands in to save its unsaved settings before a round
  const saveFirst = useRef<(() => Promise<boolean>) | null>(null);
  // how the pictures are drawn: the campaign's painter, person and brief as last saved
  const picks = useRef({ painter: campaign.painter, person: campaign.person, brief: campaign.pictureBrief });
  useEffect(() => {
    picks.current = { painter: campaign.painter, person: campaign.person, brief: campaign.pictureBrief };
  }, [campaign.painter, campaign.person, campaign.pictureBrief]);
  // the pieces as last refreshed, for the drawing line: a piece binned meanwhile is skipped
  const latest = useRef(pieces);
  useEffect(() => { latest.current = pieces; }, [pieces]);
  // a drawn picture is "done" until the refreshed piece has its background; then it is forgotten
  useEffect(() => { setPictures((p) => settledPictures(p, pieces)); }, [pieces]);
  // a ticked piece binned or sent meanwhile (another tab too) is no longer one to send
  useEffect(() => { setTicked((t) => pruneTicks(t, pieces.filter((p) => p.tab === "draft").map((p) => p.id))); }, [pieces]);

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
        const id = jobs.current[0];
        if (inBin(latest.current, id)) {
          jobs.current.shift();
          setPictures((p) => {
            const next = { ...p };
            delete next[id];
            return next;
          });
          continue;
        }
        setPictures((p) => ({ ...p, [id]: "drawing" }));
        const { painter, person, brief } = picks.current;
        const res = await drawPicture(id, pictureRequest("", brief), painter ?? AUTO, person);
        jobs.current.shift();
        setPictures((p) => {
          const next = { ...p };
          // drawn: no draw button until the refreshed piece shows the picture (the effect above clears it)
          next[id] = res.ok ? "done" : { error: res.error };
          return next;
        });
        if (res.ok) router.refresh();
      }
    } finally {
      drawing.current = false;
    }
  }

  function draw(ids: string[]) {
    const fresh = ids.filter((id) => !jobs.current.includes(id));
    if (fresh.length === 0) return;
    jobs.current.push(...fresh);
    setPictures((p) => ({ ...p, ...Object.fromEntries(fresh.map((id) => [id, "wait" as const])) }));
    void drain();
  }

  async function write({ angle, custom, reader, age, count }: WriteInput) {
    if (running.current) return;
    running.current = true;
    setMaking(count);
    setRoundNote(null);
    let made: ContentItem[] = [];
    try {
      // settings typed in ตั้งค่าแคมเปญ and not saved go first: the writer reads the campaign
      if (saveFirst.current && !(await saveFirst.current())) {
        setRoundNote({ tone: "bad", text: "บันทึกตั้งค่าแคมเปญไม่สำเร็จ ยังไม่ได้สร้างแอด — ดูที่ “ตั้งค่าแคมเปญ” แล้วลองใหม่" });
        return;
      }
      let res;
      try {
        // the campaign's plan, Page, focus, voice and writer stand in for the rest
        res = await generateRound({
          format: "ad", campaignId: campaign.id, count, angle, custom, reader, age,
          href: "", length: null, hookTemplateId: null,
        });
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
        // a round that stopped part way says how many were kept and why (the ceiling, an age the table cannot price…)
        made = res.items ?? [];
        setRoundNote({ tone: made.length > 0 ? "warn" : "bad", text: res.error });
      }
      setTab("draft");
      router.refresh();
    } finally {
      running.current = false;
      setMaking(0);
      // every new piece goes on the drawing line
      draw(made.map((i) => i.id));
    }
  }

  const tick = (id: string, on: boolean) => setTicked((was) => {
    const next = new Set(was);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const shown = pieces.filter((p) => p.tab === tab);
  const open = openId ? pieces.find((p) => p.id === openId) ?? null : null;
  const going = pieces.filter((p) => p.tab === "draft" && ticked.has(p.id));
  const blocked = sendBlocker({ ticked: going.length, accounts: connection.accounts, thIdentity: connection.thIdentity, pageConnected: campaign.pageConnected });

  return (
    <>
      <Columns
        note="เลือกมุม คนอ่าน และอายุ แล้วกดสร้าง แอดจะไปอยู่ที่ “ร่าง”"
        tools={(folded) => (
          <>
            <div className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>{pickers}</div>
            <WriteForm
              planHref={campaign.planHref}
              picks={{ writer: campaign.writer, painter: campaign.painter, person: campaign.person }}
              writing={making > 0} disabled={!campaign.pageConnected}
              warning={campaign.pageConnected ? null : "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว"}
              folded={folded} onWrite={(input) => void write(input)}
            >
              <CampaignSettings
                campaign={campaign} productName={productName} people={people} sent={counts.sent > 0} folded={folded}
                writing={making > 0} saveFirst={saveFirst}
              />
              {pageSettings(folded)}
            </WriteForm>
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
                {AD_TABS.map((t) => (
                  <button
                    key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm ${tab === t ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
                  >
                    {TAB_LABEL[t]} <span className="tabular-nums">{counts[t]}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSending(true)} disabled={blocked !== null} className={solid}>
                {`ส่งขึ้น Facebook (${ticked.size})`}
              </button>
            </div>
            {blocked && <p className="text-right text-xs text-[var(--ct-warn-ink)]">{blocked}</p>}
            {making > 0 && (
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
                <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                กำลังเขียนแอด {making} ชิ้น — เสร็จแล้วจะขึ้นในแท็บ “ร่าง”
              </p>
            )}

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
                      ticked={ticked.has(p.id)} onTick={(on) => tick(p.id, on)}
                      onOpen={() => setOpenId(p.id)}
                      onDraw={() => draw([p.id])}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      />

      {sending && (
        <SendDialog
          room={room} pieces={going} productName={productName}
          onSent={() => setTicked(new Set())}
          onClose={() => setSending(false)}
          onShowSent={() => { setSending(false); setTab("sent"); }}
        />
      )}
      {open && <AdEditor key={open.id} piece={open} room={room} rules={rules} people={people} productName={productName} onClose={() => setOpenId(null)} />}
    </>
  );
}
