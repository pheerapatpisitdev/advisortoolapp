import { describe, expect, it } from "vitest";
import { cleanLine, cleanPhone } from "@/lib/quote-video/contact";
import { buildJob, concatList, mixNarration, nameFiles, pcmSeconds } from "@/lib/quote-video/job";
import { cleanCustomerName, quoteVideoFacts, quoteVideoScript, spokenBaht } from "@/lib/quote-video/script";
import { clipLength, LEAD, planScenes, XFADE } from "@/lib/quote-video/timeline";

const TODAY = new Date("2026-10-11T00:00:00+07:00");
const input = { kind: "plan" as const, planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };

describe("quote video script", () => {
  const f = quoteVideoFacts(input, TODAY)!;

  it("takes the card's and the table's figures", () => {
    expect(f.legacy).toBe("2,000,000");
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
    expect(lines[1]).toBe("ค่าใช้จ่ายตกแค่วันละ 79 บาท หรือเดือนละ 2,583 บาท จ่ายแค่ 19 ปีก็จบ ราคาไม่ขึ้นเลยตลอดที่จ่ายค่ะ");
    expect(lines[2]).toBe("ถ้าเป็นอะไรไปก่อนอายุ 60 ครอบครัวได้ 2 ล้าน หลังจากนั้นได้ 1 ล้าน และดูแลยาวไปถึงอายุ 99 เลยค่ะ");
    expect(lines[3]).toBe("ที่ชอบที่สุดคือ เงินที่จ่ายไปไม่หายไปไหน จ่ายครบตอนอายุ 53 แล้วเงินก็ยังโตทุกปี พออายุ 64 ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ 553,000 บาท มากกว่าที่จ่ายไปทั้งหมดแล้วค่ะ");
    expect(lines[4]).toBe("คุณสมชายสนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ");
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

  it("refuses another plan", () => {
    expect(quoteVideoFacts({ ...input, planCode: "PLB" }, TODAY)).toBeUndefined();
  });
});

describe("quote video timeline and job", () => {
  const f = quoteVideoFacts(input, TODAY)!;
  const script = quoteVideoScript(f);
  const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: [12, 10, 9, 16, 4.5][i] })));

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
    const value = plans.find((p) => p.key === "value")!;
    expect(value.frames.at(-1)!.state).toMatchObject({ ring: 1, callout: true });
  });

  it("lists frames for the concat demuxer and builds one command", () => {
    const layers = plans.map((p) => (p.key === "legacy" ? "photo" as const : p.key === "value" ? "table" as const : undefined));
    const named = nameFiles(plans, layers);
    const list = concatList(plans[0], named.scenes[0].frames);
    expect(list.startsWith("ffconcat version 1.0\n")).toBe(true);
    expect(list.trim().split("\n").at(-1)).toBe(`file ${named.scenes[0].frames.at(-1)}`);
    const job = buildJob(plans, named, { tableHeight: 3000, panEnd: 1200 });
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
});
