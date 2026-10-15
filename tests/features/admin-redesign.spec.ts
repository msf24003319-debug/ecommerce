import { test, expect, type BrowserContext } from "@playwright/test";
async function login(context: BrowserContext) {
  const id = "00000000-0000-4000-8000-000000000001",
    exp = Math.floor(Date.now() / 1000) + 3600;
  const token =
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
            access_token: token,
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
test("admin sections render without overflow; navigation and stock persist across refresh", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180000);
  await login(context);
  await page.route("**/fixture-*.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="130"/>',
    }),
  );
  for (const width of [1440, 834, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Your business at a glance" }),
    ).toBeVisible();
    if (width <= 900) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const dialog = page.getByRole("dialog", { name: "Store navigation" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("link", { name: "Products", exact: true }).click();
      await expect(dialog).not.toBeVisible();
    } else {
      await expect(
        page.locator(".admin-sidebar a[aria-current=page]"),
      ).toHaveText("Dashboard");
    }
    for (const section of [
      "products",
      "categories",
      "inventory",
      "orders",
      "customers",
      "inquiries",
      "feedback",
      "coupons",
      "promotions",
      "content",
      "settings",
      "reports",
      "staff",
    ]) {
      await page.goto(`/admin/${section}`);
      await expect(
        page.locator(".admin-content").getByRole("heading", { level: 1 }),
      ).toBeVisible();
      await expect(
        page.getByText("This view is temporarily unavailable"),
      ).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.goto("/admin");
    await page.screenshot({
      path: testInfo.outputPath(`admin-${width}.png`),
      fullPage: true,
    });
  }
  await page.goto("/admin/inventory?q=TEST-S-Ivory");
  const row = page
    .locator(".record-editor")
    .filter({ hasText: "TEST-S-Ivory" });
  await row.locator("summary").click();
  await row.getByLabel("Operation").selectOption("set");
  await row.getByLabel("Quantity", { exact: true }).fill("3");
  await row
    .getByLabel("Reason", { exact: true })
    .fill("Admin redesign persistence check");
  page.once("dialog", (d) => d.accept());
  await row
    .getByRole("button", { name: "Adjust inventory", exact: true })
    .click();
  await expect(row.getByRole("status")).toContainText(
    "Confirmed on-hand stock: 3",
  );
  await page.reload();
  await expect(row.locator("summary")).toContainText("3 on hand");
  await expect(
    page
      .getByRole("cell", {
        name: "Admin redesign persistence check",
        exact: true,
      })
      .first(),
  ).toBeVisible();
});

test("new products retain S/M/L variants and independent stock", async ({
  page,
  context,
}) => {
  await login(context);
  page.on("dialog", (d) => d.accept());
  await page.goto("/admin/products/new");
  const suffix = Date.now().toString();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Admin acceptance product");
  await page
    .getByLabel("Slug", { exact: true })
    .fill("admin-acceptance-" + suffix);
  await page.getByLabel("SKU", { exact: true }).fill("ADMIN-" + suffix);
  await page.getByLabel("Regular price (PKR)", { exact: true }).fill("2500");
  await page.getByLabel("Enable size selection (S, M, L)").check();
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  for (const size of ["S", "M", "L"]) {
    const add = page
      .locator(".record-editor")
      .filter({ has: page.locator("summary", { hasText: "Add variant" }) });
    await add
      .getByLabel("SKU", { exact: true })
      .fill(`ADMIN-${suffix}-${size}`);
    await add
      .getByRole("combobox", { name: "Size", exact: true })
      .selectOption(size);
    await add.getByLabel("Colour", { exact: true }).fill("Ivory");
    await add
      .getByRole("button", { name: "Save variant", exact: true })
      .click();
    await expect(
      page.locator("summary").filter({ hasText: `ADMIN-${suffix}-${size}` }),
    ).toBeVisible();
  }
  const small = page
    .locator(".record-editor")
    .filter({ has: page.locator("summary", { hasText: `ADMIN-${suffix}-S` }) });
  await small.locator("summary").click();
  await small.getByLabel("Quantity", { exact: true }).fill("7");
  await small
    .getByLabel("Reason", { exact: true })
    .fill("Initial size S receipt");
  await small
    .getByRole("button", { name: "Adjust inventory", exact: true })
    .click();
  await expect(small.getByText("Confirmed on-hand stock: 7")).toBeVisible();
  await page.reload();
  await expect(small.locator("summary")).toContainText("Stock 7");
  for (const size of ["M", "L"])
    await expect(
      page.locator("summary").filter({ hasText: `ADMIN-${suffix}-${size}` }),
    ).toContainText("Stock 0");
});
