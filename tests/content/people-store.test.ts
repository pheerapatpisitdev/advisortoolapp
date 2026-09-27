import { describe, expect, it } from "vitest";
import { isPhotoPath, orderPhotos } from "@/lib/content/people-store";

describe("a person's photo paths", () => {
  it("take the shape <person id>/<slot>.<ext> and nothing else", () => {
    expect(isPhotoPath("b5b0c41f-1e11-4d75-b0e9-9329024413c2/7.jpg")).toBe(true);
    expect(isPhotoPath("../secret")).toBe(false);
    expect(isPhotoPath("b5b0c41f-1e11-4d75-b0e9-9329024413c2/19.jpg")).toBe(true);
    expect(isPhotoPath("b5b0c41f-1e11-4d75-b0e9-9329024413c2/100.jpg")).toBe(false);
  });
});

describe("the order a person's photos are kept in", () => {
  const kept = ["p/0.jpg", "p/1.jpg", "p/2.jpg"];
  it("puts the photo chosen as main first, and keeps the rest in their order, new ones last", () => {
    expect(orderPhotos(kept, ["p/3.jpg"], "p/2.jpg")).toEqual(["p/2.jpg", "p/0.jpg", "p/1.jpg", "p/3.jpg"]);
  });
  it("leaves the order alone when nothing, or a photo not kept, is chosen", () => {
    expect(orderPhotos(kept, [], undefined)).toEqual(kept);
    expect(orderPhotos(kept, [], "p/9.jpg")).toEqual(kept);
  });
});
