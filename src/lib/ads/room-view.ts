/**
 * Small decisions a campaign's room makes, kept free of React so a test can pin them
 * (Ads Studio, 2026-10-04): how many ads one press writes, what a round costs about, whether a
 * piece still waits for its picture, and why the send button is shut.
 */

/** a press writes one, two or four ads, never another number */
export const WRITE_COUNTS = [1, 2, 4] as const;
export type WriteCount = (typeof WRITE_COUNTS)[number];

/** ?write=<n> from the wizard: 1, 2 or 4 starts that round on arrival; anything else starts none (0) */
export function writeParam(v: string | undefined | null): WriteCount | 0 {
  const n = Number(v);
  return (WRITE_COUNTS as readonly number[]).includes(n) ? (n as WriteCount) : 0;
}

/**
 * What a round costs about, in the owner's words. Per ad: writing 0.1–0.5 baht and the picture
 * about 0.43 (the spec's figures), said as half a baht to a baht.
 */
export function roundCost(n: number): string {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return `ราว ${fmt(n * 0.5)}–${fmt(n)} บาท`;
}

/**
 * A piece written to a picture style whose picture is not on its poster yet (still drawing, or
 * the draw failed). The send leaves such a piece out (actions.ts picturePending), so the card
 * offers to draw it.
 */
export function picturePending(p: { variant: { style: string } | null; poster: { background?: string } | null }): boolean {
  return Boolean(p.variant?.style && p.poster && !p.poster.background);
}

/** The link a send starts with: the campaign's plan page on the site. */
export const planLink = (planHref: string) => `https://advisortool.app${planHref.startsWith("/") ? "" : "/"}${planHref}`;

/**
 * Why "ส่งขึ้น Facebook" is shut, or null when it may open: nothing approved and unsent, no
 * ad account connected (or none in baht), the Page gone, or the verified advertiser Meta
 * requires in Thailand not set.
 */
export function sendBlocker(s: {
  approved: number;
  accounts: { currency: string | null }[];
  thIdentity: boolean;
  pageConnected: boolean;
}): string | null {
  if (s.approved === 0) return "ยังไม่มีแอดที่อนุมัติและยังไม่ได้ส่ง — กด ✓ อนุมัติ บนการ์ดก่อน";
  if (!s.pageConnected) return "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว — เชื่อมเพจใหม่ก่อนจึงจะส่งได้";
  if (s.accounts.length === 0) return "ยังไม่ได้เชื่อมบัญชีโฆษณา — เชื่อมที่หน้ารายการแคมเปญก่อน";
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
