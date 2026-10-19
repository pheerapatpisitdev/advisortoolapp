import { readHistoryOf } from "@/lib/home/history-read";
import { pageConnections } from "@/lib/facebook/connection";
import { CLIP_BUCKET } from "@/lib/content/clip";
import type { ContentOutput } from "@/lib/content/output";
import { posterUrl } from "@/lib/content/poster";
import { calculatorName } from "@/lib/stats/calculators";
import { readStats, whoAre } from "@/lib/stats/usage-read";
import { passState } from "@/lib/members/pass";
import { passRowsOf } from "@/lib/members/pass-store";
import { VIDEO_BUCKET } from "@/lib/quote-video/rows";
import { displayNames } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { walletSummary } from "@/lib/wallet/store";
import {
  buildAsks, buildDrafts, buildLogins, buildOpens, buildPasses, buildRounds, buildSetup, fromHistory, mergeItems, ROUND_ACTIONS, SKIP_SETUP,
  type AdminItem, type AskCost, type Media,
} from "./people-history";

/**
 * The rows people-history.ts shapes, read for one person over a month (their page) or for
 * everybody over the last days (the feed), and the files their lines made, signed for an hour.
 * A table that cannot be read is left out and said in the log, as /home's history does: one
 * broken read does not empty the page.
 */

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** the links the page hands the browser live this long */
const SIGNED_SECONDS = 60 * 60;

async function read(what: string, q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  try {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  } catch (e) {
    console.error(`people history: ${what} not read:`, e);
    return [];
  }
}

/** every row of a query, a thousand at a time (the AI ledger runs to thousands a month) */
async function readAll(what: string, page: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, max = 20_000): Promise<Row[]> {
  const out: Row[] = [];
  for (let at = 0; at < max; at += 1000) {
    const rows = await read(what, page(at, at + 999));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** links to files in one bucket; a path whose file is gone maps to null */
async function sign(bucket: string, paths: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const uniq = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 200) {
    const part = uniq.slice(i, i + 200);
    try {
      const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrls(part, SIGNED_SECONDS);
      if (error) throw new Error(error.message);
      for (const d of data ?? []) if (d.path) out.set(d.path, d.error ? null : d.signedUrl);
    } catch (e) {
      console.error(`people history: ${bucket} links not signed:`, e);
    }
  }
  for (const p of uniq) if (!out.has(p)) out.set(p, null);
  return out;
}

/** the ledger's calls that are a Studio round, a clip's voice and render, or an FHC summary: not a question asked */
const notAQuestion = (task: string) => /^(content|quote-video|fhc-summary)/.test(task);

interface Window { who: string | null; from: Date; to: Date; limit: number }

/** every line, with whose it is, in a window: one person's (`who`) or everybody's */
async function readItems(w: Window): Promise<{ items: AdminItem[]; aiThb: number }> {
  const db = supabaseAdmin();
  const lo = w.from.toISOString();
  const hi = w.to.toISOString();
  const mine = <Q,>(q: Q, column = "agent_id"): Q => (w.who ? (q as unknown as { eq(c: string, v: string): Q }).eq(column, w.who) : q);

  const [base, rounds, setup, asks, ledger, logins, opens, passes, drafts] = await Promise.all([
    readHistoryOf(w.who, false, w.from, w.to, w.limit),
    read("rounds", mine(db.from("ins_audit").select("id, agent_id, at, action, target, detail"))
      .in("action", ROUND_ACTIONS).gte("at", lo).lt("at", hi).order("at", { ascending: false }).limit(w.limit)),
    // what they set up, and what the owner did to them (the person is the line's target)
    read("set-up", (w.who
      ? db.from("ins_audit").select("id, agent_id, at, action, target, detail").or(`agent_id.eq.${w.who},target.eq.${w.who}`)
      : db.from("ins_audit").select("id, agent_id, at, action, target, detail"))
      .not("action", "in", `(${[...SKIP_SETUP].join(",")})`).gte("at", lo).lt("at", hi).order("at", { ascending: false }).limit(w.limit)),
    read("asks", mine(db.from("ins_ai_asks").select("id, agent_id, created_at, question, answer, model, failed"))
      .gte("created_at", lo).lt("created_at", hi).order("created_at", { ascending: false }).limit(w.limit)),
    // the ledger is read whole for a person (it is their AI cost); the feed takes only its asks' lines
    w.who
      ? readAll("ledger", (a, b) => db.from("ins_usage_ledger").select("agent_id, ask_id, task, model, cost_thb, created_at")
        .eq("agent_id", w.who!).neq("model", "reservation").gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b))
      : read("ledger", db.from("ins_usage_ledger").select("agent_id, ask_id, task, model, cost_thb, created_at")
        .not("agent_id", "is", null).not("ask_id", "is", null).not("task", "like", "content%").not("task", "like", "quote-video%")
        .neq("task", "fhc-summary").neq("model", "reservation")
        .gte("created_at", lo).lt("created_at", hi).order("created_at", { ascending: false }).limit(w.limit * 4)),
    read("logins", mine(db.from("ins_logins").select("id, agent_id, how, ip, user_agent, at"))
      .gte("at", lo).lt("at", hi).order("at", { ascending: false }).limit(w.limit)),
    read("calculator opens", mine(db.from("ins_tool_opens").select("agent_id, tool, at"))
      .gte("at", lo).lt("at", hi).order("at", { ascending: false }).limit(w.limit * 3)),
    read("passes", mine(db.from("ins_member_passes").select("id, member_id, kind, days, amount_satang, note, created_at"), "member_id")
      .gte("created_at", lo).lt("created_at", hi).order("created_at", { ascending: false }).limit(w.limit)),
    // the scripts the คลิปตามโจทย์ writer wrote, with their briefs: read only
    read("prompt drafts", mine(db.from("ins_prompt_drafts").select("id, agent_id, brief, made_clip_id, created_at"))
      .gte("created_at", lo).lt("created_at", hi).order("created_at", { ascending: false }).limit(w.limit)),
  ]);

  // one question's calls summed; a Studio round's calls are its cost, not a question
  const byAsk = new Map<string, AskCost>();
  let aiThb = 0;
  for (const r of ledger) {
    const thb = Number(r.cost_thb ?? 0);
    aiThb += thb;
    const askId = str(r.ask_id);
    if (!askId) continue;
    const c = byAsk.get(askId);
    if (c) {
      c.thb += thb;
      c.calls++;
      if (str(r.created_at) < c.at) c.at = str(r.created_at);
    } else {
      byAsk.set(askId, {
        askId, at: str(r.created_at), by: str(r.agent_id) || null, thb, calls: 1,
        model: str(r.model) || null, studio: notAQuestion(str(r.task)),
      });
    }
  }

  const actors = setup.map((r) => str(r.agent_id)).filter(Boolean);
  const names = actors.length ? await displayNames(actors).catch(() => ({})) : {};

  const items = mergeItems(
    fromHistory(base.items, base.by),
    buildRounds(rounds.map((r) => ({
      id: String(r.id), at: str(r.at), by: str(r.agent_id) || null, action: str(r.action), target: str(r.target) || null,
      wallet: Boolean((r.detail as Row | null)?.wallet),
    }))),
    buildSetup(setup.map((r) => ({
      id: String(r.id), at: str(r.at), actor: str(r.agent_id) || null, action: str(r.action), target: str(r.target) || null,
      detail: (r.detail as Row | null) ?? null,
    })), w.who, names),
    buildAsks(asks.map((r) => ({
      id: str(r.id), at: str(r.created_at), by: str(r.agent_id) || null, question: str(r.question), answer: str(r.answer),
      model: str(r.model) || null, failed: r.failed === true,
    })), [...byAsk.values()]),
    buildLogins(logins.map((r) => ({
      id: String(r.id), at: str(r.at), by: str(r.agent_id), how: str(r.how), ip: str(r.ip) || null, userAgent: str(r.user_agent) || null,
    }))),
    buildOpens(opens.map((r) => ({
      at: str(r.at), by: str(r.agent_id), tool: str(r.tool), name: calculatorName(str(r.tool)) ?? str(r.tool),
    }))),
    buildPasses(passes.map((r) => ({
      id: String(r.id), at: str(r.created_at), by: str(r.member_id), kind: str(r.kind), days: Number(r.days ?? 0),
      satang: Number(r.amount_satang ?? 0), note: str(r.note) || null,
    }))),
    buildDrafts(drafts.map((r) => ({
      id: str(r.id), at: str(r.created_at), by: str(r.agent_id) || null, brief: r.brief, madeClipId: str(r.made_clip_id) || null,
    }))),
  );
  // a round's line is for the piece its target names: rounds keep it for the pictures below
  const roundPiece = new Map(rounds.map((r) => [`round-${String(r.id)}`, str(r.target)]));
  await addWork(items, roundPiece);
  return { items, aiThb: Number(aiThb.toFixed(4)) };
}

/* ------------------------------ the work each line made ------------------------------ */

const pieceIdOf = (it: AdminItem, roundPiece: Map<string, string>): string | null => {
  if (it.key.startsWith("piece-")) return it.key.slice(6);
  if (it.key.startsWith("round-")) {
    const t = roundPiece.get(it.key) ?? "";
    return UUID.test(t) ? t : null;
  }
  return null;
};

/** the words of a piece as it was written: every hook it carries, the body, the closing */
function pieceText(o: ContentOutput | null): string {
  if (!o) return "";
  const hooks = (o.hooks ?? []).filter(Boolean);
  const head = hooks.length > 1 ? hooks.map((h, i) => `แบบ ${i + 1}: ${h}`).join("\n") : hooks[0] ?? "";
  return [head, o.body, o.closing, (o.hashtags ?? []).join(" ")].filter((s) => typeof s === "string" && s.trim()).join("\n\n");
}

/**
 * Hangs on each line the pictures, the clip and the words it made, read by id from the rows
 * the lines came from. Files are linked for an hour; one that is gone (deleted, or swept the way
 * the ภาพปกคลิป history keeps only its latest) shows as gone.
 */
async function addWork(items: AdminItem[], roundPiece: Map<string, string>): Promise<void> {
  const db = supabaseAdmin();
  const tail = (prefix: string) => items.filter((i) => i.key.startsWith(prefix)).map((i) => i.key.slice(prefix.length));
  const postAudit = tail("post-");
  const sendIds = tail("send-");

  const [posts, sendItems, clips, thumbs, readings] = await Promise.all([
    postAudit.length ? read("posted pieces", db.from("ins_audit").select("id, target").in("id", postAudit.map(Number).filter(Number.isFinite))) : [],
    sendIds.length ? read("ad pieces", db.from("ins_ad_send_item").select("send_id, piece_id").in("send_id", sendIds)) : [],
    tail("clip-").length ? read("clip files", db.from("ins_quote_videos").select("id, video_path, duration_sec, post_text").in("id", tail("clip-"))) : [],
    tail("thumb-").length ? read("cover files", db.from("ins_thumbnail_history").select("id, image_path").in("id", tail("thumb-"))) : [],
    tail("read-").length ? read("reading files", db.from("ins_describe_history").select("id, thumb_path, prompt").in("id", tail("read-"))) : [],
  ]);

  const postPiece = new Map(posts.map((r) => [`post-${String(r.id)}`, str(r.target)]));
  const sendPieces = new Map<string, string[]>();
  for (const r of sendItems) {
    const k = `send-${str(r.send_id)}`;
    if (str(r.piece_id)) sendPieces.set(k, [...(sendPieces.get(k) ?? []), str(r.piece_id)]);
  }
  const pieceIds = [...new Set([
    ...items.map((it) => pieceIdOf(it, roundPiece)).filter((x): x is string => Boolean(x)),
    ...[...postPiece.values()].filter((t) => UUID.test(t)),
    ...[...sendPieces.values()].flat(),
  ])];
  const pieces = new Map<string, Row>();
  for (let i = 0; i < pieceIds.length; i += 150) {
    const part = await read("pieces", db.from("ins_content").select("id, format, output, fb_post_id").in("id", pieceIds.slice(i, i + 150)));
    for (const r of part) pieces.set(str(r.id), r);
  }

  // every file the lines name, one signing per bucket
  const outputOf = (id: string) => (pieces.get(id)?.output ?? null) as ContentOutput | null;
  const backgrounds: string[] = [];
  const pieceClips: string[] = [];
  for (const id of pieces.keys()) {
    const o = outputOf(id);
    if (o?.poster?.background) backgrounds.push(o.poster.background);
    const v = o?.video;
    if (v && !v.expired) pieceClips.push(v.edit?.renderedPath || v.path);
  }
  const [bg, pc, qv, th, rd] = await Promise.all([
    sign("content-media", backgrounds),
    sign(CLIP_BUCKET, pieceClips),
    sign(VIDEO_BUCKET, clips.map((r) => str(r.video_path))),
    sign("thumbnail-images", thumbs.map((r) => str(r.image_path))),
    sign("describe-thumbs", readings.map((r) => str(r.thumb_path))),
  ]);

  const pieceMedia = (id: string): Media[] => {
    const o = outputOf(id);
    if (!o) return [];
    const out: Media[] = [];
    if (o.poster) {
      const full = posterUrl(o.poster);
      out.push({ type: "image", url: o.poster.background ? bg.get(o.poster.background) ?? null : full, full, label: "โปสเตอร์" });
    }
    const v = o.video;
    if (v) out.push({ type: "video", url: v.expired ? null : pc.get(v.edit?.renderedPath || v.path) ?? null, label: "คลิป" });
    return out;
  };
  const fbLink = (id: string) => {
    const post = str(pieces.get(id)?.fb_post_id);
    return post ? { href: `https://www.facebook.com/${post}`, label: "เปิดโพสต์บน Facebook" } : null;
  };

  const clipRow = new Map(clips.map((r) => [str(r.id), r]));
  const thumbRow = new Map(thumbs.map((r) => [str(r.id), r]));
  const readRow = new Map(readings.map((r) => [str(r.id), r]));

  for (const it of items) {
    const pid = pieceIdOf(it, roundPiece) ?? (UUID.test(postPiece.get(it.key) ?? "") ? postPiece.get(it.key)! : null);
    if (pid) {
      it.media = pieceMedia(pid);
      it.text = pieceText(outputOf(pid)) || undefined;
      if (it.key.startsWith("post-")) it.link = fbLink(pid);
    } else if (it.key.startsWith("clip-")) {
      const r = clipRow.get(it.key.slice(5));
      const p = str(r?.video_path);
      const sec = Number(r?.duration_sec ?? 0);
      if (r) it.media = [{ type: "video", url: p ? qv.get(p) ?? null : null, label: sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}` : "คลิป" }];
      const post = r?.post_text as Row | null;
      if (post && typeof post.text === "string") it.text = post.text;
    } else if (it.key.startsWith("thumb-")) {
      const p = str(thumbRow.get(it.key.slice(6))?.image_path);
      it.media = [{ type: "image", url: p ? th.get(p) ?? null : null, label: "ภาพปก" }];
    } else if (it.key.startsWith("read-")) {
      const r = readRow.get(it.key.slice(5));
      const p = str(r?.thumb_path);
      it.media = [{ type: "image", url: p ? rd.get(p) ?? null : null, label: "รูปที่ถอด" }];
      if (str(r?.prompt)) it.text = str(r?.prompt);
    } else if (it.key.startsWith("send-")) {
      it.media = (sendPieces.get(it.key) ?? []).flatMap(pieceMedia);
    }
  }
}

/* ------------------------------ one person ------------------------------ */

export interface PersonHead {
  id: string;
  name: string;
  kind: "agent" | "member" | "super" | "unknown";
  code: string | null;
  email: string | null;
  room: string | null;
  unit: string | null;
  since: string | null;
  rights: string | null;
  pages: string[];
  balanceSatang: number | null;
  frozen: string | null;
  pass: string | null;
  status: string | null;
}

const thaiDate = (d: Date | string) => new Date(d).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });

export async function readPersonHead(id: string): Promise<PersonHead | null> {
  if (!UUID.test(id)) return null;
  const db = supabaseAdmin();
  const [agent, member, sup, staff, wallet, pages, firstSeen] = await Promise.all([
    read("agent", db.from("agents").select("id, name, agent_code, unit, created_at, tenant:tenants(name)").eq("id", id).limit(1)),
    read("member", db.from("ins_members").select("id, name, email, status, created_at").eq("id", id).limit(1)),
    read("super", db.from("ins_super_admins").select("id, name, email").eq("id", id).limit(1)),
    read("staff", db.from("ins_staff").select("is_owner, can_publish, can_connect, can_admin").eq("agent_id", id).limit(1)),
    read("wallet", db.from("ins_wallets").select("balance_satang, frozen_at, frozen_reason").eq("agent_id", id).limit(1)),
    read("pages", db.from("ins_staff_pages").select("page_id").eq("agent_id", id)),
    // when they started here: their first line of work, else their first sign-in
    read("first", db.from("ins_audit").select("at").eq("agent_id", id).order("at").limit(1)),
  ]);
  const a = agent[0];
  const m = member[0];
  const s = sup[0];
  if (!a && !m && !s) return null;

  const st = staff[0];
  const rights = st ? [
    st.is_owner ? "เจ้าของ" : "", st.can_admin ? "หลังบ้าน" : "", st.can_publish ? "โพสต์ขึ้นเพจได้" : "", st.can_connect ? "เชื่อมเพจได้" : "",
  ].filter(Boolean).join(" · ") || "ทีมงาน" : null;
  const w = wallet[0];
  const pageIds = new Set(pages.map((p) => str(p.page_id)));
  const pageNames = pageIds.size ? (await pageConnections().catch(() => [])).filter((p) => pageIds.has(p.pageId)).map((p) => p.pageName) : [];

  let pass: string | null = null;
  if (m) {
    const rows = (await passRowsOf([id]).catch(() => new Map())).get(id) ?? [];
    const ps = passState(rows, new Date());
    pass = ps.status === "live" ? `${ps.period.kind === "trial" ? "ทดลอง" : "บัตร ฿99"} ถึง ${thaiDate(ps.end)}`
      : ps.status === "expired" ? `หมดเมื่อ ${thaiDate(ps.end)}` : "ยังไม่มีบัตร";
  }
  const tenant = a?.tenant as Row | Row[] | null | undefined;
  const roomName = str(Array.isArray(tenant) ? tenant[0]?.name : tenant?.name).replace(/^Krungthai-AXA Life\s+/i, "") || null;
  const since = str(m?.created_at) || str(firstSeen[0]?.at) || null;

  return {
    id,
    name: a ? (str(a.name).trim() || str(a.agent_code)) : m ? (str(m.name).trim() || str(m.email)) : (str(s?.name).trim() || str(s?.email)),
    kind: a ? "agent" : m ? "member" : "super",
    code: a ? str(a.agent_code) || null : null,
    email: m ? str(m.email) : s ? str(s.email) : null,
    room: roomName,
    unit: a ? str(a.unit).trim() || null : null,
    since: since ? thaiDate(since) : null,
    rights,
    pages: pageNames,
    balanceSatang: w ? Number(w.balance_satang) : null,
    frozen: w?.frozen_at ? str(w.frozen_reason) || "ถูกระงับ" : null,
    pass,
    status: m ? (str(m.status) === "suspended" ? "ถูกระงับ" : "ใช้งานได้") : null,
  };
}

export async function readPersonMonth(id: string, from: Date, to: Date) {
  return readItems({ who: id, from, to, limit: 1000 });
}

/* ------------------------------ everybody ------------------------------ */

/** the newest lines of everybody, for the feed: the last `days` days, `max` lines */
export async function readFeed(days: number, max: number): Promise<{ items: AdminItem[]; names: Record<string, string> }> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const { items } = await readItems({ who: null, from, to, limit: 80 });
  const top = items.slice(0, max);
  const names = await displayNames(top.map((i) => i.by).filter((x): x is string => Boolean(x))).catch(() => ({}));
  return { items: top, names };
}

export interface PersonRow {
  id: string;
  name: string;
  member: boolean;
  code: string | null;
  room: string | null;
  unit: string | null;
  lastLogin: string | null;
  uses30: number;
  aiThb30: number;
  toppedUp30: number;
  spent30: number;
  balanceSatang: number | null;
}

/**
 * Everybody who uses the system: every สมาชิกทั่วไป, everybody on the staff, everybody with a
 * wallet, everybody who signed in or used a tool in the last 30 days. With what they did
 * in those 30 days and their balance now.
 */
export async function readPeople(now = new Date()): Promise<PersonRow[]> {
  const db = supabaseAdmin();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [members, staff, wallets, stats, logins] = await Promise.all([
    readAll("members", (a, b) => db.from("ins_members").select("id").order("created_at").range(a, b), 10_000),
    read("staff", db.from("ins_staff").select("agent_id")),
    walletSummary(since).catch((e) => {
      console.error("people: wallets not read:", e);
      return [];
    }),
    readStats(since, now, now).catch((e) => {
      console.error("people: 30 days not read:", e);
      return null;
    }),
    readAll("logins", (a, b) => db.from("ins_logins").select("agent_id, at").order("at", { ascending: false }).range(a, b), 20_000),
  ]);

  const last = new Map<string, string>();
  for (const l of logins) if (!last.has(str(l.agent_id))) last.set(str(l.agent_id), str(l.at));
  const wallet = new Map(wallets.map((w) => [w.agentId, w]));
  const used = new Map((stats?.people ?? []).map((p) => [p.agentId, p]));

  const ids = new Set<string>([
    ...members.map((m) => str(m.id)), ...staff.map((s) => str(s.agent_id)), ...wallet.keys(), ...used.keys(), ...last.keys(),
  ].filter((i) => UUID.test(i)));
  // super admins have no history worth a row of their own; whoAre finds agents and members only
  const who = await whoAre([...ids]);
  const codes = new Map<string, string>();
  const agentIds = [...ids].filter((i) => who.get(i) && !who.get(i)!.member);
  for (let i = 0; i < agentIds.length; i += 300) {
    for (const r of await read("codes", db.from("agents").select("id, agent_code").in("id", agentIds.slice(i, i + 300)))) codes.set(str(r.id), str(r.agent_code));
  }

  return [...ids].flatMap((id) => {
    const w = who.get(id);
    if (!w) return [];
    const wl = wallet.get(id);
    const u = used.get(id);
    return [{
      id, name: w.name, member: w.member, code: codes.get(id) ?? null, room: w.room, unit: w.unit,
      lastLogin: last.get(id) ?? null,
      uses30: u?.uses ?? 0, aiThb30: u?.thb ?? 0,
      toppedUp30: wl?.toppedUpSatang ?? 0, spent30: wl?.chargedSatang ?? 0,
      balanceSatang: wl ? wl.balanceSatang : null,
    }];
  });
}
