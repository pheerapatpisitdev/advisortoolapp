import { Composition } from "remotion";
import { REMOTION_DRAWING } from "@/lib/quote-video/remotion";
import { Clip, type ClipProps } from "./Clip";

/** One composition: the Life Protect clip, its theme and its facts in the inputProps (prepare/prepare.test.ts writes them). */
export function Root() {
  return (
    <Composition
      id="QuoteMotion"
      component={Clip}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      defaultProps={{} as ClipProps}
      calculateMetadata={({ props }) => {
        // props made for another version of the drawing code would be drawn wrong: refused, so the clip fails and is not charged
        if (props.drawing !== REMOTION_DRAWING) throw new Error(`drawing ${props.drawing} is not this image's ${REMOTION_DRAWING}: build the Remotion image again`);
        return { durationInFrames: Math.max(1, Math.round((props.total ?? 1) * 30)) };
      }}
    />
  );
}
