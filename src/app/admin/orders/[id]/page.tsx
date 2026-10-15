import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/account/order-view";
import { OrderActions } from "@/components/admin/order-actions";
import type { Order } from "@/types";
import { orderProgress } from "@/repositories/order-progress";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff("orders");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = await db();
  const { data, error } = await client
    .from("orders")
    .select("*,order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Order could not be loaded.");
  if (!data) notFound();
  const { data: events, error: timelineError } = await client.rpc(
    "order_timeline",
    { p_order: id },
  );
  if (timelineError) throw new Error("Order timeline could not be loaded.");
  return (
    <>
      <div className="admin-heading">
        <Link className="admin-back-link" href="/admin/orders">
          Back to orders
        </Link>
        <p className="eyebrow">Orders & fulfillment</p>
        <h1>Order details</h1>
        <p className="muted">
          Manage fulfillment and reconcile COD payments separately.
        </p>
      </div>
      <OrderView
        order={data as Order}
        progress={await orderProgress(id)}
        customerFeedback={false}
      />
      <OrderActions order={data as Order} />
      <section className="panel">
        <h2>Order timeline</h2>
        {events?.map(
          (
            e: {
              action: string;
              details: Record<string, unknown>;
              created_at: string;
            },
            i: number,
          ) => (
            <p key={i}>
              {new Date(e.created_at).toLocaleString("en-PK", {
                timeZone: "Asia/Karachi",
              })}{" "}
              · {e.action} {e.details?.to ? `→ ${e.details.to}` : ""}
              {e.details?.from ? ` (from ${e.details.from})` : ""}
              {e.details?.actor_id ? ` · Staff: ${e.details.actor_id}` : ""}
              {e.details?.reason ? ` · ${e.details.reason}` : ""}
            </p>
          ),
        )}
        {!events?.length && <p>No timeline events recorded yet.</p>}
      </section>
    </>
  );
}
