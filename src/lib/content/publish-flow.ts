import { pageToken } from "@/lib/facebook/connection";
import { myPageIds, myPages } from "@/lib/auth/pages";
import { deletePost, MAX_AHEAD_MS, MIN_AHEAD_MS, postPhoto, postState, PublishError, type Posted } from "@/lib/facebook/publish";
import { setContentStatus } from "@/app/studio/actions";
import { audit } from "@/lib/auth/viewer";
import { fullText } from "./output";
import { defaultPoster } from "./poster";
import { drawPoster } from "./poster-draw";
import { contentProduct } from "./products";
import { timeOfDay } from "./calendar";
import { maybeOnPage, POSSIBLY_POSTED, stalePosting } from "./publish-label";
import { POST_SCOPE } from "./posting-health";
import { adoptPage, claimPublish, getContent, listDue, recordPublishIf, saveOutput, type ContentItem } from "./store";

/**
 * Posting a piece to a Facebook Page, the steps behind the workbench's server actions
 * (src/app/studio/publish.ts) and behind an edit or a delete of a piece Facebook is holding.
 *
 * Not a "use server" module on purpose: everything exported from one is a door anyone can
 * knock on, and these take a piece the caller has already checked.
 *
 * The rule the whole file keeps: the row says what Facebook has. A post Facebook accepted is
 * never forgotten because the database hiccupped afterwards, and a held post is never taken
 * back without the row saying so.
 */

// kept beside the ออโต้โพสต์ screen's check, which reads it without loading the poster renderer
export { POST_SCOPE };

export { POSSIBLY_POSTED };
/** a move that took the old post back and could not write that down */
export const MOVE_LOST = "ย้ายเวลาไม่สำเร็จ — โพสต์เดิมถูกลบแล้ว กดตั้งเวลาใหม่ได้";
export const PAST_DAY = "ย้ายไปวันที่ผ่านมาแล้วไม่ได้";
/** another request moved, edited, cancelled or re-sent the piece while this one worked */
export const CONCURRENT = "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วลองอีกครั้ง";
/** a held post whose time came and went without Facebook putting it up */
export const MISSED = "ถึงเวลาแล้วแต่ Facebook ไม่ได้โพสต์ — ตั้งเวลาใหม่ได้";

export type PublishResult =
  | { ok: true; item: ContentItem }
  | {
    ok: false;
    error: string;
    /** amounts to confirm before it may go */
    confirmNumbers?: string[];
    /** Facebook may already show it: the owner checks the Page, then it is sent again with `force` */
    confirmRepost?: boolean;
  };

export type Refusal = Extract<PublishResult, { ok: false }>;

export interface Cleared {
  item: ContentItem;
  page: { pageId: string; pageName: string };
  token: string;
  at: Date | undefined;
}

export const PAPER_UNCHECKED = "ตรวจรูปเอกสารเคลมก่อนโพสต์ — กด “แก้ไข” แล้วดูว่าสติ๊กเกอร์ปิดชื่อและเลขครบ จากนั้นกด “ตรวจแล้ว”";

export const refused = (c: Cleared | Refusal): c is Refusal => "ok" in c;

/**
 * Every check a post must pass before Facebook hears of it, in one place, so a drop on the
 * calendar, a press in the editor and an edit of a held post are held to the same things.
 * Nothing is changed here — a reschedule takes the old post back only after the new one has
 * cleared. `edited` checks a copy not yet saved, so an edit can be refused before it lands.
 */
export async function clear(
  input: { id: string; pageId: string; at: string | null; confirmNumbers?: boolean; moving?: boolean; force?: boolean },
  edited?: ContentItem,
): Promise<Cleared | Refusal> {
  const item = edited ?? await getContent(input.id).catch(() => null);
  if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  if (item.format !== "post") return { ok: false, error: "โพสต์ลงเพจได้เฉพาะงานแบบโพสต์เฟซบุ๊ก" };
  const p = item.publish;
  const state = p?.state;
  if (input.moving) {
    if (state !== "scheduled") return { ok: false, error: "ชิ้นนี้ไม่ได้ตั้งเวลาไว้" };
  } else {
    if (state === "scheduled" || state === "published") return { ok: false, error: "ชิ้นนี้โพสต์หรือตั้งเวลาไปแล้ว" };
    if (state === "posting" && !stalePosting(p)) return { ok: false, error: "ชิ้นนี้กำลังส่งไปเพจอยู่ รอสักครู่" };
    if (maybeOnPage(p) && !input.force) return { ok: false, error: POSSIBLY_POSTED, confirmRepost: true };
  }
  // a claim paper's stickers were laid by the AI; a person looks before the Page does
  if (item.output.poster?.documents?.length && item.output.paperChecked === false) return { ok: false, error: PAPER_UNCHECKED };
  const blocked = (item.flags.policy ?? []).filter((f) => f.severity === "block");
  if (blocked.length > 0) return { ok: false, error: `ยังผิดกฎโฆษณาของ Facebook: ${blocked[0].message} — แก้ก่อนแล้วค่อยโพสต์` };
  if (item.flags.numbers.length > 0 && !input.confirmNumbers) {
    return { ok: false, error: "มีตัวเลขที่ไม่ตรงกับตารางเบี้ย", confirmNumbers: item.flags.numbers };
  }

  let at: Date | undefined;
  if (input.at) {
    at = new Date(input.at);
    const ahead = at.getTime() - Date.now();
    if (Number.isNaN(ahead)) return { ok: false, error: "เวลาที่เลือกไม่ถูกต้อง" };
    if (ahead < MIN_AHEAD_MS) return { ok: false, error: `เวลา ${timeOfDay(at)} ของวันนั้นใกล้หรือเลยไปแล้ว — ตั้งได้ตั้งแต่ 15 นาทีข้างหน้าขึ้นไป` };
    if (ahead > MAX_AHEAD_MS) return { ok: false, error: "ตั้งเวลาล่วงหน้าได้ไม่เกิน 30 วัน" };
  }

  const mine = await myPages().catch(() => []);
  // a piece is its Page's (its project, owner 2026-09-30): posted there or nowhere
  if (item.pageId && item.pageId !== input.pageId) {
    const own = mine.find((pg) => pg.pageId === item.pageId)?.pageName;
    return { ok: false, error: own ? `ชิ้นนี้เป็นของเพจ ${own} — ลงได้เฉพาะเพจของตัวเอง` : "ชิ้นนี้เป็นของเพจอื่น — ลงได้เฉพาะเพจของตัวเอง" };
  }
  // a Page the caller looks after (src/lib/auth/pages.ts): a post, a schedule and a move alike
  const page = mine.find((pg) => pg.pageId === input.pageId);
  if (!page) return { ok: false, error: "ไม่พบเพจนี้ในเพจที่คุณดูแล — เลือกเพจก่อน" };
  if (!page.scopes.includes(POST_SCOPE)) {
    return { ok: false, error: `เพจ ${page.pageName} ยังไม่ได้เปิดสิทธิ์โพสต์ — เชื่อมเพจใหม่ที่หน้า /admin/messenger แล้วกดอนุญาตให้โพสต์` };
  }
  const token = await pageToken(page.pageId);
  if (!token) return { ok: false, error: "ไม่พบการเชื่อมต่อของเพจนี้" };
  return { item, page, token, at };
}

/** the opening line a piece went to the Page with, kept within the hooks it has now */
export const postedHookOf = (item: ContentItem): number =>
  Math.min(Math.max(0, item.output.postedHook ?? 0), Math.max(0, item.output.hooks.length - 1));

/**
 * Sends a cleared piece: claims the row, draws the poster, posts or holds it, records what
 * came back. Facebook refusing and the database failing afterwards are different failures:
 * the first leaves nothing on the Page, the second leaves a post the row must not lose.
 *
 * Every write after the claim is made only if the row still holds this claim (posting, at the
 * claim's own time): a request that lost it — a claim gone stale and taken by another, a
 * cancel — must not write its answer over the other's. `claimAt` is given when the caller has
 * claimed the row already (a move).
 */
export async function send(c: Cleared, hook: number, claimAt?: string): Promise<PublishResult> {
  const { item, page, token, at } = c;
  const claim = claimAt ?? new Date().toISOString();
  if (!claimAt && !(await claimPublish(item.id, new Date(claim)))) return { ok: false, error: "ชิ้นนี้โพสต์หรือตั้งเวลาไปแล้ว หรือกำลังส่งอยู่" };
  // a piece on no Page yet becomes the Page's it goes to; the post goes up either way
  if (!item.pageId) await adoptPage(item.id, page.pageId).catch((e) => console.error("piece not tied to its Page:", e));
  const mine = { state: "posting" as const, at: claim };
  // failed is claimable again, so the owner can press once more; a move's old post is gone, so
  // its id goes too. The Page is written either way, so the calendar shows the piece on its board.
  const fail = (error: string) =>
    recordPublishIf(item.id, mine, { state: "failed", pageId: page.pageId, error, ...(claimAt ? { postId: null } : {}) })
      .catch((err) => console.error("publish failure not recorded:", err));

  let png: Buffer;
  try {
    const poster = item.output.poster ?? defaultPoster(item.output.hooks[0], contentProduct(item.planHref)?.name ?? "");
    png = await drawPoster(poster, "square");
  } catch (e) {
    // nothing has left for Facebook yet: a plain failure
    console.error("content poster failed:", e);
    const message = "วาดรูปโพสต์ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ";
    await fail(message);
    return { ok: false, error: message };
  }

  let posted: Posted;
  try {
    posted = await postPhoto({ pageId: page.pageId, token, png, caption: fullText(item.output, hook), at });
  } catch (e) {
    // A refusal Graph explained left nothing on the Page. Anything else — a timeout, a reset, a
    // gateway's page, an answer with no post id — may have: the upload can land after we stop
    // waiting. Saying "try again" there is how a post goes up twice, so the owner checks first.
    if (e instanceof PublishError && !e.unsure) {
      await fail(e.message);
      return { ok: false, error: e.message };
    }
    console.error("content publish unsure:", e);
    await fail(POSSIBLY_POSTED);
    return { ok: false, error: POSSIBLY_POSTED, confirmRepost: true };
  }

  // Facebook has it now. Whatever happens below, the row keeps its id.
  const done = () => recordPublishIf(item.id, mine, {
    state: at ? "scheduled" : "published", pageId: page.pageId, postId: posted.id, at: (at ?? new Date()).toISOString(),
  });
  let saved: ContentItem | null;
  try {
    saved = await done();
  } catch (first) {
    console.error("publish not recorded, trying once more:", first);
    try {
      saved = await done();
    } catch (second) {
      console.error("publish not recorded:", second);
      // failed, with the post id, so a second press is asked to check the Page first; if even
      // this cannot be written, the claim goes stale in ten minutes and says the same
      await recordPublishIf(item.id, mine, { state: "failed", pageId: page.pageId, postId: posted.id, error: POSSIBLY_POSTED })
        .catch((err) => console.error("possible post not recorded:", err));
      return { ok: false, error: POSSIBLY_POSTED, confirmRepost: true };
    }
  }
  if (!saved) {
    // the claim was lost while Facebook was busy: someone else owns the row now, and a second
    // post of the same piece is the one thing not to leave behind
    try {
      await deletePost(posted.id, token);
      return { ok: false, error: CONCURRENT };
    } catch (e) {
      console.error("orphan post not taken back:", e);
      return { ok: false, error: POSSIBLY_POSTED, confirmRepost: true };
    }
  }
  if (hook !== postedHookOf(saved)) {
    saved = await saveOutput(saved.id, { ...saved.output, postedHook: hook }).catch((e) => {
      console.error("posted hook not kept:", e);
      return saved!;
    });
  }
  // posted is used: it moves to ใช้จริง, and its hook joins the formula library
  if (saved.status === "draft") await setContentStatus(saved.id, "used");
  // who put it on the Page, for the calendar's "โดย" (owner, 2026-09-27)
  await audit(claimAt ? "reschedule" : at ? "schedule" : "post", item.id, { pageId: page.pageId, at: at ? at.toISOString() : null });
  return { ok: true, item: { ...saved, status: "used" } };
}

export async function publish(input: {
  id: string; pageId: string; at: string | null; hook?: number; confirmNumbers?: boolean; force?: boolean;
}): Promise<PublishResult> {
  const c = await clear(input);
  return refused(c) ? c : send(c, input.hook ?? 0);
}

/**
 * Takes a held piece for this request: scheduled with this post id → posting, at `claimAt`.
 * One conditional update, so two moves, edits or cancels of one held post cannot both go on
 * to Facebook — the second finds the row taken and stops before deleting anything.
 */
async function claimHeld(item: ContentItem, claimAt: string): Promise<ContentItem | null> {
  return recordPublishIf(item.id, { state: "scheduled", postId: item.publish?.postId ?? null }, { state: "posting", at: claimAt });
}

/** A held claim given back as it was: nothing reached Facebook. */
async function unclaimHeld(item: ContentItem, claimAt: string): Promise<void> {
  await recordPublishIf(item.id, { state: "posting", at: claimAt }, { state: "scheduled", at: item.publish?.at ?? null })
    .catch((e) => console.error("held claim not given back:", e));
}

/**
 * A held post moved to another time: the new time is cleared first, the row is claimed, then
 * the old post is taken back and the piece held again. If Facebook refuses the second step
 * the piece is left unscheduled and says so — never held twice, and never shown held when the
 * post is gone.
 */
export async function move(id: string, at: Date, confirmNumbers?: boolean): Promise<PublishResult> {
  const item = await getContent(id).catch(() => null);
  const p = item?.publish;
  if (!item || !p || p.state !== "scheduled" || !p.postId || !p.pageId) return { ok: false, error: "ชิ้นนี้ไม่ได้ตั้งเวลาไว้" };
  if (p.at && new Date(p.at).getTime() <= Date.now()) return { ok: false, error: "ถึงเวลาโพสต์ไปแล้ว ย้ายไม่ได้" };
  const c = await clear({ id, pageId: p.pageId, at: at.toISOString(), confirmNumbers, moving: true });
  if (refused(c)) return c;
  const claimAt = new Date().toISOString();
  if (!(await claimHeld(item, claimAt))) return { ok: false, error: CONCURRENT };
  try {
    await deletePost(p.postId, c.token);
  } catch (e) {
    await unclaimHeld(item, claimAt);
    return { ok: false, error: e instanceof PublishError ? e.message : "ย้ายไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
  // the old post is gone: the row says so before the new one is sent
  let taken: ContentItem | null;
  try {
    taken = await recordPublishIf(id, { state: "posting", at: claimAt }, { state: "posting", postId: null });
  } catch (e) {
    console.error("move not recorded:", e);
    await recordPublishIf(id, { state: "posting", at: claimAt }, { state: "failed", postId: null, error: MOVE_LOST })
      .catch((err) => console.error("lost move not recorded:", err));
    return { ok: false, error: MOVE_LOST };
  }
  if (!taken) return { ok: false, error: CONCURRENT };
  const sent = await send({ ...c, item: { ...c.item, publish: taken.publish } }, postedHookOf(c.item), claimAt);
  return sent.ok || sent.error === CONCURRENT ? sent : { ...sent, error: `เอาโพสต์เดิมออกแล้ว แต่ตั้งเวลาใหม่ไม่สำเร็จ: ${sent.error}` };
}

/**
 * Takes back the post Facebook is holding for a piece: claimed first, so a move or edit
 * running at the same moment cannot put a new one up behind it; then deleted on Facebook;
 * then the row says cancelled. Used by ยกเลิกคิว and before a held piece is deleted.
 */
export async function withdraw(item: ContentItem): Promise<{ ok: true; item: ContentItem } | { ok: false; error: string }> {
  const p = item.publish;
  if (p?.state !== "scheduled" || !p.postId || !p.pageId) return { ok: false, error: "ชิ้นนี้ไม่ได้ตั้งเวลาไว้" };
  if (!(await myPageIds().catch(() => new Set<string>())).has(p.pageId)) return { ok: false, error: "โพสต์นี้อยู่ในเพจที่คุณไม่ได้ดูแล" };
  const token = await pageToken(p.pageId).catch(() => null);
  if (!token) return { ok: false, error: "ไม่พบการเชื่อมต่อของเพจ เลยเอาโพสต์ที่ตั้งเวลาไว้ออกไม่ได้ — ยกเลิกคิวในเพจก่อน" };
  const claimAt = new Date().toISOString();
  if (!(await claimHeld(item, claimAt))) return { ok: false, error: CONCURRENT };
  try {
    await deletePost(p.postId, token);
  } catch (e) {
    await unclaimHeld(item, claimAt);
    if (!(e instanceof PublishError)) console.error("scheduled post not withdrawn:", e);
    return { ok: false, error: `เอาโพสต์ที่ตั้งเวลาไว้ออกจากเพจไม่สำเร็จ: ${e instanceof PublishError ? e.message : "ลองใหม่อีกครั้งนะครับ"}` };
  }
  const done = await recordPublishIf(item.id, { state: "posting", at: claimAt }, { state: "cancelled", postId: null, at: null });
  if (done) await audit("unschedule", item.id, { pageId: p.pageId });
  return done ? { ok: true, item: done } : { ok: false, error: CONCURRENT };
}

/* ------------------------- held posts whose time came ------------------------- */

/** how far back a passed schedule is still asked about */
export const VERIFY_WINDOW_MS = 48 * 60 * 60_000;
/** Facebook puts a held post up within minutes of its time, not always on the second */
export const VERIFY_GRACE_MS = 10 * 60_000;
export const VERIFY_MAX = 10;
/** a check that could not decide is not asked again for this long, on this server */
export const VERIFY_RETRY_MS = 30 * 60_000;

/** when each undecided row was last asked about; per server instance, which is enough to stop a render loop */
const lastAsked = new Map<string, number>();

/** for tests: forget every undecided check */
export function forgetChecks(): void {
  lastAsked.clear();
}

/**
 * Asks Facebook whether held posts whose time has come really went up, at most VERIFY_MAX a
 * call, side by side, skipping any this server asked about in the last VERIFY_RETRY_MS.
 *
 * Up: the row says published and is not asked about again. Facebook says the post is not up:
 * the held copy is taken back (so a new schedule cannot make two) and the row says failed.
 * Anything else — no post to ask about yet, a token or permission error, a network error —
 * leaves the row as it was: none of those is evidence, and a real post must never be marked
 * failed because a check could not be made.
 */
export async function verifyDue(now = new Date()): Promise<void> {
  const due = await listDue(new Date(now.getTime() - VERIFY_WINDOW_MS), new Date(now.getTime() - VERIFY_GRACE_MS))
    .catch((e) => { console.error("due posts unreadable:", e); return [] as ContentItem[]; });
  const fresh = due.filter((i) => now.getTime() - (lastAsked.get(i.id) ?? -Infinity) >= VERIFY_RETRY_MS).slice(0, VERIFY_MAX);
  const tokens = new Map<string, Promise<string | null>>();
  const tokenOf = (pageId: string) => {
    if (!tokens.has(pageId)) tokens.set(pageId, pageToken(pageId).catch(() => null));
    return tokens.get(pageId)!;
  };
  await Promise.all(fresh.map(async (item) => {
    const p = item.publish;
    if (!p?.postId || !p.pageId) return;
    lastAsked.set(item.id, now.getTime());
    const held = { state: "scheduled" as const, postId: p.postId };
    try {
      const token = await tokenOf(p.pageId);
      if (!token) return;
      const state = await postState(p.postId, token);
      if (state === "unknown") return;
      if (state === "published") {
        if (await recordPublishIf(item.id, held, { state: "published" })) lastAsked.delete(item.id);
        return;
      }
      let postId: string | null = p.postId;
      try {
        await deletePost(p.postId, token);
        postId = null;
      } catch (e) {
        console.error("missed post not taken back:", e);
      }
      if (await recordPublishIf(item.id, held, { state: "failed", postId, error: MISSED })) lastAsked.delete(item.id);
    } catch (e) {
      console.error(`post ${p.postId} not verified:`, e);
    }
  }));
}
