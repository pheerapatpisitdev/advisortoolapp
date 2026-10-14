/**
 * สถิติการใช้งาน: which tools people use most and what each costs (owner, 2026-10-14; mockup
 * https://claude.ai/artifact/59yop6T2WvJ4bH5ZRRkane). /admin/stats draws what this returns.
 *
 * Pure: the reader (usage-read.ts) hands over the rows, this counts them, and the tests check it.
 *
 * What counts as one use:
 * - an AI round or a question: one `ask_id` in the AI ledger, the tool named by the most
 *   telling task inside it (TASK_RANK). The ledger has known who since WHO_FROM; before that,
 *   an agent's rounds are read from ins_audit instead, and the owner's (never written there) are
 *   not known.
 * - a วิดีโอนำเสนอ clip, an FHC customer saved, a post put on a Page, an ad sent: one row each.
 * - a calculator page opened by someone signed in (ins_tool_opens, counted from 2026-10-14).
 *
 * The cost is the AI ledger's baht: what the providers were paid. Lines no person asked for
 * (the customer bots, the owner's tests) are kept apart as งานของระบบ.
 */

export type ToolKey = "ask" | "post" | "draw" | "video" | "write" | "claim" | "describe" | "fhc" | "clip" | "thumbnail" | "ads" | "calc";

export const TOOLS: Record<ToolKey, { name: string; sub: string }> = {
  ask: { name: "ถาม AI", sub: "ผู้ช่วยตัวแทน ในหน้า /ask" },
  post: { name: "โพสต์ / ตั้งเวลาโพสต์ขึ้นเพจ", sub: "Studio → เพจ" },
  draw: { name: "วาดภาพ", sub: "Studio · ภาพประกอบโพสต์" },
  video: { name: "วิดีโอนำเสนอ", sub: "ทุกแบบประกัน" },
  write: { name: "เขียนโพสต์ Organic", sub: "Studio · เขียน หาทีม ความรู้ คำคม ฯลฯ" },
  claim: { name: "รีวิวเคลม", sub: "Studio · อ่านเอกสารเคลม" },
  describe: { name: "ถอดรูปเป็น prompt", sub: "Studio" },
  fhc: { name: "Financial Health Check", sub: "บันทึกลูกค้า FHC" },
  clip: { name: "ถอดเสียงคลิป / ตัดต่อ", sub: "Studio · คลิป" },
  thumbnail: { name: "ภาพปกคลิป", sub: "Studio" },
  ads: { name: "ยิงแอด", sub: "Ads Studio" },
  calc: { name: "เปิดเครื่องคำนวณ", sub: "หน้าแบบประกัน · นับตั้งแต่ 14 ต.ค. 2569" },
};

/** from here on every ledger line made for a person says who (20261015_usage_ledger_who) */
export const WHO_FROM = new Date("2026-10-10T03:24:00Z");

type Bucket = ToolKey | "bot" | "system";

/** which tool a ledger task was spent on */
export function taskTool(task: string): Bucket {
  if (task.startsWith("quote-video")) return "video";
  if (task.startsWith("content-claim")) return "claim";
  if (task.startsWith("content-describe")) return "describe";
  if (task.startsWith("content-thumbnail")) return "thumbnail";
  if (task === "content-clip" || task === "content-edit") return "clip";
  if (task.startsWith("content-image-test")) return "system";
  if (task.startsWith("content-image")) return "draw";
  if (task === "content-bakeoff" || task === "content-claimcheck-test") return "system";
  if (task.startsWith("content")) return "write";
  if (["copilot", "library", "doc_qa", "search", "faq-search"].includes(task)) return "ask";
  if (task === "fhc-summary" || task.startsWith("plan-")) return "fhc";
  if (/^(route|plan_info|small_?talk)/.test(task)) return "bot";
  return "system";
}

/** an ask that wrote a post and drew its picture was a writing round: the first of these present names it */
const TASK_RANK: Bucket[] = ["video", "claim", "describe", "thumbnail", "clip", "write", "draw", "ask", "fhc"];

/** the tools whose uses are the ledger's asks; the rest are counted from their own tables */
const ASK_TOOLS = new Set<Bucket>(["ask", "write", "draw", "claim", "describe", "thumbnail", "clip"]);

/** an agent's audit line for a round, before WHO_FROM */
export const ROUND_TOOL: Record<string, ToolKey> = {
  "ai-write": "write", "ai-recruit": "write", "ai-knowledge": "write", "ai-draft": "write", "ai-thanks": "write",
  "ai-showcase": "write", "ai-saying": "write", "ai-draw": "draw", "ai-claim": "claim", "ai-clip": "clip",
  "ai-edit": "clip", "ai-describe": "describe",
};

const VIDEO_PLAN: Record<string, string> = {
  LIFEPROTECT: "Life Protect", ISHIELD: "iShield", IHEALTHY: "iHealthy Ultra", PENSION: "บำนาญ 95", LEGACY: "มรดก", PLB: "Protection Life",
};

export interface StatsInput {
  from: Date;
  to: Date;
  now: Date;
  ledger: { task: string; agentId: string | null; askId: string | null; thb: number; at: string }[];
  rounds: { action: string; agentId: string; at: string }[];
  posts: { agentId: string; at: string }[];
  videos: { agentId: string; at: string; product: string | null; fhc: boolean }[];
  customers: { agentId: string; at: string }[];
  sends: { agentId: string; at: string }[];
  /** `name`: the calculator's name from the menu */
  opens: { agentId: string; name: string; at: string }[];
  wallet: { agentId: string; kind: string; satang: number; at: string }[];
}

export interface ToolRow { key: ToolKey; name: string; sub: string; uses: number; people: number; thb: number; parts: { name: string; uses: number }[] }
export interface SystemRow { key: "bot" | "system"; name: string; sub: string; calls: number; thb: number }
export interface PersonRow { agentId: string; uses: number; topTool: string; thb: number; paidSatang: number }

export interface Stats {
  tools: ToolRow[];
  system: SystemRow[];
  people: PersonRow[];
  daily: { day: string; uses: number }[];
  totals: { people: number; uses: number; thbUser: number; thbSystem: number; topupSatang: number; topups: number; chargedSatang: number };
}

const TZ = "Asia/Bangkok";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

interface Use { tool: ToolKey; agentId: string; at: string; part?: string }

export function buildStats(s: StatsInput): Stats {
  const uses: Use[] = [];
  const thb = new Map<Bucket, number>();
  const calls = new Map<Bucket, number>();
  const add = (m: Map<Bucket, number>, k: Bucket, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  const personThb = new Map<string, number>();

  // the ledger: cost by tool, and each person's ask as one use
  const asks = new Map<string, { agentId: string; at: string; buckets: Set<Bucket>; thb: number }>();
  for (const l of s.ledger) {
    if (l.agentId) personThb.set(l.agentId, (personThb.get(l.agentId) ?? 0) + l.thb);
    const task = taskTool(l.task);
    // the /ask chat runs the bots' own brain (route, plan_info…): with a person on it, it is ถาม AI
    const b: Bucket = l.askId && l.agentId && (task === "bot" || task === "system") ? "ask" : task;
    if (l.askId && l.agentId) {
      const a = asks.get(l.askId) ?? { agentId: l.agentId, at: l.at, buckets: new Set<Bucket>(), thb: 0 };
      a.buckets.add(b);
      a.thb += l.thb;
      if (l.at < a.at) a.at = l.at;
      asks.set(l.askId, a);
      continue;
    }
    add(thb, b, l.thb);
    add(calls, b, 1);
  }
  for (const a of asks.values()) {
    const tool = TASK_RANK.find((b) => a.buckets.has(b)) as ToolKey;
    add(thb, tool, a.thb);
    if (ASK_TOOLS.has(tool)) uses.push({ tool, agentId: a.agentId, at: a.at });
  }

  for (const r of s.rounds) {
    const tool = ROUND_TOOL[r.action];
    if (tool && new Date(r.at) < WHO_FROM) uses.push({ tool, agentId: r.agentId, at: r.at });
  }
  for (const p of s.posts) uses.push({ tool: "post", agentId: p.agentId, at: p.at });
  for (const v of s.videos) {
    uses.push({ tool: "video", agentId: v.agentId, at: v.at, part: v.fhc ? "สรุป FHC" : VIDEO_PLAN[v.product ?? "LIFEPROTECT"] ?? "อื่น ๆ" });
  }
  for (const c of s.customers) uses.push({ tool: "fhc", agentId: c.agentId, at: c.at });
  for (const a of s.sends) uses.push({ tool: "ads", agentId: a.agentId, at: a.at });
  for (const o of s.opens) uses.push({ tool: "calc", agentId: o.agentId, at: o.at, part: o.name });

  // the tools
  const tools: ToolRow[] = (Object.keys(TOOLS) as ToolKey[]).map((key) => {
    const mine = uses.filter((u) => u.tool === key);
    const parts = new Map<string, number>();
    for (const u of mine) if (u.part) parts.set(u.part, (parts.get(u.part) ?? 0) + 1);
    return {
      key, ...TOOLS[key], uses: mine.length, people: new Set(mine.map((u) => u.agentId)).size, thb: thb.get(key) ?? 0,
      parts: [...parts].map(([name, n]) => ({ name, uses: n })).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name)),
    };
  }).filter((t) => t.uses > 0 || t.thb > 0)
    .sort((a, b) => b.uses - a.uses || b.thb - a.thb);

  const system: SystemRow[] = [
    { key: "bot" as const, name: "บอทแชท Messenger / LINE", sub: "ตอบลูกค้าบนเพจ", calls: calls.get("bot") ?? 0, thb: thb.get("bot") ?? 0 },
    { key: "system" as const, name: "งานอื่นของระบบ", sub: "ทบทวนแชท ฝึกบอท ทดสอบของเจ้าของ", calls: calls.get("system") ?? 0, thb: thb.get("system") ?? 0 },
  ].filter((r) => r.calls > 0);

  // the people
  const paid = new Map<string, number>();
  let topupSatang = 0, topups = 0, chargedSatang = 0;
  for (const w of s.wallet) {
    if (w.kind === "topup") { topupSatang += w.satang; topups++; }
    if (w.kind === "charge") { chargedSatang -= w.satang; paid.set(w.agentId, (paid.get(w.agentId) ?? 0) - w.satang); }
  }
  const byPerson = new Map<string, Use[]>();
  for (const u of uses) byPerson.set(u.agentId, [...(byPerson.get(u.agentId) ?? []), u]);
  const everyone = new Set([...byPerson.keys(), ...personThb.keys()]);
  const people: PersonRow[] = [...everyone].map((agentId) => {
    const mine = byPerson.get(agentId) ?? [];
    const count = new Map<ToolKey, number>();
    for (const u of mine) count.set(u.tool, (count.get(u.tool) ?? 0) + 1);
    const top = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return { agentId, uses: mine.length, topTool: top ? TOOLS[top[0]].name : "–", thb: personThb.get(agentId) ?? 0, paidSatang: paid.get(agentId) ?? 0 };
  }).sort((a, b) => b.uses - a.uses || b.thb - a.thb);

  // the days, every one in the range up to today, empty ones too
  const perDay = new Map<string, number>();
  for (const u of uses) perDay.set(ymd(new Date(u.at)), (perDay.get(ymd(new Date(u.at))) ?? 0) + 1);
  const daily: { day: string; uses: number }[] = [];
  const last = ymd(new Date(Math.min(s.to.getTime() - 1, s.now.getTime())));
  for (let d = ymd(s.from); d <= last; d = ymd(new Date(new Date(`${d}T12:00:00+07:00`).getTime() + 86_400_000))) {
    daily.push({ day: d, uses: perDay.get(d) ?? 0 });
  }

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    tools, system, people, daily,
    totals: {
      people: byPerson.size, uses: uses.length,
      thbUser: sum(tools.map((t) => t.thb)), thbSystem: sum(system.map((r) => r.thb)),
      topupSatang, topups, chargedSatang,
    },
  };
}

/** the period chips: the last 7 or 30 days, this month, or a month by "2026-09" */
export type Period = "7d" | "30d" | "month" | `${number}-${number}`;

export const FIRST_MONTH = "2026-09";

const monthStartOf = (m: string) => new Date(`${m}-01T00:00:00+07:00`);
const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};
const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
};

export function parsePeriod(v: unknown, now: Date): Period {
  if (v === "7d" || v === "30d" || v === "month") return v;
  const thisMonth = ymd(now).slice(0, 7);
  if (typeof v === "string" && /^20\d\d-(0[1-9]|1[0-2])$/.test(v) && v >= FIRST_MONTH && v < thisMonth) return v as Period;
  return "month";
}

/** [from, to) of a period; the rolling ones start at midnight Bangkok, so their days are whole */
export function periodRange(p: Period, now: Date): [Date, Date] {
  const today = new Date(`${ymd(now)}T00:00:00+07:00`);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (p === "7d") return [new Date(tomorrow.getTime() - 7 * 86_400_000), tomorrow];
  if (p === "30d") return [new Date(tomorrow.getTime() - 30 * 86_400_000), tomorrow];
  const m = p === "month" ? ymd(now).slice(0, 7) : p;
  return [monthStartOf(m), monthStartOf(nextMonth(m))];
}

/** the past months a chip is offered for, newest first, back to FIRST_MONTH */
export function pastMonths(now: Date): string[] {
  const out: string[] = [];
  for (let m = prevMonth(ymd(now).slice(0, 7)); m >= FIRST_MONTH; m = prevMonth(m)) out.push(m);
  return out;
}

export const monthLabel = (m: string) =>
  new Date(`${m}-15T12:00:00+07:00`).toLocaleDateString("th-TH", { timeZone: TZ, month: "short", year: "numeric" });
