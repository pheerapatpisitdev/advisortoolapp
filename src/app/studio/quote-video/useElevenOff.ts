import { useEffect, useState } from "react";
import { elevenOff } from "./actions";

/**
 * Whether the ElevenLabs voices on a clip form cannot speak now, asked once when the form shows
 * them (owner, 2026-10-20): the form then says Google reads instead, and the clip still starts.
 */
export function useElevenOff(offered: boolean): boolean {
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!offered) return;
    let live = true;
    elevenOff().then((x) => { if (live) setOff(x); }).catch(() => undefined);
    return () => { live = false; };
  }, [offered]);
  return off;
}
