import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_DISCLAIMER, KNOWLEDGE_SUBJECTS, knowledgeFormat, knowledgeMessages, parseKnowledgePiece, subjectOf,
} from "@/lib/content/knowledge";
import { modeName } from "@/lib/content/modes";
import { PRO_HOOK_RULES } from "@/lib/content/pro";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const myth = subjectOf("myth", KNOWLEDGE_SUBJECTS.myth[0].id, "")!;
const quote = subjectOf("quote", KNOWLEDGE_SUBJECTS.quote[0].id, "")!;

describe("what a knowledge piece is about", () => {
  it("has a bank for each kind, quotes in the owner's four themes", () => {
    expect(KNOWLEDGE_SUBJECTS.myth.length).toBeGreaterThanOrEqual(8);
    expect(KNOWLEDGE_SUBJECTS.article.length).toBeGreaterThanOrEqual(8);
    expect(KNOWLEDGE_SUBJECTS.quote.map((q) => q.label)).toEqual(["วางแผนการเงิน/เก็บเงิน", "ครอบครัว/คนที่รัก", "สุขภาพ/ใช้ชีวิต", "กำลังใจทั่วไป"]);
  });

  it("takes the owner's own words, and refuses nothing typed", () => {
    expect(subjectOf("article", "custom", "  ประกันกับการผ่อนบ้าน  ")).toEqual({ kind: "article", id: "custom", label: "ประกันกับการผ่อนบ้าน" });
    expect(subjectOf("article", "custom", "   ")).toBeNull();
    expect(subjectOf("myth", "nope", "")).toBeNull();
    expect(subjectOf("ad", KNOWLEDGE_SUBJECTS.myth[0].id, "")).toBeNull();
  });

  it("is written as a post or a script, never an ad", () => {
    expect(knowledgeFormat("ad")).toBe("post");
    expect(knowledgeFormat("script")).toBe("script");
  });

  it("is named ความรู้ wherever pieces are listed", () => {
    expect(modeName("knowledge")).toBe("ความรู้");
  });
});

describe("the knowledge writer's brief", () => {
  it("sells nothing, and asks only for a save or a share", () => {
    const brief = text(knowledgeMessages(myth, 0, "", "post", null, false, null));
    expect(brief).toContain("ห้ามเอ่ยชื่อแบบประกัน");
    expect(brief).toContain("เซฟ");
    expect(brief).toContain("ห้ามชวนคอมเมนต์คำเฉพาะ");
    expect(brief).toContain(myth.label);
  });

  it("never puts a quote in a real person's mouth", () => {
    expect(text(knowledgeMessages(quote, 0, "", "post", null, false, null))).toContain("ห้ามอ้างว่าเป็นคำพูดของคนดัง");
  });

  it("takes สูตรคอนเทนต์โปร and คลิปวนลูป as the other writers do", () => {
    expect(text(knowledgeMessages(myth, 0, "", "post", null, false, "pro"))).toContain(PRO_HOOK_RULES);
    expect(text(knowledgeMessages(myth, 0, "", "script", "60", true, null))).toContain("คลิปวนลูป");
  });

  it("opens each piece of a round differently", () => {
    expect(text(knowledgeMessages(myth, 0, "", "post", null, false, null))).not.toEqual(text(knowledgeMessages(myth, 1, "", "post", null, false, null)));
  });
});

describe("a knowledge piece from the writer's reply", () => {
  const reply = JSON.stringify({ hook: "หัว", body: "เนื้อ", closing: "เซฟไว้", hashtags: ["ประกัน"], imagePrompt: "x", poster: { theme: "navy", headline: "หัวบนภาพ" } });

  it("carries the general disclaimer, no story to check numbers against, and a poster", () => {
    const o = parseKnowledgePiece(reply, myth, "post")!;
    expect(o.disclaimer).toBe(KNOWLEDGE_DISCLAIMER);
    expect(o.fact).toBeUndefined();
    expect(o.hashtags).toEqual(["#ประกัน"]);
    expect(o.poster?.blocks.find((b) => b.kind === "headline")?.text).toBe("หัวบนภาพ");
  });

  it("puts a quote big in the middle, with no disclaimer of its own", () => {
    const o = parseKnowledgePiece(reply, quote, "post")!;
    expect(o.disclaimer).toBe("");
    expect(o.poster?.layout).toBe("center");
  });

  it("has no poster for a script, and nothing without a hook or a body", () => {
    expect(parseKnowledgePiece(reply, myth, "script")?.poster).toBeUndefined();
    expect(parseKnowledgePiece(JSON.stringify({ body: "เนื้อ" }), myth, "post")).toBeNull();
  });
});
