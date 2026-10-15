import { notFound } from "next/navigation";
import { BulkStatus } from "@/components/admin/bulk-status";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { reportOrders } from "@/repositories/reports";
import { money, orderStatusLabel } from "@/lib/utils";
import { RecordEditor } from "@/components/admin/editor";
import { StockForm } from "@/components/admin/product-editor";
import { fields } from "@/lib/admin-fields";
import { FeedbackModeration } from "@/components/account/feedback";
import { dashboardRange, collectedOrder } from "@/lib/admin-overview";
import type { Feedback } from "@/types";
type ManagementRecord = Record<string, unknown> & {
  reference: string;
  email: string;
  message: string;
  payment_status: string;
  id: string;
  name: string;
  title: string;
  code: string;
  full_name: string;
  phone: string;
  role: string;
  sku: string;
  sale_price: number | null;
  price: number;
  total: number;
  description: string;
  slug: string;
  announcement: string;
  status: string;
  active: boolean;
  user_id: string | null;
  created_at: string;
  address: { full_name: string } | null;
  product_variants: {
    active: boolean;
    inventory: { on_hand: number; reserved: number } | null;
  }[];
};
const scopes: Record<string, string> = {
  products: "catalog",
  feedback: "catalog",
  categories: "catalog",
  inventory: "catalog",
  orders: "orders",
  customers: "orders",
  inquiries: "orders",
  coupons: "settings",
  promotions: "settings",
  content: "settings",
  settings: "settings",
  reports: "settings",
  staff: "settings",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  if (!Object.hasOwn(scopes, section)) notFound();
  const user = await requireStaff(scopes[section]);
  const client = await db(),
    query = await searchParams;
  const page = Math.max(1, Math.floor(Number(query.page) || 1)),
    q = (query.q ?? "").replace(/[%_\\]/g, "").slice(0, 100);
  const title = section.charAt(0).toUpperCase() + section.slice(1);
  const table =
    section === "content"
      ? "pages"
      : section === "settings"
        ? "store_settings"
        : section === "customers" || section === "staff"
          ? "profiles"
          : section === "inquiries"
            ? "contact_inquiries"
            : section;
  if (section === "feedback") {
    const approved =
      query.status === "approved"
        ? true
        : query.status === "pending"
          ? false
          : null;
    const { data, error } = await client.rpc("feedback_admin", {
      p_page: page,
      p_approved: approved,
    });
    if (error || !Array.isArray(data))
      throw new Error("Feedback could not be loaded.");
    return (
      <>
        <div className="admin-heading">
          <p className="eyebrow">Customer experience</p>
          <h1>Customer feedback</h1>
          <p className="muted">
            Review ratings, manage publication, and reply to customers. Pending
            and hidden reviews share the unpublished state.
          </p>
        </div>
        <form className="filters">
          <label>
            Show feedback
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">All feedback</option>
              <option value="pending">Pending / hidden</option>
              <option value="approved">Published</option>
            </select>
          </label>
          <button className="btn btn-outline">Filter feedback</button>
        </form>
        {data.length ? (
          data.map((r: Feedback) => (
            <FeedbackModeration key={r.id} feedback={r} />
          ))
        ) : (
          <p className="empty">No matching customer feedback yet.</p>
        )}
        <Pagination
          page={page}
          status={query.status}
          hasNext={data.length === 20}
        />
      </>
    );
  }
  if (section === "reports") {
    const { from, to, invalid } = dashboardRange(query.from, query.to);
    const rows = await reportOrders(from, to);
    const paid = rows.filter(collectedOrder);
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const best = new Map<string, { quantity: number; total: number }>();
    paid.forEach((o) =>
      o.order_items.forEach(
        (i: { product_name: string; quantity: number; line_total: number }) => {
          const old = best.get(i.product_name) ?? { quantity: 0, total: 0 };
          best.set(i.product_name, {
            quantity: old.quantity + i.quantity,
            total: old.total + i.line_total,
          });
        },
      ),
    );
    const categorySales = new Map<string, number>();
    paid.forEach((o) =>
      o.order_items.forEach((i) => {
        const category =
          i.product_variants?.products?.categories?.name ?? "Uncategorized";
        categorySales.set(
          category,
          (categorySales.get(category) ?? 0) + i.line_total,
        );
      }),
    );
    const statuses = new Map<string, { count: number; total: number }>();
    rows.forEach((o) => {
      const prior = statuses.get(o.status) ?? { count: 0, total: 0 };
      statuses.set(o.status, {
        count: prior.count + 1,
        total: prior.total + o.total,
      });
    });
    const days = new Map<string, number>();
    paid.forEach((o) => {
      const day = new Date(o.created_at).toLocaleDateString("en-CA", {
        timeZone: "Asia/Karachi",
      });
      days.set(day, (days.get(day) ?? 0) + o.total);
    });
    const high = Math.max(...days.values(), 1);
    return (
      <>
        <div className="admin-heading">
          <p className="eyebrow">Business performance</p>
          <h1>Sales reports</h1>
          <p className="muted">
            Collected order totals and product demand, grouped by order
            placement date.
          </p>
        </div>
        {invalid && (
          <p role="status">Invalid date range. Showing the last 30 days.</p>
        )}
        <form className="filters">
          <label>
            From
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            Through
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button className="btn btn-primary">Generate</button>
          <Link
            className="btn btn-outline"
            href={`/api/admin/export?from=${from}&to=${to}`}
          >
            Export orders CSV
          </Link>
        </form>
        <p className="muted">
          Up to 5,000 orders. Collected order totals include discounts and
          shipping and exclude cancellations and returns. They are not net sales
          or payment-date cash flow. Product figures use immutable item
          snapshots.
        </p>
        <div className="metric-grid">
          {[
            ["Collected sales", money(revenue)],
            ["Order volume", rows.length],
            [
              "Average collected order",
              money(paid.length ? Math.round(revenue / paid.length) : 0),
            ],
            [
              "Cancelled / returned",
              `${rows.filter((o) => o.status === "cancelled").length} / ${rows.filter((o) => o.status === "returned").length}`,
            ],
          ].map(([l, v]) => (
            <div className="metric" key={l}>
              <p>{l}</p>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <section className="panel">
          <h2>Collected sales by day</h2>
          {[...days]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([day, total]) => (
              <div className="chart-row" key={day}>
                <span>{day}</span>
                <div>
                  <i style={{ width: `${(total / high) * 100}%` }} />
                </div>
                <strong>{money(total)}</strong>
              </div>
            ))}
          {!days.size && (
            <p className="empty">No collected sales in this period.</p>
          )}
        </section>
        <section className="panel">
          <h2>Sales by current category</h2>
          <p className="muted">
            Item sales before order-level coupons/shipping. Uses current product
            category.
          </p>
          {[...categorySales].map(([name, total]) => (
            <div className="summary-row" key={name}>
              <span>{name}</span>
              <strong>{money(total)}</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Orders by status</h2>
          {[...statuses].map(([status, value]) => (
            <div className="summary-row" key={status}>
              <span>
                {orderStatusLabel(status)} / {value.count} orders
              </span>
              <strong>{money(value.total)}</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Best-selling pieces</h2>
          <table>
            <thead>
              <tr>
                <th>Piece</th>
                <th>Units</th>
                <th>Item sales</th>
              </tr>
            </thead>
            <tbody>
              {[...best]
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .map(([name, r]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{r.quantity}</td>
                    <td>{money(r.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }
  if (section === "inventory") {
    let inventoryRequest = client
      .from("product_variants")
      .select("*,inventory(*)")
      .order("sku");
    if (q) inventoryRequest = inventoryRequest.ilike("sku", "%" + q + "%");
    const { data, error } = await inventoryRequest.range(
      (page - 1) * 20,
      page * 20 - 1,
    );
    const { data: movements, error: movementError } = await client
      .from("inventory_movements")
      .select("id,delta,reason,created_at,product_variants(sku)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (movementError)
      throw new Error("Stock movement history could not be loaded.");
    if (error) throw new Error("Inventory could not be loaded.");
    return (
      <>
        <div className="admin-heading">
          <p className="eyebrow">Stock control</p>
          <h1>Inventory</h1>
          <p className="muted">Independent stock for every size and color.</p>
        </div>
        <form className="filters">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search variant SKU"
            aria-label="Search variant SKU"
          />
          <button className="btn btn-outline">Search inventory</button>
        </form>
        <p className="muted">
          Available = on hand − reserved. COD checkout deducts stock
          immediately; cancelled and returned orders restore it once.
        </p>
        {data?.map((v) => (
          <details className="record-editor" key={v.id}>
            <summary>
              {v.sku} · {v.size} / {v.color} · {v.inventory?.on_hand ?? 0} on
              hand{" "}
              <span
                className="badge"
                data-status={
                  (v.inventory?.on_hand ?? 0) - (v.inventory?.reserved ?? 0) <=
                  0
                    ? "out"
                    : (v.inventory?.on_hand ?? 0) -
                          (v.inventory?.reserved ?? 0) <=
                        5
                      ? "low"
                      : "available"
                }
              >
                {(v.inventory?.on_hand ?? 0) - (v.inventory?.reserved ?? 0)}{" "}
                available
              </span>
            </summary>
            <StockForm
              variantId={v.id}
              onHand={v.inventory?.on_hand ?? 0}
              reserved={v.inventory?.reserved ?? 0}
            />
          </details>
        ))}
        {!data?.length && (
          <p className="empty">
            Create a product variant to start managing stock.
          </p>
        )}
        <Pagination page={page} q={q} hasNext={(data?.length ?? 0) === 20} />
        <section className="panel">
          <h2>Recent stock movements</h2>
          <p className="muted">
            Latest 20 movements across inventory, including orders and manual
            adjustments.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Change</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {movements?.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {(m.product_variants as unknown as { sku: string } | null)
                        ?.sku ?? "Variant"}
                    </td>
                    <td>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </td>
                    <td>{m.reason}</td>
                    <td>
                      {new Date(m.created_at).toLocaleString("en-PK", {
                        timeZone: "Asia/Karachi",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!movements?.length && (
            <p className="empty">No stock movements recorded.</p>
          )}
        </section>
      </>
    );
  }
  const columns: string =
    section === "products"
      ? "*,product_variants(id,active,inventory(on_hand,reserved))"
      : section === "customers" || section === "staff"
        ? "id,full_name,phone,role,active,created_at"
        : "*";
  let request = client
    .from(table)
    .select(columns, { count: "exact" })
    .order(
      section === "settings"
        ? "id"
        : section === "products" && ["name", "price"].includes(query.sort ?? "")
          ? query.sort!
          : "created_at",
      {
        ascending:
          section === "products" &&
          ["name", "price"].includes(query.sort ?? ""),
      },
    );
  if (["categories", "coupons", "promotions", "pages"].includes(table))
    request = client
      .from(table)
      .select("*", { count: "exact" })
      .order(
        table === "categories"
          ? "position"
          : table === "coupons"
            ? "code"
            : table === "promotions"
              ? "name"
              : "updated_at",
      );
  if (q)
    request = request.ilike(
      table === "orders"
        ? "reference"
        : table === "profiles"
          ? "full_name"
          : table === "coupons"
            ? "code"
            : table === "pages"
              ? "title"
              : "name",
      "%" + q + "%",
    );
  if (
    query.status &&
    ["products", "orders", "contact_inquiries"].includes(table)
  )
    request = request.eq("status", query.status);
  if (section === "staff") request = request.neq("role", "customer");
  if (section === "customers") request = request.eq("role", "customer");
  if (
    section === "orders" &&
    ["paid", "unpaid", "refunded"].includes(query.payment ?? "")
  )
    request = request.eq("payment_status", query.payment!);
  const { data, error, count } = await request.range(
    (page - 1) * 20,
    page * 20 - 1,
  );
  if (error) throw new Error("This management view could not be loaded.");
  const records = (data ?? []) as unknown as ManagementRecord[];
  return (
    <>
      <div className="admin-heading">
        <p className="eyebrow">Store management</p>
        <h1>{title}</h1>
        <p className="muted">
          {count ?? 0} records · Manage your {title.toLowerCase()} in one place.
        </p>
        {section === "products" && (
          <Link className="btn btn-primary" href="/admin/products/new">
            Create product +
          </Link>
        )}
      </div>
      {section !== "settings" && (
        <form className="filters">
          <input
            name="q"
            defaultValue={q}
            placeholder={
              section === "orders"
                ? "Search order reference"
                : section === "customers"
                  ? "Search customer name"
                  : "Search " + title.toLowerCase()
            }
            aria-label={"Search " + title}
          />
          {["products", "orders", "inquiries"].includes(section) && (
            <select
              name="status"
              defaultValue={query.status ?? ""}
              aria-label="Status"
            >
              <option value="">All statuses</option>
              {(section === "products"
                ? ["draft", "published", "archived"]
                : section === "orders"
                  ? [
                      "pending",
                      "confirmed",
                      "processing",
                      "packed",
                      "shipped",
                      "out_for_delivery",
                      "delivered",
                      "cancelled",
                      "returned",
                    ]
                  : ["open", "resolved"]
              ).map((s) => (
                <option key={s} value={s}>
                  {section === "orders" ? orderStatusLabel(s) : s}
                </option>
              ))}
            </select>
          )}
          {section === "products" && (
            <select
              name="sort"
              defaultValue={query.sort ?? "created_at"}
              aria-label="Sort products"
            >
              <option value="created_at">Newest first</option>
              <option value="name">Name A to Z</option>
              <option value="price">Regular price: low to high</option>
            </select>
          )}
          {section === "orders" && (
            <select
              name="payment"
              defaultValue={query.payment ?? ""}
              aria-label="Payment status"
            >
              <option value="">All payments</option>
              <option value="unpaid">Unpaid COD</option>
              <option value="paid">Collected</option>
              <option value="refunded">Refunded</option>
            </select>
          )}
          <button className="btn btn-outline">Filter</button>
          <Link className="text-link" href={"/admin/" + section}>
            Clear filters
          </Link>
        </form>
      )}
      {section === "content" && (
        <>
          <h2>Homepage banners</h2>
          <BannerEditors />
          <h2>Pages & policies</h2>
        </>
      )}
      {fields[table] &&
        !["store_settings", "contact_inquiries"].includes(table) && (
          <RecordEditor
            table={table}
            fields={fields[table]}
            title={
              "Create " +
              (section === "content" ? "page" : section.slice(0, -1))
            }
          />
        )}
      {section === "products" && (
        <BulkStatus
          products={records.map((r) => ({ id: r.id, name: r.name }))}
        />
      )}
      {section === "coupons" ? (
        <div className="coupon-records">
          {records.map((record) => (
            <section
              className="panel coupon-record"
              key={record.id}
              aria-label={record.code}
            >
              <div className="section-heading">
                <h2>{record.code}</h2>
                <span
                  className="badge"
                  data-status={record.active ? "published" : "archived"}
                >
                  {record.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="muted">
                {record.kind === "fixed"
                  ? money(Number(record.value))
                  : `${Number(record.value)}%`}{" "}
                discount{record.kind === "quantity" ? " / quantity offer" : ""}{" "}
                / Minimum subtotal {money(Number(record.minimum))}
              </p>
              <RecordEditor
                table="coupons"
                record={record}
                fields={fields.coupons}
                title="Edit coupon"
              />
            </section>
          ))}
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  {section === "orders"
                    ? "Reference"
                    : section === "products"
                      ? "Product"
                      : section === "coupons"
                        ? "Code"
                        : "Record"}
                </th>
                <th>
                  {section === "products"
                    ? "Price"
                    : section === "orders"
                      ? "Order total"
                      : "Details"}
                </th>
                {section === "products" && <th>Available stock</th>}
                {section === "orders" && (
                  <>
                    <th>Customer</th>
                    <th>Placed</th>
                    <th>Payment</th>
                  </>
                )}
                <th>Status / action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    {section === "products" ? (
                      <Link href={"/admin/products/" + r.id}>
                        {r.name}
                        <small className="block muted">{r.sku}</small>
                      </Link>
                    ) : section === "orders" ? (
                      <Link href={"/admin/orders/" + r.id}>{r.reference}</Link>
                    ) : (
                      (r.name ?? r.title ?? r.code ?? r.full_name ?? r.id)
                    )}
                  </td>
                  <td>
                    {section === "products" ? (
                      money(r.sale_price ?? r.price)
                    ) : section === "orders" ? (
                      money(r.total)
                    ) : section === "customers" || section === "staff" ? (
                      <>
                        <span>{r.phone}</span>
                        <small className="block muted">{r.id}</small>
                        {section === "customers" && (
                          <Link href={"/admin/customers/" + r.id}>
                            View order history →
                          </Link>
                        )}
                      </>
                    ) : section === "inquiries" ? (
                      <>
                        <a href={"mailto:" + r.email}>{r.email}</a>
                        <p className="whitespace">{r.message}</p>
                      </>
                    ) : (
                      (r.description ?? r.slug ?? r.announcement ?? "")
                    )}
                  </td>
                  {section === "products" && (
                    <td>
                      {(r.product_variants ?? [])
                        .filter((v: { active: boolean }) => v.active)
                        .reduce(
                          (
                            sum: number,
                            v: {
                              inventory: {
                                on_hand: number;
                                reserved: number;
                              } | null;
                            },
                          ) =>
                            sum +
                            (v.inventory
                              ? v.inventory.on_hand - v.inventory.reserved
                              : 0),
                          0,
                        )}
                      <small className="block muted">
                        Across active variants
                      </small>
                      <span className="badge" data-status={r.status}>
                        {r.status}
                      </span>
                    </td>
                  )}
                  {section === "orders" && (
                    <>
                      <td>
                        {r.address?.full_name || "Customer"}
                        <small className="block muted">
                          {r.user_id ? "Registered" : "Guest"}
                        </small>
                      </td>
                      <td>
                        {new Date(r.created_at).toLocaleDateString("en-PK", {
                          timeZone: "Asia/Karachi",
                        })}
                      </td>
                      <td>
                        <span className="badge" data-status={r.payment_status}>
                          {r.payment_status}
                        </span>
                      </td>
                    </>
                  )}
                  <td>
                    {section === "products" ? (
                      <Link
                        className="btn btn-outline btn-sm"
                        href={"/admin/products/" + r.id}
                      >
                        Manage product
                      </Link>
                    ) : fields[table] ? (
                      <RecordEditor
                        table={table}
                        record={r}
                        fields={fields[table]}
                        title="Edit"
                      />
                    ) : section === "staff" && user.profile.role === "owner" ? (
                      <RecordEditor
                        table="staff"
                        record={r}
                        fields={fields.staff}
                        title="Manage access"
                      />
                    ) : (
                      <span className="badge" data-status={r.status}>
                        {section === "orders" && r.status
                          ? orderStatusLabel(String(r.status))
                          : (r.status ??
                            r.role ??
                            (r.active === false ? "Inactive" : "Active"))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!records.length && <div className="empty">No matching records.</div>}
      <Pagination
        page={page}
        hasNext={page * 20 < (count ?? 0)}
        q={q}
        status={query.status}
        sort={query.sort}
        payment={query.payment}
      />
      {section === "staff" && (
        <p className="muted">
          First create an account through the normal confirmed registration
          flow. Owners promote existing customer accounts from the customer
          details page. There is no public admin registration.
        </p>
      )}
    </>
  );
}
async function BannerEditors() {
  const { data, error } = await (
    await db()
  )
    .from("banners")
    .select("*")
    .order("position");
  if (error) throw new Error("Banners could not be loaded.");
  return (
    <>
      <RecordEditor
        table="banners"
        fields={fields.banners}
        title="Create banner"
      />
      {data?.map((r) => (
        <RecordEditor
          key={r.id}
          table="banners"
          record={r}
          fields={fields.banners}
          title={r.title}
        />
      ))}
    </>
  );
}
function Pagination({
  page,
  hasNext,
  q = "",
  status = "",
  sort = "",
  payment = "",
}: {
  page: number;
  hasNext: boolean;
  q?: string;
  status?: string;
  sort?: string;
  payment?: string;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="pagination" aria-label="Management pages">
      {page > 1 && (
        <Link
          href={`?page=${page - 1}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}&payment=${encodeURIComponent(payment)}`}
        >
          ← Previous
        </Link>
      )}
      {page > 1 && <span>Page {page}</span>}
      {hasNext && (
        <Link
          href={`?page=${page + 1}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}&payment=${encodeURIComponent(payment)}`}
        >
          Next →
        </Link>
      )}
    </nav>
  );
}
