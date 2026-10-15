type SummaryOrder = { status: string; payment_status: string };
export function activeOrder(order: Pick<SummaryOrder, "status">) {
  return !["cancelled", "returned"].includes(order.status);
}
export function collectedOrder(order: SummaryOrder) {
  return order.payment_status === "paid" && activeOrder(order);
}
function validDate(value: string | undefined): value is string {
  return (
    !!value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function dashboardRange(start?: string, end?: string, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
  const fallback = new Date(Date.parse(today) - 29 * 86400000)
    .toISOString()
    .slice(0, 10);
  const invalid = !!(
    (start && !validDate(start)) ||
    (end && !validDate(end)) ||
    (validDate(start) && validDate(end) && start > end)
  );
  const from = !invalid && validDate(start) ? start : fallback;
  const to = !invalid && validDate(end) ? end : today;
  if (from > to)
    return {
      from: fallback,
      to: today,
      until: today + "T23:59:59.999999+05:00",
      invalid: true,
    };
  return { from, to, until: to + "T23:59:59.999999+05:00", invalid };
}
