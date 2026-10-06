import { describe, expect, it } from "vitest";
import {
  cleanShowcaseFacts, parseShowcasePiece, parseShowcaseRead, SHOWCASE_ANGLES, SHOWCASE_NAME, showcaseAngleLines, showcaseFactsBlock,
  showcaseFormat, showcaseMessages, showcaseSystem, showcaseTooThin,
} from "@/lib/content/showcase";
import { checkPolicy } from "@/lib/content/policy";
import { modeChecks } from "@/lib/content/mode-checks";
import { modeName } from "@/lib/content/modes";
import { DISCLAIMER } from "@/lib/content/output";

const text = (m: { content: unknown }[]) => m.map((x) => String(x.content)).join("\n");
const facts = cleanShowcaseFacts({ kind: "policy", what: "กรมธรรม์ประกันสุขภาพของลูกค้าออกแล้ว", figure: "12 กรมธรรม์", period: "เดือนนี้", cover: "ประกันสุขภาพ", who: "ลูกค้าวัย 30+" });

describe("showcase facts", () => {
  it("drop a name, a title and any long number, the model's or the owner's", () => {
    const f = cleanShowcaseFacts({ kind: "receipt", what: "ใบเสร็จของนางสาวสมหญิง ใจดี เลขกรมธรรม์ 1234567890", who: "คุณสมชาย มีสุข", note: "โทร 081-234-5678" });
    expect(f.what).not.toMatch(/สมหญิง|1234567890/);
    expect(f.who).not.toContain("สมชาย");
    expect(f.note).not.toMatch(/081/);
  });

  it("take an unknown kind as other and cut each field at its limit", () => {
    expect(cleanShowcaseFacts({ kind: "nope" }).kind).toBe("other");
    expect(cleanShowcaseFacts({ what: "ก".repeat(300) }).what.length).toBe(80);
    expect(cleanShowcaseFacts(null).what).toBe("");
  });

  it("are the writer's only facts, and nothing is said of money", () => {
    const block = showcaseFactsBlock(facts);
    expect(block).toContain("12 กรมธรรม์");
    expect(block).not.toMatch(/บาท/);
  });

  it("are too thin to write from with no reading and no note", () => {
    expect(showcaseTooThin(cleanShowcaseFacts({ kind: "rank" }))).toBe(true);
    expect(showcaseTooThin(cleanShowcaseFacts({ note: "ลูกค้าบอกว่าอุ่นใจ" }))).toBe(false);
  });
});

describe("reading the pictures", () => {
  it("gives one read per picture, a box turned into fractions and a picture left out left bare", () => {
    const reply = JSON.stringify({ facts: { kind: "rank", what: "อันดับในทีม" }, docs: [{ kind: "receipt", boxes: [{ label: "ชื่อ", box_2d: [100, 200, 300, 600] }] }] });
    const read = parseShowcaseRead(reply, 2)!;
    expect(read.docs).toHaveLength(2);
    expect(read.docs[0].kind).toBe("receipt");
    expect(read.docs[0].boxes).toHaveLength(1);
    expect(read.docs[1]).toEqual({ kind: "other", boxes: [] });
  });

  it("is nothing when the reply is not JSON", () => {
    expect(parseShowcaseRead("sorry", 1)).toBeNull();
  });
});

describe("the writer's brief", () => {
  it("allows no income, no amount of money and no invitation to join", () => {
    const s = showcaseSystem("post");
    expect(s).toContain("ห้ามใส่จำนวนเงินทุกชนิด");
    expect(s).toContain("ห้ามเขียนเรื่องรายได้ของตัวแทน ห้ามชวนคนมาสมัครเป็นตัวแทน");
    expect(s).toContain("ไม่ขายแบบประกัน");
  });

  it("is never an ad", () => {
    expect(showcaseFormat("ad")).toBe("post");
    expect(showcaseFormat("script")).toBe("script");
    expect(showcaseSystem("script", "60")).not.toContain("imagePrompt");
  });

  it("gives the writer the facts and the angle, and never a picture", () => {
    const m = showcaseMessages(facts, SHOWCASE_ANGLES[1], "", "post", null, false, null);
    expect(text(m)).toContain("12 กรมธรรม์");
    expect(text(m)).toContain(SHOWCASE_ANGLES[1].say);
    expect(m.some((x) => (x as { images?: unknown }).images)).toBe(false);
  });

  it("takes the angles in turn, or the owner's one opened three ways", () => {
    expect(showcaseAngleLines({}, 3).map((a) => a.label)).toEqual(SHOWCASE_ANGLES.slice(0, 3).map((a) => a.label));
    const picked = showcaseAngleLines({ angle: "plain" }, 3);
    expect(picked.every((a) => a.label === SHOWCASE_ANGLES[0].label)).toBe(true);
    expect(new Set(picked.map((a) => a.say)).size).toBe(3);
    expect(showcaseAngleLines({ angle: "custom", custom: "  เล่าเอง " }, 1)[0].label).toBe("เล่าเอง");
  });
});

describe("a showcase piece from a reply", () => {
  const reply = JSON.stringify({ hook: "หัว", body: "เนื้อ", closing: "ทักมา", hashtags: ["ผลงานจริง"], imagePrompt: "p", poster: { theme: "navy", headline: "บนภาพ" } });

  it("keeps the facts as its story, carries the kind's badge and the figure from the facts", () => {
    const o = parseShowcasePiece(reply, facts, "เล่าตรงๆ", "post")!;
    expect(o.fact).toBe(showcaseFactsBlock(facts));
    expect(o.disclaimer).toBe(DISCLAIMER);
    expect(o.angle).toBe(`${SHOWCASE_NAME} · เล่าตรงๆ`);
    const blocks = o.poster!.blocks;
    expect(blocks.find((b) => b.kind === "badge")?.text).toBe("กรมธรรม์ออกแล้ว");
    expect(blocks.find((b) => b.kind === "sub")?.text).toBe("12 กรมธรรม์");
  });

  it("has no poster as a clip, and is nothing without a hook or a body", () => {
    expect(parseShowcasePiece(reply, facts, "x", "script")!.poster).toBeUndefined();
    expect(parseShowcasePiece(JSON.stringify({ hook: "หัว" }), facts, "x", "post")).toBeNull();
  });
});

describe("where showcase pieces are listed and checked", () => {
  it("is named โชว์ผลงาน wherever pieces are listed", () => {
    expect(modeName("showcase")).toBe("โชว์ผลงาน");
  });

  it("is read with the income rules only, not หาทีม's others", () => {
    expect(modeChecks("showcase", undefined)).toEqual({ recruit: false, income: true, every: false });
    const income = checkPolicy("ได้ค่าคอม 50,000 บาทเดือนนี้", { income: true });
    expect(income.some((f) => f.code === "income_promise")).toBe(true);
    expect(checkPolicy("ได้ค่าคอม 50,000 บาทเดือนนี้").some((f) => f.code === "income_promise")).toBe(false);
    // the hiring-filter rule is หาทีม's alone: a customer's age and sex are fair words here
    expect(checkPolicy("ลูกค้าผู้หญิงวัย 30+ ไว้วางใจ", { income: true }).some((f) => f.code === "hire_filter")).toBe(false);
  });
});
