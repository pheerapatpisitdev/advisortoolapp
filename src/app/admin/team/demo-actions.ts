"use server";
import { revalidatePath } from "next/cache";
import { demoView, setDemoCap, setDemoOpen, wipeDemo, type DemoView } from "@/lib/auth/demo";
import { audit, requireStaff } from "@/lib/auth/viewer";

/**
 * บัญชีสาธิต on /admin/team (owner chose 1ก 2ข 3ก, 2026-11-11, mockup Fm1t9Ejk): open or close it, its daily
 * cap, what it spent, and the wipe the night runs, pressed by hand.
 */

/** the most a day may be capped at, in baht: a slip of the finger should not be ฿100,000 */
const MAX_CAP_BAHT = 5000;

type Done = { ok: true } | { ok: false; error: string };

export async function readDemo(): Promise<DemoView | null> {
  await requireStaff("backoffice");
  return demoView().catch((e) => {
    console.error("demo card unreadable:", e);
    return null;
  });
}

export async function toggleDemo(open: boolean): Promise<Done> {
  await requireStaff("backoffice");
  try {
    await setDemoOpen(open === true);
    await audit(open ? "demo-open" : "demo-close", null);
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่ได้" };
  }
}

export async function saveDemoCap(bahtText: string): Promise<Done> {
  await requireStaff("backoffice");
  const baht = Number(String(bahtText).trim());
  if (!Number.isInteger(baht) || baht < 0 || baht > MAX_CAP_BAHT) return { ok: false, error: `ใส่เพดานเป็นบาทเต็ม 0 ถึง ${MAX_CAP_BAHT.toLocaleString()}` };
  try {
    await setDemoCap(baht * 100);
    await audit("demo-cap", null, { baht });
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่ได้" };
  }
}

export async function wipeDemoNow(): Promise<Done> {
  await requireStaff("backoffice");
  try {
    const counts = await wipeDemo();
    await audit("demo-wipe", null, counts);
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ล้างข้อมูลไม่ได้" };
  }
}
