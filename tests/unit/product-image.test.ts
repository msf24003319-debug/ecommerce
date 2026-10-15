import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductImage } from "@/components/product/product-image";
it("renders a fallback rather than throwing for unconfigured or unsafe image hosts", () => {
  for (const src of [
    "https://unconfigured.example/image.png",
    "//unconfigured.example/image.png",
    "javascript:alert(1)",
  ]) {
    const html = renderToStaticMarkup(
      createElement(ProductImage, {
        src,
        alt: "Garment",
        width: 80,
        height: 100,
      }),
    );
    expect(html).toContain("Product image unavailable");
    expect(html).not.toContain("<img");
  }
});

it("normalizes local image paths before generating optimizer URLs", () => {
  const html = renderToStaticMarkup(
    createElement(ProductImage, {
      src: "/public/products/dress.jpg",
      alt: "Dress",
      width: 80,
      height: 100,
    }),
  );
  expect(html).toContain("url=%2Fproducts%2Fdress.jpg");
  expect(html).not.toContain("%2Fpublic%2F");
});

it("uses the allowed public endpoint for malformed Supabase product URLs", () => {
  const html = renderToStaticMarkup(
    createElement(ProductImage, {
      src: "https://store.supabase.co/storage/v1/object/product-images/photo.jpg",
      alt: "Dress",
      width: 80,
      height: 100,
    }),
  );
  expect(html).toContain("<img");
  expect(html).toContain("%2Fobject%2Fpublic%2Fproduct-images%2Fphoto.jpg");
});
