import { describe, expect, it } from "vitest";
import { cleanLine, cleanMore, cleanPhone } from "@/lib/quote-video/contact";
import { buildJob, concatList, mixNarration, nameFiles, pcmSeconds } from "@/lib/quote-video/job";
import { cleanCustomerName, pageCaption, quoteVideoFacts, quoteVideoScript, sceneMotion, spokenBaht } from "@/lib/quote-video/script";
import { videoStartFrom, videoStartHref } from "@/lib/quote-video/link";
import { motionWindows, MOTION_FPS } from "@/lib/quote-video/motion";
import { cleanBudget, resolveBudget } from "@/lib/quote-video/budget";
import { clipLength, LEAD, planScenes, XFADE } from "@/lib/quote-video/timeline";
import { beatCues, penBeats } from "@/lib/quote-video/pen";
import { tablePlan } from "@/lib/quote-video/table-pen";
import { tableY } from "@/lib/quote-video/job";

const TODAY = new Date("2026-10-11T00:00:00+07:00");
const input = { variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };

describe("quote video script", () => {
  const f = quoteVideoFacts(input, TODAY)!;

  it("takes the card's and the table's figures", () => {
    expect(f.lead).toMatchObject({ label: "มรดก", amount: "2,000,000", baht: 2_000_000 });
    expect(f.perDayAmount).toBe("79");
    expect(f.spokenPrice).toEqual({ per: "เดือนละ", amount: "2,583" });
    expect(f.payYears).toBe(19);
    expect(f.lastPayAge).toBe(53);
    expect(f.totalPaid).toBe("545,300");
    expect(f.breakEven).toMatchObject({ age: 64, cash: "553,000" });
    expect(f.coverToAge).toBe(99);
  });

  it("speaks the owner's approved lines", () => {
    const lines = quoteVideoScript(f, "คุณสมชาย").map((s) => s.voice);
    expect(lines[0]).toBe("สวัสดีค่ะ คุณสมชาย ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ อายุ 35 ทำทุน 1 ล้าน ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 2 ล้านบาทค่ะ");
    expect(lines[1]).toBe("ออมแค่วันละ 79 บาท หรือเดือนละ 2,583 บาท ออมเพียง 19 ปีก็ครบ ยอดออมเท่าเดิมตลอดค่ะ");
    expect(lines[2]).toBe("ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้ 2 ล้าน หลังจากนั้นได้ 1 ล้าน และดูแลยาวไปถึงอายุ 99 เลยค่ะ");
    expect(lines[3]).toBe("ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน ออมครบตอนอายุ 53 แล้วเงินก็ยังโตทุกปี พออายุ 64 ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ 553,000 บาท มากกว่าที่ออมไปทั้งหมดแล้วค่ะ");
    expect(lines[4]).toBe("คุณสมชายสนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
  });

  it("ends every line with ครับ when a man reads it (owner, 2026-10-11)", () => {
    const lines = quoteVideoScript(f, "สมชาย", "M").map((s) => s.voice);
    expect(lines[0]).toBe("สวัสดีครับ คุณสมชาย ขอเล่าแผนนี้ให้ฟังสั้นๆ นะครับ อายุ 35 ทำทุน 1 ล้าน ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 2 ล้านบาทครับ");
    expect(lines[4]).toBe("คุณสมชายสนใจ ทักมาคุยกันได้เลยนะครับ ยินดีช่วยดูแผนให้ครับ");
    for (const l of lines) expect(l).not.toMatch(/ค่ะ|คะ/);
  });

  it("tells จ่ายถึงอายุ 99 without a paying term that ends (owner, 2026-10-11)", () => {
    const g = quoteVideoFacts({ variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    expect(g.payToEnd).toBe(true);
    expect(g.pills).toEqual(["จ่ายเบี้ยถึงอายุ 99", "เบี้ยคงที่ตลอด"]);
    expect(g.penNote).toBeUndefined();
    const lines = quoteVideoScript(g).map((s) => s.voice);
    expect(lines[1]).toContain("ออมสบายๆ ถึงอายุ 99");
    for (const l of lines) expect(l).not.toMatch(/ก็จบ|ก็ครบ|ออมครบตอนอายุ/);
  });

  it("says ออม, not จ่าย, for a plan that builds cash (owner, 2026-10-11)", () => {
    for (const l of quoteVideoScript(f).map((s) => s.voice)) expect(l).not.toMatch(/จ่าย|ค่าใช้จ่าย/);
  });

  it("says คุณผู้ชาย / คุณผู้หญิง without a name", () => {
    const lines = quoteVideoScript(f).map((s) => s.voice);
    expect(lines[0]).toContain("คุณผู้ชายอายุ 35");
    expect(lines[4]).toBe("สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
  });

  it("cleans names and says sums", () => {
    expect(cleanCustomerName("  คุณ สมชาย!! <b> ")).toBe("สมชาย b");
    expect(cleanCustomerName(undefined)).toBe("");
    expect(spokenBaht(1_500_000)).toBe("1.5 ล้าน");
    expect(spokenBaht(750_000)).toBe("750,000");
  });

  it("refuses an age the plan does not sell at", () => {
    expect(quoteVideoFacts({ ...input, age: 90 }, TODAY)).toBeUndefined();
  });
});

describe("quote video timeline and job", () => {
  const f = quoteVideoFacts(input, TODAY)!;
  const script = quoteVideoScript(f);
  const secs = [12, 10, 9, 16, 4.5];
  const pen = tablePlan(f, script[3].voice, secs[3]);
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], ...sceneMotion(f, s.key), ...(s.key === "value" ? { table: pen.plan } : {}) })));

  it("overlaps scenes by the cross-fade and starts each voice after LEAD", () => {
    for (let i = 1; i < plans.length; i++) expect(plans[i].start).toBeCloseTo(plans[i - 1].start + plans[i - 1].dur - XFADE, 3);
    for (const p of plans) expect(p.voiceAt).toBeCloseTo(p.start + LEAD, 3);
    expect(clipLength(plans)).toBeCloseTo(plans[4].start + plans[4].dur, 3);
  });

  it("makes frames in time order, starting at 0, ending with every word said", () => {
    for (const p of plans) {
      expect(p.frames[0].t).toBe(0);
      for (let k = 1; k < p.frames.length; k++) expect(p.frames[k].t).toBeGreaterThan(p.frames[k - 1].t);
      const words = script.find((s) => s.key === p.key)!.voice.split(" ").length;
      expect(p.frames[p.frames.length - 1].state.word).toBe(words);
    }
    // every pen note written and handed over to the table's layers by the scene's end
    const value = plans.find((p) => p.key === "value")!;
    expect(value.frames.at(-1)!.state.pen).toEqual([2, 2, 2, 2, 2]);
  });

  it("lists frames for the concat demuxer and builds one command", () => {
    const layers = plans.map((p) => (p.key === "lead" ? "photo" as const : p.key === "value" ? "table" as const : undefined));
    const named = nameFiles(plans, layers, plans.map((p) => (p.key === "value" ? pen.notes.length : 0)));
    const list = concatList(plans[0], named.scenes[0].frames);
    expect(list.startsWith("ffconcat version 1.0\n")).toBe(true);
    expect(list.trim().split("\n").at(-1)).toBe(`file ${named.scenes[0].frames.at(-1)}`);
    const job = buildJob(plans, named, { tableHeight: 3000 });
    // the five finished notes ride on the table, each shown from when it is written
    expect(named.files.filter((x) => x.kind === "pen")).toHaveLength(5);
    expect(job.command.match(/overlay=0:0:enable='gte\(t,/g)).toHaveLength(5);
    expect(job.command).toContain("xfade=transition=slideleft");
    expect(job.command).toContain("zoompan=");
    expect(job.command).toContain("-f concat -safe 0 -i {{");
    expect(job.inputNames[0]).toBe("in_1");
    expect(new Set(named.files.map((x) => x.name)).size).toBe(named.files.length);
  });

  it("lays the narration on one WAV", () => {
    const pcm = Buffer.alloc(24000 * 2, 1);
    const wav = mixNarration([{ pcm, at: 0.5 }], 2);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.length).toBe(44 + 2 * 24000 * 2);
    expect(wav.readUInt8(44 + 24000 * 2 * 0.5 - 1)).toBe(0);
    expect(wav.readUInt8(44 + 24000 * 2 * 0.5)).toBe(1);
    expect(pcmSeconds(pcm)).toBe(1);
  });
});

describe("pen notes on the value scene (owner, 2026-10-13)", () => {
  const f = quoteVideoFacts(input, TODAY)!;
  const voice = quoteVideoScript(f)[3].voice;

  it("writes the card's five notes for Life Protect paid 19 years, each on its own word", () => {
    expect(penBeats(f)).toEqual(["steady", "stop", "growth", "breakEven", "gain"]);
    const cues = beatCues(penBeats(f), voice, 16);
    const said = (w: string) => voice.split(" ").findIndex((x) => x.startsWith(w));
    expect(said("ออมครบ")).toBeGreaterThan(0);
    for (let i = 1; i < cues.length; i++) expect(cues[i].at).toBeGreaterThan(cues[i - 1].at);
  });

  it("has nothing to stop on a plan paid to 99", () => {
    const to99 = quoteVideoFacts({ ...input, variant: "WLF99H" }, TODAY)!;
    expect(penBeats(to99)).not.toContain("stop");
  });

  it("moves the table only while no note is being written, and never past its foot", () => {
    const { plan, notes } = tablePlan(f, voice, 16);
    expect(notes.map((n) => n.beat)).toEqual(["steady", "stop", "growth", "breakEven", "gain"]);
    for (const m of plan.moves) {
      for (const d of plan.draws) expect(m.at + m.dur <= d.at + 1e-6 || m.at >= d.at + d.dur).toBe(true);
      expect(m.to).toBeLessThanOrEqual((f.rows!.length * 52) - 760);
    }
    // the break-even comes to stand about a third of the way down the window
    const be = notes.find((n) => n.beat === "breakEven")!;
    expect(be.at).toBe(f.breakEven!.index * 52 - 228);
  });

  it("moves the table in eased steps, each from where the last left it", () => {
    expect(tableY([])).toBe("0");
    const y = tableY([{ at: 1, dur: 1, to: 300 }, { at: 3, dur: 1, to: 500 }]);
    expect(y).toContain("(300)*");
    expect(y).toContain("(200)*");
  });

  it("writes iShield's notes too", () => {
    const ish = quoteVideoFacts({ product: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    expect(penBeats(ish)).toContain("breakEven");
    expect(tablePlan(ish, quoteVideoScript(ish)[3].voice, 15).notes.length).toBeGreaterThan(2);
  });
});

describe("iShield and iHealthy Ultra clips (owner, 2026-10-11)", () => {
  it("leads iShield with the critical-illness lump sum and walks its value table", () => {
    const f = quoteVideoFacts({ product: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    expect(f.lead).toMatchObject({ label: "รับเงินก้อนสูงสุดเมื่อตรวจพบโรคร้ายแรง", amount: "1,000,000", note: "คุ้มครอง 70 โรค · จ่ายตั้งแต่ระยะเริ่มต้น" });
    expect(f.breakEven).toMatchObject({ age: 60, cash: "676,000" });
    expect(f.pills).toEqual(["จ่ายเบี้ยแค่ 10 ปี", "เบี้ยเท่าเดิมทุกปี"]);
    expect(f.cover.map((r) => r.label)).toEqual(["ตรวจพบระยะเริ่มต้น (20 โรค) ต่อโรค", "ระยะรุนแรง (50 โรค) รวมสูงสุด", "เสียชีวิต", "อยู่ครบสัญญาอายุ 85 ปี"]);
    const lines = quoteVideoScript(f, "สมชาย").map((s) => s.voice);
    // the owner's corrected wording (2026-10-11): early stage first, the major stage "รวมสูงสุด", nothing stacked
    expect(lines[0]).toBe("สวัสดีค่ะ คุณสมชาย ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ อายุ 35 ทำทุน 1 ล้าน คุ้มครองโรคร้ายแรง 70 โรค จ่ายเป็นเงินก้อนตั้งแต่ระยะเริ่มต้นเลยค่ะ");
    expect(lines[1]).toBe("ออมแค่วันละ 184 บาท หรือเดือนละ 6,028 บาท เบี้ยเท่าเดิมทุกปี ออมเพียง 10 ปีก็ครบ แต่ดูแลยาวถึงอายุ 85 เลยค่ะ");
    expect(lines[2]).toBe("เจอระยะเริ่มต้น 20 โรค รับก่อนเลยโรคละ 250,000 เป็นคนละโรคก็เคลมได้อีก ถ้าถึงระยะรุนแรง 50 โรค รับรวมสูงสุด 1 ล้าน ถ้าไม่ได้เคลมเลย เป็นอะไรไปครอบครัวได้ 1 ล้าน อยู่ครบอายุ 85 ก็รับคืน 1 ล้านค่ะ");
    expect(lines[3]).toContain("พออายุ 60 ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ 676,000 บาท");
    for (const l of lines) expect(l).not.toContain("ทันที");
    expect(sceneMotion(f, "cover")).toEqual({ sweeps: 4, spread: true });
  });

  it("leads iHealthy with the yearly ceiling, says a first-year price and compares the plans picked", () => {
    const f = quoteVideoFacts({ product: "IHEALTHY", age: 35, sex: "M", plan: "GOLD", compare: ["SILVER", "DIAMOND"] }, TODAY)!;
    expect(f.lead).toMatchObject({ label: "วงเงินค่ารักษาต่อปี", baht: 25_000_000 });
    expect(f.perDayAmount).toBeUndefined();
    expect(f.compare?.map((p) => [p.name, p.main])).toEqual([["Silver", false], ["Gold", true], ["Diamond", false]]);
    const lines = quoteVideoScript(f, "สมชาย");
    expect(lines.map((s) => s.key)).toEqual(["lead", "price", "cover", "compare", "contact"]);
    expect(lines[0].voice).toBe("สวัสดีค่ะ คุณสมชาย ขอเล่าแผนประกันสุขภาพนี้ให้ฟังสั้นๆ นะคะ แผน Gold เหมาจ่ายค่ารักษาสูงสุดถึง 25 ล้านบาทต่อปีค่ะ");
    expect(lines[1].voice).toBe("ปีแรกค่าใช้จ่ายเดือนละ 3,524 บาท รวมประกันชีวิตกับค่าชดเชยรายวันไว้แล้วค่ะ");
    expect(lines[2].voice).toBe("ค่าห้องวันละ 9,000 บาท ผ่าตัดเล็ก อุบัติเหตุ และรักษามะเร็ง จ่ายตามจริง มีผู้ป่วยนอกปีละ 12,000 บาท และนอนโรงพยาบาลรับเพิ่มวันละ 1,000 บาทค่ะ");
    expect(lines[3].voice).toBe("ถ้าอยากเทียบ แผน Silver วงเงิน 15 ล้าน เดือนละ 2,768 บาท และแผน Diamond วงเงิน 70 ล้าน เดือนละ 6,152 บาท ต่ออายุได้ถึงอายุ 98 เลยค่ะ");
  });

  it("skips the comparison when no other plan is picked", () => {
    const f = quoteVideoFacts({ product: "IHEALTHY", age: 35, sex: "F", plan: "SILVER", compare: [] }, TODAY)!;
    expect(f.compare).toBeUndefined();
    expect(quoteVideoScript(f).map((s) => s.key)).toEqual(["lead", "price", "cover", "contact"]);
  });
});

describe("shortcut and Page caption (owner, 2026-10-11)", () => {
  it("carries a plan page's quote into the Studio form and reads it back", () => {
    const href = videoStartHref({ product: "ISHIELD", sex: "F", age: 40, sumAssured: 2_000_000, variant: "WLCI20" });
    expect(href).toBe("/studio/quote-video?product=ISHIELD&sex=F&age=40&sum=2000000&variant=WLCI20");
    const q = Object.fromEntries(new URL(href, "https://x").searchParams);
    expect(videoStartFrom(q)).toEqual({ product: "ISHIELD", sex: "F", age: 40, sumAssured: 2_000_000, variant: "WLCI20" });
    expect(videoStartFrom({ product: "EASYPROTECT" })).toBeUndefined();
    expect(videoStartFrom({ product: "IHEALTHY", plan: "<script>", age: "abc" })).toEqual({ product: "IHEALTHY" });
  });

  it("writes a Page caption from the clip's figures, never a name", () => {
    const f = quoteVideoFacts({ variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    expect(pageCaption(f)).toBe("มรดก 2 ล้าน สำหรับครอบครัว\nคุณผู้ชายอายุ 35 ทุน 1 ล้าน ตกวันละ 79 บาท จ่ายแค่ 19 ปี\nคุ้มครองถึงอายุ 99 · เงินไม่หายไปไหน เวนคืนได้\n\nทักแชทขอใบเสนอของคุณได้เลย");
    const h = quoteVideoFacts({ product: "IHEALTHY", age: 35, sex: "F", plan: "GOLD", compare: [] }, TODAY)!;
    expect(pageCaption(h).split("\n")[0]).toBe("ประกันสุขภาพเหมาจ่าย แผน Gold วงเงิน 25 ล้านบาทต่อปี");
  });
});

describe("Motion Graphic style (owner, 2026-10-11)", () => {
  it("draws a frame every 1/12 s while something moves, each frame knowing its time", () => {
    const f = quoteVideoFacts({ variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    const s = quoteVideoScript(f);
    const [lead] = planScenes([{ key: "lead", voice: s[0].voice, voiceSec: 12, windows: motionWindows("lead", f, 12), fps: MOTION_FPS }]);
    expect(lead.frames.every((fr) => typeof fr.state.t === "number")).toBe(true);
    const moving = lead.frames.filter((fr) => fr.t <= 2.4);
    expect(moving.length).toBeGreaterThanOrEqual(2.4 * MOTION_FPS);
    expect(lead.frames.length).toBeLessThan(200);
  });
});

describe("15-second clip (owner, 2026-10-11)", () => {
  const lp = quoteVideoFacts({ variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;

  it("is three scenes of one sentence each, with no greeting and no name", () => {
    const s = quoteVideoScript(lp, "สมชาย", "F", "short");
    expect(s.map((x) => x.key)).toEqual(["lead", "price", "contact"]);
    expect(s.map((x) => x.voice)).toEqual([
      "ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 2 ล้านบาทค่ะ",
      "ออมแค่วันละ 79 บาท ออมเพียง 19 ปี คุ้มครองถึงอายุ 99 ค่ะ",
      "ทักมาขอใบเสนอได้เลยนะคะ",
    ]);
    for (const x of s) expect(x.voice).not.toContain("สมชาย");
  });

  it("speaks for iShield, iHealthy and the pay-to-99 term, and a man's endings", () => {
    const is = quoteVideoFacts({ product: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    expect(quoteVideoScript(is, "", "F", "short").map((x) => x.voice).slice(0, 2)).toEqual([
      "คุ้มครองโรคร้ายแรง 70 โรค รับเงินก้อนสูงสุด 1 ล้านบาท ตั้งแต่ระยะเริ่มต้นค่ะ",
      "ออมแค่วันละ 184 บาท ออมเพียง 10 ปี คุ้มครองถึงอายุ 85 ค่ะ",
    ]);
    const ihu = quoteVideoFacts({ product: "IHEALTHY", age: 35, sex: "M", plan: "GOLD", compare: [] }, TODAY)!;
    expect(quoteVideoScript(ihu, "", "F", "short").map((x) => x.voice).slice(0, 2)).toEqual([
      "เหมาจ่ายค่ารักษาสูงสุดถึง 25 ล้านบาทต่อปีค่ะ",
      "ปีแรกเดือนละ 3,524 บาท รวมประกันชีวิตและค่าชดเชยรายวันค่ะ",
    ]);
    const to99 = quoteVideoFacts({ variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000 }, TODAY)!;
    expect(quoteVideoScript(to99, "", "F", "short")[1].voice).toBe("ออมแค่วันละ 48 บาท ออมถึงอายุ 99 คุ้มครองถึงอายุ 99 ค่ะ");
    expect(quoteVideoScript(lp, "", "M", "short")[2].voice).toBe("ทักมาขอใบเสนอได้เลยนะครับ");
  });
});

describe("a clip from a budget (owner, 2026-10-11)", () => {
  const lp = { variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 500_000 };

  it("buys the biggest sum whose instalment fits, and never one that does not", () => {
    const got = resolveBudget(lp, { baht: 3_000, per: "month" }, TODAY) as typeof lp;
    expect(got.sumAssured).toBe(1_150_000);
    const f = quoteVideoFacts(got, TODAY)!;
    const monthly = Number(f.prices.find((p) => p.label === "รายเดือน")!.amount.replace(/,/g, ""));
    expect(monthly).toBeLessThanOrEqual(3_000);
    const next = quoteVideoFacts({ ...got, sumAssured: 1_200_000 }, TODAY)!;
    expect(Number(next.prices.find((p) => p.label === "รายเดือน")!.amount.replace(/,/g, ""))).toBeGreaterThan(3_000);
  });

  it("says so, with the smallest sum's price, when the budget is too small", () => {
    const r = resolveBudget(lp, { baht: 500, per: "month" }, TODAY);
    expect(typeof r === "string" && r).toMatch(/^งบนี้ยังไม่พอสำหรับทุนต่ำสุด 500,000 \(เริ่มที่เดือนละ [\d,.]+ บาท\)$/);
  });

  it("works for iShield and a yearly budget", () => {
    const got = resolveBudget({ product: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 500_000 }, { baht: 100_000, per: "year" }, TODAY) as { sumAssured: number };
    expect(got.sumAssured).toBe(1_000_000);
    const f = quoteVideoFacts(got as never, TODAY)!;
    expect(Number(f.prices.find((p) => p.label === "รายปี")!.amount.replace(/,/g, ""))).toBeLessThanOrEqual(100_000);
  });

  it("picks the richest iHealthy plan the monthly budget pays for", () => {
    const base = { product: "IHEALTHY" as const, age: 35, sex: "M" as const, plan: "SMART", compare: ["GOLD"] };
    expect((resolveBudget(base, { baht: 3_600, per: "month" }, TODAY) as { plan: string }).plan).toBe("GOLD");
    expect((resolveBudget(base, { baht: 2_000, per: "month" }, TODAY) as { plan: string }).plan).toBe("BRONZE");
    // the plan it settles on is not also a plan to compare against
    expect((resolveBudget(base, { baht: 3_600, per: "month" }, TODAY) as { compare: string[] }).compare).toEqual([]);
    expect(resolveBudget(base, { baht: 1_000, per: "month" }, TODAY)).toBe("งบนี้ยังไม่พอสำหรับแผนต่ำสุด Smart (เริ่มที่เดือนละ 1,616 บาท)");
  });

  it("checks the budget itself", () => {
    expect(cleanBudget({ baht: 3000.7, per: "month" })).toEqual({ baht: 3000, per: "month" });
    expect(cleanBudget({ baht: 100, per: "month" })).toMatch(/ต่อเดือน/);
    expect(cleanBudget({ baht: 5000, per: "week" })).toBe("ใส่งบให้ถูกต้อง");
  });

  it("says what the customer saves in the opening line", () => {
    const got = resolveBudget(lp, { baht: 3_000, per: "month" }, TODAY)!;
    const f = quoteVideoFacts(got as never, TODAY)!;
    expect(f.budget).toEqual({ per: "month", amount: "2,970" });
    expect(quoteVideoScript(f)[0].voice).toBe("สวัสดีค่ะ ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ คุณผู้ชายอายุ 35 ถ้าออมเดือนละ 2,970 บาท ทำทุน 1,150,000 ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง 2.3 ล้านบาทค่ะ");
    expect(quoteVideoScript(f, "", "F", "short")[0].voice).toBe("ถ้าออมเดือนละ 2,970 บาท ครอบครัวได้เงินก้อนสูงสุดถึง 2.3 ล้านบาทค่ะ");
  });
});

describe("agent contact", () => {
  it("takes Thai phone numbers and LINE ids", () => {
    expect(cleanPhone(" 081-234-5678 ")).toBe("081-234-5678");
    expect(cleanPhone("+66 81 234 5678")).toBe("+66 81 234 5678");
    expect(cleanPhone("12345")).toBeNull();
    expect(cleanPhone("call me")).toBeNull();
    expect(cleanLine("@somying.plan")).toBe("@somying.plan");
    expect(cleanLine("")).toBe("");
    expect(cleanLine("สมหญิง")).toBeNull();
  });

  it("takes รายละเอียดเพิ่มเติม of up to 2 lines and 80 characters (owner, 2026-10-14)", () => {
    expect(cleanMore("")).toBe("");
    expect(cleanMore("  ตัวแทนประกันชีวิต   กรุงไทย-แอกซ่า \r\n\n ใบอนุญาตเลขที่ 6501012345 ")).toBe("ตัวแทนประกันชีวิต กรุงไทย-แอกซ่า\nใบอนุญาตเลขที่ 6501012345");
    expect(cleanMore("ก\tข")).toBe("ก ข");
    expect(cleanMore("หนึ่ง\nสอง\nสาม")).toBeNull();
    expect(cleanMore("ก".repeat(80))).toBe("ก".repeat(80));
    expect(cleanMore("ก".repeat(81))).toBeNull();
  });
});
