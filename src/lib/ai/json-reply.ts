/**
 * Reading a model's JSON reply.
 *
 * Kept apart from the AI client because client components read replies too (the hook library
 * and the content studio parse what a model sent back), and the AI client is server-only:
 * it holds the Supabase admin key, the providers and the wallet. Nothing here may import them.
 */

/** Reads the first JSON object out of a model's reply, tolerating code fences. */
export function parseJsonReply<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const json = body.slice(start, end + 1);
  const attempts = [json, escapeBareControls(json)];
  attempts.push(closeBrackets(attempts[1]));
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch { /* the next repair */ }
  }
  return null;
}

/**
 * A missing closing bracket, put back.
 *
 * Sonnet 5 at low effort wrote a Family Legacy post whose poster object was never closed —
 * `…]}]}` where `…]}}]}` belonged — twice in a row on 2026-09-23, and the owner was told
 * "AI ตอบกลับมาไม่ครบ" for a post that was all there. Walking the brackets outside strings:
 * a closer that does not match the innermost open one first closes what was left open, and
 * whatever is still open at the end is closed. A reply that was fine is returned unchanged.
 */
export function closeBrackets(json: string): string {
  const stack: string[] = [];
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
    } else if (ch === "}" || ch === "]") {
      // close whatever was left open inside, as long as this closer matches something further out
      if (stack.includes(ch)) while (stack.length && stack[stack.length - 1] !== ch) out += stack.pop();
      if (stack[stack.length - 1] === ch) stack.pop();
      else continue; // a stray closer with nothing to close
    }
    out += ch;
  }
  return out + stack.reverse().join("");
}

/**
 * Real line breaks and tabs inside JSON strings, escaped.
 *
 * Asked for a multi-paragraph Facebook ad as a JSON field, Sonnet 5 sometimes writes the
 * paragraph breaks as actual newlines inside the string, which JSON forbids — the whole reply
 * was thrown away and the owner got three ads of four. Only characters inside a string are
 * touched; the structure between strings is left exactly as it came.
 */
export function escapeBareControls(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      else if (ch === "\n") { out += "\\n"; continue; }
      else if (ch === "\r") { out += "\\r"; continue; }
      else if (ch === "\t") { out += "\\t"; continue; }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}
