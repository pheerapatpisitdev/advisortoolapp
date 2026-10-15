"use client";
import { useEffect, useState } from "react";
import { POST_TONES, POST_TRIES, type PostTone, type PostVoice } from "@/lib/quote-video/post-tones";
import { keepPostText, writePostText, type ClipPost } from "./actions";

/**
 * ข้อความโพสต์ (owner, 2026-10-15, mockup https://claude.ai/artifact/8B39tj4VDgrd9RsdCC23RL, option ก):
 * the AI writes the words to go up with one clip, in a tone the agent picks, ending ครับ or ค่ะ.
 * Free, three writes a clip; the words stay editable and are kept with the clip. A named clip or
 * an FHC summary gets a message to its customer instead of a post.
 */

const TONE_KEY = "qv-post-tone";
const VOICE_KEY = "qv-post-voice";
const small = "min-h-9 rounded-lg border border-[var(--ct-line)] px-3 text-sm inline-flex items-center hover:bg-[var(--ct-panel)] disabled:opacity-50";
const chip = (on: boolean) => `min-h-9 rounded-full border px-3 text-sm ${on ? "border-[var(--ct-accent)] bg-[var(--ct-panel)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] hover:bg-[var(--ct-panel)]"}`;

export function PostPanel({ id, post, customer, onPost, onClose }: {
  id: string;
  post: ClipPost | null | undefined;
  /** the clip is for one customer: a chat message, not a post */
  customer: boolean;
  onPost: (p: ClipPost) => void;
  onClose: () => void;
}) {
  const [tone, setTone] = useState<PostTone>(post?.tone ?? "friendly");
  const [voice, setVoice] = useState<PostVoice>(post?.voice ?? "M");
  const [text, setText] = useState(post?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [kept, setKept] = useState<"idle" | "saving" | "saved">("idle");

  // the tone and the ending last chosen, for a clip not yet written
  useEffect(() => {
    if (post) return;
    try {
      const t = localStorage.getItem(TONE_KEY);
      if (POST_TONES.some((x) => x.tone === t)) setTone(t as PostTone);
      if (localStorage.getItem(VOICE_KEY) === "F") setVoice("F");
    } catch { /* storage closed: the defaults stand */ }
  }, [post]);
  const pickTone = (t: PostTone) => { setTone(t); try { localStorage.setItem(TONE_KEY, t); } catch { /* still used */ } };
  const pickVoice = (v: PostVoice) => { setVoice(v); try { localStorage.setItem(VOICE_KEY, v); } catch { /* still used */ } };

  const left = post ? post.left : POST_TRIES;
  const word = customer ? "ข้อความส่งลูกค้า" : "ข้อความโพสต์";

  async function write() {
    setBusy(true);
    setError(null);
    const r = await writePostText(id, tone, voice).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setText(r.post.text);
    setKept("idle");
    onPost(r.post);
  }

  async function keep() {
    if (!post || text.trim() === post.text || !text.trim()) return;
    setKept("saving");
    const r = await keepPostText(id, text).catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" }));
    if (!r.ok) { setKept("idle"); setError(r.error); return; }
    setKept("saved");
    onPost({ ...post, text: text.trim() });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("คัดลอกข้อความนี้", text);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--ct-accent)] bg-[var(--ct-soft)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b className="text-sm">{word} {post && <span className="font-normal text-[var(--ct-mute)]">(AI เขียน · แก้ได้)</span>}</b>
        <span className="text-xs text-[var(--ct-mute)]">{left > 0 ? `${post ? "เขียนใหม่ได้อีก" : "ฟรี เขียนได้"} ${left} ครั้ง` : "เขียนครบแล้ว แก้เองได้"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="โทนข้อความ">
        {POST_TONES.map((t) => <button key={t.tone} type="button" className={chip(tone === t.tone)} onClick={() => pickTone(t.tone)}>{t.name}</button>)}
        <span className="mx-1 h-5 w-px bg-[var(--ct-line)]" aria-hidden />
        <button type="button" className={chip(voice === "M")} onClick={() => pickVoice("M")}>ครับ</button>
        <button type="button" className={chip(voice === "F")} onClick={() => pickVoice("F")}>ค่ะ</button>
      </div>
      {post ? (
        <>
          <label htmlFor={`post-${id}`} className="sr-only">{word}</label>
          <textarea
            id={`post-${id}`} rows={9} value={text}
            onChange={(e) => { setText(e.target.value); setKept("idle"); }} onBlur={keep}
            className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="min-h-9 rounded-lg bg-[var(--ct-solid)] px-3 text-sm text-[var(--ct-solid-ink)]">{copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}</button>
            <button type="button" onClick={write} disabled={busy || left <= 0} className={small}>{busy ? "กำลังเขียน…" : "เขียนใหม่"}</button>
            <button type="button" onClick={onClose} className={small}>ปิด</button>
            {kept !== "idle" && <span role="status" className="text-xs text-[var(--ct-mute)]">{kept === "saving" ? "กำลังเก็บ…" : "เก็บข้อความที่แก้แล้ว"}</span>}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={write} disabled={busy} className="min-h-9 rounded-lg bg-[var(--ct-solid)] px-3 text-sm text-[var(--ct-solid-ink)] disabled:opacity-50">
            {busy ? "AI กำลังเขียน…" : `ให้ AI เขียน${word}`}
          </button>
          <button type="button" onClick={onClose} className={small}>ปิด</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-[var(--ct-alert)]">{error}</p>}
      <p className="text-xs text-[var(--ct-mute)]">
        {customer ? "คลิปนี้ส่งให้ลูกค้าคนเดียว จึงเขียนเป็นข้อความแชท ไม่ใช่โพสต์ · " : "ใช้เป็นแคปชันตอนเพิ่มลงปฏิทินเพจด้วย · "}
        ตัวเลขในข้อความตรวจเทียบกับตัวเลขในคลิปแล้ว อ่านทวนก่อนใช้ทุกครั้ง
      </p>
    </div>
  );
}
