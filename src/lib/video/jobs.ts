import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  CLIP_BUCKET, CLIP_MIN_SEC, EDIT_JOB_TIMEOUT_MS, MAX_HOOK_MAIN, MAX_HOOK_TOP,
  type ClipEdit, type ClipVideo, type EditJob, type EditPass, type EngineName, type Hook,
} from "@/lib/content/clip";
import { removeClip } from "@/lib/content/clip-store";
import { getContentUnscoped, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { siteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { settleLater } from "@/lib/wallet/round";
import type { FfmpegJob } from "./command";
import { engineNamed, enginesInOrder } from "./engines/index";
import { EngineError, type JobStatus, type RenderEngine } from "./engines/types";
import { buildSubs, keepRanges, keptDuration, parseSilences, type Span } from "./timeline";

/**
 * A clip's ffmpeg jobs (owner, 2026-10-02): handed to a render service with the other one as
 * a fallback, asked after by the edit page's poll, told about by the service's webhook — and
 * collected exactly once, whichever of those sees it finished first.
 *
 * The job lives on the piece, in output.video.edit.job, and every write to it is guarded on
 * the piece's output.rev (saveOutputIf), so two writers that read the same row cannot both win.
 * Collecting starts with a claim (job.collecting): only the writer whose claim lands downloads
 * the files and settles the round; a loser reads the row again and leaves it be.
 *
 * Nothing here is a person's request — the webhook has no viewer — so pieces are read
 * unscoped. The callers that answer a person (src/app/studio) check the piece is theirs first.
 * Keys, tokens and signed links never go into a log, a stored error or an answer: an engine's
 * own error text is logged with links taken out, and the row is told a fixed message.
 */

export const JOB_CALLBACK_PATH = "/api/content-video/job";

export const NO_ENGINE = "ยังไม่ได้ตั้งค่าตัวตัดต่อ";
export const NO_OTHER_ENGINE = "ไม่มีตัวตัดต่ออื่นให้ลองแล้ว";
export const JOB_BUSY = "คลิปนี้มีงานตัดต่อค้างอยู่ — รอให้เสร็จก่อนนะครับ";
export const JOB_FAILED = "ตัดต่อไม่สำเร็จ — ลองอีกครั้งได้";
export const JOB_TIMED_OUT = "ตัดต่อนานเกิน 15 นาที — ลองอีกครั้งได้";
export const JOB_NO_FILES = "ตัวตัดต่อไม่ได้ส่งไฟล์กลับมา — ลองอีกครั้งได้";

/**
 * All of one collect — every download from the engine and every upload into our bucket — gets
 * this long, inside the 300 s a function may run (the webhook's maxDuration, the poll's action).
 */
export const COLLECT_BUDGET_MS = 240_000;
/** a claim this old was made by a collector that died half way (past its 300 s); another may take over */
export const COLLECT_STALE_MS = 6 * 60_000;
/**
 * a submit claim this old was left by a request that died (a submit signs links, draws the
 * subtitles and asks the engines — well inside the 300 s a function may run); it counts for nothing
 */
export const SUBMIT_STALE_MS = 5 * 60_000;
/** a guarded write lost to another writer is tried again from a fresh read, this many times in all */
const WRITE_TRIES = 4;

/** what each kind of job hands back, by its output alias (command.ts), and how it is filed */
const OUTPUTS: Record<EditJob["kind"], Record<string, { ext: string; contentType: string }>> = {
  prepare: { out_1: { ext: "mp4", contentType: "video/mp4" }, out_2: { ext: "txt", contentType: "text/plain" } },
  render: { out_1: { ext: "mp4", contentType: "video/mp4" } },
};

type Result = { state: "done"; paths: Record<string, string> } | { state: "failed"; error: string };

const bucket = () => supabaseAdmin().storage.from(CLIP_BUCKET);
const ageMs = (iso: string) => Date.now() - new Date(iso).getTime();
const timedOut = (job: EditJob) => ageMs(job.startedAt) > EDIT_JOB_TIMEOUT_MS;
const claimHeld = (job: EditJob) => Boolean(job.collecting) && ageMs(job.collecting!) <= COLLECT_STALE_MS;
/** a submit is under way on this edit (claimSubmit), and it is not one left by a dead request */
export const submitting = (edit: ClipEdit | undefined): boolean =>
  Boolean(edit?.submitting) && ageMs(edit!.submitting!.at) <= SUBMIT_STALE_MS;
/** the edit a first job is recorded around, before the preview is made */
const emptyEdit = (): ClipEdit => ({ cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: randomUUID() });
const destination = (pieceId: string, ext: string) => `${pieceId}/${randomUUID()}.${ext}`;
/** what is kept of a job's webhook secret: its sha256, so the row (which the edit page reads) never holds the secret */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
/** an engine's words, fit for a log: no links (a signed input URL can sit in ffmpeg's error), short */
const redact = (s: unknown) => String(s instanceof Error ? s.message : s ?? "").replace(/https?:\/\/\S+/g, "<url>").slice(0, 300);

/** The piece by its id, with no viewer to scope it (the webhook has none). */
const readPiece = (id: string): Promise<ContentItem | null> => getContentUnscoped(id);

/**
 * Writes the clip's edit as `mutate` makes it from the edit as stored, guarded on the piece's
 * output.rev. A write that loses to another reads the piece again and asks `mutate` again;
 * `mutate` answering null means "not mine to write any more" and stops. null when it stopped.
 */
async function writeEdit(item: ContentItem, mutate: (edit: ClipEdit | undefined, v: ClipVideo) => ClipEdit | null): Promise<ContentItem | null> {
  let cur: ContentItem | null = item;
  for (let i = 0; i < WRITE_TRIES && cur; i++) {
    const v = cur.output.video;
    if (!v) return null;
    const edit = mutate(v.edit, v);
    if (!edit) return null;
    const saved = await saveOutputIf(cur.id, { ...cur.output, video: { ...v, edit } }, undefined, cur.output.rev ?? null);
    if (saved) return saved;
    cur = await readPiece(item.id);
  }
  return null;
}

/** The clip's first edit, from what was heard and the silences measured (exported for the edit page). */
export function initialEdit(v: ClipVideo, silences: Span[]): ClipEdit {
  const segments = v.transcript ?? [];
  const firstLine = (v.caption.split(/\r?\n/).find((l) => l.trim()) ?? "").trim();
  const cap = (s: string, n: number) => [...s].slice(0, n).join("");
  const suggested = v.hookSuggestion?.main?.trim() ? v.hookSuggestion : null;
  // the listener's cut marks, unless they would take the whole clip (or all but under 3 s of
  // it): the agent's first view is never an empty clip (review of Task 8, 2026-10-02)
  const marked = segments.flatMap((s, i) => (s.cut ? [i] : []));
  const left = keptDuration(keepRanges({ duration: v.durationSec, segments, cut: marked, silences, trimSilence: true }));
  const cut = marked.length > 0 && (marked.length === segments.length || left < CLIP_MIN_SEC) ? [] : marked;
  const hook: Hook = suggested
    ? { ...(suggested.top?.trim() ? { top: cap(suggested.top.trim(), MAX_HOOK_TOP) } : {}), main: cap(suggested.main.trim(), MAX_HOOK_MAIN) }
    : { main: cap(firstLine, MAX_HOOK_MAIN) };
  return {
    silences,
    cut,
    trimSilence: true,
    // each line keeps its `seg`, so a cut sentence's lines can be left off (subsOnOutput)
    subs: buildSubs(segments, silences, v.durationSec),
    hook,
    style: "box",
    rev: randomUUID(),
  };
}

/** For an engine that writes our storage itself (Lambda): a signed upload destination per output. */
async function destinations(pieceId: string, kind: EditJob["kind"]): Promise<Record<string, { uploadUrl: string; path: string }>> {
  const out: Record<string, { uploadUrl: string; path: string }> = {};
  for (const [name, o] of Object.entries(OUTPUTS[kind])) {
    const path = destination(pieceId, o.ext);
    const { data, error } = await bucket().createSignedUploadUrl(path);
    if (error || !data?.signedUrl) throw new EngineError("เตรียมที่เก็บไฟล์ตัดต่อไม่สำเร็จ", true);
    out[name] = { uploadUrl: data.signedUrl, path };
  }
  return out;
}

/**
 * Hands a clip's ffmpeg job to the first engine that takes it, the owner's pick first, and
 * records it on the clip. An engine that refuses for a reason the other may not have (a key, a
 * plan, the network) passes it on; one that refuses the command itself does not.
 * `meta`: a render's round (`pass`), its estimated cost — one figure, or one per engine, since
 * which engine takes it is known only here — and the edit rev it was made from (defaults to the
 * edit's rev now). `claim`: the caller's submit claim (claimSubmit); a live claim of anyone
 * else's refuses the job, and the job's record replaces the caller's own.
 * Throws EngineError when nothing took it.
 */
export async function submitJob(
  pieceId: string, kind: "prepare" | "render", job: FfmpegJob, avoid: EngineName[] = [],
  meta: { rev?: string; pass?: EditPass; costThb?: number | Partial<Record<EngineName, number>>; claim?: string } = {},
): Promise<EditJob> {
  const expected = Object.keys(OUTPUTS[kind]);
  if (job.outputs.length !== expected.length || !job.outputs.every((o) => expected.includes(o.name))) {
    throw new EngineError(`not a ${kind} job`, false);
  }
  let item = await readPiece(pieceId);
  if (item?.output.video?.edit?.job) {
    // one that has finished or timed out is wrapped up first, so its round is settled
    item = (await checkJob(pieceId)).item;
    if (item.output.video?.edit?.job) throw new EngineError(JOB_BUSY, false);
  }
  const v = item?.output.video;
  if (!item || !v) throw new Error("ไม่พบคลิปนี้");
  const othersClaim = (edit: ClipEdit | undefined) => submitting(edit) && edit!.submitting!.id !== meta.claim;
  if (othersClaim(v.edit)) throw new EngineError(JOB_BUSY, false);

  const all = await enginesInOrder();
  if (all.length === 0) throw new EngineError(NO_ENGINE, false);
  const engines = all.filter((e) => !avoid.includes(e.name));
  if (engines.length === 0) throw new EngineError(NO_OTHER_ENGINE, false);

  const token = randomBytes(32).toString("hex");
  const tried: EngineName[] = [];
  let taken: { engine: EngineName; id: string; dest?: Record<string, string> } | null = null;
  let last: EngineError | null = null;
  for (const engine of engines) {
    tried.push(engine.name);
    try {
      const uploads = engine.name === "lambda" ? await destinations(pieceId, kind) : undefined;
      const { id } = await engine.submit(job, { callbackUrl: siteUrl(JOB_CALLBACK_PATH), token, uploads });
      taken = { engine: engine.name, id, ...(uploads ? { dest: Object.fromEntries(Object.entries(uploads).map(([k, u]) => [k, u.path])) } : {}) };
      break;
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      console.error(`${engine.name} refused a ${kind} job for ${pieceId}: ${redact(e)}`);
      last = e;
      if (!e.retryElsewhere) throw e;
    }
  }
  if (!taken) throw last ?? new EngineError(NO_ENGINE, false);

  const rev = meta.rev ?? (kind === "render" ? v.edit?.rev : undefined);
  const costThb = typeof meta.costThb === "number" ? meta.costThb : meta.costThb?.[taken.engine];
  const record: EditJob = {
    kind, engine: taken.engine, id: taken.id, startedAt: new Date().toISOString(), tokenHash: hashToken(token), tried,
    ...(taken.dest ? { dest: taken.dest } : {}),
    ...(rev ? { rev } : {}), ...(meta.pass ? { pass: meta.pass } : {}), ...(costThb !== undefined ? { costThb } : {}),
  };
  const saved = await writeEdit(item, (edit) => {
    if (edit?.job && edit.job.id !== record.id) return null; // another job got there first
    if (othersClaim(edit)) return null; // so did another submit
    return { ...(edit ?? emptyEdit()), job: record, submitting: undefined, error: undefined };
  });
  if (!saved) {
    console.error(`${taken.engine} job ${taken.id} for ${pieceId} was taken but not recorded`);
    throw new EngineError("บันทึกงานตัดต่อไม่สำเร็จ", false);
  }
  return record;
}

/**
 * Claims the clip's next submit for one request, before it asks an engine (or takes a round):
 * a write guarded on the row's rev, so of two presses at once only one gets it. "busy": a job
 * is running or another submit holds a live claim. "moved": the edit is no longer the one the
 * caller checked (`editRev`), so its checks would have to be made again.
 */
export async function claimSubmit(
  item: ContentItem, kind: EditJob["kind"], editRev?: string,
): Promise<{ item: ContentItem; claim: string } | "busy" | "moved"> {
  const claim = randomUUID();
  let why: "busy" | "moved" = "busy";
  const saved = await writeEdit(item, (edit) => {
    if (edit?.job || submitting(edit)) { why = "busy"; return null; }
    if (editRev !== undefined && edit?.rev !== editRev) { why = "moved"; return null; }
    return { ...(edit ?? emptyEdit()), submitting: { id: claim, at: new Date().toISOString(), kind } };
  });
  return saved ? { item: saved, claim } : why;
}

/** A claim let go when its submit did not happen (refused, or nothing took the job). Best effort: a claim left behind goes stale. */
export async function releaseSubmit(pieceId: string, claim: string): Promise<void> {
  try {
    const item = await readPiece(pieceId);
    if (!item) return;
    await writeEdit(item, (edit) => (edit?.submitting?.id === claim ? { ...edit, submitting: undefined } : null));
  } catch (e) {
    console.error(`submit claim on ${pieceId} not let go: ${redact(e)}`);
  }
}

/**
 * What a new job should not be sent to: the engine the last one failed on — but only while
 * another engine is set up to take it; with one engine there is nothing else to try.
 */
export async function avoidAfterFailure(edit: ClipEdit | undefined): Promise<EngineName[]> {
  const failed = edit?.failedOn;
  if (!failed) return [];
  return (await enginesInOrder()).some((e) => e.name !== failed) ? [failed] : [];
}

/** The job claimed for collecting, or null when it is gone, is another job, or someone else holds it. */
async function claim(item: ContentItem, jobId: string): Promise<{ item: ContentItem; job: EditJob } | null> {
  const stamp = new Date().toISOString();
  const saved = await writeEdit(item, (edit) => {
    const job = edit?.job;
    if (!edit || !job || job.id !== jobId || claimHeld(job)) return null;
    return { ...edit, job: { ...job, collecting: stamp } };
  });
  const job = saved?.output.video?.edit?.job;
  return saved && job ? { item: saved, job } : null;
}

/** our claim let go after a collect that broke half way, so the next poll or callback can try again */
async function unclaim(item: ContentItem, job: EditJob): Promise<void> {
  await writeEdit(item, (edit) => {
    if (edit?.job?.id !== job.id || edit.job.collecting !== job.collecting) return null;
    return { ...edit, job: { ...edit.job, collecting: undefined } };
  }).catch((e) => console.error(`job ${job.id}: claim not let go: ${redact(e)}`));
}

async function readText(path: string): Promise<string> {
  const { data, error } = await bucket().download(path);
  if (error || !data) throw new Error(`${path} not read: ${error?.message ?? "no data"}`);
  return data.text();
}

/**
 * Writes a claimed job's end into the edit and clears the job, then lets the old files go and
 * settles the round. Runs only for the claim's holder; a holder that lost its claim (it went
 * stale and was taken over) writes nothing and leaves its files to the sweep.
 */
async function finalize(item: ContentItem, job: EditJob, result: Result): Promise<ContentItem> {
  const v = item.output.video!;
  const silences = result.state === "done" && job.kind === "prepare" ? parseSilences(await readText(result.paths.out_2), v.durationSec) : [];
  const at = new Date().toISOString();
  let before: ClipEdit | undefined;
  const saved = await writeEdit(item, (edit, video) => {
    if (!edit || edit.job?.id !== job.id || edit.job.collecting !== job.collecting) return null;
    before = edit;
    if (result.state === "failed") return { ...edit, job: null, error: result.error, failedOn: job.engine };
    if (job.kind === "render") {
      return { ...edit, job: null, error: undefined, failedOn: undefined, renderedPath: result.paths.out_1, renderedAt: at, renderedRev: job.rev };
    }
    const first = edit.subs.length === 0 ? initialEdit(video, silences) : null;
    return {
      ...edit, proxyPath: result.paths.out_1, silences, job: null, error: undefined, failedOn: undefined,
      ...(first ? { cut: first.cut, subs: first.subs, hook: edit.hook.main.trim() ? edit.hook : first.hook, rev: first.rev } : {}),
    };
  });
  if (!saved || !before) {
    console.error(`job ${job.id}: its claim was taken over; nothing written`);
    return (await readPiece(item.id)) ?? item;
  }
  if (result.state === "done") {
    const [old, now] = job.kind === "render" ? [before.renderedPath, result.paths.out_1] : [before.proxyPath, result.paths.out_1];
    if (old && old !== now) await removeClip(old);
    if (job.kind === "prepare") await removeClip(result.paths.out_2);
  }
  if (job.pass) await settleLater(job.pass, result.state === "done", result.state === "done" ? job.costThb ?? 0 : 0);
  return saved;
}

/** claim, then finalize; a lost claim answers the row as it now is */
async function end(item: ContentItem, job: EditJob, result: Result): Promise<{ item: ContentItem; changed: boolean }> {
  const claimed = await claim(item, job.id);
  if (!claimed) {
    const now = (await readPiece(item.id)) ?? item;
    return { item: now, changed: now.output.rev !== item.output.rev };
  }
  try {
    return { item: await finalize(claimed.item, claimed.job, result), changed: true };
  } catch (e) {
    await unclaim(claimed.item, claimed.job);
    throw e;
  }
}

/** a step of a collect, given up when the collect's budget runs out (an upload takes no signal of its own) */
function within<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("collect ran out of time"));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new Error("collect ran out of time"));
    signal.addEventListener("abort", stop, { once: true });
    p.then(
      (v) => { signal.removeEventListener("abort", stop); resolve(v); },
      (e) => { signal.removeEventListener("abort", stop); reject(e); },
    );
  });
}

/** The engine's finished files copied into our storage (Rendi keeps them on its side), all within COLLECT_BUDGET_MS. */
async function copyOutputs(pieceId: string, job: EditJob, status: JobStatus): Promise<Record<string, string>> {
  const paths: Record<string, string> = {};
  const budget = AbortSignal.timeout(COLLECT_BUDGET_MS);
  try {
    for (const [name, o] of Object.entries(OUTPUTS[job.kind])) {
      const res = await within(fetch(status.outputs![name].url, { signal: budget }), budget);
      if (!res.ok) throw new Error(`${name} download ${res.status}`);
      const body = await within(res.arrayBuffer(), budget);
      const path = destination(pieceId, o.ext);
      // buffered, not streamed: a Reel is tens of MB, and a buffered body is the upload supabase-js is sure of
      const { error } = await within(bucket().upload(path, body, { contentType: o.contentType, upsert: false }), budget);
      if (error) throw new Error(`${name} upload: ${error.message}`);
      paths[name] = path;
    }
    return paths;
  } catch (e) {
    for (const p of Object.values(paths)) await removeClip(p);
    throw e;
  }
}

const missingOutputs = (kind: EditJob["kind"], outputs: Record<string, unknown> | undefined) =>
  Object.keys(OUTPUTS[kind]).filter((name) => !outputs?.[name]);

async function cleanup(engine: RenderEngine, status: JobStatus, jobId: string): Promise<void> {
  try {
    await engine.cleanup(status);
  } catch (e) {
    console.error(`job ${jobId}: engine copies not cleaned up: ${redact(e)}`);
  }
}

/**
 * Asks the engine about a clip's job (when it answers questions — Lambda only calls back) and
 * wraps up one that is done, failed, or past EDIT_JOB_TIMEOUT_MS — exactly once. An engine that
 * cannot be asked now is asked again next time. EDIT_JOB_TIMEOUT_MS bounds a job, full stop: one
 * past it has failed even when the engine now says done (its copies are let go, nothing is
 * collected) — the wallet hands the hold back at the same 15 minutes. A stale claim taken over
 * on such a job fails it rather than collecting again.
 */
export async function checkJob(pieceId: string): Promise<{ item: ContentItem; changed: boolean }> {
  const item = await readPiece(pieceId);
  if (!item) throw new Error("ไม่พบคลิปนี้");
  const job = item.output.video?.edit?.job;
  if (!job || claimHeld(job)) return { item, changed: false };

  const engine = await engineNamed(job.engine).catch((e) => {
    console.error(`job ${job.id}: engine not set up: ${redact(e)}`);
    return null;
  });
  let status: JobStatus | null = null;
  if (engine) {
    try {
      status = await engine.status(job.id);
    } catch (e) {
      console.error(`job ${job.id}: status not read, asking again later: ${redact(e)}`);
    }
  }

  if (timedOut(job)) {
    const r = await end(item, job, { state: "failed", error: JOB_TIMED_OUT });
    if (r.changed && engine && status?.state === "done") await cleanup(engine, status, job.id);
    return r;
  }
  if (engine && status?.state === "done") {
    if (missingOutputs(job.kind, status.outputs).length > 0) {
      console.error(`job ${job.id}: done without ${missingOutputs(job.kind, status.outputs).join(", ")}`);
      const r = await end(item, job, { state: "failed", error: JOB_NO_FILES });
      if (r.changed) await cleanup(engine, status, job.id);
      return r;
    }
    const claimed = await claim(item, job.id);
    if (!claimed) {
      const now = (await readPiece(pieceId)) ?? item;
      return { item: now, changed: now.output.rev !== item.output.rev };
    }
    let done: ContentItem;
    try {
      done = await finalize(claimed.item, claimed.job, { state: "done", paths: await copyOutputs(pieceId, claimed.job, status) });
    } catch (e) {
      console.error(`job ${job.id}: not collected: ${redact(e)}`);
      // the bound passed while copying: failed, not asked again
      if (timedOut(job)) {
        const failed = await finalize(claimed.item, claimed.job, { state: "failed", error: JOB_TIMED_OUT });
        await cleanup(engine, status, job.id);
        return { item: failed, changed: true };
      }
      await unclaim(claimed.item, claimed.job);
      return { item: (await readPiece(pieceId)) ?? item, changed: false };
    }
    await cleanup(engine, status, job.id);
    return { item: done, changed: true };
  }
  if (status?.state === "failed") {
    console.error(`job ${job.id} failed on ${job.engine}: ${redact(status.error)}`);
    return end(item, job, { state: "failed", error: JOB_FAILED });
  }
  return { item, changed: false };
}

/**
 * A Lambda callback's outputs against the destinations its job was given (submitJob records
 * them): every one exactly as given is the job's files; one missing means the job failed (the
 * engine said done without it); one naming any other path is not our Lambda's word at all.
 */
function ownPaths(job: EditJob, outputs: Record<string, { path: string }> | undefined): Record<string, string> | "missing" | "foreign" {
  const paths: Record<string, string> = {};
  for (const name of Object.keys(OUTPUTS[job.kind])) {
    const given = outputs?.[name]?.path;
    if (given === undefined) return "missing";
    if (!job.dest?.[name] || given !== job.dest[name]) return "foreign";
    paths[name] = given;
  }
  return paths;
}

/**
 * A job's end as the Lambda reported it (its webhook; the token was checked by the route).
 * - "ignored": the clip's job is no longer this one, is not a Lambda job (a Rendi job is only
 *   finished by asking Rendi), or is being collected.
 * - "refused": a done callback naming a file other than the job's own destinations; nothing is
 *   written, and the job ends by a true callback or by the time limit.
 * - "finished": written. A callback past EDIT_JOB_TIMEOUT_MS fails the job whatever it says,
 *   and the files the Lambda wrote are let go.
 * Throws when it could not be written, so the caller answers an error and the engine tries again.
 */
export async function finishJob(
  pieceId: string, jobId: string,
  result: { state: "done" | "failed"; outputs?: Record<string, { path: string }>; error?: string },
): Promise<"finished" | "ignored" | "refused"> {
  const item = await readPiece(pieceId);
  const job = item?.output.video?.edit?.job;
  if (!item || !job || job.id !== jobId || job.engine !== "lambda") return "ignored";
  if (timedOut(job)) {
    console.error(`job ${jobId}: called back past the time limit`);
    const ended = await end(item, job, { state: "failed", error: JOB_TIMED_OUT });
    if (ended.changed) for (const p of Object.values(job.dest ?? {})) await removeClip(p);
    return ended.changed ? "finished" : "ignored";
  }
  let r: Result;
  if (result.state === "done") {
    const paths = ownPaths(job, result.outputs);
    if (paths === "foreign") {
      console.error(`job ${jobId}: callback named files that are not the job's`);
      return "refused";
    }
    if (paths === "missing") console.error(`job ${jobId}: done without its files`);
    r = paths === "missing" ? { state: "failed", error: JOB_NO_FILES } : { state: "done", paths };
  } else {
    console.error(`job ${jobId} failed on ${job.engine}: ${redact(result.error)}`);
    r = { state: "failed", error: JOB_FAILED };
  }
  return (await end(item, job, r)).changed ? "finished" : "ignored";
}

/** The piece whose clip has this job, for the webhook, which knows only the job. */
export async function pieceOfJob(jobId: string): Promise<{ pieceId: string; job: EditJob } | null> {
  const { data, error } = await supabaseAdmin().from("ins_content").select("id, output")
    .eq("output->video->edit->job->>id", jobId).limit(1);
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as { id: string; output: { video?: ClipVideo } | null }[])[0];
  const job = row?.output?.video?.edit?.job;
  return row && job && job.id === jobId ? { pieceId: String(row.id), job } : null;
}
