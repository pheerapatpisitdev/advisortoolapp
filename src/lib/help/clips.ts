/**
 * วิธีใช้งาน: the how-to clips kept in the system (owner chose ก ก, 2026-11-11; mockup
 * https://claude.ai/artifact/NDFBcJ8EynfEqP4eoM5tub). The files are in public/help, one
 * `<id>.mp4` at phone size and one `<id>.jpg` cover each; a new clip is a file pair and a
 * line here. The page is open to everyone: the first clip teaches somebody who has not
 * signed in yet, and nothing in any of them is a real account.
 */
export interface HelpClip {
  /** the file's name in public/help, and the clip's address on the page: /help#<id> */
  id: string;
  title: string;
  about: string;
  seconds: number;
  /** the page the clip teaches, for the button under the player */
  go?: { href: string; label: string };
}

export const HELP_GROUPS: { title: string; clips: HelpClip[] }[] = [
  {
    title: "เริ่มต้นใช้งาน",
    clips: [
      { id: "shortcut", title: "เพิ่มทางลัดไว้หน้าจอมือถือ", about: "iPhone และ Android เปิดระบบได้ในแตะเดียว", seconds: 73 },
    ],
  },
  {
    title: "กระเป๋าเงิน",
    clips: [
      { id: "topup", title: "วิธีเติมเงินเข้าระบบ", about: "เลือกยอด สแกนพร้อมเพย์ ดูยอดเข้า", seconds: 104, go: { href: "/studio/wallet", label: "ไปหน้า กระเป๋าเงิน" } },
    ],
  },
  {
    title: "Studio",
    clips: [
      { id: "quote-video", title: "ทำวิดีโอนำเสนอแบบประกัน", about: "5 ขั้น จากเลือกแบบจนได้คลิปส่งลูกค้า", seconds: 108, go: { href: "/studio/quote-video", label: "ไปหน้า วิดีโอนำเสนอ" } },
    ],
  },
];

export const HELP_CLIPS: HelpClip[] = HELP_GROUPS.flatMap((g) => g.clips);

export const helpClip = (id: string): HelpClip | undefined => HELP_CLIPS.find((c) => c.id === id);

/** 104 → "1:44" */
export const clipLength = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** the file in public/ */
export const clipFile = (id: string) => `/help/${id}.mp4`;
/** what the player loads: the same file through /help/clip/[id], which answers an iPhone's range requests */
export const clipPlay = (id: string) => `/help/clip/${id}`;
export const clipCover = (id: string) => `/help/${id}.jpg`;
