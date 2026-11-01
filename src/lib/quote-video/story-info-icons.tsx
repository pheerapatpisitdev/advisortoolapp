import type React from "react";

/**
 * อินโฟกราฟิก's icons (owner chose ข, 2026-11-01, mockup https://claude.ai/artifact/8PbjhVriyiYNiKv4y9X5yq):
 * plain line drawings on a 48 grid, in the one colour the tile asks for. Drawn here, not by an AI,
 * so a clip costs what it did.
 */

export type InfoIcon =
  | "question" | "speech" | "person" | "family" | "hourglass" | "heart" | "car" | "wheelchair" | "doc" | "badge"
  | "coins" | "bag" | "shield" | "chart" | "pen" | "pill" | "bed" | "warn" | "book" | "handshake"
  | "calendar" | "home" | "briefcase" | "hospital" | "bank" | "coffee" | "gift" | "search" | "phone" | "clock";

const P: Record<InfoIcon, React.ReactNode> = {
  question: <><circle cx="24" cy="24" r="19" /><path d="M18 19a6 6 0 1 1 8 5.6c-1.5.6-2 1.6-2 3.4" /><path d="M24 34v.5" /></>,
  speech: <><path d="M7 11h34v22H22l-9 7v-7H7z" /><path d="M15 20h18M15 26h12" /></>,
  person: <><circle cx="24" cy="15" r="7" /><path d="M10 42c0-9 6-15 14-15s14 6 14 15" /></>,
  family: <><circle cx="15" cy="13" r="5" /><circle cx="33" cy="13" r="5" /><circle cx="24" cy="27" r="3.5" /><path d="M7 36c0-6 4-10 8-10s5 2 6 3M41 36c0-6-4-10-8-10s-5 2-6 3M18 42c0-4 3-7 6-7s6 3 6 7" /></>,
  hourglass: <><path d="M13 6h22M13 42h22M16 6c0 10 16 12 16 18S16 32 16 42M32 6c0 10-16 12-16 18s16 8 16 18" /><path d="M20 38h8" /></>,
  heart: <><path d="M24 40C10 31 6 23 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 6-4 14-18 23z" /><path d="M10 24h8l3-6 5 11 3-5h9" /></>,
  car: <><path d="M6 32v-7l5-9h18l6 9h5v7z" /><circle cx="14" cy="33" r="4" /><circle cx="32" cy="33" r="4" /><path d="M38 8l2 6M44 12l-5 3M33 10l3 4" /></>,
  wheelchair: <><circle cx="20" cy="8" r="4" /><path d="M20 14v12h12l5 12M20 20h10" /><circle cx="19" cy="34" r="10" /></>,
  doc: <><path d="M12 5h17l8 8v30H12z" /><path d="M29 5v8h8" /><path d="M20 24a4.5 4.5 0 1 1 6 4c-1.5 1-2 2-2 4M24 37v.5" /></>,
  badge: <><rect x="5" y="11" width="38" height="27" rx="4" /><circle cx="16" cy="23" r="4.5" /><path d="M9 33c1-4 4-5 7-5s6 1 7 5M27 20h11M27 26h11M27 32h7" /></>,
  coins: <><ellipse cx="18" cy="13" rx="11" ry="5" /><path d="M7 13v8c0 3 5 5 11 5s11-2 11-5v-8" /><ellipse cx="30" cy="29" rx="11" ry="5" /><path d="M19 29v8c0 3 5 5 11 5s11-2 11-5v-8" /></>,
  bag: <><path d="M17 6h14l-4 8h-6z" /><path d="M21 14C10 18 6 27 6 33c0 6 5 9 18 9s18-3 18-9c0-6-4-15-15-19" /><path d="M24 21v15M28.5 24c-1-2-8-2-8 1.5s8 2 8 5.5-7 3.5-8.5 1" /></>,
  shield: <><path d="M24 5l16 6v11c0 11-7 18-16 21C15 40 8 33 8 22V11z" /><path d="M17 24l5 5 10-10" /></>,
  chart: <><path d="M6 42h36M6 42V6" /><path d="M13 34v-8M22 34V20M31 34V13" /><path d="M12 18l9-7 8 5 11-9" /></>,
  pen: <><path d="M10 5h20l8 8v30H10z" /><path d="M16 17h14M16 24h10" /><path d="M41 22L27 36l-5 1 1-5 14-14z" /></>,
  pill: <><rect x="6" y="17" width="36" height="14" rx="7" transform="rotate(-35 24 24)" /><path d="M19 17l10 14" /></>,
  bed: <><path d="M5 10v30M5 32h38v8M5 24h38v8" /><circle cx="13" cy="19" r="4" /><path d="M20 24v-6h16c4 0 7 3 7 6" /></>,
  warn: <><path d="M24 6l20 35H4z" /><path d="M24 19v10M24 35v.5" /></>,
  book: <><path d="M24 12c-5-4-12-5-18-4v29c6-1 13 0 18 4 5-4 12-5 18-4V8c-6-1-13 0-18 4z" /><path d="M24 12v29" /></>,
  handshake: <><path d="M4 20l8-8 8 4 6-3 8 3 10 4" /><path d="M4 20l12 12c2 2 4 2 6 0l10-10M20 16l-6 6c2 2 5 2 7 0l5-4M44 20l-8 10" /><path d="M24 38l3 3M28 34l3 3" /></>,
  calendar: <><rect x="6" y="9" width="36" height="33" rx="4" /><path d="M6 19h36M15 5v8M33 5v8" /><path d="M14 27h5M22 27h5M30 27h5M14 34h5M22 34h5" /></>,
  home: <><path d="M5 23L24 7l19 16" /><path d="M10 19v23h28V19" /><path d="M20 42V30h8v12" /></>,
  briefcase: <><rect x="5" y="14" width="38" height="27" rx="4" /><path d="M17 14V9h14v5M5 25h38M21 25v5h6v-5" /></>,
  hospital: <><rect x="7" y="10" width="34" height="32" rx="3" /><path d="M24 17v14M17 24h14" /><path d="M19 42v-6h10v6" /></>,
  bank: <><path d="M4 17L24 6l20 11z" /><path d="M9 21v15M19 21v15M29 21v15M39 21v15M5 41h38" /></>,
  coffee: <><path d="M8 17h26v12c0 7-5 12-13 12S8 36 8 29z" /><path d="M34 21h3a5 5 0 0 1 0 10h-3" /><path d="M15 5c-2 3 2 5 0 8M22 5c-2 3 2 5 0 8M29 5c-2 3 2 5 0 8" /></>,
  gift: <><rect x="6" y="18" width="36" height="9" rx="2" /><path d="M9 27v15h30V27M24 18v24" /><path d="M24 18c-3-6-12-9-12-3 0 3 6 3 12 3 6 0 12 0 12-3 0-6-9-3-12 3" /></>,
  search: <><circle cx="20" cy="20" r="13" /><path d="M30 30l12 12" /><path d="M14 20l4 4 8-8" /></>,
  phone: <><rect x="13" y="4" width="22" height="40" rx="4" /><path d="M21 38h6" /><path d="M42 12a10 10 0 0 1 0 12M39 15a5 5 0 0 1 0 6" /></>,
  clock: <><circle cx="24" cy="24" r="19" /><path d="M24 13v11l8 5" /></>,
};

/** one icon, `size` px square, drawn in `color` */
export function infoIcon(kind: InfoIcon, size: number, color: string) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      {P[kind]}
    </svg>
  );
}
