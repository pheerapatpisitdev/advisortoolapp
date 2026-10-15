"use client";

/**
 * On a computer, "save" asks where (owner, 2026-10-15): Chrome and Edge open the Save As window
 * so the agent picks a folder and a name. Safari and Firefox do not let a page open it, so the
 * file goes to Downloads as before and the button says so.
 *
 * The window has to open straight from the tap, before any waiting on the network, so it is
 * asked first and the file is fetched into the chosen place afterwards.
 */

type Picker = (o: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

export const isComputer = () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches;

const picker = (): Picker | undefined =>
  (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;

/** Chrome / Edge on a computer: the Save As window is there to open */
export const canPickFolder = () => isComputer() && typeof picker() === "function";

export type SaveResult = "picked" | "downloads" | "cancel";

/** a plain download into the browser's Downloads folder */
export function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Ask where to save, then fetch `url` into that file. Without the window (or when it refuses),
 * `fallback` runs — a plain download — and the answer is "downloads".
 */
export async function saveToComputer(
  url: string,
  name: string,
  kind: { description: string; mime: string; ext: string },
  fallback: () => void = () => downloadUrl(url, name),
): Promise<SaveResult> {
  const open = picker();
  if (!isComputer() || typeof open !== "function") {
    fallback();
    return "downloads";
  }
  let handle;
  try {
    handle = await open({ suggestedName: name, types: [{ description: kind.description, accept: { [kind.mime]: [kind.ext] } }] });
  } catch (e) {
    // closing the window is an answer, not a failure
    if ((e as Error).name === "AbortError") return "cancel";
    fallback();
    return "downloads";
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`save ${res.status}`);
  await res.body.pipeTo(await handle.createWritable());
  return "picked";
}
