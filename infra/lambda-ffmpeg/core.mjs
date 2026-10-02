// Pure helpers for the clip ffmpeg Lambda — tested in tests/video/lambda-core.test.ts.

/** a command line split like a shell would: double-quoted runs stay one argument, the quotes themselves are dropped; single quotes inside stay as characters (ffmpeg's filter parser wants them) */
export function splitArgs(command) {
  const out = [];
  let cur = "";
  let quote = null;
  let started = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      cur += ch;
      continue;
    }
    if (ch === "\"") { quote = ch; started = true; continue; }
    if (/\s/.test(ch)) { if (started) { out.push(cur); cur = ""; started = false; } continue; }
    cur += ch;
    started = true;
  }
  if (started) out.push(cur);
  return out;
}

/** {{in_1}} / {{out_1}} replaced by local paths */
export function localize(command, inputs, outputs) {
  return command.replace(/\{\{((?:in|out)_\d+)\}\}/g, (m, name) => inputs[name] ?? outputs[name] ?? m);
}
