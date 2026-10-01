/**
 * Putting a picture post or a Reel on a Page…
 *
 * Facebook keeps the schedule (scheduled_publish_time on an unpublished photo), so nothing on
 * this side has to be awake at 19:30: the post shows in Meta Business Suite's planner and goes
 * up on its own. Cancelling is deleting the held post.
 *
 * The picture is uploaded as bytes rather than handed over as a URL. A URL would have Facebook
 * fetch it from this site, through the poster route's rate limit and whatever protection the
 * deployment has that day; bytes are the picture the owner looked at, sent once.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

/** Facebook takes a schedule from ten minutes ahead; fifteen, so the time spent sending cannot tip it under */
export const MIN_AHEAD_MS = 15 * 60_000;
/** and up to some months ahead; thirty days is within every limit it has published */
export const MAX_AHEAD_MS = 30 * 24 * 60 * 60_000;

/** Reels take a schedule up to 29 days ahead (Reels publishing guide, checked 2026-10-02) */
export const REEL_MAX_AHEAD_MS = 29 * 24 * 60 * 60_000;
const RUPLOAD = "https://rupload.facebook.com/video-upload/v23.0";

export class PublishError extends Error {
  /**
   * `unsure`: Facebook may have taken the post all the same — it answered with no post id, or
   * something between here and Graph answered instead of Graph. A refusal Graph explained is sure.
   */
  constructor(message: string, readonly code?: number, readonly unsure = false) {
    super(message);
    this.name = "PublishError";
  }
}

interface GraphError { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } }

/** Facebook's refusal, in words the owner can act on. */
export function explain(body: GraphError, status: number): PublishError {
  const e = body.error ?? {};
  const code = e.code;
  // 200 and 10 are permission errors; 190 is a token Facebook no longer accepts
  if (code === 200 || code === 10 || (code !== undefined && code >= 200 && code < 300)) {
    return new PublishError("เพจนี้ยังไม่ได้เปิดสิทธิ์โพสต์ให้ระบบ — เชื่อมเพจใหม่ที่หน้าตั้งค่าเพจ (/admin/messenger) แล้วกดอนุญาตให้โพสต์", code);
  }
  if (code === 190) return new PublishError("การเชื่อมเพจหมดอายุ — เชื่อมเพจใหม่ที่หน้า /admin/messenger", code);
  if (code === 368) return new PublishError("Facebook บล็อกการโพสต์ชั่วคราว (โพสต์ถี่หรือเนื้อหาติดนโยบาย) ลองใหม่ภายหลัง", code);
  return new PublishError(`Facebook ไม่รับโพสต์: ${e.error_user_msg || e.message || `HTTP ${status}`}`, code);
}

export interface Posted {
  /** "<page>_<post>" when Facebook gives it, the photo id otherwise; either deletes it */
  id: string;
}

export async function postPhoto(opts: {
  pageId: string;
  token: string;
  png: Buffer;
  caption: string;
  /** absent: now. present: held by Facebook until then */
  at?: Date;
}): Promise<Posted> {
  const form = new FormData();
  form.append("source", new Blob([new Uint8Array(opts.png)], { type: "image/png" }), "poster.png");
  form.append("message", opts.caption);
  if (opts.at) {
    form.append("published", "false");
    form.append("scheduled_publish_time", String(Math.floor(opts.at.getTime() / 1000)));
  }
  const res = await fetch(`${GRAPH}/${encodeURIComponent(opts.pageId)}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({})) as GraphError & { id?: string; post_id?: string };
  if (body.error) throw explain(body, res.status);
  // a gateway's error page, not Graph's: whether the upload landed behind it is not known
  if (!res.ok) throw new PublishError(explain(body, res.status).message, undefined, true);
  const id = body.post_id ?? body.id;
  if (!id) throw new PublishError("Facebook ตอบกลับมาไม่มีเลขโพสต์ ลองเช็กในเพจก่อนกดใหม่", undefined, true);
  return { id };
}

/** Helper: wrap a fetch call; network errors become PublishError with given message and unsure flag */
async function fetchWithError<T extends Record<string, unknown>>(
  fetcher: () => Promise<Response>,
  message: string,
  unsure: boolean,
): Promise<T & GraphError> {
  let res: Response;
  try {
    res = await fetcher();
  } catch {
    throw new PublishError(message, undefined, unsure);
  }
  const body = await res.json().catch(() => ({})) as T & GraphError;
  if (body.error) throw explain(body, res.status);
  if (!res.ok) throw new PublishError(message, undefined, unsure);
  return body;
}

/**
 * A clip as a Reel (owner, 2026-10-02): start, hand Facebook the file's link to fetch, finish.
 * The bytes never pass through here — a 300MB clip would not fit a function's request, and the
 * link is a short signed one Facebook fetches once.
 *
 * Nothing is on the Page until finish is answered, so every failure before it is sure; a finish
 * Graph did not answer (a gateway's page, no `success`) may have gone up, and is unsure.
 */
export async function postReel(opts: { pageId: string; token: string; fileUrl: string; caption: string; at?: Date }): Promise<Posted> {
  const endpoint = `${GRAPH}/${encodeURIComponent(opts.pageId)}/video_reels`;
  const auth = { Authorization: `Bearer ${opts.token}` };

  const startForm = new FormData();
  startForm.append("upload_phase", "start");
  const start = await fetchWithError<{ video_id?: string }>(
    () => fetch(endpoint, { method: "POST", headers: auth, body: startForm, signal: AbortSignal.timeout(30_000) }),
    "ติดต่อ Facebook ไม่ได้ ลองใหม่อีกครั้งนะครับ",
    false,
  );
  if (!start.video_id) throw new PublishError("Facebook ไม่รับการอัปโหลดคลิป ลองใหม่อีกครั้งนะครับ");
  const videoId = start.video_id;

  // Facebook fetches the file itself; a 300MB clip may take minutes
  const upload = await fetchWithError<{ success?: boolean }>(
    () => fetch(`${RUPLOAD}/${encodeURIComponent(videoId)}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${opts.token}`, file_url: opts.fileUrl },
      signal: AbortSignal.timeout(300_000),
    }),
    "Facebook ดึงไฟล์คลิปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ",
    false,
  );
  if (upload.success !== true) throw new PublishError("Facebook ดึงไฟล์คลิปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");

  const finishForm = new FormData();
  finishForm.append("upload_phase", "finish");
  finishForm.append("video_id", videoId);
  finishForm.append("description", opts.caption);
  if (opts.at) {
    finishForm.append("video_state", "SCHEDULED");
    finishForm.append("scheduled_publish_time", String(Math.floor(opts.at.getTime() / 1000)));
  } else {
    finishForm.append("video_state", "PUBLISHED");
  }
  const finish = await fetchWithError<{ success?: boolean }>(
    () => fetch(endpoint, { method: "POST", headers: auth, body: finishForm, signal: AbortSignal.timeout(60_000) }),
    "Facebook ตอบกลับไม่ชัดว่ารับคลิปแล้วหรือยัง ลองเช็กในเพจก่อนกดใหม่",
    true,
  );
  if (finish.success !== true) {
    throw new PublishError("Facebook ตอบกลับไม่ชัดว่ารับคลิปแล้วหรือยัง ลองเช็กในเพจก่อนกดใหม่", undefined, true);
  }
  return { id: videoId };
}

/** Where a Reel can be seen. */
export function reelLink(videoId: string): string {
  return `https://www.facebook.com/reel/${encodeURIComponent(videoId)}`;
}

/** What Facebook says of a Reel: up, failed in its processing, or not decided yet. */
export type ReelState = "published" | "failed" | "unknown";

interface ReelStatus {
  status?: {
    video_status?: string;
    processing_phase?: { status?: string };
    publishing_phase?: { status?: string; publish_status?: string };
  };
}

/**
 * A Reel's state from its video node. "failed" only when Facebook says the video errored —
 * then it will never go up; a Reel still processing, or held for later, is "unknown". Graph
 * errors throw, as postState's do.
 */
export async function reelState(videoId: string, token: string): Promise<ReelState> {
  const { status } = await graphGet<ReelStatus>(videoId, "status", token);
  if (!status) return "unknown";
  if (status.video_status === "error" || status.video_status === "upload_failed"
    || status.processing_phase?.status === "error" || status.publishing_phase?.status === "error"
    || status.publishing_phase?.publish_status === "error") return "failed";
  if (status.publishing_phase?.publish_status === "published") return "published";
  return "unknown";
}

/** Takes a held post back. A post already gone counts as taken back. */
export async function deletePost(id: string, token: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.ok) return;
  const body = await res.json().catch(() => ({})) as GraphError;
  // 100 with subcode 33: the object does not exist any more
  if (body.error?.code === 100 && body.error.error_subcode === 33) return;
  throw explain(body, res.status);
}

/** Where the post can be seen. A post id reads as the Page's post; a photo id as the photo. */
export function postLink(id: string): string {
  const [page, post] = id.split("_");
  return post ? `https://www.facebook.com/${page}/posts/${post}` : `https://www.facebook.com/photo/?fbid=${id}`;
}

/** What Facebook says of a held post whose time has come. */
export type PostState = "published" | "unpublished" | "unknown";

async function graphGet<T>(id: string, fields: string, token: string): Promise<T> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({})) as GraphError & T;
  if (!res.ok || body.error) throw explain(body, res.status);
  return body;
}

/**
 * Whether Facebook actually put a held post up. Its schedule has no event of its own here,
 * so a post whose time has passed is asked about once.
 *
 * What was kept is whatever postPhoto got back: a post id ("<page>_<post>") when Facebook
 * gave one, and for a scheduled photo — every row so far — only the photo's own id. A photo
 * has no is_published (asking for it is an error), so a photo is asked for the post it made,
 * page_story_id, and that post for is_published.
 *
 * "unpublished" only when Facebook said so of a post; "unknown" when there is no post to
 * ask about (a photo with no story yet). Any Graph error — a token, a permission, a network —
 * throws: none of them is evidence the post is missing.
 */
export async function postState(id: string, token: string): Promise<PostState> {
  let postId = id;
  if (!id.includes("_")) {
    const photo = await graphGet<{ page_story_id?: string }>(id, "page_story_id", token);
    if (!photo.page_story_id) return "unknown";
    postId = photo.page_story_id;
  }
  const post = await graphGet<{ is_published?: boolean }>(postId, "is_published", token);
  if (typeof post.is_published !== "boolean") return "unknown";
  return post.is_published ? "published" : "unpublished";
}
