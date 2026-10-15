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
