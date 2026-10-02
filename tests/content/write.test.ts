import { describe, expect, it } from "vitest";
import { DISCLAIMER, TAX_LINE, fullText, parsePieces } from "@/lib/content/write";
import { atFold } from "@/lib/content/output";
import { buildMessages } from "@/lib/content/prompt";
import type { PiecePlan } from "@/lib/content/plan";

const plans: PiecePlan[] = [
  { angle: "พ่อแม่ที่ลูกยังเรียน", hook: "ถ้าพรุ่งนี้ไม่มีเรา บ้านนี้ไปต่อได้ไหมครับ" },
  { angle: "คนที่คิดว่าแพง", hook: "วันละ 20 บาท คุ้มครอง 1,000,000 บาท" },
];

const reply = JSON.stringify({
  pieces: [
    { body: "บรรทัดหนึ่ง\nบรรทัดสอง", closing: "ทักแชทมาได้เลยครับ", hashtags: ["ประกันชีวิต", "#วางแผนการเงิน", "#ประกันชีวิต"], imagePrompt: "a Thai family at breakfast, no text" },
    { body: "อีกชิ้น", closing: "", hashtags: [], imagePrompt: "" },
  ],
});

describe("parsePieces", () => {
  it("makes one post per plan, with the planned hook and angle", () => {
    const out = parsePieces("```json\n" + reply + "\n```", plans, "family")!;
    expect(out).toHaveLength(2);
    expect(out[0].hooks).toEqual([plans[0].hook]);
    expect(out[0].angle).toBe(plans[0].angle);
    expect(out[0].hashtags).toEqual(["#ประกันชีวิต", "#วางแผนการเงิน"]);
  });

  it("keeps the planned hook even when the writer rewrote it", () => {
    // told to keep a hook, models reword it; the hook is what every check was run against
    const rewritten = JSON.stringify({ pieces: [{ hook: "hook ใหม่ที่แต่งเอง", body: "x" }, { body: "y" }] });
    expect(parsePieces(rewritten, plans, "")![0].hooks).toEqual([plans[0].hook]);
  });

  it("refuses a reply one piece short, rather than show posts for the wrong angles", () => {
    const short = JSON.stringify({ pieces: [{ body: "x" }] });
    expect(parsePieces(short, plans, "")).toBeNull();
    expect(parsePieces(JSON.stringify({ pieces: [{ body: "x" }, { body: " " }] }), plans, "")).toBeNull();
    expect(parsePieces("ขอโทษครับ", plans, "")).toBeNull();
  });

  it("takes a single piece given bare, when one was asked for", () => {
    const bare = JSON.stringify({ body: "เนื้อหา", closing: "ทักแชทครับ", hashtags: [] });
    expect(parsePieces(bare, [plans[0]], "")![0].body).toBe("เนื้อหา");
    expect(parsePieces(bare, plans, "")).toBeNull();
  });

  it("drops extra pieces instead of billing the owner for angles nobody planned", () => {
    const extra = JSON.stringify({ pieces: [{ body: "a" }, { body: "b" }, { body: "c" }] });
    expect(parsePieces(extra, plans, "")).toHaveLength(2);
  });

  it("puts the regulator's line on every piece, written by code and not by the model", () => {
    expect(parsePieces(reply, plans, "family")![0].disclaimer).toBe(DISCLAIMER);
    expect(parsePieces(reply, plans, "tax")![1].disclaimer).toBe(`${DISCLAIMER}\n${TAX_LINE}`);
  });
});

describe("fullText", () => {
  it("is the hook, the body, the closing, the tags and the disclaimer, in that order", () => {
    const [out] = parsePieces(reply, plans, "family")!;
    const text = fullText(out);
    expect(text.startsWith(`${plans[0].hook}\n\nบรรทัดหนึ่ง`)).toBe(true);
    expect(text.indexOf("ทักแชท")).toBeLessThan(text.indexOf("#ประกันชีวิต"));
    // the regulator's line, then who insures it
    expect(text.endsWith(`${DISCLAIMER}\nรับประกันภัยโดย บมจ. กรุงไทย-แอกซ่า ประกันชีวิต`)).toBe(true);
  });
});

describe("buildMessages", () => {
  const brief = "## Life Protect x 2\n- ทุน 100,000 บาท";
  const ask = { brief, format: "post" as const, angle: "family" as const, custom: "", length: null, plans };

  it("hands the model the brief and the plans, and forbids it every number it was not given", () => {
    const [system, user] = buildMessages(ask);
    expect(system.content).toContain("ห้ามคำนวณ");
    expect(user.content).toContain(brief);
    expect(user.content).toContain("โพสต์เฟซบุ๊ก");
    expect(user.content).toContain(`hook: ${plans[1].hook}`);
  });

  it("tells the writer Facebook's rules and to speak without ครับ or ค่ะ", () => {
    const [system] = buildMessages(ask);
    expect(system.content).toContain("กฎโฆษณาของ Facebook");
    expect(system.content).toContain("ไม่บอกเพศผู้เขียน");
    expect(system.content).not.toContain("ตัวแทนผู้ชาย");
  });

  it("asks a script for its length and its time markers", () => {
    const [, user] = buildMessages({ ...ask, format: "script", angle: "tax", length: "60" });
    expect(user.content).toContain("60 วินาที");
    expect(user.content).toContain("ลดหย่อนภาษี");
  });

  it("says nothing of reader, goal or story when none was given", () => {
    const [, user] = buildMessages(ask);
    expect(user.content).not.toContain("คนอ่านคือ");
    expect(user.content).not.toContain("เป้าหมาย:");
    expect(user.content).not.toContain("เรื่องจริงจากเจ้าของเพจ");
  });

  it("carries the reader, the goal and the owner's true story, bound to its own words", () => {
    const [, user] = buildMessages({ ...ask, reader: "พ่อแม่ลูกเล็ก", goal: "comment", fact: "ลูกค้าเคลมค่ารักษา 8 หมื่น" });
    expect(user.content).toContain("คนอ่านคือ: พ่อแม่ลูกเล็ก");
    expect(user.content).toContain("ห้ามทักคนอ่านตรงๆ");
    // the comment goal is worded against engagement bait
    expect(user.content).toContain("แท็กเพื่อน");
    expect(user.content).toContain("ลูกค้าเคลมค่ารักษา 8 หมื่น");
    expect(user.content).toContain("ห้ามเติมชื่อ อายุ ตัวเลข");
  });

  it("ignores a goal it does not know", () => {
    const [, user] = buildMessages({ ...ask, goal: "viral" as never });
    expect(user.content).not.toContain("เป้าหมาย:");
  });

  it("tells the model what a teaching angle means, not just its button label", () => {
    const [, user] = buildMessages({ ...ask, angle: "faq" });
    expect(user.content).toContain("คำถามที่ลูกค้าถามบ่อย —");
    expect(user.content).toContain("ถ้าข้อมูลไม่มีคำตอบ");
  });

  it("uses the owner's own angle when they typed one", () => {
    const [, user] = buildMessages({ ...ask, angle: "custom", custom: "คนทำงานฟรีแลนซ์" });
    expect(user.content).toContain("คนทำงานฟรีแลนซ์");
  });
});

describe("atFold", () => {
  it("splits where the reader's screen folds the post, counting Thai marks as characters", () => {
    const { shown, hidden, length } = atFold("ผู้".repeat(50), 125);
    expect(length).toBe(150);
    expect([...shown]).toHaveLength(125);
    expect([...hidden]).toHaveLength(25);
  });

  it("hides nothing in a short post", () => {
    expect(atFold("สั้นๆ").hidden).toBe("");
  });
});

describe("posters from the writer", () => {
  it("keeps a poster the writer designed, and leaves out one without a headline", () => {
    const withPoster = JSON.stringify({ pieces: [
      { body: "a", poster: { layout: "top", blocks: [{ kind: "headline", text: "วันละ 20 บาท" }], theme: "sand" } },
      { body: "b", poster: { blocks: [{ kind: "sub", text: "ไม่มีพาดหัว" }] } },
    ] });
    const [one, two] = parsePieces(withPoster, plans, "")!;
    expect(one.poster).toEqual({ layout: "top", theme: "sand", blocks: [{ kind: "headline", text: "วันละ 20 บาท" }] });
    expect(two.poster).toBeUndefined();
  });

  it("takes no language from the model: a Thai round's poster stays Thai whatever the reply says", () => {
    const reply = JSON.stringify({ pieces: [{ body: "a", poster: { layout: "top", lang: "en", blocks: [{ kind: "headline", text: "วันละ 20 บาท" }], theme: "sand" } }] });
    const [one] = parsePieces(reply, plans.slice(0, 1), "")!;
    expect(one.poster).toBeDefined();
    expect(one.poster).not.toHaveProperty("lang");
  });

  it("asks for a poster whose colour is one of the named themes, never a colour of the model's own", () => {
    const [system] = buildMessages({ brief: "b", format: "post", angle: "", custom: "", length: null, plans });
    expect(system.content).toContain('"poster"');
    expect(system.content).toContain("ห้ามกำหนดรหัสสีเอง");
    expect(system.content).toContain('"theme":"navy"');
  });
});
