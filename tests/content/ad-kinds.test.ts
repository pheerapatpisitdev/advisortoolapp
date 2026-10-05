import { describe, expect, it } from "vitest";
import { adKind, adSub, kindChip } from "@/lib/ads/ad-kind";
import { rowChips } from "@/lib/ads/ads-list";
import { picturePending, toDraw } from "@/lib/ads/room-view";
import { assembleNumbersAd, assembleShortAd, numbersOpeningMessages, parseOpening, parseShortAd, shortAdMessages, type ShortAd } from "@/lib/content/ad-kinds";
import { briefWithoutPremiums } from "@/lib/content/ads";
import { briefFor } from "@/lib/content/brief";
import { adCategories, iHealthyAdCaution, iHealthyAdFacts } from "@/lib/content/ihealthy-ad";
import { headlineOwner, headlineSheet, premiumTable } from "@/lib/content/premium-table";

/** Ads Studio's content types (spec 2026-10-06): the kinds' prompts and assembly, and iHealthy's emphasis. */

const plan = { angle: "มุมครอบครัว", hook: "ถ้าวันหนึ่งเราไม่อยู่" };
const ctx = { owner: "ชาย อายุ 35 ปี · ประกันชีวิตคุ้มครอง 1,000,000 บาท", reader: "พ่อแม่", focus: "", voice: "" };
const contact = "👉 คุณเอ\n📲 Line: @abc123";

describe("the kind as sent", () => {
  it("is one of the four, anything else the long ad; a knowledge ad's sub-kind a myth unless known", () => {
    expect(adKind("numbers")).toBe("numbers");
    expect(adKind("NUMBERS")).toBe("long");
    expect(adKind(undefined)).toBe("long");
    expect(adSub("knowledge", "faq")).toBe("faq");
    expect(adSub("knowledge", "x")).toBe("myth");
    expect(adSub("story", "faq")).toBeUndefined();
  });

  it("names a shorter kind on the list's chips, and not the long ad", () => {
    expect(kindChip({ kind: "knowledge", sub: "checklist" })).toBe("ความรู้ · เช็กลิสต์ก่อนซื้อ");
    expect(kindChip(null)).toBeNull();
    expect(rowChips({ sex: "F", age: 30, head: null, kind: "numbers" })).toEqual(["ตัวเลขชัดๆ", "หญิง · อายุ 30"]);
    expect(rowChips({ sex: "F", age: 30, head: null })).toEqual(["หญิง · อายุ 30"]);
  });

  it("keeps a ตัวเลขชัดๆ ad off the drawing line: its numbers poster waits for no picture", () => {
    expect(picturePending({ poster: {}, ad: { kind: "numbers" } })).toBe(false);
    expect(picturePending({ poster: {}, ad: { kind: "story" } })).toBe(true);
    expect(toDraw([{ id: "a", output: { ad: { kind: "numbers" } } }, { id: "b", output: { ad: { kind: "story" } } }, { id: "c", output: {} }])).toEqual(["b", "c"]);
  });
});

describe("the headline's sheet", () => {
  it("is the row and sex the headline settles on, priced by the ladder", () => {
    const t = premiumTable("/lifeprotect", 35)!;
    for (const pick of [{ sex: "M" as const, rung: 1 }, { sex: "F" as const }, { sex: "F" as const, rung: 99 }]) {
      const head = headlineSheet("/lifeprotect", 35, pick)!;
      const owner = headlineOwner(t, pick);
      expect(head.sex).toBe(owner.sex);
      expect(head.sheet.sumLine).toBe(owner.heading);
    }
  });

  it("is null where the plan cannot be priced", () => {
    expect(headlineSheet("/ishield", 55)).toBeNull();
    expect(headlineSheet("/no-table", 30)).toBeNull();
  });
});

describe("a ความรู้ or เล่าเป็นเรื่อง ad's writer", () => {
  it("is told the kind's rules, and shown no table and no headline figures", () => {
    const [system, user] = shortAdMessages("ข้อมูล", plan, ctx, "knowledge", "faq");
    expect(system.content).toContain("แบบ: คำถามที่ถามบ่อย");
    expect(system.content).toContain("points: 3–6 ข้อ");
    expect(system.content).toContain("ไม่มีตารางเบี้ยในแอดแบบนี้");
    expect(system.content).not.toContain("bullets");
    expect(user.content).not.toContain("ตารางเบี้ยที่ระบบจะใส่ให้");
    expect(user.content).not.toContain("ตัวเลขเด่น");
    expect(user.content).toContain(`แอดนี้เป็นของ: ${ctx.owner}`);
    expect(shortAdMessages("ข้อมูล", plan, ctx, "story", undefined)[0].content).toContain("แบบ: เล่าเป็นเรื่อง");
    const en = shortAdMessages("info", plan, ctx, "knowledge", "myth", "en");
    expect(en[0].content).toContain("Kind: a myth put right");
    expect(en[1].content).toContain("This ad is for:");
  });

  it("is assembled with the CTA and the contacts, and no table; over Facebook's length only the model's words go", () => {
    const ad = parseShortAd(JSON.stringify({ opening: "เปิด", points: ["ข้อหนึ่ง", "ข้อสอง"], cta: "", hashtags: ["ประกัน"], headline: "หัว" })) as ShortAd;
    expect(assembleShortAd(ad, contact)).toBe(["เปิด", "ข้อหนึ่ง\nข้อสอง", "ทักแชทมาคุยกันได้เลย", contact, "#ประกัน"].join("\n.\n"));
    const long = { ...ad, points: Array.from({ length: 6 }, () => "ก".repeat(500)) };
    const out = assembleShortAd(long, contact);
    expect([...out].length).toBeLessThanOrEqual(2200);
    expect(out.endsWith(`ทักแชทมาคุยกันได้เลย\n.\n${contact}`)).toBe(true);
    expect(parseShortAd(JSON.stringify({ opening: "เปิด", headline: "หัว", points: [] }))).toBeNull();
  });
});

describe("a ตัวเลขชัดๆ ad's writer", () => {
  it("is shown the figures it writes above, and asked for one figure-free line", () => {
    const [system, user] = numbersOpeningMessages("ข้อมูล", plan, ctx, "ประกันชีวิตทุน 1,000,000 บาท");
    expect(system.content).toContain("ห้ามมีตัวเลขใดๆ");
    expect(user.content).toContain("ประกันชีวิตทุน 1,000,000 บาท");
    expect(parseOpening('{"opening":"ตัวเลข\\nที่ควรรู้"}', "ฮุก")).toBe("ตัวเลข ที่ควรรู้");
    expect(parseOpening('{"opening":"ทุน ๒ ล้าน"}', "ฮุกไม่มีเลข")).toBe("ฮุกไม่มีเลข");
    expect(parseOpening('{"opening":"ประกันดี"}', "hook", "en")).toBe("hook");
    expect(assembleNumbersAd("เปิด", "ตัวเลข", contact)).toBe(["เปิด", "ตัวเลข", "ทักแชทเช็กเบี้ยตามอายุคุณ", contact].join("\n.\n"));
  });
});

describe("iHealthy's emphasis, from the benefit sheet", () => {
  it("lists exactly the categories the plan pays for — SMART has no outpatient extras, GOLD has them", () => {
    expect(adCategories("SMART")).toEqual([11, 10, 4, 1, 9]);
    expect(adCategories("GOLD")).toEqual([11, 10, 4, 1, 9, 18, 19]);
    const smart = iHealthyAdFacts("SMART").join("\n");
    const gold = iHealthyAdFacts("GOLD").join("\n");
    expect(smart).toContain("ค่าห้องและค่าอาหาร วันละ 1,500 บาท (ผู้ป่วยในโรงพยาบาลเอกชน)");
    expect(smart).not.toContain("ผู้ป่วยนอก");
    expect(gold).toContain("วันละ 9,000 บาท");
    expect(gold).toContain("ค่ารักษาผู้ป่วยนอก (ปรึกษาแพทย์และยา) วงเงินปีละ 12,000 บาท");
    expect(gold).toContain("ค่ากายภาพบำบัดผู้ป่วยนอก วงเงินปีละ 12,000 บาท");
    expect(gold).not.toContain("ทันตกรรม");
    for (const text of [smart, gold]) {
      expect(text).toContain("เคมีบำบัด");
      expect(text).toContain("ล้างไต");
      expect(text).toContain("ไม่ใช่ระยะเวลาจ่ายเบี้ยหรือระยะเวลาคุ้มครอง");
      expect(text).toContain("โรงพยาบาลเอกชน");
    }
    expect(iHealthyAdFacts("NOPE")).toEqual([]);
  });

  it("says it in English for the expat brief", () => {
    const gold = iHealthyAdFacts("GOLD", "en").join("\n");
    expect(gold).toContain("Inpatient room and board at private hospitals: up to 9,000 THB a day");
    expect(gold).toContain("Outpatient doctor visits and medicine: covered up to 12,000 THB a year");
    expect(gold).not.toMatch(/[฀-๿]/);
    expect(iHealthyAdFacts("SMART", "en").join("\n")).not.toContain("Outpatient");
    expect(iHealthyAdCaution("en")).toContain("120 days");
  });

  it("goes into an iHealthy ad's brief, the 120-day wait among the cautions; any other brief is as it was", () => {
    const plain = briefFor("/ihealthy-ultra")!.text;
    const ad = briefFor("/ihealthy-ultra", undefined, { adPlan: "GOLD" })!.text;
    expect(plain).not.toContain("แผน Gold");
    expect(ad).toContain("แผน Gold (วงเงินปีละ 25,000,000 บาท)");
    const cautions = ad.slice(ad.indexOf("### ข้อควรระวัง"));
    expect(cautions).toContain("ระยะเวลารอคอยพิเศษ 120 วัน");
    expect(ad.indexOf("แผน Gold")).toBeLessThan(ad.indexOf("### ข้อควรระวัง"));
    expect(briefFor("/lifeprotect", undefined, { adPlan: "GOLD" })!.text).toBe(briefFor("/lifeprotect")!.text);
    // the writer's brief keeps the benefit amounts: they are cover, not premiums
    expect(briefWithoutPremiums(ad)).toContain("วันละ 9,000 บาท");
    expect(briefWithoutPremiums(ad)).toContain("วงเงินปีละ 12,000 บาท");
    const en = briefFor("/ihealthy-ultra", undefined, { expat: true, adPlan: "SMART" })!.text;
    expect(en).toContain("plan Smart (3,000,000 THB a year)");
    expect(en).toContain("ข้อมูลสำหรับลูกค้าชาวต่างชาติ");
  });
});

describe("review polish (2026-10-06)", () => {
  it("keeps a numbers ad's Meta headline within 27 characters, its fallbacks too; Organic keeps 60", async () => {
    const { FALLBACK_AD_HEADLINES, FALLBACK_AD_HEADLINES_EN, headlineMessages, parseHeadlines } = await import("@/lib/content/numbers");
    for (const h of [...FALLBACK_AD_HEADLINES, ...FALLBACK_AD_HEADLINES_EN]) expect([...h].length).toBeLessThanOrEqual(27);
    const long = "ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหวสำหรับทุกคน";
    const reply = JSON.stringify({ pieces: [{ headline: long }, { headline: "เงินก้อนให้คนข้างหลัง" }] });
    const ad = parseHeadlines(reply, 2, "th", 27);
    expect(ad[0].headline).toBe(FALLBACK_AD_HEADLINES[0]);
    expect(ad[1].headline).toBe("เงินก้อนให้คนข้างหลัง");
    for (const h of parseHeadlines("not json", 3, "en", 27)) expect([...h.headline].length).toBeLessThanOrEqual(27);
    expect(parseHeadlines(reply, 2)[0].headline).toBe(long);
    expect(headlineMessages([], "th", 27)[0].content).toContain("ยาวไม่เกิน 27 ตัวอักษร");
    expect(headlineMessages([])[0].content).toContain("ยาวไม่เกิน 60 ตัวอักษร");
  });

  it("prices a numbers round without its picture", async () => {
    const { adRoundCost } = await import("@/lib/ads/picture-picks");
    const picks = { writer: null, painter: null, person: null };
    expect(Number(adRoundCost(2, picks, false).slice(5))).toBeLessThan(Number(adRoundCost(2, picks).slice(5)));
  });

  it("does not forbid premiums in an iHealthy ad's brief, which prints the code's; the post brief is as it was", () => {
    const ad = briefFor("/ihealthy-ultra", undefined, { adPlan: "GOLD" })!.text;
    expect(ad).not.toContain("โพสต์นี้ห้ามระบุเบี้ย");
    expect(ad).toContain("ห้ามเขียนตัวเลขเบี้ยเอง — ระบบใส่ให้");
    expect(briefFor("/ihealthy-ultra")!.text).toContain("โพสต์นี้ห้ามระบุเบี้ย");
  });
});
