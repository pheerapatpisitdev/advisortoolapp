import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";

/**
 * คลังแอนิเมชัน's preview pictures (scene library phase 2, 2026-11-14): the props for one คลิปเล่าเรื่อง per
 * health episode and look, and a list of the moments to photograph (public/props/library.json), which
 * remotion/library-stills.mjs renders into the app's public/library/. Run by that script, not by ship.sh:
 *
 *   LIBRARY=1 npx vitest run --config remotion/prepare/vitest.config.ts remotion/prepare/library.test.ts
 *
 * Figures as phase 1's samples: iHealthy Silver, a man of 35, a 6,000-baht room, an 800,000-baht bill and a
 * 50,000-baht group sum. ส่วนต่างที่จ่ายเอง alone is on iHealthy Smart (3,000,000 a year) with a 3,500,000 bill:
 * the story takes the limit from the plan and a bill only up to 10,000,000, so on Silver (15,000,000) it can
 * only ever say the bill is inside the limit, and the picture would not show the device's overflow.
 * วงเงินต่อปีเติมหลอด is photographed in คลิปตามโจทย์ (prompt-story), as its writer may type it: the story tells
 * Silver's limit alone, an empty tube, where the prompt clip fills the tube with what was used (the 800,000 bill).
 * ส่งต่อสามรุ่น is in no episode either (the library links it to ทุนชีวิตเท่าไหร่ถึงพอ), so it too is photographed in คลิปตามโจทย์.
 * Every other device is photographed in the episode the library links it to (catalog.ts DEVICE_TOPIC), whole, after every one
 * of its moves and before the next scene comes in. The ชีวิต ภาษี มรดก episodes (device round 2, 2026-11-14) are told on
 * the figures the story-money tests type: a debt of 2,000,000, 300,000 a year for 10 years, 800,000 for school and
 * 3,000,000 of cover had; 30,000 a month stopped 6 months with a 1,000,000 CI sum; a 50,000 premium at the 20% rate.
 * The voice is silence; no database, no paid call.
 */

const PUB = join(__dirname, "..", "public");
const CONTACT = { name: "ภีรพัฒน์ ตัวอย่าง", phone: "081-234-5678", line: "@unitclub" };
const LOOKS = ["paper", "minimal", "line", "plot", "board", "neon", "blueprint"] as const;
/** the episodes the devices stand in, and the figures each is told on */
const SILVER = { plan: "SILVER", sex: "M", age: 35, room: 6000, bill: 800_000 };
const EPISODES = [
  { topic: "lumpsum", health: SILVER, devices: ["split"] },
  { topic: "roomcost", health: SILVER, devices: ["room"] },
  { topic: "roomcost", health: { ...SILVER, plan: "SMART", bill: 3_500_000 }, devices: ["overflow"], tag: "over" },
  { topic: "waiting", health: SILVER, devices: ["waiting", "cashless"] },
  { topic: "agecost", health: SILVER, devices: ["agecost"] },
  { topic: "groupins", home: { kind: "group", bill: 800_000, group: 50_000 }, devices: ["groupgap"] },
  { topic: "lifeneed", money: { debts: 2_000_000, expenses: 300_000, years: 10, education: 800_000, have: 3_000_000 }, devices: ["lifeneed", "beneficiary", "moneysplit"] },
  { topic: "ciincome", money: { monthly: 30_000, months: 6, ciSum: 1_000_000 }, devices: ["incomestop", "cilump"] },
  { topic: "taxback", money: { premium: 50_000, bracket: 20 }, devices: ["taxcap", "taxback"] },
] as const;
/** the devices in no episode, as a คลิปตามโจทย์ writer may give them: one device scene, then the agent's card */
const FREE = [
  { file: "limit", title: "วงเงินรักษาต่อปี", voice: "วงเงินรักษาต่อปีของ iHealthy Silver 15 ล้านบาท ใช้ไป 800,000 บาท ยังเหลืออีกมาก",
    device: { layout: "limit", title: ["วงเงินรักษา", "ต่อปี"], limit: 15_000_000, used: 800_000, planName: "iHealthy Silver" } },
  { file: "threegen", title: "ส่งต่อสามรุ่น", voice: "เงินก้อนจากประกันชีวิต ส่งต่อจากรุ่นปู่ย่า ถึงรุ่นพ่อแม่ และถึงรุ่นลูก",
    device: { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["รุ่นปู่ย่า", "รุ่นพ่อแม่", "รุ่นลูก"], note: "ส่งต่อเงินก้อนให้ลูกหลาน" } },
] as const;
/** the look pictures: one scene of one episode, the same in every look so they compare */
const LOOK_SCENE = { topic: "sumvspremium", key: "knowOne" } as const;

function silentWav(sec: number): Buffer {
  const n = Math.ceil(sec * 24000);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

it.runIf(Boolean(process.env.LIBRARY))("prepares the library's preview props", async () => {
  const { checkedStory, storyScript } = await import("@/lib/quote-video/story");
  const { clipTail, clipWindows } = await import("@/lib/quote-video/story-frames");
  const { knowEpisode, isDevice } = await import("@/lib/quote-video/story-knowledge");
  const { DEVICE_HOLD } = await import("@/lib/quote-video/story-knowledge-motion");
  const { planScenes, clipLength, XFADE } = await import("@/lib/quote-video/timeline");
  const { MOTION_FPS } = await import("@/lib/quote-video/motion");
  const { storyClipProps } = await import("@/lib/quote-video/remotion");
  const { DEFAULT_CAST } = await import("@/lib/story/figure");
  const { freeTail, freeWindows } = await import("@/lib/prompt-story/frames");
  const { contactSpec } = await import("@/lib/quote-video/story-motion");
  for (const d of ["audio", "props"]) mkdirSync(join(PUB, d), { recursive: true });
  const secsOf = (voice: string) => Math.max(2.5, [...voice].length / 9);

  const shots: { file: string; props: string; at: number }[] = [];
  const clip = (name: string, v: Record<string, unknown>, look: (typeof LOOKS)[number]) => {
    const art = look === "minimal" ? { art: "minimal", ground: "warm", cast: { hero: DEFAULT_CAST.hero.M, narrator: DEFAULT_CAST.narrator } } : { art: look };
    const input = checkedStory({ faces: { narrator: "w26", hero: "m09" }, palette: "color", ...v, ...art } as never, "F");
    if (typeof input === "string") throw new Error(`${name}: ${input}`);
    if (input.art !== look) throw new Error(`${name}: drawn in ${input.art}, not ${look}`);
    const script = storyScript(input, "", "F");
    const secs = script.map((s) => secsOf(s.voice));
    const plans = planScenes(script.map((s, i) => ({ key: s.key, voice: s.voice, voiceSec: secs[i], windows: clipWindows(s.key, input, "portrait"), fps: MOTION_FPS, ...clipTail(s.key, input, secs[i]) })));
    writeFileSync(join(PUB, `audio/${name}.wav`), silentWav(clipLength(plans)));
    writeFileSync(join(PUB, `props/${name}.json`), JSON.stringify(storyClipProps(input, "portrait", "", "F", CONTACT, plans, script, secs, clipLength(plans), `audio/${name}.wav`, [])));
    /** a scene's moment: every move done, half the hold gone, before the next scene's cross-fade */
    const moment = (i: number) => {
      const end = Math.max(0, ...clipWindows(plans[i].key as never, input, "portrait").map(([, to]) => to));
      const at = Math.min(end + DEVICE_HOLD / 2, plans[i].dur - XFADE - 0.1);
      return plans[i].start + at;
    };
    return { input, plans, moment };
  };

  for (const look of LOOKS) {
    for (const e of EPISODES) {
      const name = `lib-${e.topic}${"tag" in e ? `-${e.tag}` : ""}-${look}`;
      const { input, plans, moment } = clip(name, { topic: e.topic, ...("health" in e ? { health: e.health } : {}), ...("home" in e ? { home: e.home } : {}), ...("money" in e ? { money: e.money } : {}) }, look);
      const scenes = knowEpisode(input).scenes;
      plans.forEach((p, i) => {
        const show = scenes.find((s) => s.key === p.key)?.show;
        if (!show || !isDevice(show) || !(e.devices as readonly string[]).includes(show.layout)) return;
        shots.push({ file: `${show.layout}-${look}.jpg`, props: name, at: moment(i) });
      });
    }
    // วงเงินต่อปีเติมหลอด and ส่งต่อสามรุ่น as คลิปตามโจทย์ scenes (prompt-story's style calls แสงอุ่น "warm")
    const style = look === "minimal" ? "warm" : look;
    for (const f of FREE) {
      const free = {
        product: "FREESTORY", brief: "", title: f.title, caption: "", style, painter: "sharp", size: "portrait", narrator: "F", faces: { narrator: "w26" }, pictures: [null],
        scenes: [{ voice: f.voice, screen: "", picture: "", device: f.device }],
      };
      const fScript = [{ key: "freeScene", voice: free.scenes[0].voice }, { key: "storyContact", voice: "สนใจรายละเอียดเพิ่มเติม ทักมาได้เลยนะคะ" }];
      const fSecs = fScript.map((x) => secsOf(x.voice));
      const card = Object.values(contactSpec()).map((x): [number, number] => [x.at, x.at + x.dur]);
      const fPlans = planScenes(fScript.map((x, i) => ({ key: x.key, voice: x.voice, voiceSec: fSecs[i], windows: i ? card : freeWindows(), fps: MOTION_FPS, ...(i ? {} : freeTail(free.scenes[0] as never, fSecs[0])) })));
      const fName = `lib-${f.file}-${look}`;
      writeFileSync(join(PUB, `audio/${fName}.wav`), silentWav(clipLength(fPlans)));
      writeFileSync(join(PUB, `props/${fName}.json`), JSON.stringify(storyClipProps(free as never, "portrait", "", "F", CONTACT, fPlans, fScript, fSecs, clipLength(fPlans), `audio/${fName}.wav`, [undefined])));
      // the scene runs until the device has stood whole DEVICE_HOLD (freeTail): half of that hold
      shots.push({ file: `${f.file}-${look}.jpg`, props: fName, at: fPlans[0].start + fPlans[0].dur - XFADE - DEVICE_HOLD / 2 });
    }

    const name = `lib-look-${look}`;
    const { plans, moment } = clip(name, { topic: LOOK_SCENE.topic }, look);
    shots.push({ file: `look-${look}.jpg`, props: name, at: moment(plans.findIndex((p) => p.key === LOOK_SCENE.key)) });
  }
  // 7 looks × (16 devices + the look picture): the 63 of round 1 and the new looks, and round 2's 8 × 7 = 56
  if (new Set(shots.map((s) => s.file)).size !== 119 || shots.length !== 119) throw new Error(`119 pictures expected: ${shots.map((s) => s.file).join(" ")}`);
  writeFileSync(join(PUB, "props/library.json"), JSON.stringify(shots, null, 1));
});
