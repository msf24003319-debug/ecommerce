import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  staff: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ staff: mocks.staff, currentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ db: mocks.db }));
vi.mock("@/lib/security/guest-checkout", () => ({
  guestToken: async () => null,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { updateOrder, saveRecord } from "@/actions/commerce";
import {
  findCouponOptions,
  resolveCouponTargets,
  validateCouponTargets,
} from "@/repositories/coupon-options";
import { RecordEditor } from "@/components/admin/editor";
import { fields } from "@/lib/admin-fields";
import { OrderActions } from "@/components/admin/order-actions";
import type { Order } from "@/types";
const id = "00000000-0000-4000-8000-000000000011";
function client(rows: Record<string, unknown>[] = []) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    or: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { id, status: "confirmed" }, error: null }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  for (const key of [
    "select",
    "eq",
    "in",
    "or",
    "ilike",
    "order",
    "range",
    "insert",
    "update",
  ] as const)
    chain[key].mockReturnValue(chain);
  const result = {
    chain,
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mocks.db.mockResolvedValue(result);
  return result;
}
const transition = {
  id,
  status: "processing",
  reason: "Ready to prepare",
  courier: "",
  tracking: "",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ id, profile: { role: "owner" } });
});
describe("Verified fulfillment updates", () => {
  it("verifies the void RPC against saved status and invalidates the affected views", async () => {
    const c = client();
    c.chain.single
      .mockResolvedValueOnce({ data: { id, status: "confirmed" }, error: null })
      .mockResolvedValueOnce({
        data: { id, status: "processing" },
        error: null,
      });
    const result = await updateOrder(transition);
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("processing");
    expect(mocks.staff).toHaveBeenCalledWith("orders");
    expect(c.rpc).toHaveBeenCalledWith("transition_order", {
      p_order: id,
      p_status: "processing",
      p_reason: "Ready to prepare",
      p_tracking: "",
      p_courier: "",
    });
    for (const path of ["/admin", "/admin/orders", "/admin/orders/" + id])
      expect(mocks.revalidate).toHaveBeenCalledWith(path);
    expect(c.chain.update).not.toHaveBeenCalled();
  });
  it("does not claim success for an acknowledged no-op or failed verification read", async () => {
    const c = client();
    expect((await updateOrder(transition)).ok).toBe(false);
    c.chain.single
      .mockResolvedValueOnce({ data: { id, status: "confirmed" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "PRIVATE" },
      } as never);
    const result = await updateOrder(transition);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("could not be verified");
    expect(result.message).not.toContain("PRIVATE");
  });
  it.each(["confirmed", "pending"])(
    "rejects repeated/backward %s actions before mutation",
    async (status) => {
      const c = client();
      expect((await updateOrder({ ...transition, status })).ok).toBe(false);
      expect(c.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(["PGRST202", "42883", "23514"])(
    "reports workflow deployment incompatibility for %s",
    async (code) => {
      const c = client();
      c.rpc.mockResolvedValue({
        data: null,
        error: { code, message: "orders_status_check" },
      } as never);
      const result = await updateOrder(transition);
      expect(result.ok).toBe(false);
      expect(result.message).toContain("202610140014");
    },
  );
  it("makes an invalid-transition RPC rejection actionable without bypassing its guard", async () => {
    const c = client();
    c.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Invalid order transition" },
    } as never);
    const result = await updateOrder(transition);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Reload");
    expect(result.message).toContain("202610140014");
    expect(c.chain.update).not.toHaveBeenCalled();
  });
  it("retains actionable RPC business errors, mandatory reasons, and authorization", async () => {
    const c = client();
    c.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Courier and tracking required" },
    } as never);
    expect(
      (await updateOrder({ ...transition, status: "cancelled" })).message,
    ).toBe("Courier and tracking required");
    c.rpc.mockClear();
    expect((await updateOrder({ ...transition, reason: " " })).ok).toBe(false);
    expect(c.rpc).not.toHaveBeenCalled();
    mocks.staff.mockRejectedValue(new Error("private"));
    expect((await updateOrder(transition)).ok).toBe(false);
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it("renders the correct default next action and current status", () => {
    const html = renderToStaticMarkup(
      createElement(OrderActions, {
        order: {
          id,
          status: "confirmed",
          payment_status: "unpaid",
          courier: "",
          tracking_number: "",
        } as Order,
      }),
    );
    expect(html).toContain('name="status" value="processing"');
    expect(html).toContain("Fulfillment");
    expect(html).toContain('role="combobox"');
  });
  it("routes a direct jump through the atomic advancement RPC", async () => {
    const c = client();
    c.chain.single
      .mockResolvedValueOnce({ data: { id, status: "pending" }, error: null })
      .mockResolvedValueOnce({
        data: { id, status: "delivered" },
        error: null,
      });
    const result = await updateOrder({
      ...transition,
      status: "delivered",
      tracking: "TRACK",
      courier: "Courier",
    });
    expect(result.ok).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith(
      "advance_order",
      expect.objectContaining({ p_status: "delivered" }),
    );
  });
});
describe("Coupon eligibility safety", () => {
  it("searches a bounded, scoped safe customer view", async () => {
    const c = client(
      Array.from({ length: 21 }, () => ({
        id,
        full_name: "Customer",
        phone: "03000000000",
      })),
    );
    const result = await findCouponOptions({
      kind: "customers",
      search: "Customer",
      page: 2,
    });
    expect(mocks.staff).toHaveBeenCalledWith("settings");
    expect(c.chain.select).toHaveBeenCalledWith("id,full_name,phone,active");
    expect(c.chain.eq).toHaveBeenCalledWith("role", "customer");
    expect(c.chain.range).toHaveBeenCalledWith(20, 40);
    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(true);
  });
  it("resolves stored IDs without filtering archived products", async () => {
    const c = client([
      { id, name: "Archived item", sku: "ARCHIVE", status: "archived" },
    ]);
    expect(
      (await resolveCouponTargets({ kind: "products", ids: [id] })).items[0]
        .detail,
    ).toContain("archived");
    expect(c.chain.in).toHaveBeenCalledWith("id", [id]);
    expect(c.chain.eq).not.toHaveBeenCalledWith("status", "published");
  });
  it("rejects unavailable new targets and malformed IDs before saving", async () => {
    const c = client();
    await expect(
      validateCouponTargets(c as never, null, {
        product_ids: [id],
        category_ids: [],
        customer_ids: [],
      }),
    ).rejects.toThrow("unavailable");
    await expect(
      resolveCouponTargets({ kind: "customers", ids: ["invalid"] }),
    ).rejects.toThrow();
    expect(c.chain.insert).not.toHaveBeenCalled();
  });
  it("preserves saved unavailable restrictions and validates newly added IDs", async () => {
    const c = client();
    c.chain.single.mockResolvedValue({
      data: { product_ids: [], category_ids: [id], customer_ids: [] },
      error: null,
    } as never);
    const values = { product_ids: [], category_ids: [id], customer_ids: [] };
    await validateCouponTargets(c as never, id, values);
    expect(values.category_ids).toEqual([id]);
    expect(c.chain.in).not.toHaveBeenCalled();
  });
  it("blocks unauthorized lookup and saves before database access", async () => {
    client();
    mocks.db.mockClear();
    mocks.staff.mockRejectedValue(new Error("No access"));
    await expect(findCouponOptions({ kind: "customers" })).rejects.toThrow();
    expect(mocks.db).not.toHaveBeenCalled();
    expect((await saveRecord("coupons", null, {})).ok).toBe(false);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("retains legacy null targets without crashing or replacing their restriction with an empty array", () => {
    const html = renderToStaticMarkup(
      createElement(RecordEditor, {
        table: "coupons",
        title: "Create coupon",
        fields: fields.coupons.map((field) =>
          field.key === "product_ids" ? { ...field, default: [null] } : field,
        ),
      }),
    );
    expect(html).toContain('name="product_ids" value="[null]"');
    expect(html).toContain("restriction retained");
    expect(html).toContain("unavailable");
  });
  it("renders normal selectors and retains the exact hidden ID arrays", () => {
    const html = renderToStaticMarkup(
      createElement(RecordEditor, {
        table: "coupons",
        title: "Create coupon",
        fields: fields.coupons.map((field) =>
          field.key === "product_ids" ? { ...field, default: [id] } : field,
        ),
      }),
    );
    expect(html).toContain("Search eligible products");
    expect(html).toContain("Search eligible categories");
    expect(html).toContain("Search eligible customers");
    expect(html).toContain('type="hidden" name="product_ids"');
    expect(html).toContain(id);
    expect(html).not.toContain("Eligible product UUIDs");
    expect(html).not.toContain("JSON array; [] = all");
  });
});
it("inherits the original color tokens without editing the storefront", () => {
  const css = readFileSync("src/app/admin/admin.css", "utf8"),
    global = readFileSync("src/app/globals.css", "utf8");
  expect(global).toContain("--olive: #575b40");
  expect(global).toContain("--paper: #fffefa");
  expect(global).toContain("--accent: #9c694e");
  expect(css).not.toMatch(/--(?:olive|ink|paper|accent):/);
  expect(css).not.toContain("#36584a");
  expect(css).toContain("background: #f7f7f2");
});
