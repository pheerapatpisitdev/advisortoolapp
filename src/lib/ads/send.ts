import type { AdSend, AdSendItem, LeadCta, SendObjective } from "./send-store";
import { checkDailyBudget, checkLink, maxDailyBudgetThb } from "./launch-limits";
import { thVerifiedIdentity } from "./launch";
import {
  adParams,
  adsetParams,
  type AdGoal,
  bangkokDay,
  campaignParams,
  creativeParams,
  graph,
  hashOf,
  idOf,
  imageParams,
  LEAD_CTAS,
  LEAD_LINK,
  messengerLink,
  NO_HASH,
  NO_ID,
} from "./graph";

/**
 * Sends a campaign's approved ads to Facebook as one batch: one campaign, one ad set, and an
 * image, a creative and an ad for each piece — every one PAUSED. Nothing here switches anything
 * on except activateSend, a separate press; a send never spends money by itself.
 *
 * The campaign, ad set, creative and ad carry exactly the fields a single launch does: both
 * engines build them with graph.ts, and the reasons for each field are in launch.ts's header.
 *
 * Every Meta id is saved the moment Meta returns it (send-store.ts), so a break stops there and
 * resumeSend carries on with what was made instead of making a second campaign or ad set. A
 * piece that breaks does not stop the others: its error is saved on its item and the next piece
 * goes on; a resume makes only the ads still missing, reusing an image already uploaded.
 *
 * Every check that can fail without Meta (pieces, budget, currency, link, ids, Thai identity,
 * token) runs before the send is recorded. A piece with no poster, or already in a live send of
 * the campaign, is left out with its reason rather than failing the whole batch.
 *
 * Only the request holding the send's claim may make anything. Two presses of "send" each make a
 * send row (nothing in the database stops the same piece being in two), so before its campaign a
 * send checks the campaign's other live sends: if an earlier one holds any of its pieces — or is
 * still being created (its row is written before its items, in a second request, so its pieces
 * cannot be seen yet) — this one stands down with nothing made on Meta and removes its own row
 * (dropSend), so it neither keeps those pieces locked nor can be resumed later. Only the
 * earliest makes a campaign.
 *
 * A batch can make many requests, each allowed REQUEST_TIMEOUT_MS (graph.ts). No new piece is
 * started once SEND_TIME_BUDGET_MS has passed since the request began (deps.startedAt, or when
 * runSend / resumeSend was entered — poster drawing counts) — the rest wait for a resume — so a
 * run ends well inside the page's maxDuration (300 s): a function killed mid-piece would leave an
 * ad on Meta with no id saved. The claim is held for longer than any run can last.
 */

/**
 * No new piece is started this long after the request began. A piece started just inside it
 * (three requests at their full 30 s) still ends a minute and more before maxDuration (300 s).
 */
export const SEND_TIME_BUDGET_MS = 120_000;

/**
 * How old a claim must be before another request may take it over. Longer than the longest run
 * (the budget, plus a piece started just inside it: three requests at their full timeout), so a
 * send that is still making ads is never taken over and given a second ad for the same piece.
 */
export const SEND_CLAIM_STALE_MS = 300_000;

export interface SendPiece {
  id: string;
  headline: string;
  primaryText: string;
  description: string;
}

export interface SendInput {
  /** the Studio campaign the pieces belong to */
  campaignId: string;
  actId: string;
  currency: string | null;
  pageId: string;
  /** where a traffic ad's button goes; a lead send ignores it */
  link: string;
  dailyBudgetBaht: number;
  pieces: SendPiece[];
  createdBy: string;
  /** traffic when left out */
  objective?: SendObjective;
  /** the Page's Instant Form a lead send's ads open */
  leadFormId?: string;
  /** a lead ad's button, one of LEAD_CTAS */
  cta?: string;
}

export interface SendDeps {
  store: typeof import("./send-store");
  /** the ads_management token for the account, or null when it is not connected */
  token(actId: string): Promise<string | null>;
  /** the piece's rendered poster, or null when it has none */
  poster(pieceId: string): Promise<Buffer | null>;
  /**
   * The piece's words, for a resume: the send rows keep Meta's ids, not the ad's text. Null when
   * the piece is gone. runSend uses the words it was given and does not call this.
   */
  piece(pieceId: string): Promise<Omit<SendPiece, "id"> | null>;
  /** the verified advertiser identity Meta requires on ad sets reaching Thailand; defaults to the env */
  thIdentity?: () => string | null;
  fetchFn?: typeof fetch;
  now?: () => Date;
  /** when the request began (ms since epoch); the time budget counts from here. Defaults to entering runSend / resumeSend. */
  startedAt?: number;
}

/** A piece left out of a send before anything was made, and why. */
export interface Skipped {
  pieceId: string;
  reason: string;
}

export type SendFailStep = "check" | "campaign" | "adset";

export type SendResult =
  | { ok: true; send: AdSend; items: AdSendItem[]; skipped: Skipped[] }
  | { ok: false; step: SendFailStep; error: string; send?: AdSend; skipped?: Skipped[] };

export type SwitchResult = { ok: true } | { ok: false; error: string };

/** what a batch's Meta campaign name says before its count; traffic says nothing, as it always has */
const BATCH_LABEL: Record<SendObjective, string> = { traffic: "", leads: "ลีด · ", messages: "ข้อความ · " };

const NO_PIECES = "ยังไม่ได้เลือกแอด";
const NO_TOKEN = "ยังไม่ได้เชื่อมบัญชีโฆษณาสำหรับสร้างแอด กดเชื่อมบัญชีก่อน";
const NO_POSTER = "ชิ้นนี้ยังไม่มีโปสเตอร์ สร้างโปสเตอร์ก่อนส่ง";
const ALREADY_SENT = "ชิ้นนี้ส่งขึ้น Facebook ไปแล้วในรอบส่งอื่น";
const PIECE_GONE = "ชิ้นนี้ถูกลบไปแล้ว";
const OUT_OF_TIME = "ส่งไม่ทันในรอบเดียว กดลองใหม่เพื่อส่งชิ้นที่เหลือ";
const BUSY = "กำลังส่งรอบนี้อยู่ รอสักครู่แล้วลองใหม่";
const DUPLICATE = "แอดในรอบนี้อยู่ในรอบส่งอื่นที่เริ่มก่อนแล้ว รอบนี้จึงไม่ได้สร้างอะไรบน Facebook";
const OTHER_STARTING = "มีรอบส่งอื่นของแคมเปญนี้กำลังเริ่มอยู่ รอสักครู่แล้วลองใหม่";

/**
 * How long a send with no items yet counts as one still being created. Its items follow its row
 * within the same request, so a minute is ample; an older item-less row (a rollback that failed)
 * must not block the campaign's sends for ever.
 */
const CREATING_MS = 60_000;
const NOT_FOUND = "ไม่พบรอบส่งนี้";
const RETIRED = "รอบส่งนี้ถูกเลิกแล้ว";
const BAD_IDS = "บัญชีโฆษณาหรือเพจไม่ถูกต้อง";
const BAD_FORM = "ยังไม่ได้เลือกฟอร์มลีด หรือฟอร์มไม่ถูกต้อง";
const BAD_CTA = "ปุ่มบนแอดไม่ถูกต้อง";
const NO_TH_IDENTITY =
  "ยังไม่ได้ตั้งค่า META_TH_VERIFIED_IDENTITY_ID — Meta บังคับให้แอดที่แสดงในไทยระบุผู้ลงโฆษณาที่ยืนยันตัวตนแล้ว (ขั้นตอนอยู่ใน docs/ads-manage-permission.md)";

/** What a send's ads ask people to do, from what the send was started with. */
export function goalOf(send: AdSend): AdGoal {
  if (send.objective === "leads") return { objective: "leads", leadFormId: send.leadFormId!, cta: send.cta! };
  if (send.objective === "messages") return { objective: "messages" };
  return { objective: "traffic", link: send.link };
}

/** A lead send's form and button, or why they cannot go; a traffic send's checked link; a messages send's chat link. */
function checkGoal(input: SendInput): { ok: true; link: string; leadFormId: string | null; cta: LeadCta | null } | { ok: false; error: string } {
  // the button opens the Page's chat: nothing to choose, and the link kept is the Page's own
  if (input.objective === "messages") return { ok: true, link: messengerLink(input.pageId), leadFormId: null, cta: null };
  if (input.objective !== "leads") {
    const link = checkLink(input.link);
    return link.ok ? { ok: true, link: link.url, leadFormId: null, cta: null } : link;
  }
  // the form id goes into the creative; only Meta's own numeric ids are taken
  if (!input.leadFormId || !/^\d+$/.test(input.leadFormId)) return { ok: false, error: BAD_FORM };
  const cta = LEAD_CTAS.find((c) => c === input.cta);
  if (!cta) return { ok: false, error: BAD_CTA };
  return { ok: true, link: LEAD_LINK, leadFormId: input.leadFormId, cta };
}

/** Where a run gets a piece's words and poster: from the request for a new send, from deps for a resume. */
interface Sources {
  text(pieceId: string): Promise<Omit<SendPiece, "id"> | null>;
  poster(pieceId: string): Promise<Buffer | null>;
  /** the order pieces are made in: a new send keeps the order it was given */
  order(items: AdSendItem[]): AdSendItem[];
}

export async function runSend(input: SendInput, deps: SendDeps): Promise<SendResult> {
  const { store } = deps;
  const begun = deps.startedAt ?? (deps.now ?? (() => new Date()))().getTime();

  const unique = [...new Map(input.pieces.map((p) => [p.id, p])).values()];
  if (unique.length === 0) return { ok: false, step: "check", error: NO_PIECES };
  const budget = checkDailyBudget(input.dailyBudgetBaht, input.currency, maxDailyBudgetThb());
  if (!budget.ok) return { ok: false, step: "check", error: budget.error };
  const goal = checkGoal(input);
  if (!goal.ok) return { ok: false, step: "check", error: goal.error };
  // ids go into Graph paths; anything else would let a bad value pick a different endpoint
  if (!/^act_\d+$/.test(input.actId) || !/^\d+$/.test(input.pageId)) return { ok: false, step: "check", error: BAD_IDS };
  // every ad set reaches Thailand, and Meta refuses one that names no verified advertiser
  const identity = (deps.thIdentity ?? thVerifiedIdentity)();
  if (!identity) return { ok: false, step: "check", error: NO_TH_IDENTITY };
  const token = await deps.token(input.actId);
  if (!token) return { ok: false, step: "check", error: NO_TOKEN };

  // a piece goes to Facebook once; the action checks this too, this is the engine's own guard
  const sent = await store.sentPieceIds(input.campaignId);
  const skipped: Skipped[] = [];
  const fresh = unique.filter((p) => (sent.has(p.id) ? (skipped.push({ pieceId: p.id, reason: ALREADY_SENT }), false) : true));
  // fetched before anything is recorded, so a piece without one is left out, not half-sent
  const fetched = await Promise.all(fresh.map(async (p) => [p, await deps.poster(p.id)] as const));
  const posters = new Map<string, Buffer>();
  const going: SendPiece[] = [];
  for (const [p, poster] of fetched) {
    if (poster) {
      posters.set(p.id, poster);
      going.push(p);
    } else skipped.push({ pieceId: p.id, reason: NO_POSTER });
  }
  if (going.length === 0) {
    const reasons = [...new Set(skipped.map((s) => s.reason))].join(" / ");
    return { ok: false, step: "check", error: `ไม่มีแอดที่ส่งได้ — ${reasons}`, skipped };
  }

  const { send: started } = await store.createSend(
    {
      campaignId: input.campaignId,
      actId: input.actId,
      pageId: input.pageId,
      link: goal.link,
      currency: "THB",
      dailyBudgetMinor: budget.minor,
      objective: input.objective === "leads" || input.objective === "messages" ? input.objective : "traffic",
      leadFormId: goal.leadFormId,
      cta: goal.cta,
      createdBy: input.createdBy,
    },
    going.map((p) => p.id),
  );

  const byId = new Map(going.map((p, i) => [p.id, { piece: p, index: i }]));
  const sources: Sources = {
    text: async (id) => byId.get(id)?.piece ?? deps.piece(id),
    poster: async (id) => posters.get(id) ?? deps.poster(id),
    order: (items) => [...items].sort((a, b) => (byId.get(a.pieceId ?? "")?.index ?? 0) - (byId.get(b.pieceId ?? "")?.index ?? 0)),
  };
  return { ...(await drive(started.id, token, identity, sources, deps, begun)), skipped };
}

/**
 * Carries a send on from where it stopped, making only what is missing: the campaign and ad set
 * if they are not there, then the ad of every piece that has none. Uses what the send was started
 * with (account, page, link, budget), never anything new.
 */
export async function resumeSend(sendId: string, deps: SendDeps): Promise<SendResult> {
  const begun = deps.startedAt ?? (deps.now ?? (() => new Date()))().getTime();
  const send = await deps.store.getSend(sendId);
  if (!send) return { ok: false, step: "check", error: NOT_FOUND };
  if (send.superseded) return { ok: false, step: "check", error: RETIRED, send };
  let identity: string | null = null;
  if (!send.adsetId) {
    identity = (deps.thIdentity ?? thVerifiedIdentity)();
    if (!identity) return { ok: false, step: "check", error: NO_TH_IDENTITY, send };
  }
  const token = await deps.token(send.actId);
  if (!token) return { ok: false, step: "check", error: NO_TOKEN, send };

  const sources: Sources = { text: (id) => deps.piece(id), poster: (id) => deps.poster(id), order: (items) => items };
  const result = await drive(sendId, token, identity, sources, deps, begun);
  return result.ok ? { ...result, skipped: [] } : result;
}

/**
 * Why this send must stand down, or null when it may go on: an earlier live send of the same
 * Studio campaign holds one of its pieces, or is still being created (no items and nothing on
 * Meta yet, made within CREATING_MS before this one) and so may be about to hold them.
 * "Earlier" is by creation time, then id, so of two racing sends exactly one goes on.
 */
async function beatenBy(store: SendDeps["store"], send: AdSend, items: AdSendItem[]): Promise<string | null> {
  if (!send.campaignId) return null;
  const mine = new Set(items.flatMap((i) => (i.pieceId ? [i.pieceId] : [])));
  const mineAt = Date.parse(send.createdAt);
  const earlier = (await store.listSends(send.campaignId)).filter(
    (o) => o.id !== send.id && (o.createdAt < send.createdAt || (o.createdAt === send.createdAt && o.id < send.id)),
  );
  if (earlier.some((o) => o.items.some((i) => i.pieceId && mine.has(i.pieceId)))) return DUPLICATE;
  const starting = earlier.some(
    (o) => o.items.length === 0 && !o.metaCampaignId && o.step === "none" && mineAt - Date.parse(o.createdAt) <= CREATING_MS,
  );
  return starting ? OTHER_STARTING : null;
}

/** The run itself, under the claim: campaign, ad set, then every piece still without an ad. */
async function drive(
  sendId: string,
  token: string,
  identity: string | null,
  sources: Sources,
  deps: SendDeps,
  /** when the request began (ms): the time budget counts from here, not from the claim */
  begun: number,
): Promise<Exclude<SendResult, { ok: true }> | { ok: true; send: AdSend; items: AdSendItem[] }> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());

  if (!(await store.claimSend(sendId, SEND_CLAIM_STALE_MS))) {
    return { ok: false, step: "check", error: BUSY, send: (await store.getSend(sendId)) ?? undefined };
  }
  let dropped = false;
  try {
    // re-read under the claim: another run may have moved the send on since it was read
    let send = await store.getSend(sendId);
    if (!send) return { ok: false, step: "check", error: NOT_FOUND };
    if (send.superseded) return { ok: false, step: "check", error: RETIRED, send };
    const items = sources.order(await store.listItems(sendId));

    const stop = async (step: SendFailStep, error: string) => {
      await store.saveSendError(sendId, error);
      send = { ...send!, error };
      return { ok: false as const, step, error, send };
    };

    if (!send.metaCampaignId) {
      const beaten = await beatenBy(store, send, items);
      if (beaten) {
        // nothing of this send is on Meta: remove it rather than leave a live row holding the pieces
        dropped = await store.dropSend(sendId);
        if (dropped) return { ok: false, step: "check", error: beaten };
        return stop("check", beaten);
      }
    }

    const act = send.actId;
    const day = bangkokDay(now());
    const batchName = `Studio · ${BATCH_LABEL[send.objective]}${items.length} แอด · ${day}`;

    if (!send.metaCampaignId) {
      const r = await graph(fetchFn, token, `${act}/campaigns`, campaignParams(batchName, send.objective));
      if (!r.ok) return stop("campaign", r.error);
      const id = idOf(r.body);
      if (!id) return stop("campaign", NO_ID);
      await store.saveSendStep(sendId, { metaCampaignId: id, step: "campaign" });
      send = { ...send, metaCampaignId: id, step: "campaign", error: null };
    }

    if (!send.adsetId) {
      // resumeSend reads the identity only when the ad set is still to make; this is that case
      if (!identity) return stop("adset", NO_TH_IDENTITY);
      const r = await graph(
        fetchFn,
        token,
        `${act}/adsets`,
        adsetParams({
          name: batchName,
          campaignId: send.metaCampaignId!,
          dailyBudgetMinor: send.dailyBudgetMinor,
          identity,
          goal: goalOf(send),
          pageId: send.pageId,
        }),
      );
      if (!r.ok) return stop("adset", r.error);
      const id = idOf(r.body);
      if (!id) return stop("adset", NO_ID);
      await store.saveSendStep(sendId, { adsetId: id, step: "adset" });
      send = { ...send, adsetId: id, step: "adset", error: null };
    }

    let cut = false;
    for (const item of items) {
      if (item.adId) continue;
      if (cut || now().getTime() - begun >= SEND_TIME_BUDGET_MS) {
        cut = true;
        await store.saveItemError(item.id, OUT_OF_TIME);
        continue;
      }
      const error = await makeAd(item, send, token, day, sources, fetchFn, store);
      if (error) await store.saveItemError(item.id, error);
    }

    // "ads" says every piece has been tried once; a run cut short by time stays at "adset"
    if (!cut && send.step !== "ads") {
      await store.saveSendStep(sendId, { step: "ads" });
    }
    const after = (await store.getSend(sendId)) ?? send;
    const madeItems = sources.order(await store.listItems(sendId));
    return { ok: true, send: after, items: madeItems };
  } finally {
    if (!dropped) await store.releaseSend(sendId);
  }
}

/**
 * One piece's ad: image (saved on its own, so a retry after a creative failure reuses it), then
 * creative, then the ad, paused. Returns why it stopped, or null when the ad was made.
 */
async function makeAd(
  item: AdSendItem,
  send: AdSend,
  token: string,
  day: string,
  sources: Sources,
  fetchFn: typeof fetch,
  store: SendDeps["store"],
): Promise<string | null> {
  if (!item.pieceId) return PIECE_GONE;
  const act = send.actId;
  let { imageHash, creativeId } = item;
  const text = await sources.text(item.pieceId);
  const name = `Studio · ${text?.headline ?? ""} · ${day}`;

  if (!creativeId) {
    if (!text) return PIECE_GONE;
    if (!imageHash) {
      const poster = await sources.poster(item.pieceId);
      if (!poster) return NO_POSTER;
      const r = await graph(fetchFn, token, `${act}/adimages`, imageParams(poster));
      if (!r.ok) return r.error;
      imageHash = hashOf(r.body);
      if (!imageHash) return NO_HASH;
      await store.saveItem(item.id, { imageHash });
    }
    const r = await graph(
      fetchFn,
      token,
      `${act}/adcreatives`,
      creativeParams({
        name,
        pageId: send.pageId,
        imageHash,
        goal: goalOf(send),
        primaryText: text.primaryText,
        headline: text.headline,
        description: text.description,
      }),
    );
    if (!r.ok) return r.error;
    creativeId = idOf(r.body);
    if (!creativeId) return NO_ID;
    await store.saveItem(item.id, { creativeId });
  }

  const r = await graph(fetchFn, token, `${act}/ads`, adParams({ name, adsetId: send.adsetId!, creativeId }));
  if (!r.ok) return r.error;
  const adId = idOf(r.body);
  if (!adId) return NO_ID;
  await store.saveItem(item.id, { adId });
  return null;
}

/** A Meta id used as a Graph path: a stray "/" or "?" would reach a different endpoint. */
const pathSafe = (id: string | null): id is string => !!id && /^\w+$/.test(id);

type SwitchDeps = Pick<SendDeps, "store" | "token" | "fetchFn" | "now">;

/** Why a send may not be switched on, or null when it may. */
function notActivatable(send: AdSend | null, items: AdSendItem[]): string | null {
  if (!send) return NOT_FOUND;
  if (send.superseded) return RETIRED;
  if (!pathSafe(send.metaCampaignId) || !pathSafe(send.adsetId)) return "ชุดโฆษณายังสร้างไม่เสร็จ";
  if (!items.some((i) => pathSafe(i.adId))) return "ยังไม่มีแอดที่สร้างสำเร็จในรอบนี้";
  return null;
}

/** Sets each object's status in order; only Meta's {success: true} counts. */
async function setStatus(fetchFn: typeof fetch, token: string, ids: string[], status: "ACTIVE" | "PAUSED"): Promise<SwitchResult> {
  for (const id of ids) {
    const r = await graph(fetchFn, token, id, { status });
    if (!r.ok) return { ok: false, error: r.error };
    if (r.body.success !== true) {
      return { ok: false, error: status === "ACTIVE" ? "Facebook ไม่ยืนยันการเปิดใช้" : "Facebook ไม่ยืนยันการหยุด" };
    }
  }
  return { ok: true };
}

/**
 * The owner's press to switch the whole send on: campaign, then ad set, then every ad that was
 * made, parent first so nothing runs under a paused parent. Only when all are on is the send
 * marked; a break in the middle is reported and the press can be repeated — ACTIVE twice is
 * harmless. Every press sets every ad, so an ad a resume made after an earlier press (made
 * PAUSED, as every ad is) is switched on by the next press.
 */
export async function activateSend(sendId: string, deps: SwitchDeps): Promise<SwitchResult> {
  return switchSend(sendId, deps, "ACTIVE");
}

/** The owner's press to pause the whole send: the campaign is paused, which stops its ad set and ads. */
export async function pauseSend(sendId: string, deps: SwitchDeps): Promise<SwitchResult> {
  return switchSend(sendId, deps, "PAUSED");
}

async function switchSend(sendId: string, deps: SwitchDeps, status: "ACTIVE" | "PAUSED"): Promise<SwitchResult> {
  const { store } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());

  const refusal = async (send: AdSend | null): Promise<string | null> => {
    if (status === "ACTIVE") return notActivatable(send, send ? await store.listItems(send.id) : []);
    if (!send) return NOT_FOUND;
    if (send.superseded) return RETIRED;
    if (!pathSafe(send.metaCampaignId)) return "รอบนี้ยังไม่มีแคมเปญบน Facebook";
    return null;
  };

  const first = await store.getSend(sendId);
  const refused = await refusal(first);
  if (refused) return { ok: false, error: refused };
  const token = await deps.token(first!.actId);
  if (!token) return { ok: false, error: NO_TOKEN };

  if (!(await store.claimSend(sendId, SEND_CLAIM_STALE_MS))) return { ok: false, error: BUSY };
  try {
    // re-read under the claim: a resume or another press may have changed the send meanwhile
    const send = await store.getSend(sendId);
    const changed = await refusal(send);
    if (changed) return { ok: false, error: changed };

    if (status === "PAUSED") {
      const r = await setStatus(fetchFn, token, [send!.metaCampaignId!], "PAUSED");
      if (!r.ok) return r;
      await store.markSendPaused(sendId, now().toISOString());
      return { ok: true };
    }

    const ads = (await store.listItems(sendId)).flatMap((i) => (pathSafe(i.adId) ? [i.adId] : []));
    const r = await setStatus(fetchFn, token, [send!.metaCampaignId!, send!.adsetId!, ...ads], "ACTIVE");
    if (!r.ok) return r;
    await store.markSendActivated(sendId, now().toISOString());
    return { ok: true };
  } finally {
    await store.releaseSend(sendId);
  }
}
