import { chat } from "@/lib/ai/client";
import { parseJsonReply } from "@/lib/ai/json-reply";
import { fallbackLines, HEADLINE_MAX, HOOKS, lineProblem, NOTE_MAX, WRITTEN_HOOKS } from "@/lib/quote-video/brief";
import type { QuoteVideoFacts } from "@/lib/quote-video/script";
import { factLines } from "@/lib/quote-video/writer";
import { bodyName, type AdArt, type AdBodyKey, type AdCtaKey, type AdHookKind, type AdPlan, type AdProduct } from "./keys";
import { allowedNote, bodiesFor, cleanAdPlan, ctasFor, fixedPlan, type nextYear } from "./plan";

/**
 * วิดีโอโฆษณา's writer (owner chose ก ×6 on the mockup, 2026-11-22): a small model writes the whole ad — the
 * hook, 1–3 content scenes, the closing and English photo ideas — from the quote's own figures. Never Claude
 * (owner, 2026-10-11: no Claude at runtime), the video-script lane's small model.
 *
 * Every part is held to the quote by cleanAdPlan. What fails is asked for once more with the reasons while
 * what passed is kept; what fails again is the fixed line. So an ad is always told, the model down or not,
 * and never says a figure the quote does not.
 */

export const AD_WRITER_TASK = "ad-video-script";
const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 1400;
const VOICE_MAX = 150;

type Next = ReturnType<typeof nextYear>;
type Written = Exclude<AdHookKind, "own">;
export type AdPart = "hook" | `body${number}` | "cta";

export interface AdWriteOpts {
  art: AdArt;
  mode: "ai" | "pick";
  /** what the agent asked to stress, ≤ NOTE_MAX; said to the model and kept on the plan */
  brief?: string;
  hook?: AdHookKind;
  body?: AdBodyKey[];
  cta?: AdCtaKey;
  next?: Next;
  /** turns a redraft toward another opening technique */
  seed?: number;
  /** เลือกเอง with hook "own": the agent's own opening line, spoken as typed (still checked) */
  ownHook?: string;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "");
const tidy = (x: unknown): string => str(x).replace(/["“”]/g, "");
const tidyList = (x: unknown): string[] => (Array.isArray(x) ? x.map(tidy).filter(Boolean) : []);

/** what one scene shows, so the model writes the voice that goes with the figure we draw on screen */
function bodyHint(f: QuoteVideoFacts, key: AdBodyKey): string {
  switch (key) {
    case "price": return "ยอดออมของแผน (วันละ หรือ ปีละ) และออมกี่ปี";
    case "cover":
      if (f.product === "ISHIELD") return "โรคร้ายแรงที่คุ้มครอง และเงินก้อนที่ได้ตั้งแต่ระยะเริ่มต้น";
      if (f.product === "IHEALTHY") return "วงเงินค่ารักษาต่อปี";
      return "เงินก้อนที่ครอบครัวได้ถ้าเป็นอะไรไป และคุ้มครองถึงอายุเท่าไร";
    case "value": return "อายุที่ขอเงินก้อนคืนได้มากกว่ายอดออมรวม";
    case "versus": return "ยอดออมรวม เทียบกับเงินก้อนที่แผนนี้ให้";
  }
}

function ctaHint(key: AdCtaKey, next: Next): string {
  switch (key) {
    case "chat": return "ชวนบอกอายุแล้วทักแชทขอใบเสนอ";
    case "line": return "ชวนแอด LINE รับใบเสนอตามอายุ";
    case "comment": return "ชวนคอมเมนต์คำว่า สนใจ";
    case "meet": return "ชวนทักมานัดคุย 15 นาที";
    case "nextyear": return next ? `ถ้ารอปีหน้า ยอดออมขึ้นเป็น${next.per} ${next.said} บาท ชวนคุยวันนี้` : "";
  }
}

/** which picture ideas the ad will draw: none for ก, the first and last scene for ค, every scene for ข */
const photoWant = (art: AdArt): { ends: boolean; body: boolean } => ({ ends: art !== "motion", body: art === "photo" });

interface Ask {
  f: QuoteVideoFacts;
  next: Next;
  art: AdArt;
  brief: string;
  /** keys the model must keep; undefined = it chooses */
  locked?: { hook: AdHookKind; body: AdBodyKey[]; cta: AdCtaKey };
  ownHook?: string;
  suggest?: Written;
  /** parts to (re)write with the reason the last one failed; the rest is context */
  fix?: Record<string, string>;
  /** the plan so far, shown when only some parts are written */
  current?: AdPlan;
  /** only these parts are asked for (rewriteAdPart and the retry) */
  only?: string[];
}

function rules(f: QuoteVideoFacts): string[] {
  return [
    "- ห้ามใช้คำว่า เบี้ย เสียชีวิต ตาย เวนคืน ใช้ \"ออม\" \"ยอดออม\" \"ถ้าเป็นอะไรไป\" \"ขอเงินก้อนคืน\" แทน",
    "- ห้ามพูดถึงผลตอบแทน ดอกเบี้ย เปอร์เซ็นต์ กำไร ห้ามใช้คำว่า การันตี ทันที",
    "- ห้ามใส่ตัวเลขที่ไม่อยู่ในข้อมูลของแผน ห้ามเขียนตัวเลขเป็นคำ (สองล้าน) ห้ามใช้เลขไทย",
    "- ตัวเลขในคำขอของตัวแทน ห้ามนำมาพูด ใช้ได้เฉพาะตัวเลขในข้อมูลของแผน",
    "- ห้ามสัญญาเกินแบบประกัน ห้ามอีโมจิ ห้ามลิงก์ ห้ามทักทาย ห้ามใส่ชื่อลูกค้า",
    ...(f.product === "ISHIELD" ? ["- ห้ามพูดว่ารับเงินได้เลยตั้งแต่วันแรก โรคร้ายแรงคุ้มครองหลัง 90 วันแรก"] : []),
    // ตั้งค่าส่วนตัว (owner, 2026-11-14): the agent hid these instalments; the ad never says them
    ...(f.hide?.includes("monthly") ? ["- ห้ามพูดถึงการจ่ายรายเดือนหรือยอดต่อเดือน ให้พูดเป็นรายปีหรือวันละเท่านั้น"] : []),
    ...(f.hide?.includes("semi") ? ["- ห้ามพูดถึงการจ่ายราย 6 เดือน"] : []),
  ];
}

function prompt(a: Ask): string {
  const { f, next, locked } = a;
  const product = f.product as AdProduct;
  const want = (part: string) => !a.only || a.only.includes(part) || (part === "body" && a.only.some((p) => p.startsWith("body")));
  const photos = photoWant(a.art);
  const wantPhotos = want("photos") && photos.ends;
  const own = locked?.hook === "own";
  const bodies = bodiesFor(f);
  const ctas = ctasFor(next);
  const hookLine = (h: { kind: string; name: string; hint: string }) => `- ${h.kind}: ${h.name} (${h.hint})`;
  const offered = HOOKS.filter((h) => (WRITTEN_HOOKS as string[]).includes(h.kind));

  // the closings go by their hint alone: CTA_NAMES is screen text and one of them says เบี้ย, which an ad's voice never does (owner's house wording, 2026-11-22)
  const choose: string[][] = [];
  if (want("hook")) {
    if (own) choose.push([`ประโยคเปิด (hook) ตัวแทนเขียนเอง ใช้ตามนี้ ไม่ต้องเขียน voice: "${a.ownHook ?? ""}" ให้เขียนแค่ headline ของประโยคนี้`]);
    else if (locked) {
      const h = offered.find((x) => x.kind === locked.hook) ?? offered[0];
      choose.push([`เทคนิคเปิด (hook.kind) ใช้ "${h.kind}": ${h.name} (${h.hint})`]);
    } else {
      choose.push(["เทคนิคเปิด (hook.kind) เลือก 1 แบบ:", ...offered.map(hookLine), ...(a.suggest ? [`รอบนี้ลองเริ่มจาก "${a.suggest}" ถ้าเข้ากับแผน`] : [])]);
    }
  }
  if (want("body")) {
    choose.push(locked
      ? ["ฉากเนื้อหา (body) ตามลำดับนี้ ห้ามเปลี่ยน:", ...locked.body.map((k, i) => `- body${i + 1} "${k}": ${bodyName(k, product)} (${bodyHint(f, k)})`)]
      : ["ฉากเนื้อหา (body[].key) เลือก 1–3 ฉาก ไม่ซ้ำ เรียงตามที่อยากเล่า:", ...bodies.map((k) => `- ${k}: ${bodyName(k, product)} (${bodyHint(f, k)})`)]);
  }
  if (want("cta")) {
    choose.push(locked
      ? [`ปิดท้าย (cta.key) ใช้ "${locked.cta}": ${ctaHint(locked.cta, next)}`]
      // the รอปีหน้า closing is offered only where the age+1 quote prices higher (owner, 2026-11-22)
      : ["ปิดท้าย (cta.key) เลือก 1 แบบ:", ...ctas.map((k) => `- ${k}: ${ctaHint(k, next)}`)]);
  }

  const shape = {
    ...(want("hook") ? { hook: own ? { kind: "own", headline: ["...", "..."] } : { kind: "...", voice: "...", headline: ["...", "..."] } } : {}),
    ...(want("body") ? { body: [{ key: "...", voice: "..." }] } : {}),
    ...(want("cta") ? { cta: { key: "...", voice: "..." } } : {}),
    ...(wantPhotos ? { photos: { hook: "...", close: "...", ...(photos.body ? { body: ["..."] } : {}) } } : {}),
  };
  const fields = [
    ...(want("hook") && !own ? ["hook.voice: ประโยคเปิด 1 ประโยค ไม่เกิน 150 ตัวอักษร ให้คนหยุดดู ห้ามทักทาย"] : []),
    ...(want("hook") ? [`hook.headline: พาดหัวบนจอ 1–2 บรรทัด บรรทัดละไม่เกิน ${HEADLINE_MAX} ตัวอักษร ใจความเดียวกับประโยคเปิด`] : []),
    ...(want("body") ? [`body: ${a.only ? "เฉพาะฉากที่ขอ ใส่ key ของฉากด้วย " : ""}ฉากละ 1 ประโยค ไม่เกิน 150 ตัวอักษร พูดเรื่องของฉากนั้น ระบบจะวาดตัวเลขของฉากบนจอเอง`] : []),
    ...(want("cta") ? ["cta.voice: 1 ประโยค ไม่เกิน 150 ตัวอักษร ชวนติดต่อตามแบบที่เลือก"] : []),
    ...(wantPhotos ? [
      `photos: ไอเดียภาพถ่ายสมจริง เป็นภาษาอังกฤษ ภาพละ 1 ประโยคสั้น: hook = ภาพฉากเปิด, close = ภาพฉากปิด${photos.body ? ", body = array ภาพละฉากเนื้อหาตามลำดับ" : ""}`,
      "photos ห้ามมีตัวอักษรไทย ห้ามมีตัวเลข ห้ามมีข้อความในภาพ เป็นภาพชีวิตจริงที่อบอุ่น ไม่น่ากลัว ไม่มีงานศพ อุบัติเหตุ ห้องฉุกเฉิน",
    ] : []),
  ];

  const context = a.current ? [
    "",
    "คลิปตอนนี้ (ส่วนที่ไม่ได้ขอ ให้คงไว้):",
    `- hook (${a.current.hook.kind}): ${a.current.hook.voice} | พาดหัว: ${a.current.hook.headline.join(" / ")}`,
    ...a.current.body.map((b, i) => `- body${i + 1} (${b.key}): ${b.voice}`),
    `- cta (${a.current.cta.key}): ${a.current.cta.voice}`,
  ] : [];

  return [
    "เขียนบทพากย์ภาษาไทยสำหรับคลิปโฆษณาประกันสั้นแนวตั้งของตัวแทน พูดแบบสบายๆ เป็นกันเอง ผู้หญิงพูด ลงท้าย ค่ะ หรือ คะ (คำถาม)",
    "คลิปมี 3 ท่อน: ประโยคเปิด (hook) → ฉากเนื้อหา 1–3 ฉาก (body) → ปิดท้ายชวนติดต่อ (cta) แต่ละท่อนพูด 1 ประโยค",
    "",
    "ข้อมูลของแผน (ใช้ได้เฉพาะตัวเลขในนี้ เขียนเป็นตัวเลขอารบิก เช่น 79 หรือ 2 ล้าน):",
    ...factLines(f).map((l) => `- ${l}`),
    ...(next ? [`- ถ้ารอปีหน้า (อายุถัดไป) ยอดออมขึ้นเป็น${next.per} ${next.said} บาท`] : []),
    ...(a.brief ? ["", `ตัวแทนอยากเน้น: ${a.brief}`] : []),
    ...context,
    ...choose.flatMap((g) => ["", ...g]),
    "",
    "กฎ:",
    ...rules(f),
    ...(a.fix && Object.keys(a.fix).length ? ["", "รอบก่อนใช้ไม่ได้ เขียนใหม่ตามนี้:", ...Object.entries(a.fix).map(([k, why]) => `- ${k}: ${why}`)] : []),
    "",
    `ตอบเป็น JSON object เดียว รูปแบบ: ${JSON.stringify(shape)}`,
    ...fields.map((x) => `- ${x}`),
  ].join("\n");
}

interface Reply { raw: Record<string, unknown>; model?: string }

async function ask(a: Ask): Promise<Reply> {
  const r = await chat({
    tier: "small", task: AD_WRITER_TASK, json: true, maxTokens: MAX_TOKENS, timeoutMs: TIMEOUT_MS,
    messages: [{ role: "user", content: prompt(a) }],
  });
  return { raw: parseJsonReply<Record<string, unknown>>(r.text) ?? {}, model: r.model };
}

/** the hook as the model wrote it (own: the agent's line with the model's headline) */
function hookOf(raw: Record<string, unknown>, kind: AdHookKind, ownHook?: string): AdPlan["hook"] {
  const h = isObj(raw.hook) ? raw.hook : {};
  return { kind, voice: kind === "own" ? str(ownHook) : tidy(h.voice), headline: tidyList(h.headline) };
}

/**
 * The model's voice for a scene: the entry with that key, else the one in that place when the reply holds
 * exactly the `count` scenes asked for (a model that drops the key but keeps the order).
 */
function bodyVoice(raw: Record<string, unknown>, key: AdBodyKey, i: number, count: number): string {
  const list = Array.isArray(raw.body) ? raw.body.filter(isObj) : [];
  return tidy((list.find((b) => b.key === key) ?? (list.length === count ? list[i] : undefined))?.voice);
}

const ctaVoice = (raw: Record<string, unknown>): string => tidy(isObj(raw.cta) ? raw.cta.voice : "");

/** the picture ideas this art draws, nothing else: a prompt the ad never draws is not worth a retry */
function photosOf(raw: Record<string, unknown>, art: AdArt): Record<string, unknown> {
  const p = isObj(raw.photos) ? raw.photos : {};
  const want = photoWant(art);
  if (!want.ends) return {};
  return { hook: p.hook, close: p.close, ...(want.body && p.body !== undefined ? { body: p.body } : {}) };
}

/** the strings a model reply holds, to tell which kept lines it wrote */
function saidIn(raw: Record<string, unknown>, into: Set<string>) {
  const h = isObj(raw.hook) ? raw.hook : {};
  [tidy(h.voice), ...tidyList(h.headline), ctaVoice(raw)].forEach((s) => s && into.add(s));
  for (const b of Array.isArray(raw.body) ? raw.body.filter(isObj) : []) { const v = tidy(b.voice); if (v) into.add(v); }
}

/**
 * A hook's voice and headline stand or fall together, so the screen says what the voice does: when either
 * took its fixed line, both do. The agent's own line is theirs and stays when it passes.
 */
function wholeHook(f: QuoteVideoFacts, plan: AdPlan, replaced: boolean, ownOk: boolean): AdPlan {
  const kind = plan.hook.kind;
  if (!replaced) return plan;
  const fixed = fallbackLines(f, { hook: kind === "own" ? "question" : kind });
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const fixedVoice = plan.hook.voice === fixed.hook;
  const fixedHead = same(plan.hook.headline, fixed.headline);
  if (kind === "own" && ownOk) return plan;
  if (fixedVoice === fixedHead) return plan;
  return { ...plan, hook: { kind, voice: fixed.hook, headline: fixed.headline } };
}

function finish(
  plan: AdPlan, fixed: string[],
  a: { f: QuoteVideoFacts; mode: "ai" | "pick"; art: AdArt; brief: string; ownOk: boolean }, said: Set<string>, model?: string,
): AdPlan {
  const whole = wholeHook(a.f, plan, fixed.includes("hook"), a.ownOk);
  const lines = [...(whole.hook.kind === "own" ? [] : [whole.hook.voice]), ...whole.hook.headline, ...whole.body.map((b) => b.voice), whole.cta.voice];
  const written = lines.some((l) => said.has(l));
  return {
    ...whole,
    mode: a.mode,
    art: a.art,
    ...(a.brief ? { brief: a.brief } : {}),
    written,
    ...(written && model ? { model } : {}),
  };
}

const briefOf = (b: string | undefined): string => str(b).slice(0, NOTE_MAX);

/**
 * The ad's plan, written by the model and held to the quote. In "ai" mode the model picks the opening
 * technique, the scenes and the closing; in "pick" mode the agent's picks stand and it writes the lines.
 */
export async function writeAdPlan(f: QuoteVideoFacts, opts: AdWriteOpts): Promise<AdPlan> {
  const { art, mode, next } = opts;
  const brief = briefOf(opts.brief);
  const bodies = bodiesFor(f);
  const ctas = ctasFor(next);
  const pick = mode === "pick";

  // เลือกเอง: the agent's keys, held to what this quote can say
  const pickBody = pick ? [...new Set((opts.body ?? []).filter((k) => bodies.includes(k)))].slice(0, 3) : [];
  const locked = pick ? {
    hook: (opts.hook && (opts.hook === "own" || (WRITTEN_HOOKS as string[]).includes(opts.hook)) ? opts.hook : "question") as AdHookKind,
    body: pickBody.length ? pickBody : bodies.slice(0, 2),
    cta: opts.cta && ctas.includes(opts.cta) ? opts.cta : "chat" as AdCtaKey,
  } : undefined;
  const own = locked?.hook === "own";
  const ownHook = own ? str(opts.ownHook) : undefined;
  // a broken own line is replaced by the fixed hook whole (voice and headline); the model cannot mend the agent's words
  const ownOk = own && !lineProblem(ownHook ?? "", f, VOICE_MAX, allowedNote(next));
  const suggest = WRITTEN_HOOKS[Math.abs((opts.seed ?? 0) + f.age) % WRITTEN_HOOKS.length];

  const fallback = (): AdPlan => {
    const p = fixedPlan(f, { art, mode, next, ...(locked ? { hook: locked.hook, body: locked.body, cta: locked.cta } : {}) });
    const hook = ownOk ? { ...p.hook, voice: ownHook! } : p.hook;
    return { ...p, hook, ...(brief ? { brief } : {}) };
  };

  // the reply as a plan to clean: keys the agent locked stand, an own line is the agent's, photos only those drawn
  const normal = (raw: Record<string, unknown>): Record<string, unknown> => {
    const h = isObj(raw.hook) ? raw.hook : {};
    const kind: AdHookKind = locked ? locked.hook : (WRITTEN_HOOKS as string[]).includes(h.kind as string) ? (h.kind as Written) : suggest;
    const hook = hookOf(raw, kind, ownHook);
    if (own && !ownOk) hook.headline = [];
    const body = locked
      ? locked.body.map((key, i, all) => ({ key, voice: bodyVoice(raw, key, i, all.length) }))
      : (Array.isArray(raw.body) ? raw.body.filter(isObj) : []).map((b) => ({ key: b.key, voice: tidy(b.voice) }));
    const c = isObj(raw.cta) ? raw.cta : {};
    const cta = { key: locked ? locked.cta : c.key, voice: ctaVoice(raw) };
    return { hook, body, cta, photos: photosOf(raw, art) };
  };

  const said = new Set<string>();
  const base = { f, next, art, brief, locked, ownHook, suggest: locked ? undefined : suggest };
  let first: Reply;
  try {
    first = await ask(base);
  } catch (e) {
    console.error("ad video plan not written:", e instanceof Error ? e.message : "unknown error");
    return fallback();
  }
  saidIn(first.raw, said);
  const raw1 = normal(first.raw);
  const one = cleanAdPlan(raw1, f, next);
  let plan = one.plan;
  let fixed = one.fixed;
  let model = first.model;

  // the parts worth asking again: an own line that breaks the rules is the agent's to mend, not the model's
  const redo = new Set(one.fixed.filter((p) => !(p === "hook" && own && !ownOk)));
  // no scene fitted the quote: the fixed scenes stand in for all of them, so all are asked again
  const fitted = (raw1.body as { key: unknown }[]).filter((b) => bodies.includes(b.key as AdBodyKey)).length;
  if (!fitted) plan.body.forEach((_, i) => redo.add(`body${i + 1}`));

  if (redo.size) {
    const fix = Object.fromEntries([...redo].map((p) => [p, one.reasons[p] ?? "ไม่ตรงกับแบบประกันนี้"]));
    try {
      const second = await ask({
        ...base, suggest: undefined, fix, current: plan, only: [...redo],
        locked: { hook: plan.hook.kind, body: plan.body.map((b) => b.key), cta: plan.cta.key },
      });
      saidIn(second.raw, said);
      const again = plan.body.map((_, i) => i).filter((i) => redo.has(`body${i + 1}`));
      const raw2 = {
        hook: redo.has("hook") ? hookOf(second.raw, plan.hook.kind, ownHook) : plan.hook,
        body: plan.body.map((b, i) => (again.includes(i) ? { key: b.key, voice: bodyVoice(second.raw, b.key, again.indexOf(i), again.length) } : b)),
        cta: redo.has("cta") ? { key: plan.cta.key, voice: ctaVoice(second.raw) } : plan.cta,
        photos: redo.has("photos") ? photosOf(second.raw, art) : plan.photos,
      };
      ({ plan, fixed } = cleanAdPlan(raw2, f, next));
      model = second.model ?? model;
    } catch (e) {
      // the first round's plan stands, its failing parts already on their fixed lines
      console.error("ad video plan not rewritten:", e instanceof Error ? e.message : "unknown error");
    }
  }
  return finish(plan, fixed, { f, mode, art, brief, ownOk: !own || ownOk }, said, model);
}

/**
 * One part of a plan written anew ("เปลี่ยน" on the form), the rest given as context; cleaned the same way
 * and asked once more with the reason. When it still fails, or the model is down, the plan is unchanged.
 */
export async function rewriteAdPart(f: QuoteVideoFacts, plan: AdPlan, part: AdPart, next: Next): Promise<AdPlan> {
  const index = part.startsWith("body") ? Number(part.slice(4)) - 1 : -1;
  if (part.startsWith("body") && !(index >= 0 && index < plan.body.length)) return plan;
  if (part !== "hook" && part !== "cta" && index < 0) return plan;
  // in เลือกเอง the agent picked the technique; otherwise the model may take another of the five
  const keepKind = plan.mode === "pick" && plan.hook.kind !== "own";
  const brief = briefOf(plan.brief);
  let fix: Record<string, string> | undefined;
  for (let round = 0; round < 2; round++) {
    let reply: Reply;
    try {
      reply = await ask({
        f, next, art: plan.art, brief, current: plan, only: [part],
        locked: part === "hook" && !keepKind ? undefined : { hook: plan.hook.kind, body: plan.body.map((b) => b.key), cta: plan.cta.key },
        fix: { [part]: fix?.[part] ?? "เขียนใหม่ให้ต่างจากเดิม" },
      });
    } catch (e) {
      console.error("ad video part not rewritten:", e instanceof Error ? e.message : "unknown error");
      return plan;
    }
    const raw: Record<string, unknown> = { ...plan };
    if (part === "hook") {
      const h = isObj(reply.raw.hook) ? reply.raw.hook : {};
      const kind = keepKind ? plan.hook.kind : (WRITTEN_HOOKS as string[]).includes(h.kind as string) ? (h.kind as Written) : "question";
      raw.hook = hookOf(reply.raw, kind);
    } else if (part === "cta") {
      raw.cta = { key: plan.cta.key, voice: ctaVoice(reply.raw) };
    } else {
      raw.body = plan.body.map((b, i) => (i === index ? { key: b.key, voice: bodyVoice(reply.raw, b.key, 0, 1) } : b));
    }
    const out = cleanAdPlan(raw, f, next);
    if (!out.fixed.includes(part)) {
      return { ...out.plan, mode: plan.mode, art: plan.art, ...(brief ? { brief } : {}), written: true, ...(reply.model ? { model: reply.model } : {}) };
    }
    fix = { [part]: out.reasons[part] ?? "ใช้ไม่ได้" };
  }
  return plan;
}
