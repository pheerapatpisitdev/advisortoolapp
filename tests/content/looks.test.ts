import { describe, expect, it } from "vitest";
import golden from "./fixtures/background-classic.json";
import { backgroundPrompt } from "@/lib/content/background";
import {
  CLASSIC, LIGHTS, MOODS, PLACES, SPACES, STYLES, SUBJECTS, lookLabel, lookMessages, parseLook, settleLook, type Look,
} from "@/lib/content/looks";

/** More kinds of background picture, the original kept as one of them (owner, 2026-10-01). */

const scene = "A Thai father reading to his daughter at bedtime";
const flatlay: Look = { style: "flatlay", subject: "objects", place: "home", light: "morning", mood: "calm", space: "table" };

describe("the original look", () => {
  it("draws word for word what every picture was drawn from before", () => {
    const cases = {
      bottom: { scene, layout: "bottom", theme: "navy" },
      top: { scene, layout: "top", theme: "sand" },
      center: { scene, layout: "center", theme: "photo" },
      person: { scene, layout: "bottom", theme: "mint", person: { pose: "auto" } },
      aside: { scene, layout: "top", theme: "navy", person: { pose: "auto", aside: true } },
    } as const;
    for (const [name, opts] of Object.entries(cases)) {
      expect(backgroundPrompt(opts), name).toBe(golden[name as keyof typeof golden]);
      expect(backgroundPrompt({ ...opts, look: CLASSIC }), name).toBe(golden[name as keyof typeof golden]);
    }
  });

  it("is the first choice of every kind, so it stays one of them", () => {
    expect(CLASSIC).toEqual({ style: STYLES[0].id, subject: SUBJECTS[0].id, place: PLACES[0].id, light: LIGHTS[0].id, mood: MOODS[0].id, space: SPACES[0].id });
  });
});

describe("another look", () => {
  const p = backgroundPrompt({ scene, layout: "bottom", theme: "navy", look: flatlay });

  it("asks for its own style, subject, place, light, mood and calm area", () => {
    for (const [list, id] of [[STYLES, "flatlay"], [SUBJECTS, "objects"], [PLACES, "home"], [LIGHTS, "morning"], [MOODS, "calm"], [SPACES, "table"]] as const) {
      expect(p).toContain((list as readonly { id: string; say: string }[]).find((x) => x.id === id)!.say);
    }
    expect(p).not.toContain("editorial-quality");
    expect(p).not.toContain("Hopeful and reassuring");
  });

  it("keeps the rules that hold for every picture: no lettering, the calm side, the palette, nothing fearful", () => {
    expect(p).toContain("NO text, letters, numbers or words");
    expect(p).toContain("bottom half of the frame");
    expect(p).toContain("deep navy blue shadows");
    expect(p).toContain("coffins");
    expect(p).toContain("never fearful");
    expect(backgroundPrompt({ scene, layout: "top", theme: "navy", look: flatlay })).toContain("top half of the frame");
  });

  it("gives no Thai word to the model, whatever the look", () => {
    for (const list of [STYLES, SUBJECTS, PLACES, LIGHTS, MOODS, SPACES]) {
      for (const x of list) expect(x.say, x.id).not.toMatch(/[฀-๿]/);
    }
  });
});

describe("settling a look", () => {
  it("takes the ids it knows and the original for the rest", () => {
    expect(settleLook({ style: "film", mood: "warm", place: "nowhere" }, { person: false, recent: [] }))
      .toEqual({ ...CLASSIC, style: "film", mood: "warm" });
    expect(settleLook(null, { person: false, recent: [] })).toEqual(CLASSIC);
  });

  it("never repeats the Page's last picture's style", () => {
    const got = settleLook({ ...CLASSIC }, { person: false, recent: [CLASSIC] });
    expect(got.style).not.toBe(CLASSIC.style);
    expect(settleLook(null, { person: false, recent: [{ ...CLASSIC, style: "film" }] }).style).toBe(CLASSIC.style);
  });

  it("keeps a picture of objects to objects", () => {
    expect(settleLook({ style: "flatlay", subject: "family" }, { person: false, recent: [] }).subject).toBe("objects");
  });

  it("with a person from the library, draws a photograph with that person in it", () => {
    const got = settleLook({ style: "watercolor", subject: "empty" }, { person: true, recent: [] });
    expect(STYLES.find((s) => s.id === got.style)!.kind).toBe("photo");
    expect(["objects", "empty", "hands"]).not.toContain(got.subject);
    const again = settleLook({ style: "phone" }, { person: true, recent: [{ ...CLASSIC, style: "phone" }] });
    expect(again.style).not.toBe("phone");
    expect(STYLES.find((s) => s.id === again.style)!.kind).toBe("photo");
  });
});

describe("the picker's reply", () => {
  it("reads the six ids from JSON, and nothing from a reply it cannot read", () => {
    expect(parseLook('{"style":"soft3d","subject":"family","place":"park","light":"golden","mood":"playful","space":"sky"}'))
      .toEqual({ style: "soft3d", subject: "family", place: "park", light: "golden", mood: "playful", space: "sky" });
    expect(parseLook("ขอโทษครับ")).toBeNull();
  });

  it("is shown the scene, every choice, the Page's recent looks, and the person rule", () => {
    const text = lookMessages({ scene, person: true, recent: [flatlay] }).map((m) => String(m.content)).join("\n");
    expect(text).toContain(scene);
    for (const s of STYLES) expect(text).toContain(s.id);
    expect(text).toContain("flatlay");
    expect(text).toContain("photograph");
  });
});

describe("the card's words for a look", () => {
  it("names the style and the mood in Thai", () => {
    expect(lookLabel(flatlay)).toBe("ภาพวางของมุมบน · สงบ");
    expect(lookLabel(CLASSIC)).toBe("ภาพถ่าย editorial · มีความหวัง");
  });
});

describe("the owner's own direction", () => {
  const request = "a watercolour painting of an empty beach at dawn, pastel colours";
  const p = backgroundPrompt({ scene, layout: "bottom", theme: "navy", look: flatlay, request });

  it("decides the whole picture: no scene, no look, no theme colours", () => {
    expect(p).toContain(request);
    expect(p).not.toContain(scene);
    expect(p).not.toContain(STYLES.find((s) => s.id === "flatlay")!.say);
    expect(p).not.toContain("editorial-quality");
    expect(p).not.toContain("deep navy blue shadows");
    expect(p).not.toContain("Hopeful and reassuring");
  });

  it("keeps only what keeps the poster readable and the advertisement safe", () => {
    expect(p).toContain("1:1 square");
    expect(p).toContain("NO text, letters, numbers or words");
    expect(p).toContain("bottom half of the frame");
    expect(p).toContain("coffins");
  });

  it("keeps a person from the library in it", () => {
    expect(backgroundPrompt({ scene, layout: "bottom", theme: "navy", request, person: { pose: "auto" } })).toContain("reference photos");
  });

  it("is not a direction when it is blank, or only Thai the model is never handed", () => {
    for (const blank of ["", "   ", "ภาพสีน้ำ"]) {
      expect(backgroundPrompt({ scene, layout: "bottom", theme: "navy", request: blank })).toBe(golden.bottom);
    }
  });
});
