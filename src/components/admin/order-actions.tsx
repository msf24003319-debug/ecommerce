"use client";
import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  allOrderStatuses,
  directOrderTargets,
  orderStatusLabel,
} from "@/lib/utils";
import { codReconciliation } from "@/lib/admin-input";
import { actionRequest } from "@/lib/action-request";
import { updateOrder, recordPayment } from "@/actions/commerce";
import type { Order } from "@/types";
import { OrderStatusSelect } from "./order-status-select";
export function OrderActions({ order }: { order: Order }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const disabled = busy || refreshing;
  const next = directOrderTargets(order.status);
  const [selectedStatus, setSelectedStatus] = useState(next[0] ?? "");
  const targetStatus = next.includes(selectedStatus) ? selectedStatus : next[0];
  const pending = useRef(false);
  const reconciliation = codReconciliation(order.status, order.payment_status);
  return (
    <div className="panel order-management">
      <h2>Order management</h2>
      <div className="order-status-cards">
        <div>
          <span>Fulfillment</span>
          <strong>{orderStatusLabel(order.status)}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>{order.payment_status.replaceAll("_", " ")}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <strong>{order.courier || "Courier not assigned"}</strong>
          <small>{order.tracking_number || "No tracking number yet"}</small>
        </div>
      </div>
      <p className="muted">
        Choose a fulfillment stage directly and record a reason. Earlier stages
        are unavailable. Shipping and later stages require courier and tracking
        details. COD payments are recorded separately.
      </p>
      {next.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current || disabled) return;
            const f = new FormData(e.currentTarget);
            if (
              !confirm(
                `Change order from ${orderStatusLabel(order.status)} to ${orderStatusLabel(String(f.get("status")))}?`,
              )
            )
              return;
            pending.current = true;
            setBusy(true);
            const r = await actionRequest(() =>
              updateOrder({
                id: order.id,
                status: f.get("status"),
                tracking: f.get("tracking"),
                courier: f.get("courier"),
                reason: f.get("reason"),
              }),
            );
            setBusy(false);
            pending.current = false;
            setMessage(
              r.ok
                ? `Order updated to ${orderStatusLabel(String(r.data?.status))}.`
                : r.message,
            );
            if (r.ok) startRefresh(() => router.refresh());
          }}
        >
          <fieldset
            className="form-grid order-action-fields"
            disabled={disabled}
          >
            <OrderStatusSelect
              key={order.id + ":" + order.status}
              value={targetStatus}
              options={allOrderStatuses}
              allowedOptions={next}
              disabled={disabled}
              onChange={setSelectedStatus}
            />
            <label>
              Courier
              <input
                name="courier"
                maxLength={120}
                defaultValue={order.courier}
              />
            </label>
            <label>
              Tracking number
              <input
                name="tracking"
                maxLength={120}
                defaultValue={order.tracking_number}
              />
            </label>
            <label>
              Reason
              <input name="reason" minLength={3} maxLength={500} required />
            </label>
          </fieldset>
          <p className="order-change-preview" aria-live="polite">
            {orderStatusLabel(order.status)} → {orderStatusLabel(targetStatus)}
          </p>
          <button className="btn btn-primary" disabled={disabled}>
            {disabled
              ? "Saving order..."
              : `Mark as ${orderStatusLabel(targetStatus)}`}
          </button>
        </form>
      )}
      {!next.length && (
        <p className="muted">
          This order is {orderStatusLabel(order.status).toLowerCase()}. No
          further fulfillment updates are available.
        </p>
      )}
      {reconciliation && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current || disabled) return;
            if (!confirm("Record confirmed COD collection or refund?")) return;
            pending.current = true;
            setBusy(true);
            const form = new FormData(e.currentTarget);
            const r = await actionRequest(() =>
              recordPayment({
                id: order.id,
                status: reconciliation,
                reason: form.get("reason"),
              }),
            );
            setBusy(false);
            pending.current = false;
            setMessage(r.message);
            if (r.ok) startRefresh(() => router.refresh());
          }}
        >
          <label>
            Payment reconciliation reason
            <input name="reason" required minLength={3} maxLength={500} />
          </label>
          <button disabled={disabled} className="btn btn-outline">
            {busy
              ? "Saving payment..."
              : reconciliation === "refunded"
                ? "Record completed refund"
                : "Record collected COD payment"}
          </button>
        </form>
      )}
      <p role="status">
        {refreshing ? "Reloading the saved order..." : message}
      </p>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={disabled}
        onClick={() => startRefresh(() => router.refresh())}
      >
        Reload order
      </button>
    </div>
  );
}
