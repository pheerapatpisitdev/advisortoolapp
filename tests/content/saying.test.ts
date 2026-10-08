import { describe, expect, it } from "vitest";
import {
  MAX_SAYING_OWN, parseSayingPiece, readSaying, SAYING_TONES, SAYING_TOPICS, sayingFormat, sayingMessages, sayingSystem, sayingTones,
  type SayingSource,
} from "@/lib/content/saying";
import { modeChecks } from "@/lib/content/mode-checks";
import { modeName } from "@/lib/content/modes";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const life = SAYING_TOPICS[0];
const fromTopic: SayingSource = { kind: "topic", topic: life };
const own: SayingSource = { kind: "own", text: "วันนี้ที่ดีที่สุด คือวันที่เราเตรียมไว้ให้พรุ่งนี้", who: "แม่" };
const blocks = (o: ReturnType<typeof parseSayingPiece>) => o!.poster!.blocks.map((b) => [b.kind, b.text]);

describe("SAYING_TOPICS", () => {
  it("has unique ids and a brief for each, with no figure the writer could repeat", () => {
    expect(new Set(SAYING_TOPICS.map((t) => t.id)).size).toBe(SAYING_TOPICS.length);
    for (const t of SAYING_TOPICS) {
      expect(t.brief.length).toBeGreaterThan(30);
      expect(t.brief).not.toMatch(/\d/);
    }
  });
});

describe("where a saying comes from", () => {
  it("is a picked topic, or the owner's own topic cut at 120", () => {
    expect(readSaying({ source: "topic", topic: life.id })).toEqual({ ok: true, source: fromTopic });
    const custom = readSaying({ source: "topic", topic: "custom", custom: "  ความกล้า " });
    expect(custom.ok && custom.source.kind === "topic" && custom.source.topic.label).toBe("ความกล้า");
    const long = readSaying({ source: "topic", topic: "custom", custom: "ก".repeat(300) });
    expect(long.ok && long.source.kind === "topic" && [...long.source.topic.label].length).toBe(120);
  });

  it("is the agent's own words, kept as typed, with who said them if given", () => {
    expect(readSaying({ source: "own", own: `  ${own.text} `, who: " แม่ " })).toEqual({ ok: true, source: own });
    expect(readSaying({ source: "own", own: own.text })).toEqual({ ok: true, source: { kind: "own", text: own.text, who: "" } });
  });

  it("refuses nothing to write from, and words too long for the poster rather than cutting them", () => {
    expect(readSaying({ source: "topic", topic: "custom", custom: "  " }).ok).toBe(false);
    expect(readSaying({ source: "topic", topic: "nope" }).ok).toBe(false);
    expect(readSaying({ source: "own", own: "   " }).ok).toBe(false);
    expect(readSaying({ source: "own", own: "ก".repeat(MAX_SAYING_OWN) }).ok).toBe(true);
    expect(readSaying({ source: "own", own: "ก".repeat(MAX_SAYING_OWN + 1) })).toEqual({ ok: false, error: `คำคมยาวเกิน ${MAX_SAYING_OWN} ตัวอักษร ย่อให้สั้นลงหน่อยนะครับ` });
  });
});

describe("a saying's tones", () => {
  it("run in turn when none is picked, each opened its own way", () => {
    const t = sayingTones("", 3);
    expect(t.map((x) => x.label)).toEqual(SAYING_TONES.map((x) => x.label));
    expect(new Set(t.map((x) => x.say)).size).toBe(3);
  });

  it("is the picked one for every piece, opened three ways", () => {
    const t = sayingTones(SAYING_TONES[2].id, 3);
    expect(t.every((x) => x.label === SAYING_TONES[2].label)).toBe(true);
    expect(new Set(t.map((x) => x.say)).size).toBe(3);
  });
});

describe("the writer's brief", () => {
  it("writes a new saying from a topic, claiming no one said it", () => {
    const s = sayingSystem("post", "topic");
    expect(s).toContain("แต่งคำคมขึ้นใหม่");
    expect(s).toContain("ห้ามอ้างว่าเป็นคำพูดของใคร");
  });

  it("keeps the agent's own words, adding nothing to them or about who said them", () => {
    const s = sayingSystem("post", "own");
    expect(s).toContain("ห้ามแก้");
    expect(s).not.toContain("แต่งคำคมขึ้นใหม่");
    const m = text(sayingMessages(own, SAYING_TONES[0], "", "post", null, false, null));
    expect(m).toContain(own.text);
    expect(m).toContain("แม่");
  });

  it("ties the saying to being prepared, and sells nothing", () => {
    const s = sayingSystem("post", "topic");
    expect(s).toContain("เตรียมพร้อม");
    expect(s).toContain("ห้ามเอ่ยชื่อแบบประกัน");
    expect(s).toContain("ห้ามชวนซื้อ");
  });

  it("gives the writer the topic and its brief", () => {
    const m = text(sayingMessages(fromTopic, SAYING_TONES[0], "", "post", null, false, null));
    expect(m).toContain(life.label);
    expect(m).toContain(life.brief);
  });

  it("is never an ad: anything but a clip is a post", () => {
    expect(sayingFormat("ad")).toBe("post");
    expect(sayingFormat("script")).toBe("script");
    expect(sayingSystem("script", "topic", "60")).not.toContain("imagePrompt");
    expect(sayingSystem("post", "topic")).toContain("imagePrompt");
  });
});

describe("a saying from a reply", () => {
  const reply = (saying: string) => JSON.stringify({
    saying, body: "ข้อคิด", closing: "ทักมาคุยได้เสมอ", hashtags: ["คำคม"], imagePrompt: "p", poster: { theme: "teal", footer: "เตรียมไว้ อุ่นใจกว่า" },
  });

  it("opens with the writer's saying and puts it on the poster under a คำคม badge", () => {
    const o = parseSayingPiece(reply("ชีวิตไม่รอใคร"), fromTopic, "สั้นกินใจ", "post")!;
    expect(o.hooks).toEqual(["“ชีวิตไม่รอใคร”"]);
    expect(blocks(o)).toEqual([["badge", "คำคม"], ["headline", "ชีวิตไม่รอใคร"], ["footer", "เตรียมไว้ อุ่นใจกว่า"]]);
    expect(o.poster!.theme).toBe("teal");
    expect(o.angle).toBe(`คำคม · ${life.label} · สั้นกินใจ`);
    expect(o.fact).toBe(life.brief);
    expect(o.disclaimer).toBe("");
    expect(o.hashtags).toEqual(["#คำคม"]);
  });

  it("uses the agent's own words, not the writer's, with who said them under", () => {
    const o = parseSayingPiece(reply("คำที่ AI แก้มา"), own, "ข้อคิดอบอุ่น", "post")!;
    expect(o.hooks).toEqual([`“${own.text}” — แม่`]);
    expect(blocks(o)).toEqual([["badge", "คำคม"], ["headline", own.text], ["sub", "— แม่"], ["footer", "เตรียมไว้ อุ่นใจกว่า"]]);
    expect(o.angle).toBe("คำคม · พิมพ์เอง · ข้อคิดอบอุ่น");
    expect(o.fact).toContain(own.text);
  });

  it("needs no saying in the reply when the words are the agent's", () => {
    const o = parseSayingPiece(JSON.stringify({ body: "ข้อคิด", closing: "c" }), { kind: "own", text: own.text, who: "" }, "x", "post")!;
    expect(o.hooks).toEqual([`“${own.text}”`]);
    expect(blocks(o).map(([k]) => k)).toEqual(["badge", "headline", "footer"]);
  });

  it("has no poster or picture prompt as a clip, and says the saying first", () => {
    const o = parseSayingPiece(reply("ชีวิตไม่รอใคร"), fromTopic, "ปลุกพลัง", "script")!;
    expect(o.poster).toBeUndefined();
    expect(o.imagePrompt).toBe("");
    expect(o.hooks).toEqual(["“ชีวิตไม่รอใคร”"]);
  });

  it("is nothing without a saying from a topic, or without a body", () => {
    expect(parseSayingPiece(JSON.stringify({ body: "เนื้อ" }), fromTopic, "x", "post")).toBeNull();
    expect(parseSayingPiece(JSON.stringify({ saying: "คำ" }), fromTopic, "x", "post")).toBeNull();
    expect(parseSayingPiece("not json", own, "x", "post")).toBeNull();
  });
});

describe("where sayings are listed and checked", () => {
  it("is named คำคม wherever pieces are listed", () => {
    expect(modeName("saying")).toBe("คำคม");
  });

  it("flags every figure, as ขอบคุณลูกค้า does", () => {
    expect(modeChecks("saying", undefined)).toEqual({ recruit: false, income: false, every: true });
  });
});
