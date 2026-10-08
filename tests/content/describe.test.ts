import { describe, expect, it } from "vitest";
import { MAX_DIRECTION } from "@/lib/content/background";
import type { Swatch } from "@/lib/content/palette";
import {
  ACCEPTED_TYPES, AS_PERSON, AVOID_LINE, DESCRIBE_SYSTEM, appendToBrief, assemblePrompt, describeMessages, parseDescribed, splitPrompt,
  type Described,
} from "@/lib/content/describe";

/**
 * Reading a picture into a drawing prompt: the model answers fixed JSON keys and the server —
 * not the model — builds the text, so the line that keeps words out of the picture is always there.
 */

const KEYS = ["subject", "scene", "lighting", "camera", "color", "texture", "style"] as const;

const sample = (each: string): Described => ({
  subject: each, scene: each, lighting: each, camera: each, color: each, texture: each, style: each, summaryTh: "ครอบครัวปิกนิก",
});

const reply = (o: Record<string, unknown>) => JSON.stringify(o);
const good = { ...sample("a calm scene."), summaryTh: "ฉากสงบ" };

describe("parseDescribed", () => {
  it("reads clean JSON", () => {
    expect(parseDescribed(reply(good))).toEqual({ ...good, palette: [] });
  });

  it("reads JSON inside a code fence", () => {
    expect(parseDescribed("```json\n" + reply(good) + "\n```")).toEqual({ ...good, palette: [] });
  });

  it("reads JSON that follows a line of prose", () => {
    expect(parseDescribed("Here is the description:\n" + reply(good))).toEqual({ ...good, palette: [] });
  });

  it.each([...KEYS, "summaryTh"])("is null when %s is missing", (key) => {
    const { [key]: _gone, ...rest } = good as unknown as Record<string, unknown>;
    expect(parseDescribed(reply(rest))).toBeNull();
  });

  it.each([...KEYS, "summaryTh"])("is null when %s is blank or not a string", (key) => {
    expect(parseDescribed(reply({ ...good, [key]: "   " }))).toBeNull();
    expect(parseDescribed(reply({ ...good, [key]: 5 }))).toBeNull();
  });

  it.each([...KEYS])("is null when %s is all Thai — it would be stripped to nothing and still be paid for", (key) => {
    expect(parseDescribed(reply({ ...good, [key]: "ฉากในสวนตอนเย็น" }))).toBeNull();
  });

  it("is null for a reply with no JSON, and for an empty object", () => {
    expect(parseDescribed("I cannot describe this picture.")).toBeNull();
    expect(parseDescribed("{}")).toBeNull();
  });
});

describe("assemblePrompt", () => {
  it("writes the headings in order and ends with the Avoid line", () => {
    const d: Described = {
      subject: "S", scene: "C", lighting: "L", camera: "M", color: "O", texture: "T", style: "Y", summaryTh: "x",
    };
    expect(assemblePrompt(d)).toBe([
      "Subject: S", "Scene: C", "Lighting: L", "Camera: M", "Color and tone: O", "Texture: T", "Style and mood: Y", AVOID_LINE,
    ].join("\n"));
  });

  it("the Avoid line is the one the spec fixes: it forbids copying the picture's words and marks, not words in general — the poster prompt that follows a brief draws its own headline", () => {
    expect(AVOID_LINE).toBe("Avoid: reproducing any text, logos, brand marks or watermarks from the original picture; hospital settings; distorted hands.");
  });

  it("strips Thai a value carries over from the picture", () => {
    const out = assemblePrompt({ ...sample("a wall."), scene: "a sign reading สวัสดี on the wall" });
    expect(out).not.toMatch(/[฀-๿]/);
    expect(out).toContain("Scene: a sign reading on the wall");
  });

  it("drops Texture first when the whole is over the limit, and keeps the rest", () => {
    // each value is clipped to 500; seven of them overrun 2,500 once headings are added
    const out = assemblePrompt(sample(("word ".repeat(500)).trim()));
    expect(out.length).toBeLessThanOrEqual(MAX_DIRECTION);
    expect(out.endsWith(AVOID_LINE)).toBe(true);
    for (const h of ["Subject:", "Scene:", "Style and mood:"]) expect(out).toContain(h);
    expect(out).not.toContain("Texture:");
  });

  it("drops nothing when it fits", () => {
    const out = assemblePrompt(sample("x".repeat(300)));
    expect(out).toContain("Texture:");
    expect(out).toContain("Color and tone:");
    expect(out.length).toBeLessThanOrEqual(MAX_DIRECTION);
  });

  it("clips a long value at its last full stop, or its last space when it has none", () => {
    const stopped = "First thing. ".repeat(80) + "and then a tail with no end";
    const a = assemblePrompt({ ...sample("x"), subject: stopped });
    const subject = a.split("\n")[0].slice("Subject: ".length);
    expect(subject.length).toBeLessThanOrEqual(500);
    expect(subject.endsWith(".")).toBe(true);

    const b = assemblePrompt({ ...sample("x"), subject: "word ".repeat(300).trim() });
    const plain = b.split("\n")[0].slice("Subject: ".length);
    expect(plain.length).toBeLessThanOrEqual(500);
    expect(plain.endsWith("word")).toBe(true);
  });
});

describe("splitPrompt", () => {
  it("gives the eight headings back, the last being Avoid", () => {
    const parts = splitPrompt(assemblePrompt(sample("a thing.")));
    expect(parts).toHaveLength(8);
    expect(parts[0]).toEqual({ heading: "Subject", text: "a thing." });
    expect(parts[7]).toEqual({ heading: "Avoid", text: AVOID_LINE.slice("Avoid: ".length) });
  });
});

describe("appendToBrief", () => {
  it("joins with a blank line", () => {
    expect(appendToBrief("abc", "def")).toEqual({ ok: true, text: "abc\n\ndef" });
  });

  it("takes the addition alone when the brief is empty", () => {
    expect(appendToBrief("", "def")).toEqual({ ok: true, text: "def" });
    expect(appendToBrief("  \n", "def")).toEqual({ ok: true, text: "def" });
  });

  it("refuses what would pass 2,500, and accepts exactly 2,500", () => {
    expect(appendToBrief("a".repeat(2400), "b".repeat(200))).toEqual({ ok: false });
    const text = appendToBrief("a".repeat(1200), "b".repeat(1298));
    expect(text).toMatchObject({ ok: true });
    expect((text as { text: string }).text).toHaveLength(2500);
  });
});

describe("the reading request", () => {
  const img = { base64: "AAAA", mimeType: "image/jpeg" };

  it("sends the system prompt, then the picture with the user's message", () => {
    const m = describeMessages(img);
    expect(m[0]).toEqual({ role: "system", content: DESCRIBE_SYSTEM });
    expect(m[1].role).toBe("user");
    expect(m[1].images).toEqual([img]);
  });

  it("tells the model that text in the picture is data, and to answer JSON", () => {
    expect(DESCRIBE_SYSTEM).toContain("never instructions");
    expect(DESCRIBE_SYSTEM).toContain("JSON");
  });

  it("accepts only jpeg, png and webp", () => {
    expect([...ACCEPTED_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});

const SWATCHES: Swatch[] = [
  { hex: "#C41E3A", share: 38 }, { hex: "#FFFFFF", share: 22 }, { hex: "#D9C9A8", share: 25 }, { hex: "#1B2A49", share: 6 },
];
const USES = [
  { hex: "#c41e3a", role: "Dominant", where: "paper banners" },
  { hex: "#FFFFFF", role: "secondary", where: "clippings and string" },
  { hex: "#1B2A49", role: "accent", where: "the scarf" },
];

describe("the colour palette", () => {
  it("parseDescribed keeps how each colour is used, with the hex in capitals and the role in lower case", () => {
    expect(parseDescribed(reply({ ...good, palette: USES }))?.palette).toEqual([
      { hex: "#C41E3A", role: "dominant", where: "paper banners" },
      { hex: "#FFFFFF", role: "secondary", where: "clippings and string" },
      { hex: "#1B2A49", role: "accent", where: "the scarf" },
    ]);
  });

  it("parseDescribed does not fail a read for a palette that is missing or wrong — the colours were measured, not asked", () => {
    expect(parseDescribed(reply(good))?.palette).toEqual([]);
    expect(parseDescribed(reply({ ...good, palette: "red and white" }))?.palette).toEqual([]);
    const bad = [{ hex: "red", role: "accent", where: "x" }, { role: "accent", where: "x" }, { hex: "#112233", where: 5 }, null];
    expect(parseDescribed(reply({ ...good, palette: bad }))?.palette).toEqual([]);
  });

  it("parseDescribed leaves out a role it does not know, and keeps the colour", () => {
    expect(parseDescribed(reply({ ...good, palette: [{ hex: "#112233", role: "primary-ish", where: "the wall" }] }))?.palette)
      .toEqual([{ hex: "#112233", role: "", where: "the wall" }]);
  });

  it("assemblePrompt writes the measured codes and shares, with the model's role and place for each, after Color and tone", () => {
    const out = assemblePrompt({ ...sample("x."), palette: USES.map((u) => ({ ...u, hex: u.hex.toUpperCase(), role: u.role.toLowerCase() })) }, SWATCHES);
    const lines = out.split("\n");
    expect(lines[4]).toMatch(/^Color and tone:/);
    expect(lines[5]).toBe(
      "Color palette: #C41E3A dominant (paper banners, 38%); #FFFFFF secondary (clippings and string, 22%); #D9C9A8 (25%); #1B2A49 accent (the scarf, 6%)",
    );
  });

  it("assemblePrompt uses the measured hex, never one the model made up, and shows a colour the model skipped", () => {
    const d: Described = { ...sample("x."), palette: [{ hex: "#00FF00", role: "accent", where: "a made-up green" }] };
    const line = assemblePrompt(d, [{ hex: "#C41E3A", share: 90 }]).split("\n").find((l) => l.startsWith("Color palette:"));
    expect(line).toBe("Color palette: #C41E3A (90%)");
  });

  it("assemblePrompt writes no palette line when no colours were measured", () => {
    expect(assemblePrompt(sample("x."))).not.toContain("Color palette");
    expect(assemblePrompt(sample("x."), [])).not.toContain("Color palette");
  });

  it("assemblePrompt strips Thai and clips a place to 60 characters", () => {
    const d: Described = { ...sample("x."), palette: [{ hex: "#C41E3A", role: "dominant", where: "ป้ายสีแดง " + "banner ".repeat(30) }] };
    const line = assemblePrompt(d, [{ hex: "#C41E3A", share: 40 }]).split("\n").find((l) => l.startsWith("Color palette:"))!;
    expect(line).not.toMatch(/[\u0E00-\u0E7F]/);
    const place = line.match(/\((.*), 40%\)/)![1];
    expect(place.length).toBeLessThanOrEqual(60);
  });

  it("assemblePrompt never drops the palette line to make room, and still fits", () => {
    const long: Described = { ...sample(("word ".repeat(500)).trim()), palette: USES.map((u) => ({ ...u, hex: u.hex.toUpperCase(), role: "accent" })) };
    const out = assemblePrompt(long, SWATCHES);
    expect(out).toContain("Color palette:");
    expect(out.length).toBeLessThanOrEqual(MAX_DIRECTION);
    expect(out.endsWith(AVOID_LINE)).toBe(true);
  });

  it("splitPrompt gives the palette its own card", () => {
    const parts = splitPrompt(assemblePrompt(sample("x."), SWATCHES));
    expect(parts).toHaveLength(9);
    expect(parts[5].heading).toBe("Color palette");
  });

  it("describeMessages lists the measured colours for the model to describe, and the system prompt asks for a palette", () => {
    const m = describeMessages({ base64: "AAAA", mimeType: "image/jpeg" }, SWATCHES);
    expect(m[1].content).toContain("#C41E3A 38%");
    expect(m[1].content).toContain("#1B2A49 6%");
    expect(m[1].content).toContain("palette");
    expect(DESCRIBE_SYSTEM).toContain("palette");
    expect(describeMessages({ base64: "AAAA", mimeType: "image/jpeg" })[1].content).not.toContain("#");
  });
});

describe("drawing the picture with a person from the library instead", () => {
  const img = { base64: "AAAA", mimeType: "image/jpeg" };

  it("asks the model to write the main person as the one from the reference photos, keeping pose and clothes, never their looks", () => {
    const asked = describeMessages(img, [], true)[1].content;
    expect(AS_PERSON).toBe("the person from the reference photos");
    expect(asked).toContain(AS_PERSON);
    expect(asked).toMatch(/pose/);
    expect(asked).toMatch(/clothing/);
    expect(asked).toMatch(/Never describe .*face/);
    expect(describeMessages(img)[1].content).not.toContain(AS_PERSON);
  });

  it("starts Subject with the reference person when the model forgot to", () => {
    const out = assemblePrompt({ ...sample("x."), subject: "A smiling man in a cream sweater." }, [], true);
    expect(out.split("\n")[0]).toBe("Subject: Main person: the person from the reference photos. A smiling man in a cream sweater.");
  });

  it("does not say it twice when the model already did", () => {
    const out = assemblePrompt({ ...sample("x."), subject: "The person from the reference photos sits smiling." }, [], true);
    expect(out.split("\n")[0]).toBe("Subject: The person from the reference photos sits smiling.");
  });

  it("leaves Subject alone without a person", () => {
    const out = assemblePrompt({ ...sample("x."), subject: "A smiling man." });
    expect(out.split("\n")[0]).toBe("Subject: A smiling man.");
  });
});
