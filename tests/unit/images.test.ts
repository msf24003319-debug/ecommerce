import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { getImageUrl } from "@/lib/images";

it("normalizes only a leading local public directory", () => {
  expect(getImageUrl("/public/products/dress.jpg")).toBe("/products/dress.jpg");
  expect(getImageUrl("public/products/dress.jpg")).toBe("/products/dress.jpg");
  expect(getImageUrl("/products/dress.jpg")).toBe("/products/dress.jpg");
  for (const url of [
    "https://store.supabase.co/storage/v1/object/public/product-images/photo.jpg",
    "https://images.unsplash.com/photo-example?w=800&q=80",
    "https://res.cloudinary.com/store/image/upload/public/photo.jpg",
  ])
    expect(getImageUrl(url)).toBe(url);
});

it("uses an existing public placeholder for empty paths", () => {
  for (const url of [undefined, null, "", "  ", "/public/", "public/"]) {
    const path = getImageUrl(url);
    expect(path).toBe("/placeholder.svg");
    expect(existsSync(`public${path}`)).toBe(true);
  }
});
