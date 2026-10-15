"use server";
import {
  findCouponOptions,
  resolveCouponTargets,
} from "@/repositories/coupon-options";
import { safeErrorMessage } from "@/lib/security/errors";
import type { ActionResult } from "@/types";
export async function searchCouponOptions(
  input: unknown,
): Promise<ActionResult> {
  try {
    return { ok: true, message: "", data: await findCouponOptions(input) };
  } catch (error) {
    return {
      ok: false,
      message: safeErrorMessage(
        error,
        "Selections could not be loaded. Check your access and try again.",
      ),
    };
  }
}
export async function resolveCouponOptions(
  input: unknown,
): Promise<ActionResult> {
  try {
    return { ok: true, message: "", data: await resolveCouponTargets(input) };
  } catch (error) {
    return {
      ok: false,
      message: safeErrorMessage(
        error,
        "Saved selections could not be loaded. Their restrictions have been retained.",
      ),
    };
  }
}
