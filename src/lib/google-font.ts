/**
 * A Google font, fetched and cut down to the letters a picture actually uses.
 *
 * The way Vercel's own examples load a face for a drawn image: a whole face can be megabytes
 * a weight, and a card uses a handful of letters. Undefined when the font could not be had,
 * so the caller can draw on in its own face rather than fail the picture.
 */
export async function googleFontSubset(family: string, text: string, weights = "400;600") {
  try {
    const letters = [...new Set(text)].join("");
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}`
        + `&text=${encodeURIComponent(letters)}`,
      { signal: AbortSignal.timeout(4000) },
    ).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`css ${r.status}`))));
    // one @font-face a weight, each naming its weight and then its file
    const faces = [...css.matchAll(/font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g)];
    if (faces.length === 0) return undefined;
    return await Promise.all(faces.map(async ([, weight, url]) => ({
      name: family,
      data: await fetch(url, { signal: AbortSignal.timeout(4000) })
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`font ${r.status}`)))),
      weight: Number(weight) as 400 | 600,
      style: "normal" as const,
    })));
  } catch {
    return undefined;
  }
}
