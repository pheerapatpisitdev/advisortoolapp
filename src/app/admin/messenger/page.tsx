import { redirect } from "next/navigation";

/** Messenger became เพจและช่องทาง on 2026-10-15 (owner chose ข); the old address keeps its query (?fb=…). */
export default async function MessengerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v);
  redirect(`/admin/pages${q.size ? `?${q}` : ""}`);
}
