import { useEffect, useState, type CSSProperties } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clipCrowd, clipFaces, clipFrame, freeFrame } from "@/lib/quote-video/story-frames";
import { storyBackground, storyFrame, type StoryContext } from "@/lib/quote-video/story-motion";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { XFADE } from "@/lib/quote-video/timeline";
import type { StoryClipProps } from "@/lib/quote-video/remotion";
import type { StorySceneKey, StoryVideoInput } from "@/lib/quote-video/story";
import type { PromptStoryInput } from "@/lib/prompt-story/types";
import { crossing, loadFonts, SATORI_CSS } from "./Clip";
import { KeepWords } from "./KeepWords";

/**
 * คลิปเล่าเรื่อง and คลิปตามโจทย์ drawn by Remotion (src/lib/quote-video/remotion.ts StoryClipProps). The frames are
 * the app's own clipFrame / freeFrame at the scene's time, over the story paper; a คลิปตามโจทย์ scene's picture
 * fills the frame and is pushed in 1.00 → 1.12 over its scene, as buildJob's zoompan does; the cross-fades are
 * job.ts's, at every one of the 30 frames a second.
 */

export type { StoryClipProps };

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
  // the cartoon faces, colour and grey, from the bundle's story/faces as story-faces.ts reads them; มินิมอล draws its people instead
  const story = p.kind === "story" ? (p.input as StoryVideoInput) : null;
  const faces: Record<string, string> = {};
  for (const id of story && story.art !== "minimal" ? clipFaces(story) : []) {
    faces[id] = staticFile(`story/faces/${id}.jpg`);
    faces[`${id}-g`] = staticFile(`story/faces/${id}-g.jpg`);
  }
  const ready = useReady([...Object.values(faces), ...(p.contact.photo ? [p.contact.photo] : [])]);
  if (!ready) return null;
  const T = frame / fps;
  const crowd = story ? clipCrowd(story) : [];
  const layers = p.scenes.map((sc, s) => {
    if (T < sc.start || T >= sc.start + sc.dur) return null;
    const t = T - sc.start;
    const c: StoryContext = {
      input: p.input as StoryVideoInput, size: p.size, customer: p.customer, narrator: p.narrator, contact: p.contact,
      crowd, faces, words: sc.voice.split(" ").filter(Boolean), voiceSec: sc.voiceSec,
    };
    let style: CSSProperties = {};
    const next = p.scenes[s + 1];
    if (t < XFADE && s > 0) style = crossing(TRANSITIONS[sc.key] ?? "fade", t / XFADE, w).in;
    else if (next && T >= next.start) style = crossing(TRANSITIONS[next.key] ?? "fade", (T - next.start) / XFADE, w).out;
    const free = p.kind === "free" ? (p.input as PromptStoryInput) : null;
    const body = !free ? clipFrame(sc.key as StorySceneKey, c, t)
      : sc.key === "storyContact" ? storyFrame("storyContact", c, t)
      : freeFrame(free.scenes[s], Boolean(sc.picture), c as unknown as Parameters<typeof freeFrame>[2], t);
    return (
      <AbsoluteFill key={`${sc.key}-${s}`} style={{ overflow: "hidden", ...style }}>
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>{storyBackground(p.size, story ?? undefined)}</div>
        {sc.picture ? (
          <Img src={asUrl(sc.picture)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1 + PUSH * Math.min(1, t / sc.dur)})` }} />
        ) : null}
        <KeepWords>{body}</KeepWords>
      </AbsoluteFill>
    );
  });
  return (
    <AbsoluteFill className="sat" style={{ background: "#000" }}>
      <style>{SATORI_CSS}</style>
      {layers}
      <Audio src={asUrl(p.audio)} />
    </AbsoluteFill>
  );
}
