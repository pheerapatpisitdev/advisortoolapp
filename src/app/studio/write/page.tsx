import { StudioPage } from "../StudioPage";

export const dynamic = "force-dynamic";
// a round of five is two calls and several thousand words of Thai; the actions run as this page
export const maxDuration = 300;

export const metadata = {
  title: "Organic Studio | advisortool",
  description: "สร้างโพสต์เฟซบุ๊กและสคริปต์วิดีโอจากข้อมูลจริงของแบบประกัน",
};

// the menu, the palette and the tabs come from ../layout.tsx
export default async function ContentPage({ searchParams }: { searchParams: Promise<{ hook?: string; open?: string; day?: string; page?: string }> }) {
  const { hook, open, day, page } = await searchParams;
  return <StudioPage hook={hook} open={open} day={day} page={page} />;
}
