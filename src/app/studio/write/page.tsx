import { gatePage } from "@/lib/auth/viewer";
import { ClosedNotice, LockedPage } from "@/components/ClosedNotice";
import { closedFor } from "@/lib/switches/store";
import { StudioPage } from "../StudioPage";

export const dynamic = "force-dynamic";
// a round of five is two calls and several thousand words of Thai; the actions run as this page.
// A clip over 100MB goes storage → Gemini upload (≤100 s) → wait (≤60 s) → a listen of up to 110 s, inside the
// 300 s the Hobby plan allows (a 600 s value failed the production build, 2026-10-02).
export const maxDuration = 300;

export const metadata = {
  title: "Organic Studio | AdvisorTool",
  description: "สร้างโพสต์เฟซบุ๊กและสคริปต์วิดีโอจากข้อมูลจริงของแบบประกัน",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function ContentPage({ searchParams }: { searchParams: Promise<{ hook?: string; open?: string; day?: string; page?: string }> }) {
  // the layout's gate is not re-run on every navigation between Studio's pages, so each page asks too
  const viewer = await gatePage("/studio/write");
  // switched off by the Super Admin: locked, nothing of the tool shown (owner, 2026-10-17)
  const locked = await closedFor(viewer, "write");
  if (locked) return <LockedPage feature="write" message={locked} />;
  const { hook, open, day, page } = await searchParams;
  return (
    <>
      <ClosedNotice viewer={viewer} feature="write" />
      <StudioPage hook={hook} open={open} day={day} page={page} />
    </>
  );
}
