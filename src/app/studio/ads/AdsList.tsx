"use client";
import type { ReactNode } from "react";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import { AD_TABS, type AdTab } from "@/lib/ads/campaign-view";
import { rowChips } from "@/lib/ads/ads-list";
import { resultCells } from "@/lib/ads/campaign-table";
import type { AdResult, UnsyncedAccount } from "@/lib/ads/results";
import type { PictureState } from "@/lib/ads/room-view";
import type { RoomPiece } from "./AdEditor";
import { UnsyncedNote } from "./UnsyncedNote";

/**
 * The โฆษณา tab's left pane (Ads Studio desktop, 2026-10-05): the sub-tabs ร่าง · ส่งแล้ว ·
 * ถังขยะ with their counts, then one row per ad of the sub-tab — a tick for the next send (ร่าง
 * only; the room keeps the ticks), a small poster, the headline, chips (เพศ · อายุ, the headline's
 * row), a warning when it trips Facebook's rules, and for a sent ad what it has spent and the
 * chats it started over the range ("—" without data). Pressing a row shows it in the preview.
 * What sits under the rows (the send button, สร้างโฆษณาเพิ่ม, the sent tab's batch panels) is
 * handed in as `foot`.
 */

const TAB_LABEL: Record<AdTab, string> = { draft: "ร่าง", sent: "ส่งแล้ว", trash: "ถังขยะ" };
const TAB_EMPTY: Record<AdTab, string> = {
  draft: "ยังไม่มีแอดร่าง — กด “สร้างโฆษณาเพิ่ม”",
  sent: "ยังไม่มีแอดที่ส่งขึ้น Facebook",
  trash: "ถังขยะว่าง",
};
const chip = "max-w-full break-words rounded-full bg-[var(--ct-ground)] px-2 py-0.5 text-[0.7rem] text-[var(--ct-mute)]";

export function AdsList({ pieces, tab, onTab, counts, selected, onSelect, ticked, onTick, results, resultsNote, unsynced, productName, pictures, foot }: {
  pieces: RoomPiece[];
  tab: AdTab;
  onTab: (t: AdTab) => void;
  counts: Record<AdTab, number>;
  /** the ad in the preview */
  selected: string | null;
  onSelect: (id: string) => void;
  ticked: Set<string>;
  onTick: (id: string, on: boolean) => void;
  /** each sent piece's results over the range; a piece absent has no data */
  results: Record<string, AdResult>;
  /** why results are missing, or when they were read; under the sent rows */
  resultsNote: string | null;
  /** ad accounts the sends used whose results are not fetched: a line each, under the sent rows */
  unsynced: UnsyncedAccount[];
  productName: string;
  pictures: Record<string, PictureState>;
  foot: ReactNode;
}) {
  const shown = pieces.filter((p) => p.tab === tab);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="สถานะแอด" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
        {AD_TABS.map((t) => (
          <button
            key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm ${tab === t ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
          >
            {TAB_LABEL[t]} <span className="tabular-nums">{counts[t]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-8 text-center text-sm text-[var(--ct-mute)]">{TAB_EMPTY[tab]}</p>
      ) : (
        <ul className="divide-y divide-[var(--ct-hair)] overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
          {shown.map((p) => {
            const on = p.id === selected;
            const chips = rowChips(p.ad);
            const blocking = p.flags.policy.some((f) => f.severity === "block");
            const flagged = p.flags.policy.length > 0 || p.flags.numbers.length > 0;
            const picture = pictures[p.id];
            const cells = p.tab === "sent" ? resultCells(results[p.id]) : null;
            return (
              <li key={p.id} className={`flex items-stretch ${on ? "bg-[var(--ct-soft)]" : ""} ${p.tab === "trash" ? "opacity-80" : ""}`}>
                {p.tab === "draft" && (
                  <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center pl-2">
                    <span className="sr-only">เลือกส่ง {p.headline}</span>
                    <input type="checkbox" checked={ticked.has(p.id)} onChange={(e) => onTick(p.id, e.target.checked)} className="size-5" />
                  </label>
                )}
                <button
                  type="button" aria-current={on ? "true" : undefined} onClick={() => onSelect(p.id)}
                  className={`flex min-h-11 min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left ${on ? "" : "hover:bg-[var(--ct-ground)]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route */}
                  <img
                    src={posterUrl(p.poster ?? defaultPoster(p.headline, productName))} alt="" loading="lazy"
                    className="size-[34px] shrink-0 rounded bg-[var(--ct-ground)] object-cover"
                  />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className={`block break-words text-sm leading-snug ${on ? "font-semibold" : "font-medium"}`}>
                      {p.headline || <span className="font-normal text-[var(--ct-mute)]">(ไม่มีหัวข้อ)</span>}
                    </span>
                    {(chips.length > 0 || flagged || picture || p.paperPending || p.lang === "en") && (
                      <span className="flex flex-wrap gap-1">
                        {p.lang === "en" && <span className={chip} title="แอดภาษาอังกฤษ">EN</span>}
                        {chips.map((c) => <span key={c} className={chip}>{c}</span>)}
                        {flagged && (
                          <span className={`rounded-full px-2 py-0.5 text-[0.7rem] ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
                            {blocking ? "ผิดกฎ Facebook" : "ต้องตรวจ"}
                          </span>
                        )}
                        {p.paperPending && <span className="rounded-full bg-[var(--ct-warn-bg)] px-2 py-0.5 text-[0.7rem] text-[var(--ct-warn-ink)]">ยังไม่ตรวจใบเคลม</span>}
                        {(picture === "wait" || picture === "drawing") && <span className={chip}>{picture === "drawing" ? "กำลังวาดรูป…" : "รอวาดรูป…"}</span>}
                        {typeof picture === "object" && <span className="rounded-full bg-[var(--ct-alert-bg)] px-2 py-0.5 text-[0.7rem] text-[var(--ct-alert)]">วาดรูปไม่สำเร็จ</span>}
                      </span>
                    )}
                    {cells && (
                      <span className="block text-xs tabular-nums text-[var(--ct-mute)]">
                        ใช้ไป {cells.spend} · แชท {cells.messaging} · บาท/แชท {cells.perChat}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tab === "sent" && shown.length > 0 && resultsNote && <p className="text-xs text-[var(--ct-mute)]">{resultsNote}</p>}
      {tab === "sent" && shown.length > 0 && <UnsyncedNote accounts={unsynced} />}

      {foot}
    </div>
  );
}
