import { describe, expect, it } from "vitest";
import {
  CLAIM_ANGLES, amountLine, claimAngleLines, claimMessages, claimSystem, claimPoster, cleanAmount, cleanFacts, factsBlock, parseClaimPiece,
  parseRead, scrub, toBox,
} from "@/lib/content/claim";
import { strayNumbers } from "@/lib/content/check";
import { anthropicMessage, googleParts, openAiMessage } from "@/lib/ai/providers";
import { parsePoster, toDocument } from "@/lib/content/poster";

const PATH = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.jpg";

describe("scrub — nothing that names a person reaches the writer", () => {
  it("drops ID, phone, policy and account numbers", () => {
    expect(scrub("บัตร 1-1037-00123-45-6 โทร 081-234-5678")).toBe("บัตร โทร");
    expect(scrub("กรมธรรม์ 5012345678")).toBe("กรมธรรม์");
  });

  it("drops a titled name", () => {
    expect(scrub("นางสาวสมหญิง ใจดี นอนโรงพยาบาล")).toBe("นอนโรงพยาบาล");
    expect(scrub("คุณแม่ของนายสมชาย")).not.toContain("สมชาย");
  });

  it("drops a name after คุณ, and a number in Thai digits", () => {
    expect(scrub("คุณสมศรี มีสุข นอนโรงพยาบาล")).toBe("นอนโรงพยาบาล");
    expect(scrub("บัตร ๑๑๐๓๗๐๐๑๒๓๔๕๖")).toBe("บัตร");
    expect(scrub("โทร ๐๘๑-๒๓๔-๕๖๗๘")).toBe("โทร");
  });

  it("drops an English titled name", () => {
    expect(scrub("ผู้ป่วย Mrs. Somsri Meesuk นอน 3 คืน")).toBe("ผู้ป่วย นอน 3 คืน");
    expect(scrub("Mr John Smith")).toBe("");
  });

  it("keeps คุณ that names nobody: family, the doctor, and words that begin with it", () => {
    expect(scrub("คุณแม่ นอนโรงพยาบาล")).toBe("คุณแม่ นอนโรงพยาบาล");
    expect(scrub("คุณหมอ บอกว่าต้องผ่าตัด")).toBe("คุณหมอ บอกว่าต้องผ่าตัด");
    expect(scrub("คุณภาพชีวิต ดีขึ้น")).toBe("คุณภาพชีวิต ดีขึ้น");
    expect(scrub("ตรงคุณสมบัติ ได้เคลม")).toBe("ตรงคุณสมบัติ ได้เคลม");
  });

  it("keeps the figures a post needs", () => {
    expect(scrub("ประกันจ่าย 48,250 บาท นอน 3 คืน")).toBe("ประกันจ่าย 48,250 บาท นอน 3 คืน");
    expect(scrub("ประกันจ่าย ๔๘,๒๕๐ บาท")).toBe("ประกันจ่าย ๔๘,๒๕๐ บาท");
  });
});

describe("cleanAmount", () => {
  it("keeps digits and commas, drops a trailing .00 and any words", () => {
    expect(cleanAmount("48,250.00 บาท")).toBe("48,250");
    expect(cleanAmount("฿1,250.50")).toBe("1,250.50");
    expect(cleanAmount(3)).toBe("3");
    expect(cleanAmount("ไม่มี")).toBe("");
    expect(cleanAmount(null)).toBe("");
  });
});

describe("cleanFacts", () => {
  it("makes anything into facts, with an unknown kind as other and names scrubbed", () => {
    const f = cleanFacts({ kind: "spaceflight", illness: "ไข้เลือดออก ของนายสมชาย ใจดี", paid: "12,000.00", who: "0812345678 ผู้ชาย วัย 30+" });
    expect(f.kind).toBe("other");
    // a surname cannot be told from the next word, so the word after a name goes too: safer
    expect(f.illness).toBe("ไข้เลือดออก ของ");
    expect(f.paid).toBe("12,000");
    expect(f.who).toBe("ผู้ชาย วัย 30+");
    expect(cleanFacts(null)).toEqual({ kind: "other", illness: "", nights: "", billTotal: "", paid: "", selfPaid: "", daysToApprove: "", who: "", note: "" });
  });

  it("cuts each field to its limit", () => {
    expect(cleanFacts({ note: "ก".repeat(500) }).note.length).toBe(200);
  });
});

describe("toBox", () => {
  it("turns Gemini's [ymin, xmin, ymax, xmax] of 0–1000 into padded fractions", () => {
    const b = toBox([100, 200, 150, 600])!;
    expect(b.x).toBeCloseTo(0.194);
    expect(b.y).toBeCloseTo(0.094);
    expect(b.w).toBeCloseTo(0.412);
    expect(b.h).toBeCloseTo(0.062);
  });

  it("stays on the photograph and refuses what is not a box", () => {
    const edge = toBox([0, 0, 1000, 1000])!;
    expect(edge).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(toBox([1, 2, 3])).toBeNull();
    expect(toBox(["a", 0, 1, 1])).toBeNull();
    expect(toBox([500, 500, 500, 500])).not.toBeNull(); // a point still gets its padding
  });
});

describe("parseRead", () => {
  const reply = JSON.stringify({
    facts: { kind: "ipd", illness: "ไข้เลือดออก", nights: "3", billTotal: "52,300.00", paid: "48,250.00", selfPaid: "4,050" },
    docs: [
      { kind: "approval", boxes: [{ label: "ชื่อ", box_2d: [100, 100, 130, 500] }, { label: "bad", box_2d: [1] }] },
    ],
  });

  it("reads the facts and one entry per photograph", () => {
    const r = parseRead(reply, 2)!;
    expect(r.facts.paid).toBe("48,250");
    expect(r.docs).toHaveLength(2);
    expect(r.docs[0].kind).toBe("approval");
    expect(r.docs[0].boxes).toHaveLength(1);
  });

  it("gives a photograph the reply left out no boxes at all, so it must be barred by hand", () => {
    expect(parseRead(reply, 2)!.docs[1]).toEqual({ kind: "other", boxes: [] });
  });

  it("is null for a reply that is not JSON", () => {
    expect(parseRead("sorry, I cannot", 1)).toBeNull();
  });
});

const facts = cleanFacts({ kind: "ipd", illness: "ไข้เลือดออก", nights: "3", billTotal: "52,300", paid: "48,250", selfPaid: "4,050", who: "ผู้หญิง วัย 40+" });

describe("the facts as the writer gets them", () => {
  it("lists only the fields that are filled", () => {
    const block = factsBlock(facts);
    expect(block).toContain("บริษัทประกันจ่าย: 48,250 บาท");
    expect(block).toContain("นอนโรงพยาบาล: 3 คืน");
    expect(block).not.toContain("ยื่นเคลมถึงอนุมัติ");
  });

  it("is the yardstick: the amount on the poster passes the number check", () => {
    expect(strayNumbers(`${amountLine(facts)}\nค่ารักษา 52,300 บาท`, factsBlock(facts))).toEqual([]);
    expect(strayNumbers("ประกันจ่าย 50,000 บาท", factsBlock(facts))).toEqual(["50,000 บาท"]);
  });

  it("tells the writer never to name anyone, any hospital or any plan", () => {
    const [system, user] = claimMessages(facts, CLAIM_ANGLES[0]);
    expect(system.content).toContain("ห้ามใส่ชื่อคน ชื่อโรงพยาบาล");
    expect(system.content).toContain("ห้ามบอกชื่อแบบประกัน");
    expect(user.content).toContain(factsBlock(facts));
    expect(user.content).toContain(CLAIM_ANGLES[0].say);
  });
});

describe("the round's angles", () => {
  it("takes the first three in turn when left to the AI", () => {
    expect(claimAngleLines({}, 3).map((a) => a.label)).toEqual(["ยอดเงินชัดๆ", "เล่าเหตุการณ์", "ข้อคิด"]);
    expect(claimAngleLines({ angle: "nonsense" }, 2).map((a) => a.label)).toEqual(["ยอดเงินชัดๆ", "เล่าเหตุการณ์"]);
  });

  it("gives every piece the owner's angle, each opening another way", () => {
    const lines = claimAngleLines({ angle: "without" }, 3);
    expect(lines.map((a) => a.label)).toEqual(["ถ้าไม่มีประกัน", "ถ้าไม่มีประกัน", "ถ้าไม่มีประกัน"]);
    expect(new Set(lines.map((a) => a.say)).size).toBe(3);
    // one piece: the angle as it is
    expect(claimAngleLines({ angle: "speed" }, 1)[0]).toEqual(CLAIM_ANGLES.find((a) => a.id === "speed"));
  });

  it("uses the owner's own words, and the AI's turns when those are empty", () => {
    expect(claimAngleLines({ angle: "custom", custom: "  เคลมได้แม้เพิ่งทำ 1 ปี " }, 1)[0]).toEqual({ label: "เคลมได้แม้เพิ่งทำ 1 ปี", say: "เคลมได้แม้เพิ่งทำ 1 ปี" });
    expect(claimAngleLines({ angle: "custom", custom: " " }, 1)[0].label).toBe("ยอดเงินชัดๆ");
  });

  it("tells the writer who reads it, under Facebook's rule", () => {
    const [, user] = claimMessages(facts, CLAIM_ANGLES[1], "พ่อแม่ลูกเล็ก");
    expect(user.content).toContain("คนอ่านคือ: พ่อแม่ลูกเล็ก");
    expect(claimMessages(facts, CLAIM_ANGLES[1])[1].content).not.toContain("คนอ่านคือ");
  });
});

describe("the claim poster", () => {
  it("has the fixed badge, the writer's headline and the amount from the facts, at the top", () => {
    const p = claimPoster({ theme: "teal", headline: "นอน 3 คืน ไม่ต้องสำรองจ่าย", footer: "ทักมาเลย" }, facts, "hook");
    expect(p.layout).toBe("top");
    expect(p.theme).toBe("teal");
    expect(p.blocks.map((b) => b.kind)).toEqual(["badge", "headline", "sub", "footer"]);
    expect(p.blocks[0].text).toBe("รีวิวเคลมจริง");
    expect(p.blocks[2].text).toBe("ประกันจ่ายให้ 48,250 บาท");
  });

  it("falls back to the hook, the brand's navy, and no amount line when nothing was paid", () => {
    const p = claimPoster({ theme: "photo" }, { ...facts, paid: "" }, "เปิดเรื่อง");
    expect(p.theme).toBe("navy");
    expect(p.blocks.find((b) => b.kind === "headline")?.text).toBe("เปิดเรื่อง");
    expect(p.blocks.some((b) => b.kind === "sub")).toBe(false);
  });
});

describe("parseClaimPiece", () => {
  it("makes a post that keeps its facts for later checks", () => {
    const out = parseClaimPiece(JSON.stringify({
      hook: "เคลมจริง จ่ายจริง", body: "ลูกค้าของผม…", closing: "ทักมาได้ครับ", hashtags: ["รีวิวเคลม", "#ประกันสุขภาพ"],
      poster: { headline: "จ่ายแล้ว 48,250 บาท" }, imagePrompt: "A relieved Thai family at home",
    }), facts, "เล่าเหตุการณ์")!;
    expect(out.imagePrompt).toBe("A relieved Thai family at home");
    expect(out.hooks).toEqual(["เคลมจริง จ่ายจริง"]);
    expect(out.hashtags).toEqual(["#รีวิวเคลม", "#ประกันสุขภาพ"]);
    expect(out.angle).toBe("รีวิวเคลม · เล่าเหตุการณ์");
    expect(out.fact).toBe(factsBlock(facts));
    expect(out.poster?.blocks[1].text).toBe("จ่ายแล้ว 48,250 บาท");
  });

  it("is null without a hook or a body", () => {
    expect(parseClaimPiece(JSON.stringify({ body: "x" }), facts, "amount")).toBeNull();
    expect(parseClaimPiece("not json", facts, "amount")).toBeNull();
  });
});

describe("a poster's papers", () => {
  const H = [{ kind: "headline", text: "x" }];
  it("keeps each only with the one path shape and a paper's ratio", () => {
    expect(toDocument({ path: PATH, ratio: 0.7 })).toEqual({ path: PATH, ratio: 0.7 });
    expect(toDocument({ path: "../etc/passwd", ratio: 0.7 })).toBeNull();
    expect(toDocument({ path: PATH, ratio: 40 })).toBeNull();
    // a claims-table screenshot is about five times wider than tall
    expect(toDocument({ path: PATH, ratio: 4.53 })).not.toBeNull();
  });

  it("keeps up to three, dropping any that are not papers", () => {
    const p = parsePoster({ blocks: H, documents: [{ path: PATH, ratio: 0.75 }, { path: "x", ratio: 1 }, { path: PATH, ratio: 1.2 }, { path: PATH, ratio: 1 }, { path: PATH, ratio: 2 }] })!;
    expect(p.documents).toEqual([{ path: PATH, ratio: 0.75 }, { path: PATH, ratio: 1.2 }, { path: PATH, ratio: 1 }]);
    expect(parsePoster({ blocks: H, documents: [{ path: "x", ratio: 1 }] })!.documents).toBeUndefined();
  });

  it("reads a poster from before there could be several as a list of its one", () => {
    expect(parsePoster({ blocks: H, document: { path: PATH, ratio: 0.75 } })!.documents).toEqual([{ path: PATH, ratio: 0.75 }]);
  });
});

describe("pictures in a message, per provider", () => {
  const m = { role: "user" as const, content: "อ่านนี่", images: [{ base64: "QUJD", mimeType: "image/jpeg" }] };

  it("OpenAI: text then a data URL", () => {
    expect(openAiMessage(m)).toEqual({
      role: "user",
      content: [{ type: "text", text: "อ่านนี่" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }],
    });
    expect(openAiMessage({ role: "user", content: "x" })).toEqual({ role: "user", content: "x" });
  });

  it("Anthropic: the picture first, then the text", () => {
    expect(anthropicMessage(m).content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
      { type: "text", text: "อ่านนี่" },
    ]);
  });

  it("Gemini: inline data, then the text", () => {
    expect(googleParts(m)).toEqual([{ inlineData: { mimeType: "image/jpeg", data: "QUJD" } }, { text: "อ่านนี่" }]);
  });
});

describe("the three kinds of work", () => {
  const reply = JSON.stringify({
    hook: "เคลมจริง", body: "[3–15 วิ] ลูกค้าของผม…", closing: "[50–60 วิ] ทักมาได้ครับ", hashtags: ["รีวิวเคลม"],
    poster: { headline: "จ่ายแล้ว 48,250 บาท" },
  });

  it("asks for a clip of the length picked, with time marks and no poster", () => {
    const sys = claimSystem("script", "30");
    expect(sys).toContain("สคริปต์พูดหน้ากล้อง");
    expect(sys).toContain("30 วินาที");
    expect(sys).not.toContain("poster");
    expect(claimSystem("script")).toContain("60 วินาที");
  });

  it("asks an ad for Ads Manager's three fields", () => {
    const sys = claimSystem("ad");
    expect(sys).toContain("headline");
    expect(sys).toContain("primary text");
    expect(sys).toContain("description");
  });

  it("keeps the same rules for all three", () => {
    for (const f of ["post", "script", "ad"] as const) expect(claimSystem(f)).toContain("ห้ามใส่ชื่อคน ชื่อโรงพยาบาล");
  });

  it("makes a script without a poster, and an ad without tags", () => {
    const script = parseClaimPiece(reply, facts, "เล่าเหตุการณ์", "script")!;
    expect(script.poster).toBeUndefined();
    expect(script.hashtags).toEqual(["#รีวิวเคลม"]);
    const ad = parseClaimPiece(reply, facts, "ยอดเงินชัดๆ", "ad")!;
    expect(ad.hashtags).toEqual([]);
    expect(ad.ad).toEqual({ angle: "ยอดเงินชัดๆ", tone: "รีวิวเคลม" });
    expect(ad.poster?.blocks[0].text).toBe("รีวิวเคลมจริง");
  });
});
