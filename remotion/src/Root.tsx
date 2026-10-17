import { Composition } from "remotion";
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
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round((props.total ?? 1) * 30)) })}
    />
  );
}
