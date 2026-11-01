import type { SatoriOptions } from "satori";

/**
 * A face a picture is drawn in. Either its bytes (a Google face fetched and cut to the letters,
 * src/lib/google-font.ts) or, for the faces we ship, just the file's name: whoever draws reads
 * it — the app's server off its own disk, the draw service off its copy — so a route that only
 * describes a picture never reads a font, and a server without a disk can describe one too.
 */
export interface FontFile { file: string }
type SatoriFont = SatoriOptions["fonts"][number];
export type DrawFont = Omit<SatoriFont, "data"> & { data: SatoriFont["data"] | FontFile };

/** the faces shipped beside the quote card's route (src/app/api/card) */
export type CardFace = "IBMPlexSansThai-Regular.ttf" | "IBMPlexSansThai-SemiBold.ttf" | "Trirong-SemiBold.ttf";

export const cardFont = (file: CardFace): FontFile => ({ file });

export function isFontFile(data: unknown): data is FontFile {
  return typeof data === "object" && data !== null && typeof (data as FontFile).file === "string" && !ArrayBuffer.isView(data);
}
