import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { checkDevice } from "@/lib/prompt-story/check";
import { checkedStory, storyScript } from "@/lib/quote-video/story";
import { clipFrame } from "@/lib/quote-video/story-frames";
import { isDevice, isMeta, knowEpisode, META_LIMITS, metaWords, type KnowShow, type MetaShow } from "@/lib/quote-video/story-knowledge";
import { deviceTail, knowTail } from "@/lib/quote-video/story-knowledge-motion";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { DEFAULT_CAST } from "@/lib/story/figure";
import { INFO_SHELVES, topicOf } from "@/lib/story/topics";
import { OPENER_TOPICS, openerInput, openerSnapshot, VARIANTS, type OpenerTopic } from "./story-openers-variants";

/**
 * device round 3, Task 5: the opening scene (knowAsk) of eight คลิปเล่าเรื่อง topics is a metaphor. Its voice and its
 * title (the old opener's own two lines) are unchanged; every other scene is exactly as before. The expected values are
 * pinned here as literals (the old strings), and the other scenes against a snapshot taken at the base commit 48039e49.
 */

const OPENER: Record<OpenerTopic, MetaShow> = {
  pillar: { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""], note: "รายได้หลักของบ้าน", label: "รายได้" },
  mythjinx: { layout: "umbrella", title: ["“ซื้อประกัน", "เหมือนแช่งตัวเอง”"], note: "พกร่ม ไม่ได้ทำให้ฝนตก" },
  fiverisks: { layout: "shield", title: ["ประกันชีวิต", "คืออะไรกันแน่?"], note: "ประกันรับแทนเรา", arrows: ["จากไปเร็ว", "อยู่นานเกิน", "ป่วยหนัก", "อุบัติเหตุ", "ทุพพลภาพ"] },
  selfemployed: { layout: "safetynet", title: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"], note: "ตาข่ายนี้ เราขึงเองได้" },
  pricey: { layout: "seedtree", title: ["“เบี้ยแพง", "ไม่มีงบ”"], note: "เริ่มเล็ก ดีกว่าไม่เริ่ม" },
  bank: { layout: "balance", title: ["“ฝากธนาคาร", "ดีกว่า”"], note: "ออมไว้ใช้ ประกันกันเรื่องใหญ่", sides: ["เงินออม", "ประกัน"], tilt: "even" },
  welfare: { layout: "bridge", title: ["“มีบัตรทอง", "ประกันสังคมแล้ว”"], note: "ช่วงป่วย รายได้หาย ต้องมีสะพาน" },
  ciincome: { layout: "lifering", title: ["ป่วยหนัก", "รายได้หายไปไหน?"], note: "เงินก้อนมาตอนที่ต้องการที่สุด" },
};

/** the old opener's voice, as the code said it at the base commit (the pillar's depends on the name and the asker's sex) */
const OLD_VOICE: Record<Exclude<OpenerTopic, "pillar">, string> = {
  mythjinx: "ซื้อประกัน เหมือนแช่งตัวเองหรือเปล่าคะ",
  fiverisks: "ประกันชีวิตคืออะไรกันแน่คะ พูดง่าย ๆ คือเงินก้อนหนึ่ง ที่วันหนึ่งต้องมีคนได้รับแน่นอนค่ะ",
  selfemployed: "ทำงานของตัวเอง ไม่มีเจ้านาย แล้วสวัสดิการล่ะคะ",
  pricey: "ประกันแพง ตอนนี้ยังไม่มีงบ หลายคนคิดแบบนี้ค่ะ",
  bank: "เอาเงินไปฝากธนาคารดีกว่า ไม่ต้องทำประกันหรอก จริงไหมคะ",
  welfare: "มีบัตรทอง มีประกันสังคมแล้ว พอแล้วหรือเปล่าคะ",
  ciincome: "ถ้าป่วยหนัก ต้องหยุดงานไปรักษาตัวหลายเดือน รายได้ช่วงนั้นหายไปไหนคะ",
};
/** the old opener's two lines (the myth quotes keep their quotation marks) */
const OLD_LINES: Record<OpenerTopic, [string, string]> = {
  pillar: ["บ้านนี้มีเสาหลัก", ""],
  mythjinx: ["“ซื้อประกัน", "เหมือนแช่งตัวเอง”"],
  fiverisks: ["ประกันชีวิต", "คืออะไรกันแน่?"],
  selfemployed: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"],
  pricey: ["“เบี้ยแพง", "ไม่มีงบ”"],
  bank: ["“ฝากธนาคาร", "ดีกว่า”"],
  welfare: ["“มีบัตรทอง", "ประกันสังคมแล้ว”"],
  ciincome: ["ป่วยหนัก", "รายได้หายไปไหน?"],
};
const OLD_LAYOUT: Record<OpenerTopic, string> = { pillar: "kin", mythjinx: "myth", fiverisks: "ask", selfemployed: "ask", pricey: "myth", bank: "myth", welfare: "myth", ciincome: "ask" };

const base = JSON.parse(readFileSync(path.join(__dirname, "fixtures/story-openers-base.json"), "utf8")) as ReturnType<typeof openerSnapshot>;

describe("the eight story openers are metaphors", () => {
  for (const topic of OPENER_TOPICS) {
    it(`${topic}: the first scene is the ${OPENER[topic].layout}, as the spec's table says, with the old two lines as its title`, () => {
      for (const v of VARIANTS[topic]) {
        const first = knowEpisode(openerInput(topic, v.over), "", "F").scenes[0];
        expect(first.key).toBe("knowAsk");
        expect(first.show).toEqual(OPENER[topic]);
        expect((first.show as MetaShow).title).toEqual(OLD_LINES[topic]);
      }
    });

    it(`${topic}: every word passes the same checks a prompt-clip device does (no digit, within META_LIMITS)`, () => {
      const show = OPENER[topic];
      expect(isMeta(show) && isDevice(show)).toBe(true);
      // checkDevice also carries the prompt clip's forbidden words; the owner's own title “เบี้ยแพง ไม่มีงบ” says เบี้ย,
      // which a prompt clip's AI-written script may not, so pricey is held to the digit and length rules alone
      if (topic === "pricey") expect(checkDevice(show, new Set())).toBe("title: ใช้คำว่า เบี้ย");
      else expect(checkDevice(show, new Set())).toEqual(show);
      for (const w of metaWords(show)) expect(w, w).not.toMatch(/[\d๐-๙]/);
      for (const line of show.title) expect([...line].length).toBeLessThanOrEqual(META_LIMITS.titleLine);
      expect([...(show.note ?? "")].length).toBeLessThanOrEqual(META_LIMITS.note);
      if (show.layout === "shield") {
        expect(show.arrows.length).toBeLessThanOrEqual(META_LIMITS.arrows);
        for (const a of show.arrows) expect([...a].length).toBeLessThanOrEqual(META_LIMITS.arrow);
      }
      if (show.layout === "balance") for (const s of show.sides) expect([...s].length).toBeLessThanOrEqual(META_LIMITS.word);
      if (show.layout === "housepillar") expect([...show.label!].length).toBeLessThanOrEqual(META_LIMITS.word);
    });

    it(`${topic}: the old opener was a ${OLD_LAYOUT[topic]} scene whose lines are pinned, and the snapshot agrees`, () => {
      for (const v of VARIANTS[topic]) for (const customer of ["", "เอก"]) {
        const was = base[`${topic} | ${v.label} | ${JSON.stringify(customer)}`] as { layouts: string[]; title?: string[]; quote?: string[] };
        expect(was.layouts[0]).toBe(OLD_LAYOUT[topic]);
        expect(was.title ?? was.quote).toEqual(OLD_LINES[topic]);
      }
    });
  }

  it("voice: every opener says exactly what it said before", () => {
    for (const topic of OPENER_TOPICS.filter((t): t is Exclude<OpenerTopic, "pillar"> => t !== "pillar")) {
      for (const v of VARIANTS[topic]) {
        const first = knowEpisode(openerInput(topic, v.over), "", "F").scenes[0];
        expect(first.voice, topic).toBe(OLD_VOICE[topic]);
      }
    }
    // a customer's name leads the voice only where it did
    expect(knowEpisode(openerInput("selfemployed"), "เอก", "F").scenes[0].voice).toBe(`คุณเอก ${OLD_VOICE.selfemployed}`);
    expect(knowEpisode(openerInput("mythjinx"), "เอก", "F").scenes[0].voice).toBe(OLD_VOICE.mythjinx);
  });

  it("voice: the pillar's depends on the name and the asker's sex, as before", () => {
    const woman = { narrator: "w26", hero: "w15" };
    const man = { narrator: "w26", hero: "m09" };
    const voice = (faces: object, customer: string) => knowEpisode(openerInput("pillar", { faces }), customer, "F").scenes[0].voice;
    expect(voice(woman, "")).toBe("นี่คือครอบครัวหนึ่ง รายได้หลักของบ้าน มาจากแม่คนเดียวค่ะ");
    expect(voice(man, "")).toBe("นี่คือครอบครัวหนึ่ง รายได้หลักของบ้าน มาจากพ่อคนเดียวค่ะ");
    expect(voice(woman, "เอก")).toBe("นี่คือครอบครัวของคุณเอก รายได้หลักของบ้าน มาจากคุณเอกคนเดียวค่ะ");
    expect(voice(man, "เอก")).toBe("นี่คือครอบครัวของคุณเอก รายได้หลักของบ้าน มาจากคุณเอกคนเดียวค่ะ");
    // and the later scenes still say who goes (knowTwo)
    expect(knowEpisode(openerInput("pillar", { faces: man }), "", "F").scenes[2].voice).toBe("ถ้าวันหนึ่งพ่อไม่อยู่ รายได้หายไปในวันเดียว แต่ค่าใช้จ่ายทุกอย่างยังอยู่ค่ะ");
  });

  it("nothing else changes: every other scene, its show and voice, and the opener's key and voice, equal the snapshot taken before", () => {
    const now = openerSnapshot();
    expect(Object.keys(now)).toEqual(Object.keys(base));
    for (const [k, was] of Object.entries(base) as [string, { cta: string; opener: unknown; rest: unknown; layouts: string[] }][]) {
      const is = now[k] as typeof was;
      expect(is.cta, k).toBe(was.cta);
      expect(is.opener, k).toEqual(was.opener);
      expect(is.rest, k).toEqual(was.rest);
      expect(is.layouts.slice(1), k).toEqual(was.layouts.slice(1));
    }
  });

  it("the clip's script (key and voice per scene) is untouched, the contact card still last", () => {
    for (const topic of OPENER_TOPICS) {
      const keys = storyScript(openerInput(topic), "", "F").map((s) => s.key);
      expect(keys, topic).toEqual(["knowAsk", "knowOne", "knowTwo", "knowThree", "knowRecap", "storyContact"]);
    }
  });

  it("timing: the opener is a device scene, so its beats are held to the end (the tail covers them, whatever the voice)", () => {
    for (const topic of OPENER_TOPICS) {
      const inp = openerInput(topic);
      for (const voiceSec of [2, 6, 12]) {
        const tail = knowTail("knowAsk", inp, voiceSec);
        expect(tail, `${topic} ${voiceSec}s`).toBeTypeOf("number");
        expect(tail).toBe(deviceTail(OPENER[topic] as KnowShow, voiceSec));
      }
    }
  });

  it("looks: every look the topic offers draws the opener without throwing", () => {
    const contact = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
    for (const topic of OPENER_TOPICS) {
      const info = INFO_SHELVES.includes(topicOf(topic)!.shelf);
      // มินิมอล draws a man hero from the cast the form sends (m09 is the man's face)
      const arts: Record<string, unknown>[] = [{}, { art: "paper" }, { art: "line" }, { art: "minimal", ground: "warm", faces: { narrator: "w26", hero: "m09" }, cast: { hero: DEFAULT_CAST.hero.M, narrator: DEFAULT_CAST.narrator } }];
      if (info) arts.push({ art: "info" }, { art: "plot" }, { art: "board" }, { art: "neon" }, { art: "blueprint" });
      for (const art of arts) {
        const clip = checkedStory({ topic, faces: { narrator: "w26", hero: "w15" }, ...art } as never, "F");
        if (typeof clip === "string") throw new Error(`${topic} ${JSON.stringify(art)}: ${clip}`);
        const s = storyScript(clip, "", "F")[0];
        for (const size of ["portrait", "square", "landscape"] as const) {
          const c: StoryContext = { input: { ...clip, size }, size, customer: "", narrator: "F", contact, crowd: [], faces: {}, words: s.voice.split(" "), voiceSec: 5 };
          for (const frame of [0, 7, 90]) {
            expect(renderToStaticMarkup(clipFrame(s.key, c, frame)).length, `${topic} ${JSON.stringify(art)} ${size} f${frame}`).toBeGreaterThan(400);
          }
        }
      }
    }
  });
});
