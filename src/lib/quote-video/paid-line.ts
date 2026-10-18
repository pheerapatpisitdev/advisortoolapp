import { formatBaht } from "@/lib/wallet/money";

interface Paid {
  status: string;
  paid_by: string | null;
  held_satang: number | null;
  charged_satang: number | null;
}

/**
 * How a clip was paid, in words. A free clip that also held money (a คลิปตามโจทย์'s pictures are
 * paid from the wallet even when the clip itself is free) says so, not only "free".
 */
export function paidLine(v: Paid): string | null {
  const failed = v.status === "failed";
  if (v.paid_by === "free") {
    const held = Number(v.held_satang ?? 0) > 0;
    if (!held) return failed ? "คืนสิทธิ์ฟรีแล้ว" : "ใช้สิทธิ์ฟรี";
    if (failed) return "คืนสิทธิ์ฟรีและเงินแล้ว";
    // 0: the hold was gone before the clip finished, so nothing was taken (make.ts finishVideo)
    if (Number(v.charged_satang) === 0 && v.charged_satang !== null) return "ใช้สิทธิ์ฟรี · ไม่ได้หักค่าภาพ";
    return v.charged_satang !== null
      ? `ใช้สิทธิ์ฟรี · ค่าภาพหักจากกระเป๋า ${formatBaht(Number(v.charged_satang))}`
      : "ใช้สิทธิ์ฟรี · กันเงินค่าภาพไว้ระหว่างทำ";
  }
  if (v.paid_by === "wallet") {
    if (!failed && v.charged_satang !== null && Number(v.charged_satang) === 0) return "ทำเสร็จ · ไม่ได้หักเงิน";
    return failed ? "คืนเงินแล้ว" : v.charged_satang !== null ? `หักจากกระเป๋า ${formatBaht(Number(v.charged_satang))}` : "กันเงินไว้ระหว่างทำ";
  }
  return null;
}
