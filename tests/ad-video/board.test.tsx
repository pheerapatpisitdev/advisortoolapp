import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";
import type { AdPlan } from "@/lib/ad-video/keys";
import type { CostView } from "@/lib/quote-video/make";
import type { VideoInput } from "@/lib/quote-video/script";
import { adPhotosPrice, adPrice } from "@/lib/ad-video/make";
import { formatBaht } from "@/lib/wallet/money";

/**
 * The วิดีโอโฆษณา form (studio/ad-video, owner chose ก ×6 on mockup v4, 2026-11-22). The suite has no DOM, so a
 * press is the form's own step (form.ts: the same function the button calls, with the server action handed in) and
 * the screen after it is the form drawn from the state the step leaves. Every action is mocked: nothing here reaches
 * the database or a paid model.
 */

const a = vi.hoisted(() => ({
  draftAdPlan: vi.fn(), redraftAdPart: vi.fn(), previewAd: vi.fn(), makeAdVideo: vi.fn(), myAdVideos: vi.fn(),
}));
vi.mock("@/app/studio/ad-video/actions", () => a);
vi.mock("@/app/studio/quote-video/actions", () => ({
  myCost: vi.fn(), myVideos: vi.fn(), voiceQuota: vi.fn(), clipsMaking: vi.fn(), elevenOff: vi.fn(async () => false),
  removeVideo: vi.fn(), addToCalendar: vi.fn(), calendarCaption: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));

const { AdVideoBoard, AdVideoForm } = await import("@/app/studio/ad-video/AdVideoBoard");
const F = await import("@/app/studio/ad-video/form");

const ages = { LIFEPROTECT: { min: 1, max: 70 }, ISHIELD: { min: 1, max: 65 }, IHEALTHY: { min: 1, max: 70 } };
const ihuPlans = [{ code: "SILVER", name: "Silver" }, { code: "GOLD", name: "Gold" }];
const wallet: CostView = {
  kind: "wallet", balance: "฿500.00", satang: 50_000,
  prices: { videoMotion: { price: "฿10.00", enough: true, satang: DEFAULT_PRICES.videoMotion } },
};
const base = { ages, ihuPlans, prices: DEFAULT_PRICES, cost: wallet, eleven: [], quota: null, pages: [] };
const LINE = "Life Protect x 2 · ชำระเบี้ย 19 ปี · ชาย 35 ปี · ทุน 1,000,000 บาท · มรดก 2,000,000 บาท · ตกวันละ 79 บาท";

const plan2: AdPlan = {
  mode: "ai",
  hook: { kind: "story", voice: "ลูกยังเล็ก บ้านยังผ่อน ถ้าวันหนึ่งคุณไม่อยู่ ใครจะดูแลต่อคะ?", headline: ["ลูกยังเล็ก", "บ้านยังผ่อน"] },
  body: [
    { key: "price", voice: "ออมวันละ 79 บาท ครอบครัวได้เงินก้อนสูงสุด 2 ล้าน ค่ะ" },
    { key: "cover", voice: "ออม 19 ปี แต่คุ้มครองยาวถึงอายุ 99 ค่ะ" },
  ],
  cta: { key: "chat", voice: "ทักมาบอกอายุ รับใบเสนอของคุณได้เลยนะคะ" },
  photos: { hook: "a Thai father holding his baby at home", close: "a Thai family smiling at dinner" },
  art: "mixed",
  written: true,
};
const drafted = { plan: plan2, facts: { line: LINE }, ctas: ["chat", "line", "comment", "nextyear", "meet"], bodies: ["price", "cover", "value", "versus"] };

const start = () => F.startState({ ihuPlans });
const draw = (s: ReturnType<typeof start>, cost: CostView | null = wallet) =>
  renderToStaticMarkup(createElement(AdVideoForm, { ...base, cost, s, dispatch: () => undefined, on: { draft: () => undefined, redraft: () => undefined, make: () => undefined } }));
const rows = (html: string) => [...html.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]);
/** the words of every pressed button, tags stripped */
const pressed = (html: string) => [...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
const text = (html: string) => html.replace(/<[^>]+>/g, "");
const apply = (s: ReturnType<typeof start>, ...acts: Parameters<typeof F.reduce>[1][]) => acts.reduce(F.reduce, s);

beforeEach(() => { for (const f of Object.values(a)) f.mockReset(); });

describe("the วิดีโอโฆษณา form", () => {
  it("opens in AI mode: the AI box with its brief box, no hook, content or closing cards", () => {
    const html = renderToStaticMarkup(createElement(AdVideoBoard, { ...base, initial: [] }));
    expect(html).toContain("✦ ให้ AI เขียน");
    expect(pressed(html).some((w) => w.startsWith("✦ ให้ AI จัดให้ทั้งคลิป"))).toBe(true);
    expect(html).toMatch(/<textarea[^>]*maxLength="100"/);
    expect(html).not.toContain("เขียนเอง");
    expect(html).not.toContain("ตัวเลขช็อก");
    // no plan yet: no rows
    expect(rows(html)).toEqual([]);
    // ค ผสม is the picture mode it opens on, ไวท์บอร์ด the look, 9:16 the only size
    expect(pressed(html).some((w) => w.startsWith("ค · ผสม"))).toBe(true);
    expect(pressed(html)).toContain("ไวท์บอร์ด");
    expect(pressed(html)).toEqual(expect.arrayContaining(["Life Protect", "ชาย", "19 ปี"]));
    expect(html).toContain("9:16");
    expect(html).not.toContain("1:1");
  });

  it("pressing ✦ ให้ AI เขียน asks draftAdPlan for this quote and shows Hook, เนื้อหา 1, เนื้อหา 2, ปิดท้าย with the figures marked", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    const s0 = apply(start(), { type: "set", patch: { brief: "พ่อแม่ลูกเล็ก" } });
    const s1 = F.reduce(s0, await F.draftStep(s0, a.draftAdPlan));
    expect(a.draftAdPlan).toHaveBeenCalledTimes(1);
    const [input, opts] = a.draftAdPlan.mock.calls[0];
    expect(input).toMatchObject({ product: "LIFEPROTECT", variant: "WLF19H", sex: "M", age: 35, sumAssured: 1_000_000, style: "motion", length: "short", size: "portrait", theme: "board" });
    expect(input).not.toHaveProperty("riders");
    expect(input).not.toHaveProperty("budget");
    expect(opts).toMatchObject({ mode: "ai", art: "mixed", brief: "พ่อแม่ลูกเล็ก" });
    const html = draw(s1);
    expect(rows(html)).toEqual(["hook", "body1", "body2", "cta"]);
    for (const w of ["Hook", "เนื้อหา 1", "เนื้อหา 2", "ปิดท้าย"]) expect(html).toContain(w);
    expect(html).toContain("<mark");
    expect(html).toMatch(/<mark[^>]*>79<\/mark>/);
    expect(html).toMatch(/<mark[^>]*>2 ล้าน<\/mark>/);
    expect(html).toContain(LINE);
    // a written plan says nothing about standard lines; "เปลี่ยน" on every part
    expect(html).not.toContain("ใช้ประโยคมาตรฐาน");
    expect(html.split(">เปลี่ยน<").length - 1).toBe(4);
    // the button now asks for another version
    expect(html).toContain("ให้ AI เขียนแบบใหม่");
  });

  it("says ใช้ประโยคมาตรฐาน when the plan was not written by the AI", async () => {
    a.draftAdPlan.mockResolvedValue({ ...drafted, plan: { ...plan2, written: false } });
    const s = F.reduce(start(), await F.draftStep(start(), a.draftAdPlan));
    expect(draw(s)).toContain("ใช้ประโยคมาตรฐาน");
  });

  it("a draft that comes back after the quote changed is not shown", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    const s0 = start();
    const act = await F.draftStep(s0, a.draftAdPlan);
    const moved = apply(s0, { type: "set", patch: { age: 40 } });
    expect(rows(draw(F.reduce(moved, act)))).toEqual([]);
  });

  it("switching to เลือกเอง shows the hook, content and closing cards and hides the AI box and its rows", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    const s1 = F.reduce(start(), await F.draftStep(start(), a.draftAdPlan));
    const html = draw(apply(s1, { type: "set", patch: { mode: "pick" } }));
    for (const w of ["ตัวเลขช็อก", "ถามสะกิด", "สวนความเชื่อ", "เล่าเรื่อง", "ลิสต์ 3 ข้อ", "เขียนเอง"]) expect(html).toContain(w);
    for (const w of ["ราคา", "ความคุ้มครอง", "เงินไม่หาย", "เทียบเก็บเงินเอง"]) expect(html).toContain(w);
    for (const w of ["ทักแชทขอใบเสนอ", "แอด LINE", "นัดคุย 15 นาที"]) expect(html).toContain(w);
    expect(rows(html)).toEqual([]);
    expect(html).not.toContain("✦ ให้ AI เขียน");
    expect(html).not.toMatch(/<textarea[^>]*maxLength="100"/);
  });

  it("offers iHealthy only ราคา and ความคุ้มครอง, and a closing only where the quote has one", () => {
    const s = apply(start(), { type: "set", patch: { mode: "pick" } }, { type: "product", product: "IHEALTHY", ages });
    const p = apply(s, { type: "preview", stamp: s.stamp, preview: { line: "iHealthy", satang: 2000, bodies: ["price", "cover"], ctas: ["chat", "line", "comment", "meet"] } });
    const html = draw(p);
    expect(html).toContain("ความคุ้มครอง");
    expect(html).not.toContain("เงินไม่หาย");
    expect(html).not.toContain("เทียบเก็บเงินเอง");
    expect(html).not.toContain("รอปีหน้าเบี้ยขึ้น");
  });

  it("picking a 4th content scene drops the first, and a lone scene stays picked", () => {
    const s = apply(start(), { type: "set", patch: { mode: "pick" } });
    expect(s.bodies).toEqual(["price", "cover"]);
    const three = apply(s, { type: "body", key: "value" });
    expect(three.bodies).toEqual(["price", "cover", "value"]);
    const four = apply(three, { type: "body", key: "versus" });
    expect(four.bodies).toEqual(["cover", "value", "versus"]);
    // the cards say the order they were tapped in
    expect(text(draw(four))).toContain("เทียบเก็บเงินเอง · ฉาก 3");
    expect(text(draw(four))).toContain("ความคุ้มครอง · ฉาก 1");
    const one = apply(s, { type: "body", key: "cover" });
    expect(one.bodies).toEqual(["price"]);
    expect(apply(one, { type: "body", key: "price" }).bodies).toEqual(["price"]);
  });

  it("asks previewAd for the art and the number of scenes, and the price line says ฿20 for ค with 2 scenes", async () => {
    a.previewAd.mockResolvedValue({ line: LINE, satang: DEFAULT_PRICES.videoMotion + 2 * DEFAULT_PRICES.drawGemini, bodies: ["price", "cover", "value", "versus"], ctas: ["chat", "line", "comment", "meet"] });
    const s0 = start();
    const s1 = F.reduce(s0, await F.previewStep(s0, a.previewAd));
    expect(a.previewAd).toHaveBeenCalledWith(expect.objectContaining({ product: "LIFEPROTECT" }), "mixed", 2);
    const html = draw(s1);
    expect(html).toContain("฿20");
    expect(html).toContain(LINE);
    // a free clip still pays for its photos (R11): said before the press
    const free = draw(s1, { kind: "free", left: 1, of: 3 });
    expect(free).toContain("ใช้วิดีโอฟรี");
    expect(free).toMatch(/ภาพ 2 × ฿5/);
  });

  it("เขียนเอง: a 150-character box, and no เปลี่ยน on the agent's own opening (R13)", async () => {
    const pick = apply(start(), { type: "set", patch: { mode: "pick" } }, { type: "set", patch: { hook: "own", ownHook: "ใครยังไม่มีประกันชีวิต ฟังทางนี้" } });
    expect(draw(pick)).toMatch(/maxLength="150"/);
    a.draftAdPlan.mockResolvedValue({ ...drafted, plan: { ...plan2, mode: "pick", hook: { kind: "own", voice: "ใครยังไม่มีประกันชีวิต ฟังทางนี้", headline: ["ฟังทางนี้"] } } });
    a.makeAdVideo.mockResolvedValue({ ok: true, id: "v1" });
    const acts = await F.makeStep(pick, a.draftAdPlan, a.makeAdVideo);
    // เลือกเอง: the AI writes the lines on สร้างวิดีโอ, then the clip is made from that plan
    expect(a.draftAdPlan.mock.calls[0][1]).toMatchObject({ mode: "pick", hook: "own", ownHook: "ใครยังไม่มีประกันชีวิต ฟังทางนี้", body: ["price", "cover"], cta: "chat", art: "mixed" });
    expect(a.makeAdVideo.mock.calls[0][1]).toMatchObject({ mode: "pick", hook: { kind: "own" } });
    expect(acts.at(-1)).toEqual({ type: "made" });
    // a refusal leaves the plan on screen: the own opening has no เปลี่ยน, the others do
    a.makeAdVideo.mockResolvedValue({ ok: false, error: "x" });
    const shown = (await F.makeStep(pick, a.draftAdPlan, a.makeAdVideo)).reduce(F.reduce, pick);
    const html = draw(shown);
    expect(rows(html)).toEqual(["hook", "body1", "body2", "cta"]);
    expect(html.split(">เปลี่ยน<").length - 1).toBe(3);
  });

  it("an own opening the checker turned down is shown with its reason and nothing is made", async () => {
    const pick = apply(start(), { type: "set", patch: { mode: "pick", hook: "own", ownHook: "วันละ 59 บาท" } });
    a.draftAdPlan.mockResolvedValue({ ...drafted, plan: { ...plan2, mode: "pick", hook: { kind: "own", voice: "มาตรฐาน", headline: ["x"] } }, fixed: ["hook"], reasons: { hook: "ตัวเลข 59 ไม่มีในใบเสนอ" } });
    const html = draw((await F.makeStep(pick, a.draftAdPlan, a.makeAdVideo)).reduce(F.reduce, pick));
    expect(a.makeAdVideo).not.toHaveBeenCalled();
    expect(html).toContain("ตัวเลข 59 ไม่มีในใบเสนอ");
  });

  it("R14: a refused make swaps in the cleaned plan, marks the mended parts, shows the error, and the next press sends that plan", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    let s = F.reduce(start(), await F.draftStep(start(), a.draftAdPlan));
    // the agent's edit carries a figure the quote has not got
    s = apply(s, { type: "edit", part: "body1", text: "ออมแค่วันละ 59 บาท ค่ะ" });
    expect(s.shown?.plan.body[0].voice).toBe("ออมแค่วันละ 59 บาท ค่ะ");
    const cleaned = { ...plan2, body: [{ key: "price" as const, voice: "ออมแค่วันละ 79 บาท ออมเพียง 19 ปี คุ้มครองถึงอายุ 99 ค่ะ" }, plan2.body[1]] };
    a.makeAdVideo.mockResolvedValueOnce({ ok: false, error: "มีบางประโยคใช้ไม่ได้ ระบบแก้ให้แล้ว ตรวจอีกครั้งแล้วกดสร้าง", fixed: ["body1"], reasons: { body1: "ตัวเลข 59 ไม่มีในใบเสนอ" }, plan: cleaned });
    s = (await F.makeStep(s, a.draftAdPlan, a.makeAdVideo)).reduce(F.reduce, s);
    // the shown plan was sent, not drafted again
    expect(a.draftAdPlan).toHaveBeenCalledTimes(1);
    expect(a.makeAdVideo.mock.calls[0][1].body[0].voice).toBe("ออมแค่วันละ 59 บาท ค่ะ");
    const html = draw(s);
    expect(html).toContain("มีบางประโยคใช้ไม่ได้");
    expect(html).toContain("ตัวเลข 59 ไม่มีในใบเสนอ");
    expect(text(html)).toContain("ออมแค่วันละ 79 บาท ออมเพียง 19 ปี");
    a.makeAdVideo.mockResolvedValueOnce({ ok: true, id: "v2" });
    const after = (await F.makeStep(s, a.draftAdPlan, a.makeAdVideo)).reduce(F.reduce, s);
    expect(a.makeAdVideo.mock.calls[1][1]).toMatchObject({ body: cleaned.body });
    // made: the plan leaves the form, so a second press is a new clip
    expect(after.shown).toBeNull();
  });

  it("needContact says where to put the name and phone, as วิดีโอนำเสนอ does", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    a.makeAdVideo.mockResolvedValue({ ok: false, needContact: true, error: "ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน" });
    const s = (await F.makeStep(start(), a.draftAdPlan, a.makeAdVideo)).reduce(F.reduce, start());
    const html = draw(s);
    expect(html).toContain("ใส่ชื่อและเบอร์ในบัญชีของฉันก่อน");
    expect(html).toContain('href="/studio/account"');
  });

  it("เปลี่ยน on one part sends the shown plan and puts the new part in its place", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    const s1 = F.reduce(start(), await F.draftStep(start(), a.draftAdPlan));
    const next = { ...plan2, cta: { key: "line" as const, voice: "แอด LINE รับใบเสนอตามอายุของคุณได้เลยนะคะ" } };
    a.redraftAdPart.mockResolvedValue({ plan: next });
    const s2 = F.reduce(s1, await F.redraftStep(s1, "cta", a.redraftAdPart));
    expect(a.redraftAdPart).toHaveBeenCalledWith(expect.objectContaining({ product: "LIFEPROTECT" }), plan2, "cta");
    expect(draw(s2)).toContain("แอด LINE รับใบเสนอตามอายุของคุณ");
  });
});

describe("the วิดีโอโฆษณา form, fix round 1", () => {
  /** what the server charges for this input with n scenes in this art (ad-video/make.ts), as previewAd answers */
  const stub = (art: AdPlan["art"], n: number): AdPlan => ({
    mode: "ai", hook: { kind: "question", voice: "", headline: [] }, body: Array.from({ length: n }, () => ({ key: "price" as const, voice: "" })),
    cta: { key: "chat", voice: "" }, photos: {}, art, written: false,
  });
  const charged = (v: VideoInput, art: AdPlan["art"], n: number) => adPrice({ ...v, ad: stub(art, n) }, DEFAULT_PRICES);
  const photosOnly = (v: VideoInput, art: AdPlan["art"], n: number) => adPhotosPrice({ ...v, ad: stub(art, n) }, DEFAULT_PRICES);
  const answer = () => a.previewAd.mockImplementation(async (v: VideoInput, art: AdPlan["art"], n: number) => ({ line: LINE, satang: charged(v, art, n), bodies: ["price", "cover", "value", "versus"], ctas: ["chat"] }));

  it("AI mode, ข, nothing written yet: the price is a range from 1 to 3 scenes, each end what the server would charge", async () => {
    answer();
    const s0 = apply(start(), { type: "set", patch: { art: "photo" } });
    const s1 = F.reduce(s0, await F.previewStep(s0, a.previewAd));
    expect(a.previewAd.mock.calls.map((c) => c[2]).sort()).toEqual([1, 3]);
    const v = F.adInput(s0);
    const html = text(draw(s1));
    expect(html).toContain(`${formatBaht(charged(v, "photo", 1))}–${formatBaht(charged(v, "photo", 3))} ตามจำนวนฉากที่ AI เลือก`);
    expect(html).not.toContain(formatBaht(charged(v, "photo", 2)));
    const free = text(draw(s1, { kind: "free", left: 1, of: 3 }));
    expect(free).toContain(`ค่าภาพ 3–5 × ฿5 = ${formatBaht(photosOnly(v, "photo", 1))}–${formatBaht(photosOnly(v, "photo", 3))} ตามจำนวนฉากที่ AI เลือก`);
    // a balance between the two ends is not shut, and says the top may not fit
    const thin: CostView = { ...wallet, kind: "wallet", satang: charged(v, "photo", 2), balance: "฿x" } as CostView;
    expect(text(draw(s1, thin))).toContain("ถ้า AI เลือก 3 ฉากอาจไม่พอ");
  });

  it("once the AI has written, ข is priced at the plan's own number of scenes; ค is never a range", async () => {
    answer();
    a.draftAdPlan.mockResolvedValue({ ...drafted, plan: { ...plan2, art: "photo" } });
    const s0 = apply(start(), { type: "set", patch: { art: "photo" } });
    const s1 = F.reduce(s0, await F.draftStep(s0, a.draftAdPlan));
    const s2 = F.reduce(s1, await F.previewStep(s1, a.previewAd));
    expect(a.previewAd).toHaveBeenLastCalledWith(expect.anything(), "photo", 2);
    expect(text(draw(s2))).toContain(formatBaht(charged(F.adInput(s0), "photo", 2)));
    expect(text(draw(s2))).not.toContain("ตามจำนวนฉากที่ AI เลือก");
    a.previewAd.mockClear();
    await F.previewStep(start(), a.previewAd);
    expect(a.previewAd.mock.calls.map((c) => c[2])).toEqual([2]);
  });

  it("an R14 plan for a quote the form has left is not put up under the new one", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    a.makeAdVideo.mockResolvedValue({ ok: false, error: "มีบางประโยคใช้ไม่ได้", fixed: ["body1"], reasons: { body1: "x" }, plan: plan2 });
    const s0 = start();
    const acts = await F.makeStep(s0, a.draftAdPlan, a.makeAdVideo);
    const moved = apply(s0, { type: "set", patch: { age: 41 } });
    const after = acts.reduce(F.reduce, moved);
    expect(after.shown).toBeNull();
    expect(after.error?.text).toContain("ยังไม่ได้สร้างวิดีโอ");
  });

  it("a clip that started stays started when the desk cannot be read again: no try-again", async () => {
    const act = await F.refreshAfter(true, async () => { throw new Error("offline"); });
    expect(act).toEqual({ type: "notice", text: F.STARTED });
    const html = draw(apply(start(), { type: "made" }, act!));
    expect(html).toContain(F.STARTED);
    expect(html).not.toContain("ลองใหม่");
    expect(await F.refreshAfter(false, async () => { throw new Error("offline"); })).toBeNull();
    expect(await F.refreshAfter(true, async () => undefined)).toBeNull();
  });

  it("says ใช้ประโยคมาตรฐาน over a เลือกเอง plan too", async () => {
    a.draftAdPlan.mockResolvedValue({ ...drafted, plan: { ...plan2, mode: "pick", written: false } });
    a.makeAdVideo.mockResolvedValue({ ok: false, error: "x" });
    const pick = apply(start(), { type: "set", patch: { mode: "pick" } });
    const html = draw((await F.makeStep(pick, a.draftAdPlan, a.makeAdVideo)).reduce(F.reduce, pick));
    expect(rows(html)).toHaveLength(4);
    expect(html).toContain("ใช้ประโยคมาตรฐาน");
  });

  it("แก้คำ is shut while a เปลี่ยน or a make is pending", async () => {
    a.draftAdPlan.mockResolvedValue(drafted);
    const s1 = F.reduce(start(), await F.draftStep(start(), a.draftAdPlan));
    const edits = (h: string) => [...h.matchAll(/<button([^>]*)>แก้คำ<\/button>/g)].map((m) => / disabled=""/.test(m[1]));
    expect(edits(draw(s1))).toEqual([false, false, false, false]);
    for (const what of ["make", "body1"] as const) expect(edits(draw(apply(s1, { type: "busy", what })))).toEqual([true, true, true, true]);
  });
});

describe("the วิดีโอโฆษณา price line before the price is in (owner, 2026-11-22: ฿8 showed for 2 s on load)", () => {
  it("a wallet clip says กำลังคิดราคา and stays shut until previewAd answers, never the bare Motion price", () => {
    const html = text(draw(start()));
    expect(html).toContain("กำลังคิดราคา");
    expect(html).not.toContain(formatBaht(DEFAULT_PRICES.videoMotion));
    expect(F.adCostLine(wallet, DEFAULT_PRICES, start())?.blocked).toBe(true);
  });

  it("once previewAd answers, the line is the whole clip's price", () => {
    const s = F.reduce(start(), { type: "preview", stamp: 0, preview: { line: LINE, satang: 2000, bodies: ["price", "cover"], ctas: ["chat"] } });
    expect(text(draw(s))).toContain(formatBaht(2000));
    expect(F.adCostLine(wallet, DEFAULT_PRICES, s)?.blocked).toBe(false);
  });
});
