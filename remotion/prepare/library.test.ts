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
 * The อุปมา metaphors (device round 3, 2026-11-15) are each the opening scene of the topic the library links them to,
 * photographed there in every look the topic keeps. เสาหลักหายไป and ฟรีแลนซ์ are on shelves told with people, which keep
 * no info-route look (ปากกาพล็อตเตอร์ ไวต์บอร์ด นีออน บลูพริ้นท์), so in those four looks เสาหลักของบ้าน and ตาข่ายนิรภัย are
 * photographed in คลิปตามโจทย์, on the opener's own words.
 * The ออมเงิน devices (device round 4, 2026-11-15) are told on the spec's example, ชาย 40 ปี, บำนาญ 10,000 a month from 60, paid
 * until 60: pricerise, savejar (20 years, 2,724,410) and paidgot (2,724,410 over 40-59 against 6,023,625 over 60-95) are the
 * scenes of เก็บเงินไว้ใช้ตอนเกษียณ that open them; pensionsteps is in no episode, so it is a คลิปตามโจทย์ scene on the four
 * bands 118,110 / 157,480 / 196,851 / 236,221 (60-75, 76-80, 81-85, 86-95).
 * The สุขภาพเพิ่มเติม devices (device round 5, 2026-11-15) are told on iHealthy GOLD (ชาย 35 ปี: room 9,000 a day, OPD 12,000 a year,
 * deductible 50,000, co-payment 20 percent, renewal to 98): ipdopd, renew98 and hospitals (the list's total 537 and its five largest
 * provinces) are the scenes of the episode ipdopd; deductible (bill 100,000), copay (bill 100,000), parentshealth (cap 15,000),
 * groupcost (plan 1, 10-25 heads, 2,552 a year) and paclaim (Platinum 03: medical 150,000, weekly 3,000, 52 weeks) are in no
 * episode, so they are คลิปตามโจทย์ scenes on those figures.
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
  { topic: "ciincome", money: { monthly: 30_000, months: 6, ciSum: 1_000_000 }, devices: ["lifering", "incomestop", "cilump"] },
  { topic: "taxback", money: { premium: 50_000, bracket: 20 }, devices: ["taxcap", "taxback"] },
  // อุปมา (round 3): the opener of each topic, on the topic's own words; pillar and selfemployed keep no info-route look
  { topic: "mythjinx", devices: ["umbrella"] },
  { topic: "fiverisks", devices: ["shield"] },
  { topic: "pricey", devices: ["seedtree"] },
  { topic: "bank", devices: ["balance"] },
  { topic: "welfare", devices: ["bridge"] },
  { topic: "pillar", devices: ["housepillar"], people: true },
  { topic: "selfemployed", devices: ["safetynet"], people: true },
  // ออมเงิน (round 4): the scenes of เก็บเงินไว้ใช้ตอนเกษียณ, told on the pension the spec's example types
  { topic: "retiresave", pension: { sex: "M", age: 40, annuityAge: 60, pay: "untilAnnuity", monthly: 10_000 }, devices: ["pricerise", "savejar", "paidgot"] },
  // สุขภาพเพิ่มเติม (round 5): the scenes of ผู้ป่วยใน ผู้ป่วยนอก ต่างกันยังไง on iHealthy GOLD, a man of 35
  { topic: "ipdopd", health: { plan: "GOLD", sex: "M", age: 35 }, devices: ["ipdopd", "renew98", "hospitals"] },
] as const;
/** the devices in no episode, as a คลิปตามโจทย์ writer may give them: one device scene, then the agent's card */
const FREE = [
  { file: "limit", title: "วงเงินรักษาต่อปี", voice: "วงเงินรักษาต่อปีของ iHealthy Silver 15 ล้านบาท ใช้ไป 800,000 บาท ยังเหลืออีกมาก",
    device: { layout: "limit", title: ["วงเงินรักษา", "ต่อปี"], limit: 15_000_000, used: 800_000, planName: "iHealthy Silver" } },
  { file: "threegen", title: "ส่งต่อสามรุ่น", voice: "เงินก้อนจากประกันชีวิต ส่งต่อจากรุ่นปู่ย่า ถึงรุ่นพ่อแม่ และถึงรุ่นลูก",
    device: { layout: "threegen", title: ["ส่งต่อ", "สามรุ่น"], rows: ["รุ่นปู่ย่า", "รุ่นพ่อแม่", "รุ่นลูก"], note: "ส่งต่อเงินก้อนให้ลูกหลาน" } },
  // the two metaphors whose topics keep no info-route look, in those looks only, as their openers say them
  { file: "housepillar", title: "เสาหลักของบ้าน", voice: "นี่คือครอบครัวหนึ่ง รายได้หลักของบ้าน มาจากพ่อคนเดียวค่ะ", info: true,
    device: { layout: "housepillar", title: ["บ้านนี้มีเสาหลัก", ""], note: "รายได้หลักของบ้าน", label: "รายได้" } },
  { file: "safetynet", title: "ตาข่ายนิรภัย", voice: "ทำงานของตัวเอง ไม่มีเจ้านาย แล้วสวัสดิการล่ะคะ", info: true,
    device: { layout: "safetynet", title: ["ไม่มีเจ้านาย", "สวัสดิการล่ะ?"], note: "ตาข่ายนี้ เราขึงเองได้" } },
  // ออมเงิน (round 4): in no episode, so as a คลิปตามโจทย์ scene on the example's four bands, in every look
  { file: "pensionsteps", title: "บำนาญขั้นบันได", voice: "บำนาญที่ได้รับ ขยับขึ้นเป็นขั้น ตามช่วงอายุค่ะ",
    device: { layout: "pensionsteps", title: ["บำนาญ", "ขั้นบันได"], note: "ค่าครองชีพก็สูงขึ้น วางแผนเผื่อไว้",
      rows: [{ from: 60, to: 75, annual: 118_110 }, { from: 76, to: 80, annual: 157_480 }, { from: 81, to: 85, annual: 196_851 }, { from: 86, to: 95, annual: 236_221 }] } },
  // สุขภาพเพิ่มเติม (round 5): in no episode, so as คลิปตามโจทย์ scenes on the sheet's, the tables' and the spec's own figures, in every look
  { file: "deductible", title: "ส่วนรับผิดชอบแรก", voice: "บิลหนึ่งใบ ส่วนแรกเราจ่ายเอง ส่วนที่เหลือประกันจ่ายค่ะ",
    device: { layout: "deductible", title: ["ส่วนรับผิดชอบแรก", "เราจ่ายก่อน"], note: "ตามเงื่อนไขของแผน", deductible: 50_000, bill: 100_000 } },
  { file: "copay", title: "ร่วมจ่าย", voice: "บิลหนึ่งใบ แบ่งกันจ่าย ส่วนหนึ่งเรา ส่วนหนึ่งประกันค่ะ",
    device: { layout: "copay", title: ["ร่วมจ่าย", "ตามเงื่อนไข"], note: "แบ่งตามส่วน", percent: 20, bill: 100_000 } },
  { file: "parentshealth", title: "ประกันสุขภาพให้พ่อแม่", voice: "ซื้อประกันสุขภาพให้พ่อแม่ แล้วนำค่าประกันไปลดหย่อนภาษีได้ตามเพดานค่ะ",
    device: { layout: "parentshealth", title: ["ประกันสุขภาพ", "ให้พ่อแม่"], note: "ตามเงื่อนไขของแผน", cap: 15_000 } },
  { file: "groupcost", title: "ต้นทุนต่อหัว ประกันกลุ่ม", voice: "ประกันกลุ่มของบริษัท ต้นทุนต่อคนต่อปี หารเป็นเดือนได้เท่านี้ค่ะ",
    device: { layout: "groupcost", title: ["ต้นทุนต่อหัว", "ประกันกลุ่ม"], note: "ตามตารางประกันกลุ่ม", perYear: 2_552, band: "10-25" } },
  { file: "paclaim", title: "อุบัติเหตุหนึ่งครั้ง", voice: "อุบัติเหตุหนึ่งครั้ง ประกันจ่ายค่ารักษาและชดเชยรายสัปดาห์ตามแผนค่ะ",
    device: { layout: "paclaim", title: ["อุบัติเหตุ", "หนึ่งครั้ง"], note: "ตามแผนที่เลือก", medical: 150_000, weekly: 3_000, weeks: 52 } },
] as const;
/** ปากกาพล็อตเตอร์ ไวต์บอร์ด นีออน บลูพริ้นท์: kept only on the shelves told in points (story/topics.ts INFO_ARTS) */
const INFO_LOOKS: readonly string[] = ["plot", "board", "neon", "blueprint"];
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
      if ("people" in e && INFO_LOOKS.includes(look)) continue;
      const name = `lib-${e.topic}${"tag" in e ? `-${e.tag}` : ""}-${look}`;
      const { input, plans, moment } = clip(name, { topic: e.topic, ...("health" in e ? { health: e.health } : {}), ...("home" in e ? { home: e.home } : {}), ...("money" in e ? { money: e.money } : {}), ...("pension" in e ? { pension: e.pension } : {}) }, look);
      const scenes = knowEpisode(input).scenes;
      plans.forEach((p, i) => {
        const show = scenes.find((s) => s.key === p.key)?.show;
        if (!show || !isDevice(show) || !(e.devices as readonly string[]).includes(show.layout)) return;
        shots.push({ file: `${show.layout}-${look}.jpg`, props: name, at: moment(i) });
      });
    }
    // วงเงินต่อปีเติมหลอด, ส่งต่อสามรุ่น (and the two metaphors in the info looks) as คลิปตามโจทย์ scenes (prompt-story's style calls แสงอุ่น "warm")
    const style = look === "minimal" ? "warm" : look;
    for (const f of FREE) {
      if ("info" in f && !INFO_LOOKS.includes(look)) continue;
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
  // 7 looks × (36 devices + the look picture): the 63 of round 1 and the new looks, round 2's 8 × 7 = 56, round 3's 8 × 7 = 56, round 4's 4 × 7 = 28 and round 5's 8 × 7 = 56
  if (new Set(shots.map((s) => s.file)).size !== 259 || shots.length !== 259) throw new Error(`259 pictures expected: ${shots.map((s) => s.file).join(" ")}`);
  writeFileSync(join(PUB, "props/library.json"), JSON.stringify(shots, null, 1));
});
