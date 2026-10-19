import { Composition } from "remotion";
import { REMOTION_DRAWING } from "@/lib/quote-video/remotion";
import { SIZES } from "@/lib/quote-video/timeline";
import { Clip, type ClipProps } from "./Clip";
import { StoryClip, type StoryClipProps } from "./StoryClip";

/** props made for another version of the drawing code would be drawn wrong: refused, so the clip fails and is not charged */
function sameDrawing(drawing: string | undefined) {
  if (drawing !== REMOTION_DRAWING) throw new Error(`drawing ${drawing} is not this image's ${REMOTION_DRAWING}: build the Remotion image again`);
}

/**
 * QuoteMotion: วิดีโอนำเสนอ's Motion Graphic clip, its theme and its facts in the inputProps (prepare/prepare.test.ts writes them).
 * StoryClip: คลิปเล่าเรื่อง and คลิปตามโจทย์, in the clip's own size.
 */
export function Root() {
  return (
    <>
      <Composition
        id="QuoteMotion"
        component={Clip}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={30}
        defaultProps={{} as ClipProps}
        calculateMetadata={({ props }) => {
          sameDrawing(props.drawing);
          return { durationInFrames: Math.max(1, Math.round((props.total ?? 1) * 30)) };
        }}
      />
      <Composition
        id="StoryClip"
        component={StoryClip}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={30}
        defaultProps={{} as StoryClipProps}
        calculateMetadata={({ props }) => {
          sameDrawing(props.drawing);
          const { w, h } = SIZES[props.size ?? "portrait"];
          return { width: w, height: h, durationInFrames: Math.max(1, Math.round((props.total ?? 1) * 30)) };
        }}
      />
    </>
  );
}
