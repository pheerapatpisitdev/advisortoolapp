import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ agentId: "super" })), audit: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
const store = vi.hoisted(() => ({ saveOwnerPhones: vi.fn(async () => {}), clearOwnerPhones: vi.fn(async () => {}) }));
vi.mock("@/lib/hospitals/store", () => store);

const { saveHospitalPhones, resetHospitalPhones } = await import("@/app/admin/hospitals/actions");
const { places } = await import("@/lib/hospitals/places");
const HOSPITAL = places(new Map()).find((p) => p.th === "โรงพยาบาลสมิติเวช สุขุมวิท") ?? places(new Map())[0];
const FORM = { insurance: "0 2111 1111\n0 2111 1112", room: "", appointment: "1719", reception: "" };

beforeEach(() => vi.clearAllMocks());

describe("the back office's hospital numbers", () => {
  it("are the Super Admin's alone to write", async () => {
    viewer.requireStaff.mockRejectedValue(new Error("ไม่มีสิทธิ์ใช้ส่วนนี้"));
    await expect(saveHospitalPhones(HOSPITAL.id, FORM)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(resetHospitalPhones(HOSPITAL.id)).rejects.toThrow("ไม่มีสิทธิ์");
    expect(store.saveOwnerPhones).not.toHaveBeenCalled();
    expect(store.clearOwnerPhones).not.toHaveBeenCalled();
    viewer.requireStaff.mockResolvedValue({ agentId: "super" });
  });
  it("save what was typed, audited by the hospital's name, and both pages read again", async () => {
    expect(await saveHospitalPhones(HOSPITAL.id, FORM)).toEqual({ ok: true });
    expect(viewer.requireStaff).toHaveBeenCalledWith("backoffice");
    const saved = { insurance: ["0 2111 1111", "0 2111 1112"], room: [], appointment: ["1719"], reception: [] };
    expect(store.saveOwnerPhones).toHaveBeenCalledWith(HOSPITAL.id, saved);
    expect(viewer.audit).toHaveBeenCalledWith("hospital-phones-save", HOSPITAL.id, { name: HOSPITAL.th, ...saved });
    expect(cache.revalidatePath.mock.calls.flat()).toEqual(["/admin/hospitals", "/hospitals"]);
  });
  it("refuse a hospital not on the list, and numbers that are not numbers", async () => {
    expect(await saveHospitalPhones("nowhere", FORM)).toEqual({ ok: false, error: "ไม่พบโรงพยาบาลนี้ในรายชื่อ" });
    expect(await resetHospitalPhones("nowhere")).toEqual({ ok: false, error: "ไม่พบโรงพยาบาลนี้ในรายชื่อ" });
    expect(await saveHospitalPhones(HOSPITAL.id, { ...FORM, room: "ถามที่เคาน์เตอร์" })).toMatchObject({ ok: false });
    expect(store.saveOwnerPhones).not.toHaveBeenCalled();
    expect(store.clearOwnerPhones).not.toHaveBeenCalled();
    expect(viewer.audit).not.toHaveBeenCalled();
  });
  it("go back to the website's", async () => {
    expect(await resetHospitalPhones(HOSPITAL.id)).toEqual({ ok: true });
    expect(store.clearOwnerPhones).toHaveBeenCalledWith(HOSPITAL.id);
    expect(viewer.audit).toHaveBeenCalledWith("hospital-phones-reset", HOSPITAL.id, { name: HOSPITAL.th });
  });
  it("say so when the write fails, and audit nothing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    store.saveOwnerPhones.mockRejectedValueOnce(new Error("บันทึกเบอร์ไม่สำเร็จ: down"));
    expect(await saveHospitalPhones(HOSPITAL.id, FORM)).toEqual({ ok: false, error: "บันทึกเบอร์ไม่สำเร็จ: down" });
    expect(viewer.audit).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
