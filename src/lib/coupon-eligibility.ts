export const eligibilityKinds = [
  "products",
  "categories",
  "customers",
] as const;
export type EligibilityKind = (typeof eligibilityKinds)[number];
export type EligibilityOption = { id: string; label: string; detail: string };
export const eligibilityKeys = {
  products: "product_ids",
  categories: "category_ids",
  customers: "customer_ids",
} as const;
