import { test, expect, type BrowserContext } from "@playwright/test";
const ids = {
  product: "10000000-0000-4000-8000-000000000001",
  accessory: "10000000-0000-4000-8000-000000000002",
  apparel: "30000000-0000-4000-8000-000000000001",
  accessories: "30000000-0000-4000-8000-000000000002",
  customer: "00000000-0000-4000-8000-000000000002",
};
async function login(context: BrowserContext) {
  const id = "00000000-0000-4000-8000-000000000001",
    exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: id,
        exp,
        aud: "authenticated",
        role: "authenticated",
      }),
    ).toString("base64url") +
    ".fixture";
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" +
        Buffer.from(
          JSON.stringify({
            access_token,
            refresh_token: "fixture",
            expires_at: exp,
            expires_in: 3600,
            token_type: "bearer",
            user: { id },
          }),
        ).toString("base64url"),
      url: "http://localhost:3200",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("restores the original theme, removes Page 1, and preserves pagination filters", async ({
  page,
  context,
}, testInfo) => {
  await login(context);
  await page.goto("/admin/products");
  await expect(
    page.getByRole("heading", { level: 1, name: "Products", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Page 1", { exact: true })).toHaveCount(0);
  const palette = await page.locator(".admin-shell").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      olive: style.getPropertyValue("--olive").trim(),
      ink: style.getPropertyValue("--ink").trim(),
      paper: style.getPropertyValue("--paper").trim(),
      accent: style.getPropertyValue("--accent").trim(),
      background: style.backgroundColor,
    };
  });
  expect(palette).toEqual({
    olive: "#575b40",
    ink: "#302f28",
    paper: "#fffefa",
    accent: "#9c694e",
    background: "rgb(247, 247, 242)",
  });
  await page.screenshot({
    path: testInfo.outputPath("restored-theme.png"),
    fullPage: true,
  });
  await page.goto(
    "/admin/products?page=2&q=Fixture&status=published&sort=name",
  );
  const previous = page
    .getByRole("navigation", { name: "Management pages" })
    .getByRole("link", { name: /Previous/ });
  await expect(previous).toHaveAttribute(
    "href",
    /page=1&q=Fixture&status=published&sort=name/,
  );
  await previous.click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByText("Page 1", { exact: true })).toHaveCount(0);
});
test("coupon selectors persist exact product/category/customer IDs and allow explicit removal", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180000);
  await login(context);
  const cases = [
    { name: "ALL", products: [], categories: [], customers: [] },
    { name: "PRODUCT", products: [ids.product], categories: [], customers: [] },
    {
      name: "MULTI",
      products: [ids.product, ids.accessory],
      categories: [ids.apparel, ids.accessories],
      customers: [],
    },
    {
      name: "CUSTOMER",
      products: [],
      categories: [],
      customers: [ids.customer],
    },
    {
      name: "MIXED",
      products: [ids.product],
      categories: [ids.apparel],
      customers: [ids.customer],
    },
  ];
  const labels: Record<string, string> = {
    [ids.product]: "Fixture garment",
    [ids.accessory]: "Fixture accessory",
    [ids.apparel]: "Fixture apparel",
    [ids.accessories]: "Fixture accessories",
    [ids.customer]: "Fixture Customer",
  };
  for (const item of cases) {
    await page.goto("/admin/coupons");
    const create = page
      .locator(".record-editor")
      .filter({ has: page.locator("summary", { hasText: "Create coupon" }) });
    const code = `PICK-${item.name}-${Date.now()}`;
    await create.getByLabel("Code (uppercase)", { exact: true }).fill(code);
    for (const kind of ["products", "categories", "customers"] as const) {
      const picker = create.getByRole("group", {
        name: `Eligible ${kind}`,
        exact: true,
      });
      for (const selected of item[kind]) {
        await picker.getByRole("searchbox").fill(labels[selected]);
        await picker
          .getByRole("checkbox", { name: new RegExp(labels[selected]) })
          .check();
      }
    }
    await create
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      create.getByRole("status").filter({ hasText: "Saved successfully." }),
    ).toBeVisible();
    await page.reload();
    const row = page.getByRole("region", { name: code, exact: true });
    await row.locator("summary").click();
    for (const [kind, key] of [
      ["products", "product_ids"],
      ["categories", "category_ids"],
      ["customers", "customer_ids"],
    ] as const) {
      await expect(row.locator(`input[name=${key}]`)).toHaveValue(
        JSON.stringify(item[kind]),
      );
      for (const selected of item[kind])
        await expect(
          row
            .getByRole("list", { name: `Selected ${kind}` })
            .getByRole("button", {
              name: "Remove " + labels[selected],
              exact: true,
            }),
        ).toBeVisible();
    }
    if (item.name === "MIXED") {
      await expect(
        row.getByRole("status").filter({ hasText: /Loading/ }),
      ).toHaveCount(0);
      await create.locator("summary").click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.screenshot({
        path: testInfo.outputPath("coupon-selectors.png"),
        fullPage: true,
      });
      await row
        .getByRole("button", { name: "Remove Fixture garment", exact: true })
        .click();
      await row
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        row.getByText("Saved successfully.", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await row.locator("summary").click();
      await expect(row.locator("input[name=product_ids]")).toHaveValue("[]");
      await expect(row.locator("input[name=category_ids]")).toHaveValue(
        JSON.stringify(item.categories),
      );
      await expect(row.locator("input[name=customer_ids]")).toHaveValue(
        JSON.stringify(item.customers),
      );
    }
  }
});
