import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { can, money, orderStatusLabel } from "@/lib/utils";
import Link from "next/link";
import { queryRows } from "@/lib/query-result";
import {
  dashboardRange,
  collectedOrder,
  activeOrder,
} from "@/lib/admin-overview";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; denied?: string }>;
}) {
  const user = await requireStaff();
  const client = await db(),
    params = await searchParams;
  const { from, to, until, invalid } = dashboardRange(params.from, params.to);
  const orderAccess = can(user.profile.role, "orders"),
    catalogAccess = can(user.profile.role, "catalog");
  const [orders, inventory, activity] = await Promise.all([
    orderAccess
      ? client
          .from("orders")
          .select(
            "id,reference,status,payment_status,total,created_at,order_items(product_name,quantity,line_total)",
          )
          .gte("created_at", from + "T00:00:00+05:00")
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(1000)
          .then((r) => queryRows(r, "Dashboard orders could not be loaded."))
      : [],
    catalogAccess
      ? client
          .from("inventory")
          .select("*,product_variants(sku,size,color,product_id)")
          .order("variant_id")
          .limit(1000)
          .then((r) => queryRows(r, "Dashboard inventory could not be loaded."))
      : [],
    can(user.profile.role, "settings")
      ? client
          .from("admin_audit_logs")
          .select("id,action,entity,created_at")
          .order("created_at", { ascending: false })
          .limit(8)
          .then((r) => queryRows(r, "Staff activity could not be loaded."))
      : [],
  ]);
  const stock = inventory.filter((i) => i.on_hand - i.reserved <= 5);
  const paid = orders.filter(collectedOrder);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const outstanding = orders
    .filter((o) => activeOrder(o) && o.payment_status === "unpaid")
    .reduce((s, o) => s + o.total, 0);
  const awaiting = orders.filter((o) =>
    ["pending", "confirmed", "processing", "packed"].includes(o.status),
  ).length;
  const days = new Map<string, number>(),
    best = new Map<string, number>();
  paid.forEach((o) => {
    const day = new Date(o.created_at).toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });
    days.set(day, (days.get(day) ?? 0) + o.total);
    o.order_items.forEach((i) =>
      best.set(i.product_name, (best.get(i.product_name) ?? 0) + i.quantity),
    );
  });
  const peak = Math.max(...days.values(), 1);
  const statuses = [
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "returned",
  ];
  return (
    <>
      <div className="admin-heading">
        <p className="eyebrow">Store overview</p>
        <h1>Your business at a glance</h1>
        <p className="muted">
          Track collections, prioritize orders, and keep your catalog ready to
          sell.
        </p>
      </div>
      {params.denied && (
        <p role="status">
          Your role does not have access to that section. Available sections
          appear in the navigation.
        </p>
      )}
      {invalid && (
        <p role="status">
          Choose a valid date range with the start on or before the end. Showing
          the last 30 days.
        </p>
      )}
      <form className="filters">
        <label>
          From
          <input type="date" name="from" defaultValue={from} required />
        </label>
        <label>
          Through
          <input type="date" name="to" defaultValue={to} min={from} required />
        </label>
        <button className="btn btn-primary">Update range</button>
        <span className="muted">Order dates · Pakistan time</span>
      </form>
      <div className="admin-quick-actions">
        {catalogAccess && (
          <Link className="btn btn-primary" href="/admin/products/new">
            + Add product
          </Link>
        )}
        {orderAccess && (
          <Link className="btn btn-outline" href="/admin/orders?status=pending">
            Review pending orders
          </Link>
        )}
        {catalogAccess && (
          <>
            <Link className="btn btn-outline" href="/admin/inventory">
              Adjust stock
            </Link>
            <Link
              className="btn btn-outline"
              href="/admin/feedback?status=pending"
            >
              Review feedback
            </Link>
          </>
        )}
      </div>
      <div className="metric-grid">
        {orderAccess && (
          <>
            <div className="metric">
              <p>Collected order totals</p>
              <strong>{money(revenue)}</strong>
              <small>Paid orders, excluding cancellations & returns</small>
            </div>
            <div className="metric">
              <p>Orders in period</p>
              <strong>{orders.length.toLocaleString("en-PK")}</strong>
              <small>{awaiting} awaiting fulfillment action</small>
            </div>
            <div className="metric">
              <p>Outstanding COD</p>
              <strong>{money(outstanding)}</strong>
              <small>Unpaid active orders, including undelivered orders</small>
            </div>
          </>
        )}
        {catalogAccess && (
          <div className="metric">
            <p>Variants needing stock</p>
            <strong>{stock.length}</strong>
            <small>
              {stock.filter((i) => i.on_hand - i.reserved <= 0).length} out of
              stock · current inventory
            </small>
          </div>
        )}
      </div>
      <p className="muted">
        Order metrics use up to 1,000 orders placed in this range; inventory
        uses up to 1,000 variants, independent of the date filter. Collected
        totals include shipping and discounts and are grouped by order date, not
        payment date. These figures are not net sales or a cash ledger.
      </p>
      {(orders.length === 1000 || inventory.length === 1000) && (
        <p role="status">
          The display limit was reached. Metrics may be incomplete. Narrow the
          order date range or review the paginated inventory.
        </p>
      )}
      {orderAccess && (
        <>
          <div className="admin-columns">
            <section className="panel">
              <h2>Collected order trend</h2>
              {[...days]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([day, total]) => (
                  <div className="chart-row" key={day}>
                    <span>{day}</span>
                    <div>
                      <i style={{ width: `${(total / peak) * 100}%` }} />
                    </div>
                    <strong>{money(total)}</strong>
                  </div>
                ))}
              {!days.size && (
                <p className="empty">
                  Collected orders will appear here once COD payments are
                  recorded.
                </p>
              )}
            </section>
            <section className="panel">
              <h2>Best-selling products</h2>
              <p className="muted">
                Units from collected orders in this period.
              </p>
              {[...best]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, quantity]) => (
                  <div className="summary-row" key={name}>
                    <span>{name}</span>
                    <strong>{quantity} units</strong>
                  </div>
                ))}
              {!best.size && (
                <p className="empty">
                  No collected product sales in this range.
                </p>
              )}
            </section>
          </div>
          <section className="panel">
            <h2>Fulfillment overview</h2>
            <div className="button-row">
              {statuses.map((status) => (
                <Link
                  key={status}
                  className="badge"
                  data-status={status}
                  href={`/admin/orders?status=${status}`}
                >
                  {orderStatusLabel(status)} ·{" "}
                  {orders.filter((o) => o.status === status).length}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
      <div className="admin-columns">
        {orderAccess && (
          <section className="panel">
            <div className="section-heading">
              <h2>Recent orders</h2>
              <Link className="text-link" href="/admin/orders">
                View all
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Fulfillment</th>
                    <th>Payment</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}`}>
                          {o.reference}
                        </Link>
                        <small className="block muted">
                          {new Date(o.created_at).toLocaleDateString("en-PK", {
                            timeZone: "Asia/Karachi",
                          })}
                        </small>
                      </td>
                      <td>
                        <span className="badge" data-status={o.status}>
                          {orderStatusLabel(o.status)}
                        </span>
                      </td>
                      <td>
                        <span className="badge" data-status={o.payment_status}>
                          {o.payment_status}
                        </span>
                      </td>
                      <td>{money(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!orders.length && (
              <p className="empty">
                No orders in this range. Try a different date range.
              </p>
            )}
          </section>
        )}
        {catalogAccess && (
          <section className="panel">
            <div className="section-heading">
              <h2>Stock needs attention</h2>
              <Link className="text-link" href="/admin/inventory">
                View inventory
              </Link>
            </div>
            {stock.slice(0, 10).map((i) => (
              <div className="summary-row" key={i.variant_id}>
                <Link
                  href={`/admin/products/${i.product_variants?.product_id}`}
                >
                  {i.product_variants?.sku}
                  <small className="block muted">
                    {i.product_variants?.size} / {i.product_variants?.color}
                  </small>
                </Link>
                <span
                  className="badge"
                  data-status={i.on_hand - i.reserved <= 0 ? "out" : "low"}
                >
                  {i.on_hand - i.reserved} available
                </span>
              </div>
            ))}
            {!stock.length && (
              <p className="empty">
                No low-stock variants in the loaded inventory.
              </p>
            )}
          </section>
        )}
      </div>
      {can(user.profile.role, "settings") && (
        <section className="panel">
          <h2>Recent staff activity</h2>
          {activity.map((event) => (
            <div className="summary-row" key={event.id}>
              <span>
                {event.action.replaceAll("_", " ")}
                <small className="block muted">{event.entity}</small>
              </span>
              <time className="muted" dateTime={event.created_at}>
                {new Date(event.created_at).toLocaleString("en-PK", {
                  timeZone: "Asia/Karachi",
                })}
              </time>
            </div>
          ))}
          {!activity.length && (
            <p className="empty">No recent staff activity.</p>
          )}
        </section>
      )}
    </>
  );
}
