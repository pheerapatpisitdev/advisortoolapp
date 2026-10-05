"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ContentItem } from "@/lib/content/store";
import { liveCount, type AdTab } from "@/lib/ads/campaign-view";
import { ctaLabel, pickAd, sendOf, startTab } from "@/lib/ads/ads-list";
import { pictureRequest } from "@/lib/ads/picture-picks";
import type { AdResult, UnsyncedAccount } from "@/lib/ads/results";
import { AUTO } from "@/lib/content/models";
import { inBin, pruneTicks, sendBlocker, settledPictures, type PictureState } from "@/lib/ads/room-view";
import type { PersonOption } from "../PersonPicker";
import { drawPicture, generateRound } from "../draw";
import { AdEditor, type Room } from "./AdEditor";
import { AdPreview } from "./AdPreview";
import { AdsList } from "./AdsList";
import { CampaignSettings } from "./CampaignSettings";
import { CreateDrawer } from "./CreateDrawer";
import { HeadlinePreview } from "./HeadlinePreview";
import { withCreate } from "@/lib/ads/manager-view";
import type { AdRules } from "./rules";
import { SendDialog } from "./SendDialog";
import { SentTab } from "./SentTab";
import { when } from "./SentSend";
import { plain, solid, TONES } from "./styles";
import { WriteForm, type WriteDraft, type WriteInput } from "./WriteForm";

/**
 * The โฆษณา tab of the campaign open (Ads Studio desktop, 2026-10-05), in two panes: the list on
 * the left (AdsList — ร่าง · ส่งแล้ว · ถังขยะ, ticks, each sent ad's results, ส่งขึ้น Facebook (N)
 * and สร้างโฆษณาเพิ่ม under it, the sent tab's batch panels below) and on the right the ad picked
 * as a Facebook feed post (AdPreview), sticky on a desk. The editor goes full screen over both.
 * สร้างโฆษณาเพิ่ม (and + สร้าง › โฆษณาในแคมเปญนี้) opens the create drawer (CreateDrawer, ?create=ad
 * in the address, written in place): the writing form with ตั้งค่าแคมเปญ under it, the figures the
 * round will place beside it (HeadlinePreview), the press at its foot. A campaign with no ad yet
 * opens with the drawer open. While a round runs the drawer stays open and says so; when the
 * round is back with ads it shuts and the first new ad is picked.
 *
 * The ad picked is kept in the address (?ad=<id>), written in place with history.replaceState so a
 * click neither adds history nor reads the room again; the page opens on that ad's sub-tab. An ad
 * not in the sub-tab shown (binned or sent meanwhile, or gone) gives way to the sub-tab's first,
 * and a new sub-tab starts at its first (ads-list pickAd).
 *
 * Ticks live here only and are never saved: a draft row's tick adds it, the send takes the
 * ticked drafts, and they are cleared once a send is back. A ticked piece that leaves ร่าง (binned,
 * or sent from another tab) drops out when the room is read again.
 *
 * A round is one press at a time. When it is back, each new ad's picture is drawn, one after
 * another, from the campaign's ภาพและโมเดล (painter, person, brief) — an empty request lets the
 * drawing choose the look, as Organic does; its row and preview say so meanwhile and offer to draw
 * again if it fails. A drawn picture stays "done" until the refreshed piece shows it, so the
 * preview never offers a paid draw in between; a piece binned while waiting is not drawn. The
 * round's first new ad is picked once it is in.
 */

type RoundNote = { tone: keyof typeof TONES; text: string } | null;

export interface RoomResults {
  /** each sent piece's results over the range */
  byPiece: Record<string, AdResult>;
  error: string | null;
  fetchedAt: string | null;
  days: 7 | 30;
  /** ad accounts the sends used whose results are not fetched */
  unsynced: UnsyncedAccount[];
}

export function CampaignRoom({ room, pickers, productName, rules, people, adAsked, results }: {
  room: Room;
  /** the way back to the campaigns, above the panes */
  pickers: ReactNode;
  productName: string;
  rules: AdRules;
  people: PersonOption[];
  /** the ad named in the address (?ad=), if any */
  adAsked: string | null;
  results: RoomResults;
}) {
  const router = useRouter();
  const { campaign, pieces, counts, connection } = room;
  const [tab, setTab] = useState<AdTab>(() => startTab(pieces, adAsked));
  const [wanted, setWanted] = useState<string | null>(adAsked);
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
  // the create drawer, kept in the address (?create=ad) and opened or shut in place
  const search = useSearchParams();
  const drawerOpen = search.get("create") === "ad";
  // what was typed in the drawer's form, kept while it is shut
  const [draft, setDraft] = useState<WriteDraft | null>(null);
  const setDrawer = (on: boolean) => window.history.replaceState(null, "", withCreate(window.location.href, on ? "ad" : null));
  // a campaign with no ad yet starts with the drawer open, as the form used to be
  useEffect(() => {
    if (pieces.length === 0 && new URL(window.location.href).searchParams.get("create") !== "ad") setDrawer(true);
    // once, on opening the campaign
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        const res = await drawPicture(id, pictureRequest(brief), painter ?? AUTO, person);
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

  async function write({ angle, custom, reader, age, count, sex, rung }: WriteInput) {
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
          format: "ad", campaignId: campaign.id, count, angle, custom, reader, age, sex, rung,
          href: "", length: null, hookTemplateId: null,
        });
      } catch {
        // the server carries on and saves the ads whatever happened to the connection
        setRoundNote({ tone: "warn", text: "การเชื่อมต่อหลุดระหว่างรอ แอดอาจสร้างเสร็จแล้ว ดูในแท็บ “ร่าง” ก่อนกดสร้างใหม่ — ชิ้นที่ยังไม่มีรูปกด “วาดรูป” ที่ตัวอย่างได้" });
        setTab("draft");
        setWanted(null);
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
      // the round's first new ad in the preview, once the refreshed room has it; the drawer shuts
      setWanted(made[0]?.id ?? null);
      if (made.length > 0) setDrawer(false);
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

  const selected = pickAd(pieces, tab, wanted);
  const picked = selected ? pieces.find((p) => p.id === selected) ?? null : null;
  const open = openId ? pieces.find((p) => p.id === openId) ?? null : null;
  const going = pieces.filter((p) => p.tab === "draft" && ticked.has(p.id));
  const blocked = sendBlocker({ ticked: going.length, accounts: connection.accounts, thIdentity: connection.thIdentity, pageConnected: campaign.pageConnected });
  const resultsNote = results.error
    ? `อ่านผลลัพธ์ไม่ได้ — ${results.error}`
    : `${results.fetchedAt ? `ผลลัพธ์ ${results.days} วันล่าสุด · อัปเดตล่าสุด ${when(results.fetchedAt)}` : `ยังไม่มีผลลัพธ์ในช่วง ${results.days} วัน`} · ดึงจาก Facebook วันละครั้ง อาจช้าได้ถึง 1 วัน`;

  // the ad picked, in the address: in place, so no history entry and no new read of the room;
  // asserted again when the address changes under it (a new results range drops ?ad=)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("ad") === selected || (!selected && !url.searchParams.has("ad"))) return;
    if (selected) url.searchParams.set("ad", selected);
    else url.searchParams.delete("ad");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selected, search]);

  const chooseTab = (t: AdTab) => {
    setTab(t);
    setWanted(null);
  };

  return (
    <>
      <div className="mt-4 space-y-3">
        {pickers}
        {!campaign.pageConnected && (
          <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
            เพจนี้ไม่ได้เชื่อมกับระบบแล้ว — ยังแก้แอดได้ แต่สร้างและส่งแอดไม่ได้จนกว่าจะเชื่อมเพจอีกครั้ง
          </p>
        )}
        {making > 0 && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
            <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
            กำลังเขียนแอด {making} ชิ้น — เสร็จแล้วจะขึ้นในแท็บ “ร่าง”
          </p>
        )}
        {/* in the drawer while it is open, here otherwise: said once */}
        {roundNote && !drawerOpen && (
          <p role={roundNote.tone === "bad" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${TONES[roundNote.tone]}`}>{roundNote.text}</p>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <section aria-label="รายการโฆษณา" className="min-w-0 space-y-3 lg:w-[42%] lg:shrink-0">
            <AdsList
              pieces={pieces} tab={tab} onTab={chooseTab} counts={counts}
              selected={selected} onSelect={setWanted}
              ticked={ticked} onTick={tick}
              results={results.byPiece} resultsNote={resultsNote} unsynced={results.unsynced}
              productName={productName} pictures={pictures}
              foot={(
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setSending(true)} disabled={blocked !== null} className={solid}>
                      {`ส่งขึ้น Facebook (${going.length})`}
                    </button>
                    <button type="button" data-create-opener onClick={() => setDrawer(true)} className={plain}>+ สร้างโฆษณาเพิ่ม</button>
                  </div>
                  {blocked && <p className="text-xs text-[var(--ct-warn-ink)]">{blocked}</p>}
                  {/* a sent ad pressed in a batch panel shows in the preview */}
                  {tab === "sent" && room.sends.length > 0 && <SentTab room={room} productName={productName} onOpen={setWanted} />}
                </>
              )}
            />
          </section>

          <section aria-label="ตัวอย่างโฆษณา" className="min-w-0 flex-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <div className="mx-auto max-w-[500px]">
            {picked ? (
              <AdPreview
                key={picked.id}
                piece={picked} productName={productName} pageName={campaign.pageName ?? "เพจของคุณ"} fold={rules.limits.fold}
                cta={ctaLabel(sendOf(room.sends, picked.id))} picture={pictures[picked.id]}
                onEdit={() => setOpenId(picked.id)} onDraw={() => draw([picked.id])}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">
                เลือกแอดในรายการเพื่อดูตัวอย่างในฟีด
              </p>
            )}
            </div>
          </section>
        </div>
      </div>

      {drawerOpen && (
        <CreateDrawer title={`สร้างโฆษณา · ${campaign.title}`} busy={making > 0} onClose={() => setDrawer(false)}>
          {roundNote && (
            <p role={roundNote.tone === "bad" ? "alert" : "status"} className={`mx-4 mt-4 rounded-lg border px-3 py-2 text-sm ${TONES[roundNote.tone]}`}>{roundNote.text}</p>
          )}
          <WriteForm
            campaignId={campaign.id} planHref={campaign.planHref}
            picks={{ writer: campaign.writer, painter: campaign.painter, person: campaign.person }}
            writing={making > 0} disabled={!campaign.pageConnected}
            warning={campaign.pageConnected ? null : "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว"}
            folded={false} onWrite={(input) => void write(input)}
            preview={(pick) => <HeadlinePreview campaignId={campaign.id} {...pick} />}
            draft={draft} onDraft={setDraft}
          >
            <CampaignSettings
              campaign={campaign} productName={productName} people={people} sent={counts.sent > 0} live={liveCount(room.sends, room.pieces.flatMap((p) => p.launches))} folded={false}
              writing={making > 0} saveFirst={saveFirst}
            />
          </WriteForm>
        </CreateDrawer>
      )}
      {sending && (
        <SendDialog
          room={room} pieces={going} productName={productName}
          onSent={() => setTicked(new Set())}
          onClose={() => setSending(false)}
          onShowSent={() => { setSending(false); chooseTab("sent"); }}
        />
      )}
      {open && <AdEditor key={open.id} piece={open} room={room} rules={rules} people={people} productName={productName} onClose={() => setOpenId(null)} />}
    </>
  );
}
