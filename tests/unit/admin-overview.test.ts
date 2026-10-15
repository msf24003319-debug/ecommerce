import { describe, expect, it } from "vitest";
import {
  activeOrder,
  collectedOrder,
  dashboardRange,
} from "@/lib/admin-overview";
describe("Admin overview accounting and Pakistan date boundaries", () => {
  it("excludes cancelled and returned orders from collections and receivables", () => {
    for (const status of ["cancelled", "returned"]) {
      expect(activeOrder({ status })).toBe(false);
      expect(collectedOrder({ status, payment_status: "paid" })).toBe(false);
    }
    expect(
      collectedOrder({ status: "delivered", payment_status: "paid" }),
    ).toBe(true);
    expect(
      collectedOrder({ status: "delivered", payment_status: "unpaid" }),
    ).toBe(false);
    expect(
      collectedOrder({ status: "returned", payment_status: "refunded" }),
    ).toBe(false);
  });
  it("uses the Pakistan calendar date and includes fractional seconds on the final day", () => {
    const range = dashboardRange(
      undefined,
      undefined,
      new Date("2026-10-15T20:00:00Z"),
    );
    expect(range).toEqual({
      from: "2026-09-17",
      to: "2026-10-16",
      until: "2026-10-16T23:59:59.999999+05:00",
      invalid: false,
    });
  });
  it.each([
    ["2026-02-30", "2026-03-02"],
    ["2026-10-20", "2026-10-01"],
    ["invalid", "2026-10-15"],
  ])("recovers invalid or reversed dates %s / %s", (from, to) => {
    const range = dashboardRange(from, to, new Date("2026-10-15T10:00:00Z"));
    expect(range.invalid).toBe(true);
    expect(range.from).toBe("2026-09-16");
    expect(range.to).toBe("2026-10-15");
  });
});
