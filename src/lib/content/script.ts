/**
 * A video script read back as a shot list: one row per stretch of time, with what is said,
 * what the presenter does, and what goes on screen kept apart.
 *
 * The writer is asked for the script as prose with markers — "[3–15 วิ]" to start a stretch,
 * "(ชี้ไปที่กล้อง)" for an action, "{จอ: …}" for on-screen text (prompt.ts). Those markers are
 * what this reads; nothing here changes the stored words, so copying still gives the script
 * exactly as it was written.
 */

export interface Scene {
  /** "3–15 วิ", or null for words before the first marker */
  time: string | null;
  /** the spoken words, markers taken out */
  say: string;
  /** what the presenter does */
  acts: string[];
  /** text that goes on screen */
  screen: string[];
}

/** "[3–15 วิ]": a digit and วิ inside one pair of brackets — "[ตัดไปที่วิวทะเล]" is not a time */
const TIME = /\[([^\[\]]*\d[^\[\]]*วิ[^\[\]]*)\]/g;
const SCREEN = /\{\s*จอ\s*:\s*([^}]*)\}/g;
const PAREN = /\(([^()]*)\)/g;

function scene(time: string | null, text: string): Scene {
  const screen = [...text.matchAll(SCREEN)].map((m) => m[1].trim()).filter(Boolean);
  let rest = text.replace(SCREEN, " ");
  // a bracket with a figure in it is part of the sentence ("(6 แผน)"); one without is an action
  const acts: string[] = [];
  // innermost first, again until none are left, so "(ชี้ไปที่กล้อง (ยิ้ม))" is two actions
  const kept: string[] = [];
  for (let before = ""; before !== rest;) {
    before = rest;
    rest = rest.replace(PAREN, (_, inner: string) => {
      if (/\d/.test(inner)) { kept.push(inner); return `\u0000${kept.length - 1}\u0001`; }
      if (inner.trim()) acts.push(inner.trim());
      return " ";
    });
  }
  // a bracket with a figure in it stays in the sentence, as it was written
  while (/\u0000\d+\u0001/.test(rest)) rest = rest.replace(/\u0000(\d+)\u0001/g, (_, i: string) => `(${kept[Number(i)]})`);
  return { time, say: rest.replace(/\s+/g, " ").trim(), acts, screen };
}

export function scenes(hook: string, body: string, closing: string): Scene[] {
  const out: Scene[] = [];
  const opening = hook.replace(TIME, " ").trim();
  if (opening) out.push(scene("0–3 วิ", opening));

  const text = [body, closing].filter(Boolean).join("\n\n");
  const marks = [...text.matchAll(TIME)];
  const before = text.slice(0, marks[0]?.index ?? text.length);
  if (before.trim()) out.push(scene(null, before));
  marks.forEach((m, i) => {
    const end = marks[i + 1]?.index ?? text.length;
    const s = scene(m[1].trim(), text.slice(m.index! + m[0].length, end));
    if (!(s.say || s.acts.length || s.screen.length)) return;
    // สูตรคอนเทนต์โปร opens the body with the hook's own three seconds — its screen text and
    // opening shot, not spoken again (pro.ts): they belong on the hook's row, not a row of their own
    const first = out[0];
    if (i === 0 && opening && first && s.time?.replace(/\s/g, "") === "0–3วิ") {
      first.acts.push(...s.acts);
      first.screen.push(...s.screen);
      if (s.say) first.say = `${first.say} ${s.say}`;
      return;
    }
    out.push(s);
  });
  return out;
}
