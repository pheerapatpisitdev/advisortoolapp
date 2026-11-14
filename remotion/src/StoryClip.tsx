import { useEffect, useState, type CSSProperties } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clipCrowd, clipFaces, clipFrame, freeFrame } from "@/lib/quote-video/story-frames";
import { paperTime, storyBackground, storyFrame, type StoryContext } from "@/lib/quote-video/story-motion";
import { freeLook } from "@/lib/prompt-story/frames";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import type { StoryClipProps } from "@/lib/quote-video/remotion";
import type { StorySceneKey, StoryVideoInput } from "@/lib/quote-video/story";
import type { PromptStoryInput } from "@/lib/prompt-story/types";
import { crossing, loadFonts, SATORI_CSS } from "./Clip";
import { FxSound } from "./Fx";
import { joinCues, transitionOf } from "@/lib/quote-video/fx";
import { KeepWords } from "./KeepWords";

/**
 * คลิปเล่าเรื่อง and คลิปตามโจทย์ drawn by Remotion (src/lib/quote-video/remotion.ts StoryClipProps). The frames are
 * the app's own clipFrame / freeFrame at the scene's time, over the story paper; a คลิปตามโจทย์ scene's picture
 * fills the frame and is pushed in 1.00 → 1.12 over its scene, as buildJob's zoompan does (a health device scene has
 * none: freeFrame draws the device on the look's ground); the cross-fades are
 * job.ts's, at every one of the 30 frames a second.
 */

export type { StoryClipProps };

/**
 * สต็อปโมชันกระดาษ: every drawn piece (the jar, an arrow, an icon) throws a shadow on the table as the cut
 * faces and the title's tiles do, and every card is a piece of white-edged paper; the subtitle band is left flat.
 */
const PAPER_CSS = [
  ".paper .piece svg { filter: drop-shadow(3px 5px 3px rgba(42,26,14,0.4)); }",
  // a note, a list's card, a tag and the agent's card (marked `cut` / `cut-card` where they are drawn): white-edged, squarer, with a shadow
  ".paper .cut, .paper .cut-card > div:first-child { border-color: white !important; border-width: 7px !important; border-radius: 8px !important; box-shadow: 7px 11px 9px rgba(42,26,14,0.42); }",
  ".paper .cut svg, .paper .cut-card svg { filter: none; }",
  // ฉากกระดาษใต้แสงอุ่น: the lamp throws a soft shadow under every person and thing, and a card is a sheet of
  // paper lifted off the backdrop, with no inked edge
  ".warm .piece svg { filter: drop-shadow(5px 10px 7px rgba(58,42,24,0.3)); }",
  ".warm .cut, .warm .cut-card > div:first-child { border-color: transparent !important; border-radius: 22px !important; box-shadow: 0 16px 26px rgba(58,42,24,0.3); }",
  ".warm .cut svg, .warm .cut-card svg { filter: none; }",
].join("\n");

/** the looks that draw no cartoon face: their own people (มินิมอล, the dolls), or none at all (the info route's own looks) */
const NO_FACES: ReadonlySet<string> = new Set(["minimal", "paper", "line", "board", "neon", "blueprint"]);

/** the zoompan's push: 1.00 at the scene's start to 1.12 at its end */
export const PUSH = 0.12;

const asUrl = (at: string) => (/^https?:\/\//.test(at) ? at : staticFile(at));

/** pictures already decoded, held so the page keeps them: the frames' plain <img>s then draw at once */
const held: HTMLImageElement[] = [];

/**
 * The fonts, and every picture the frames show (the cartoon faces, the contact photo), loaded and decoded
 * before the first frame: the app's frames draw them with plain <img>s, which Remotion does not wait for.
 */
function useReady(pictures: string[]): boolean {
  const [handle] = useState(() => delayRender("fonts and pictures"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([
      loadFonts(),
      ...pictures.map(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        held.push(img);
      }),
    ]).then(() => { setReady(true); continueRender(handle); }, (e) => { console.error(e); throw e; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

export function StoryClip(p: StoryClipProps) {
  const frame = useCurrentFrame();
  const { fps, width: w } = useVideoConfig();
  // the cartoon faces, colour and grey, from the bundle's story/faces as story-faces.ts reads them; มินิมอล draws its people
  // instead, and ไวต์บอร์ด นีออน บลูพริ้นท์ draw none
  const story = p.kind === "story" ? (p.input as StoryVideoInput) : null;
  const faces: Record<string, string> = {};
  for (const id of story && !NO_FACES.has(story.art ?? "") ? clipFaces(story) : []) {
    faces[id] = staticFile(`story/faces/${id}.jpg`);
    faces[`${id}-g`] = staticFile(`story/faces/${id}-g.jpg`);
  }
  const ready = useReady([...Object.values(faces), ...(p.contact.photo ? [p.contact.photo] : [])]);
  if (!ready) return null;
  // คลิปตามโจทย์ in one of คลิปเล่าเรื่อง's looks (frames.tsx freeLook): its agent's card, its ground and its cards are that look's
  const freeIn = p.kind === "free" ? (p.input as PromptStoryInput) : null;
  const dress = freeIn ? freeLook(freeIn) : null;
  const lookIn = (story ?? (dress?.art ? { ...freeIn, ...dress } : null)) as StoryVideoInput | null;
  const T = frame / fps;
  const crowd = story ? clipCrowd(story) : [];
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    // สต็อปโมชันกระดาษ holds a คลิปตามโจทย์ scene to its 12 poses a second too, the picture's push with it
    const t = dress?.art === "paper" ? paperTime(T - sc.start) : T - sc.start;
    const c: StoryContext = {
      input: (dress?.art ? lookIn : p.input) as StoryVideoInput, size: p.size, customer: p.customer, narrator: p.narrator, contact: p.contact,
      crowd, faces, words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec,
    };
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(transitionOf(sc.key, Boolean(p.fx), TRANSITIONS), t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(transitionOf(next.key, Boolean(p.fx), TRANSITIONS), (T - next.start) / XFADE, w).out;
    const free = p.kind === "free" ? (p.input as PromptStoryInput) : null;
    // a health device is drawn by the system in the clip's look, on the same ground as a scene with no picture
    const picture = sc.picture && !(free && sc.key !== "storyContact" && free.scenes[s]?.device) ? sc.picture : undefined;
    const body = !free ? clipFrame(sc.key as StorySceneKey, c, t)
      : sc.key === "storyContact" ? storyFrame("storyContact", c, t)
      : freeFrame(free.scenes[s], Boolean(picture), c as unknown as Parameters<typeof freeFrame>[2], t);
    return (
      <AbsoluteFill key={`${sc.key}-${s}`} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>{storyBackground(p.size, lookIn ?? undefined)}</div>
        {picture ? (
          <Img src={asUrl(picture)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + PUSH * Math.min(1, t / sc.dur)})` }} />
        ) : null}
        <div className="piece" style={{ position: "absolute", inset: 0, display: "flex" }}><KeepWords>{body}</KeepWords></div>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className={lookIn?.art === "paper" ? "sat paper" : lookIn?.art === "minimal" && lookIn.ground === "warm" ? "sat warm" : "sat"} style={{ background: "#000" }}>
      <style>{SATORI_CSS}{PAPER_CSS}</style>
      {layers}
      <Audio src={asUrl(p.audio)} />
      {p.fx ? <FxSound music={p.fx.music} cues={joinCues(p.scenes)} scenes={p.scenes} total={p.total} fps={fps} /> : null}
    </AbsoluteFill>
  );
}
