/**
 * Small decisions a campaign's room makes, kept free of React so a test can pin them
 * (Ads Studio, 2026-10-04): the age a round's premium table is priced at, whether a piece still
 * waits for its picture, why the send button is shut, and which ticks survive a refresh.
 */

/** The premium table's age as typed in the writing form: a whole year from 0 to 80, or null for anything else. */
export function tableAge(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n <= 80 ? n : null;
}

/**
 * A piece whose poster has no picture yet (still drawing, or the draw failed), whatever its ad
 * holds. The send leaves such a piece out (actions.ts picturePending), so the card offers to
 * draw it. A ตัวเลขชัดๆ ad's poster is the numbers poster, never drawn over (spec 2026-10-06), so
 * it waits for no picture.
 */
export function picturePending(p: { poster: { background?: string } | null; ad?: { kind?: string | null } | null }): boolean {
  return Boolean(p.poster && !p.poster.background && p.ad?.kind !== "numbers");
}

/**
 * A รีวิวเคลม ad whose papers the owner has not yet checked: it has papers and `paperChecked` is
 * false (absent counts as checked, as for a plain post). The send leaves such a piece out
 * (actions.ts), so the list and the dialog say so.
 */
export function paperPending(o: { poster?: { documents?: unknown[] } | null; paperChecked?: boolean }): boolean {
  return Boolean(o.poster?.documents?.length) && o.paperChecked === false;
}

/** The new pieces of a round that go on the drawing line: all but the ตัวเลขชัดๆ ads, whose poster is the numbers poster. */
export function toDraw(items: { id: string; output: { ad?: { kind?: string } } }[]): string[] {
  return items.filter((i) => i.output.ad?.kind !== "numbers").map((i) => i.id);
}

/** The link a send starts with: the campaign's plan page on the site. */
export const planLink = (planHref: string) => `https://advisortool.app${planHref.startsWith("/") ? "" : "/"}${planHref}`;

/**
 * Why "ส่งขึ้น Facebook" is shut, or null when it may open: nothing ticked in the draft tab, no
 * ad account connected (or none in baht), the Page gone, or the verified advertiser Meta
 * requires in Thailand not set.
 */
export function sendBlocker(s: {
  ticked: number;
  accounts: { currency: string | null }[];
  thIdentity: boolean;
  pageConnected: boolean;
}): string | null {
  if (s.ticked === 0) return "ติ๊กเลือกแอดในแท็บร่างก่อน";
  if (!s.pageConnected) return "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว — เชื่อมเพจใหม่ก่อนจึงจะส่งได้";
  if (s.accounts.length === 0) return "ยังไม่ได้เชื่อมบัญชีโฆษณา — เชื่อมที่ “ตั้งค่าเพจ” ในแผงเครื่องมือก่อน";
  if (!s.accounts.some((a) => a.currency === "THB")) return "รองรับเฉพาะบัญชีโฆษณาสกุลบาท (THB) — เชื่อมบัญชีสกุลบาทก่อน";
  if (!s.thIdentity) return "ยังส่งไม่ได้ — ต้องตั้งค่า META_TH_VERIFIED_IDENTITY_ID ก่อน (ขั้นตอนอยู่ใน docs/ads-manage-permission.md)";
  return null;
}

/**
 * Where a piece's automatic picture stands in the room: waiting its turn, drawing, drawn (until
 * the refreshed piece shows its background), or failed with why.
 */
export type PictureState = "wait" | "drawing" | "done" | { error: string };

/**
 * The draw button a card offers: วาดรูปใหม่ after a failed draw, วาดรูป for a piece still
 * without its picture — but none while it waits, draws, or has just been drawn and the refreshed
 * piece is not in yet (a paid draw the owner would press for nothing), and none in the bin.
 */
export function drawOffer(picture: PictureState | undefined, pending: boolean, tab: string): "draw" | "redraw" | null {
  if (typeof picture === "object") return "redraw";
  if (picture || !pending || tab === "trash") return null;
  return "draw";
}

/**
 * The room's picture states with every "done" dropped whose piece is in and has its background. A
 * piece the room has not seen yet keeps its "done": the round's own refresh may land after the
 * draw's. The same record when nothing changed, so an effect calling it settles.
 */
export function settledPictures<P extends { id: string } & Parameters<typeof picturePending>[0]>(
  pictures: Record<string, PictureState>,
  pieces: P[],
): Record<string, PictureState> {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const settled = Object.keys(pictures).filter((id) => {
    if (pictures[id] !== "done") return false;
    const p = byId.get(id);
    return p !== undefined && !picturePending(p);
  });
  if (settled.length === 0) return pictures;
  const next = { ...pictures };
  for (const id of settled) delete next[id];
  return next;
}

/**
 * The ticks on the ร่าง cards once the room is read again: an id that is no longer a draft (binned,
 * or sent from another tab meanwhile) drops out, so the send never counts it. The same set when
 * nothing drops, so an effect calling it settles.
 */
export function pruneTicks(ticked: Set<string>, draftIds: string[]): Set<string> {
  const drafts = new Set(draftIds);
  if ([...ticked].every((id) => drafts.has(id))) return ticked;
  return new Set([...ticked].filter((id) => drafts.has(id)));
}

/** A picture waiting its turn is skipped when its piece went to the bin meanwhile (one the room has not seen yet is not). */
export const inBin = (pieces: { id: string; tab: string }[], id: string): boolean => pieces.some((p) => p.id === id && p.tab === "trash");
