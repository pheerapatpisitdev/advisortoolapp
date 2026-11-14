import { checkedStory, type StoryVideoInput } from "@/lib/quote-video/story";
import { knowEpisode } from "@/lib/quote-video/story-knowledge";

/** the eight topics whose opening scene became a metaphor (device round 3, Task 5), and the inputs each is checked with */
export const OPENER_TOPICS = ["pillar", "mythjinx", "fiverisks", "selfemployed", "pricey", "bank", "welfare", "ciincome"] as const;
export type OpenerTopic = (typeof OPENER_TOPICS)[number];

const LIFE = { plan: "LIFEPROTECT", variant: "WLF99H", sex: "M", age: 35, sumAssured: 3_000_000 };
const SHIELD = { plan: "ISHIELD", variant: "WLCI20", sex: "F", age: 35, sumAssured: 1_000_000 };
const HERO_FACES = { woman: { narrator: "w26", hero: "w15" }, man: { narrator: "w26", hero: "m09" } };

/** every input shape a topic is told with: the asker's sex, with and without a premium, the household's and the form's numbers */
export const VARIANTS: Record<OpenerTopic, { label: string; over: Record<string, unknown> }[]> = {
  pillar: [
    { label: "woman bare", over: { faces: HERO_FACES.woman } },
    { label: "man bare", over: { faces: HERO_FACES.man } },
    { label: "man home+figure", over: { faces: HERO_FACES.man, home: { monthly: 25_000, years: 10 }, figure: LIFE } },
    { label: "woman home+figure", over: { faces: HERO_FACES.woman, home: { monthly: 25_000, years: 10 }, figure: LIFE } },
  ],
  mythjinx: [{ label: "bare", over: {} }],
  fiverisks: [{ label: "bare", over: {} }],
  selfemployed: [{ label: "bare", over: {} }, { label: "figure", over: { figure: SHIELD } }],
  pricey: [{ label: "bare", over: {} }, { label: "figure", over: { figure: LIFE } }],
  bank: [{ label: "bare", over: {} }, { label: "figure", over: { figure: LIFE } }],
  welfare: [{ label: "bare", over: {} }, { label: "figure", over: { figure: SHIELD } }],
  ciincome: [{ label: "bare", over: {} }, { label: "money", over: { money: { monthly: 30_000, months: 6, ciSum: 1_000_000 } } }],
};
export const CUSTOMERS = ["", "เอก"] as const;

export function openerInput(topic: OpenerTopic, over: Record<string, unknown> = {}): StoryVideoInput {
  const s = checkedStory({ topic, faces: { narrator: "w26", hero: "w15" }, ...over } as never, "F");
  if (typeof s === "string") throw new Error(`${topic}: ${s}`);
  return s;
}

/** the scenes of every variant of every topic as { key, layout, voice, show? }: the whole show of every scene but the first */
export function openerSnapshot() {
  const out: Record<string, unknown> = {};
  for (const topic of OPENER_TOPICS) {
    for (const v of VARIANTS[topic]) {
      for (const customer of CUSTOMERS) {
        const e = knowEpisode(openerInput(topic, v.over), customer, "F");
        out[`${topic} | ${v.label} | ${JSON.stringify(customer)}`] = {
          cta: e.cta,
          opener: { key: e.scenes[0].key, voice: e.scenes[0].voice },
          rest: e.scenes.slice(1).map((s) => ({ key: s.key, voice: s.voice, show: s.show })),
          layouts: e.scenes.map((s) => s.show.layout),
          title: "title" in e.scenes[0].show ? e.scenes[0].show.title : undefined,
          quote: "quote" in e.scenes[0].show ? e.scenes[0].show.quote : undefined,
        };
      }
    }
  }
  return out;
}
