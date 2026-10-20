import type { ReactNode } from "react";
import { CHAT_COLORS as K } from "@/lib/card-theme";
import type { QuoteVideoFacts } from "./script";

/**
 * แชทถาม-ตอบ (owner, 2026-10-20, style 1 on https://claude.ai/artifact/1L8biGvcnTLQffH2xKhAGt, "ตามที่แนะนำ"):
 * the clip as a plain chat, nobody's brand. At each scene the customer asks the same question for that
 * part of the quote (1ก), the agent types, then answers with the scene's own spoken line — the one
 * voice reads only the agent's answers (1ก) — and sends the scene's card: the price, the cover, a few
 * rows of the value table, the agent's own card. The head is the agent's photo and ชื่อที่แสดง. Drawn
 * by Remotion over the whole clip (remotion/src/Clip.tsx); a ติ๊ง plays as each question comes in.
 */

export interface ChatScene { key: string; voice: string; voiceSec: number; start: number }
export interface ChatClip {
  facts: QuoteVideoFacts;
  /** the insured, who asks: their sex sets ครับ or คะ */
  sex: "M" | "F";
  contact: { name: string; phone: string; line?: string; photo?: string };
  scenes: ChatScene[];
}

/** when, in a scene, the agent starts typing and when the answer and its card come in */
export const CHAT_TYPING = 0.15;
export const CHAT_ANSWER = 0.55;
const cardAt = (sc: ChatScene) => CHAT_ANSWER + Math.max(1.2, sc.voiceSec * 0.4);

/** the plan as the customer names it: the plan's line up to its first dot */
const planName = (f: QuoteVideoFacts) => f.planLine.split(" · ")[0];

/** the customer's question for a part of the quote, ending as the insured speaks */
export function chatQuestion(key: string, f: QuoteVideoFacts, sex: "M" | "F"): string {
  const q = sex === "M" ? "ครับ" : "คะ";
  const k = sex === "M" ? "ครับ" : "ค่ะ";
  switch (key) {
    case "lead": return `สวัสดี${k} สนใจ ${planName(f)} ช่วยเล่าให้ฟังหน่อยได้ไหม${q}`;
    case "price": return `ต้องจ่ายเท่าไหร่${q}`;
    case "cover": return `แล้วคุ้มครองยังไงบ้าง${q}`;
    case "value": return `ถ้าเลิกจ่ายกลางทาง เงินหายไหม${q}`;
    case "critical": return `ถ้าป่วยโรคร้ายแรงล่ะ${q}`;
    case "terms": return `มีระยะเวลาให้เลือกไหม${q}`;
    case "index": return `ผลตอบแทนเป็นยังไงบ้าง${q}`;
    case "compare": return `เทียบกับแผนอื่นเป็นยังไง${q}`;
    case "contact": return `สนใจ${k} ขอรายละเอียดเพิ่มหน่อย${k}`;
    case "qa": return `ขอถามอีกข้อได้ไหม${q}`;
    case "versus": return `ต่างจากเก็บเงินเองยังไง${q}`;
    case "steps": return `ถ้าตกลงทำ ต้องทำยังไงบ้าง${q}`;
    default: return `เล่าเพิ่มอีกหน่อยได้ไหม${q}`;
  }
}

type Msg = { at: number; who: "them" | "me"; body: ReactNode; key: string };

/** one row of a card: its label and its figure */
const row = (u: number, label: string, value: string, strong = false, key?: string) => (
  <div key={key ?? label} style={{ display: "flex", justifyContent: "space-between", borderTop: `${Math.max(1, Math.round(2 * u))}px solid ${K.rule}`, padding: `${Math.round(8 * u)}px 0`, fontSize: Math.round((strong ? 36 : 30) * u), fontWeight: strong ? 700 : 400 }}>
    <div style={{ display: "flex" }}>{label}</div><div style={{ display: "flex", fontWeight: 700 }}>{value}</div>
  </div>
);

function card(u: number, head: string, body: ReactNode, foot = true): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: Math.round(620 * u), borderRadius: Math.round(22 * u), overflow: "hidden", background: K.theirs, color: K.cardInk }}>
      <div style={{ display: "flex", background: K.cardHead, color: K.headInk, padding: `${Math.round(12 * u)}px ${Math.round(20 * u)}px`, fontSize: Math.round(28 * u), fontWeight: 600 }}>{head}</div>
      <div style={{ display: "flex", flexDirection: "column", padding: `${Math.round(14 * u)}px ${Math.round(20 * u)}px` }}>{body}</div>
      {foot ? <div style={{ display: "flex", justifyContent: "flex-end", padding: `0 ${Math.round(20 * u)}px ${Math.round(10 * u)}px`, fontSize: Math.round(20 * u), color: K.mute, letterSpacing: 1 }}>unitclub</div> : null}
    </div>
  );
}

/** the value table's rows a chat card has room for: the first, the last, the break-even, and evenly between */
export function chatRows<T>(rows: T[], keep: number, must?: number): T[] {
  if (rows.length <= keep) return rows;
  const at = new Set<number>([0, rows.length - 1, ...(must !== undefined && must >= 0 ? [must] : [])]);
  for (let i = 1; at.size < keep; i++) at.add(Math.round((i * (rows.length - 1)) / keep));
  return [...at].sort((x, y) => x - y).slice(0, keep).map((i) => rows[i]);
}

/** the card the agent sends with a part of the quote; none where the answer says it all */
function sceneCard(key: string, c: ChatClip, u: number): ReactNode | null {
  const f = c.facts;
  switch (key) {
    case "lead":
      return card(u, planName(f), <>
        <div style={{ display: "flex", fontSize: Math.round(30 * u) }}>{f.lead.label}</div>
        <div style={{ display: "flex", fontSize: Math.round(64 * u), fontWeight: 700, color: K.cardHead }}>{`${f.lead.amount} บาท`}</div>
      </>);
    case "price":
      return card(u, f.priceTitle, <>
        {f.perDayAmount ? <>
          <div style={{ display: "flex", fontSize: Math.round(30 * u) }}>ตกวันละ</div>
          <div style={{ display: "flex", fontSize: Math.round(72 * u), fontWeight: 700, color: K.cardHead, marginBottom: Math.round(6 * u) }}>{`${f.perDayAmount} บาท`}</div>
        </> : null}
        {f.prices.map((p) => row(u, p.label, p.amount, p.main))}
      </>);
    case "cover":
      return card(u, f.coverTitle, <>
        {f.cover.slice(0, 4).map((r, i) => row(u, r.label, r.amount, r.mark, `${r.label}${i}`))}
        <div style={{ display: "flex", fontSize: Math.round(30 * u), marginTop: Math.round(6 * u) }}>{`คุ้มครองถึงอายุ ${f.coverToAge}`}</div>
      </>);
    case "value": {
      const all = f.rows ?? [];
      if (!all.length || !all.some((r) => r.cash)) return null;
      const be = f.breakEven ? all.findIndex((r) => r.age === f.breakEven!.age) : -1;
      // what was paid stays at its total once the paying years are over
      let paid = "";
      const held = all.map((r) => ({ ...r, paid: (paid = r.paid ?? paid) }));
      const shown = chatRows(held, 6, be);
      const cols = ["อายุ", "เบี้ยสะสม", "เวนคืน", "คุ้มครอง"];
      const cell = (v: string, i: number, strong: boolean) => <div key={i} style={{ display: "flex", flex: 1, justifyContent: "center", fontSize: Math.round(26 * u), fontWeight: strong ? 700 : 400 }}>{v}</div>;
      return (
        <div style={{ display: "flex", flexDirection: "column", width: Math.round(660 * u), borderRadius: Math.round(22 * u), overflow: "hidden", background: K.theirs, color: K.cardInk }}>
          <div style={{ display: "flex", background: K.cardHead, color: K.headInk, padding: `${Math.round(10 * u)}px ${Math.round(8 * u)}px` }}>{cols.map((h, i) => cell(h, i, true))}</div>
          {shown.map((r) => {
            const mark = f.breakEven?.age === r.age;
            return (
              <div key={r.age} style={{ display: "flex", padding: `${Math.round(8 * u)}px ${Math.round(8 * u)}px`, borderBottom: `${Math.max(1, Math.round(2 * u))}px solid ${K.rule}`, background: mark ? K.mark : K.theirs }}>
                {cell(String(r.age), 0, mark)}{cell(r.paid, 1, mark)}{cell(r.cash ?? "", 2, mark)}{cell(r.cover, 3, mark)}
              </div>
            );
          })}
          {f.breakEven ? <div style={{ display: "flex", padding: `${Math.round(10 * u)}px ${Math.round(20 * u)}px 0`, fontFamily: "Sriracha", color: K.pen, fontSize: Math.round(32 * u) }}>{`อายุ ${f.breakEven.age} ขอคืนได้ ${f.breakEven.cash} บาท`}</div> : null}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: `${Math.round(6 * u)}px ${Math.round(20 * u)}px ${Math.round(10 * u)}px`, fontSize: Math.round(20 * u), color: K.mute }}>ตารางจากใบเสนอ · unitclub</div>
        </div>
      );
    }
    case "contact":
      return card(u, c.contact.name, <>
        {row(u, "โทร", c.contact.phone)}
        {c.contact.line ? row(u, "LINE", c.contact.line) : null}
        <div style={{ display: "flex", justifyContent: "center", background: K.button, color: K.headInk, borderRadius: Math.round(14 * u), padding: `${Math.round(10 * u)}px`, marginTop: Math.round(10 * u), fontSize: Math.round(32 * u), fontWeight: 700 }}>ทักขอใบเสนอของคุณ</div>
      </>);
    default:
      return null;
  }
}

/** every message of the clip with its moment: the question, the answer, the card */
export function chatMessages(c: ChatClip, u: number): Msg[] {
  const out: Msg[] = [];
  const text = (who: "them" | "me", s: string) => (
    <div style={{
      display: "flex", maxWidth: Math.round(820 * u), padding: `${Math.round(16 * u)}px ${Math.round(26 * u)}px`, fontSize: Math.round(40 * u), lineHeight: 1.45,
      borderRadius: Math.round(34 * u), ...(who === "them"
        ? { background: K.mine, color: K.mineInk, borderBottomRightRadius: Math.round(8 * u) }
        : { background: K.theirs, color: K.theirsInk, borderBottomLeftRadius: Math.round(8 * u) }),
    }}>{s}</div>
  );
  c.scenes.forEach((sc, i) => {
    out.push({ at: sc.start, who: "them", body: text("them", chatQuestion(sc.key, c.facts, c.sex)), key: `q${i}` });
    out.push({ at: sc.start + CHAT_ANSWER, who: "me", body: text("me", sc.voice), key: `a${i}` });
    const extra = sceneCard(sc.key, c, u);
    if (extra) out.push({ at: sc.start + cardAt(sc), who: "me", body: extra, key: `c${i}` });
  });
  return out;
}

/** the chat at clip time T, w×h: a phone-wide column on a wide clip */
export function chatFrame(c: ChatClip, T: number, w: number, h: number): ReactNode {
  const colW = Math.min(w, Math.round(h * 0.6));
  const u = colW / 1080;
  const shown = chatMessages(c, u).filter((m) => m.at <= T);
  const now = [...c.scenes].reverse().find((sc) => sc.start <= T);
  const typing = now && T >= now.start + CHAT_TYPING && T < now.start + CHAT_ANSWER;
  const dot = (i: number) => <div key={i} style={{ display: "flex", width: Math.round(14 * u), height: Math.round(14 * u), borderRadius: 99, marginRight: Math.round(8 * u), background: K.dots, opacity: 0.35 + 0.65 * Math.abs(Math.sin(T * 6 - i)) }} />;
  const initials = [...c.contact.name.replace(/^คุณ/, "")].slice(0, 2).join("");
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: K.ground, justifyContent: "center", fontFamily: "Plex" }}>
      <div style={{ display: "flex", flexDirection: "column", width: colW, height: h, background: K.ground }}>
        <div style={{ display: "flex", alignItems: "center", background: K.head, color: K.headInk, padding: `${Math.round(70 * u)}px ${Math.round(36 * u)}px ${Math.round(24 * u)}px` }}>
          <div style={{ display: "flex", width: Math.round(96 * u), height: Math.round(96 * u), borderRadius: 999, overflow: "hidden", background: K.avatar, color: K.head, alignItems: "center", justifyContent: "center", fontSize: Math.round(38 * u), fontWeight: 700, marginRight: Math.round(22 * u) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.contact.photo ? <img src={c.contact.photo} width={Math.round(96 * u)} height={Math.round(96 * u)} style={{ objectFit: "cover" }} alt="" /> : initials}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: Math.round(40 * u), fontWeight: 700 }}>{c.contact.name}</div>
            <div style={{ display: "flex", alignItems: "center", fontSize: Math.round(28 * u), opacity: 0.85 }}>
              <div style={{ display: "flex", width: Math.round(14 * u), height: Math.round(14 * u), borderRadius: 99, background: K.online, marginRight: Math.round(10 * u) }} />ออนไลน์
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", padding: `${Math.round(20 * u)}px ${Math.round(28 * u)}px ${Math.round(90 * u)}px` }}>
          {shown.map((m) => {
            const q = Math.min(1, (T - m.at) / 0.28);
            return (
              <div key={m.key} style={{ display: "flex", flexShrink: 0, justifyContent: m.who === "them" ? "flex-end" : "flex-start", marginTop: Math.round(18 * u), opacity: Math.min(1, q * 1.6), transform: `translateY(${Math.round((1 - q) * 30 * u)}px) scale(${(0.94 + 0.06 * q).toFixed(3)})` }}>{m.body}</div>
            );
          })}
          {typing ? <div style={{ display: "flex", flexShrink: 0, marginTop: Math.round(18 * u), alignSelf: "flex-start", background: K.theirs, borderRadius: Math.round(30 * u), padding: `${Math.round(22 * u)}px ${Math.round(24 * u)}px` }}>{[0, 1, 2].map(dot)}</div> : null}
        </div>
      </div>
      <div style={{ display: "flex", position: "absolute", left: 0, width: w, bottom: Math.round((h > w ? 34 : 14) * (Math.min(w, h) / 1080)), justifyContent: "center", fontSize: Math.round(26 * (Math.min(w, h) / 1080)), color: K.mute }}>Application by www.advisortool.app</div>
    </div>
  );
}
