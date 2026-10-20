import { Audio, Sequence, staticFile } from "remotion";
import { musicVolume, type Cue, type MusicMood } from "@/lib/quote-video/fx";

/**
 * ลูกเล่นคลิปใหม่'s sound (src/lib/quote-video/fx.ts): the music under the narration, quieter while the voice speaks,
 * and each sound effect where fx-cues.ts places it. The files are in this project's public/fx, made once.
 */
export function FxSound({ music, cues, scenes, total, fps }: {
  music: MusicMood | null; cues: Cue[]; scenes: { start: number; voiceSec: number }[]; total: number; fps: number;
}) {
  return (
    <>
      {music ? <Audio src={staticFile(`fx/music-${music}.mp3`)} loop volume={(f) => musicVolume(f / fps, scenes, total)} /> : null}
      {cues.map((c, k) => (
        <Sequence key={k} from={Math.round(c.at * fps)} durationInFrames={Math.round(1.6 * fps)}>
          <Audio src={staticFile(`fx/${c.sound}.mp3`)} volume={c.volume} />
        </Sequence>
      ))}
    </>
  );
}
