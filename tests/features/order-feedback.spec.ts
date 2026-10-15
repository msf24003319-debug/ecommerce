import { test, expect, type BrowserContext } from "@playwright/test";
async function session(context: BrowserContext, id: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600,
    token =
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
for (const registered of [false, true])
  test(`${registered ? "registered customer" : "guest"} sees delivery progress, submits private feedback and sees admin approval/reply`, async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(120000);
    if (registered)
      await session(context, "00000000-0000-4000-8000-000000000002");
    await page.route("**/fixture-*.svg", (r) =>
      r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"/>',
      }),
    );
    await page.goto("/products/fixture-garment");
    await page.getByRole("button", { name: "Blue", exact: true }).click();
    await page.getByRole("button", { name: "L", exact: true }).click();
    await page.getByRole("button", { name: "Buy now", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText("L / Blue", { exact: false })).toBeVisible();
    await page.locator("input[name=full_name]").fill("Feedback Fixture");
    await page.locator("input[name=phone]").fill("03001234567");
    await page.locator("input[name=line1]").fill("12 Fixture Street");
    await page.locator("input[name=city]").fill("Lahore");
    await page
      .getByRole("button", { name: "Place COD order", exact: true })
      .click();
    await expect(page).toHaveURL(/\/order-confirmation\//);
    const url = page.url(),
      id = url.split("/").pop()!;
    await expect(
      page.locator(".order-progress [aria-current=step]"),
    ).toContainText("Pending");
    await expect(page.getByText("L / Blue", { exact: true })).toBeVisible();
    const adminContext = await browser.newContext();
    await session(adminContext, "00000000-0000-4000-8000-000000000001");
    const admin = await adminContext.newPage();
    admin.on("dialog", (d) => d.accept());
    await admin.goto("/admin/orders/" + id);
    await expect(
      admin.getByRole("heading", { name: "Order details", exact: true }),
    ).toBeVisible();
    await expect(admin.getByText("L / Blue", { exact: true })).toBeVisible();
    for (const status of [
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "out_for_delivery",
      "delivered",
    ]) {
      await expect(admin.locator("select[name=status]")).toHaveValue(status);
      await admin.locator("select[name=status]").selectOption(status);
      await admin
        .getByLabel("Reason", { exact: true })
        .fill("Fixture status update");
      await admin
        .getByLabel("Courier", { exact: true })
        .fill("Fixture courier");
      await admin
        .getByLabel("Tracking number", { exact: true })
        .fill("FIXTURE-TRACK");
      await admin
        .getByRole("button", { name: "Update order", exact: true })
        .click();
      await expect
        .poll(async () => {
          const snapshot = await (
            await admin.request.get(
              "http://127.0.0.1:4401/fixture/order-state?id=" + id,
            )
          ).json();
          return snapshot.order.status;
        })
        .toBe(status);
      const persisted = await (
        await admin.request.get(
          "http://127.0.0.1:4401/fixture/order-state?id=" + id,
        )
      ).json();
      expect(persisted.order.status).toBe(status);
      expect(persisted.order.payment_status).toBe("unpaid");
      expect(
        persisted.history.some(
          (event: { status: string }) => event.status === status,
        ),
      ).toBe(true);
      await expect(
        admin.locator(".order-progress [aria-current=step]"),
      ).toContainText(
        status === "out_for_delivery"
          ? "Out for delivery"
          : status === "shipped"
            ? "Shipped"
            : status.charAt(0).toUpperCase() + status.slice(1),
      );
      if (status === "processing") {
        await admin.reload();
        await expect(
          admin.locator(".order-progress [aria-current=step]"),
        ).toContainText("Processing");
        await expect(admin.locator("select[name=status]")).toHaveValue(
          "packed",
        );
      }
    }
    await page.reload();
    await expect(
      page.locator(".order-progress [aria-current=step]"),
    ).toContainText("Delivered");
    await expect(
      page.getByText("COD payment: unpaid", { exact: false }),
    ).toBeVisible();
    const message = `Feedback ${registered ? "member" : "guest"} ${id}`;
    await page.locator("select[name=rating]").selectOption("4");
    await page.locator("textarea[name=content]").fill(message);
    await page
      .getByRole("button", { name: /^(Send|Update) feedback$/ })
      .click();
    await expect(
      page.getByText("Thank you. Your feedback is awaiting admin review.", {
        exact: true,
      }),
    ).toBeVisible();
    const publicContext = await browser.newContext(),
      publicPage = await publicContext.newPage();
    await publicPage.goto("/products/fixture-garment");
    await expect(publicPage.getByText(message, { exact: true })).toHaveCount(0);
    await admin.goto("/admin/feedback");
    const article = admin.getByRole("article").filter({ hasText: message });
    await expect(article).toBeVisible();
    await article.getByLabel("Publish on product page").check();
    await article
      .getByLabel("Reply to customer")
      .fill("Thank you for your feedback.");
    await article.getByRole("button", { name: "Save feedback review" }).click();
    await expect(article.getByText("Feedback moderation saved.")).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByText(message, { exact: true })).toBeVisible();
    await page.goto(url);
    await expect(
      page.getByText("Thank you for your feedback.", { exact: true }),
    ).toBeVisible();
    if (registered) {
      await page.goto("/account/orders");
      await expect(
        page.getByText("L / Blue", { exact: true }).first(),
      ).toBeVisible();
    } else {
      const reference = await page
        .getByRole("heading", { name: /^MM-/ })
        .innerText();
      await page.goto(
        "/track-order?reference=" + encodeURIComponent(reference),
      );
      await expect(
        page.locator(".order-progress [aria-current=step]"),
      ).toContainText("Delivered");
    }
    await admin.goto("/admin/orders/" + id);
    await admin
      .getByLabel("Payment reconciliation reason")
      .fill("Confirmed courier remittance");
    await admin
      .getByRole("button", { name: "Record collected COD payment" })
      .click();
    await expect(
      admin.getByText("COD payment: paid", { exact: false }),
    ).toBeVisible();
    await admin.locator("select[name=status]").selectOption("returned");
    await admin
      .getByLabel("Reason", { exact: true })
      .fill("Customer returned the order");
    await admin
      .getByRole("button", { name: "Update order", exact: true })
      .click();
    await expect(
      admin.getByRole("button", { name: "Record completed refund" }),
    ).toBeVisible();
    await admin
      .getByLabel("Payment reconciliation reason")
      .fill("Confirmed customer refund");
    await admin
      .getByRole("button", { name: "Record completed refund" })
      .click();
    await expect(
      admin.getByText("COD payment: refunded", { exact: false }),
    ).toBeVisible();
    await publicContext.close();
    await adminContext.close();
  });
