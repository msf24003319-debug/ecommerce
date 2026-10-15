import "server-only";
import { z } from "zod";
import { staff } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { PublicError } from "@/lib/security/errors";
import {
  eligibilityKinds,
  eligibilityKeys,
  type EligibilityKind,
  type EligibilityOption,
} from "@/lib/coupon-eligibility";

const kindSchema = z.enum(eligibilityKinds);
type OptionRow = {
  id: string;
  name?: string;
  sku?: string;
  status?: string;
  visible?: boolean;
  full_name?: string;
  phone?: string;
  active?: boolean;
};
function option(kind: EligibilityKind, row: OptionRow): EligibilityOption {
  return {
    id: row.id,
    label:
      (kind === "customers" ? row.full_name : row.name) ||
      (kind === "customers" ? "Unnamed customer" : "Unnamed record"),
    detail:
      kind === "products"
        ? [row.sku, row.status].filter(Boolean).join(" / ")
        : kind === "customers"
          ? [row.phone, row.active === false ? "Inactive" : ""]
              .filter(Boolean)
              .join(" / ")
          : row.visible === false
            ? "Hidden category"
            : "",
  };
}
// Query builders are thenable: construct them synchronously so they are not
// accidentally executed before filters and pagination are attached.
function query(client: Awaited<ReturnType<typeof db>>, kind: EligibilityKind) {
  if (kind === "products")
    return client.from("products").select("id,name,sku,status");
  if (kind === "categories")
    return client.from("categories").select("id,name,visible");
  return client
    .from("profiles")
    .select("id,full_name,phone,active")
    .eq("role", "customer");
}
export async function findCouponOptions(input: unknown) {
  await staff("settings");
  const { kind, search, page } = z
    .object({
      kind: kindSchema,
      search: z.string().max(100).default(""),
      page: z.number().int().min(1).max(10000).default(1),
    })
    .parse(input);
  const client = await db();
  let request = query(client, kind);
  const term = search.replace(/[%_\\,()."']/g, " ").trim();
  if (term)
    request =
      kind === "products"
        ? request.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
        : kind === "customers"
          ? request.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
          : request.ilike("name", `%${term}%`);
  const { data, error } = await request
    .order(kind === "customers" ? "full_name" : "name")
    .order("id")
    .range((page - 1) * 20, page * 20);
  if (error || !Array.isArray(data))
    throw new PublicError("Selections could not be loaded. Try again.");
  const rows = data as unknown as OptionRow[];
  return {
    items: rows.slice(0, 20).map((row) => option(kind, row)),
    hasMore: rows.length > 20,
  };
}
export async function resolveCouponTargets(input: unknown) {
  await staff("settings");
  const { kind, ids } = z
    .object({ kind: kindSchema, ids: z.array(z.guid()).max(100) })
    .parse(input);
  if (!ids.length) return { items: [] };
  const { data, error } = await query(await db(), kind).in("id", ids);
  if (error || !Array.isArray(data))
    throw new PublicError(
      "Saved selections could not be loaded. Their restrictions have been retained. Try again.",
    );
  return {
    items: (data as unknown as OptionRow[]).map((row) => option(kind, row)),
  };
}
export async function validateCouponTargets(
  client: Awaited<ReturnType<typeof db>>,
  couponId: string | null,
  values: Record<string, unknown>,
) {
  let existing: Record<string, unknown> = {};
  if (couponId) {
    const { data, error } = await client
      .from("coupons")
      .select("product_ids,category_ids,customer_ids")
      .eq("id", couponId)
      .single();
    if (error || !data)
      throw new PublicError(
        "The coupon could not be loaded. Reload before saving.",
      );
    existing = data;
  }
  for (const kind of eligibilityKinds) {
    const key = eligibilityKeys[kind];
    const ids = [...new Set(z.array(z.guid()).parse(values[key]))];
    const prior = new Set(
      Array.isArray(existing[key]) ? (existing[key] as string[]) : [],
    );
    // Preserve already-saved unavailable targets without broadening eligibility.
    // Newly attached IDs must resolve through this administrator's authorized view.
    const added = ids.filter((id) => !prior.has(id));
    for (let offset = 0; offset < added.length; offset += 100) {
      const chunk = added.slice(offset, offset + 100);
      const { data, error } = await query(client, kind).in("id", chunk);
      if (error || !Array.isArray(data))
        throw new PublicError(
          `Could not validate eligible ${kind}. Try again.`,
        );
      const found = new Set(
        (data as unknown as OptionRow[]).map((row) => row.id),
      );
      if (chunk.some((id) => !found.has(id)))
        throw new PublicError(
          `One or more selected ${kind} are unavailable. Remove those selections or choose an available record.`,
        );
    }
    values[key] = ids;
  }
}
