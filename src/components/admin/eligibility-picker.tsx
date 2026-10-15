"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  searchCouponOptions,
  resolveCouponOptions,
} from "@/actions/coupon-options";
import { actionRequest } from "@/lib/action-request";
import type {
  EligibilityKind,
  EligibilityOption,
} from "@/lib/coupon-eligibility";

const help: Record<EligibilityKind, string> = {
  products:
    "No selection means all products, subject to any category restriction.",
  categories:
    "No selection means no category restriction. Product and category restrictions must both match when set.",
  customers:
    "No selection means all otherwise-eligible customers, including guests. Selecting customers limits this coupon to their signed-in accounts.",
};
export function EligibilityPicker({
  name,
  label,
  kind,
  initialIds,
  disabled,
}: {
  name: string;
  label: string;
  kind: EligibilityKind;
  initialIds: (string | null)[];
  disabled: boolean;
}) {
  const id = useId();
  const initial = useRef(
    initialIds.filter((value): value is string => typeof value === "string"),
  );
  const [selected, setSelected] = useState(initialIds);
  const [labels, setLabels] = useState<Record<string, EligibilityOption>>({});
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [items, setItems] = useState<EligibilityOption[]>([]),
    [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [resolveError, setResolveError] = useState("");
  useEffect(() => {
    let current = true;
    async function resolve() {
      setResolveError("");
      for (let offset = 0; offset < initial.current.length; offset += 100) {
        const result = await actionRequest(() =>
          resolveCouponOptions({
            kind,
            ids: initial.current.slice(offset, offset + 100),
          }),
        );
        if (!current) return;
        if (!result.ok || !Array.isArray(result.data?.items)) {
          setResolveError(
            result.message ||
              "Saved selections could not be loaded. They are still retained.",
          );
          return;
        }
        const resolved = result.data.items as EligibilityOption[];
        setLabels((previous) => ({
          ...previous,
          ...Object.fromEntries(resolved.map((item) => [item.id, item])),
        }));
      }
    }
    void resolve();
    return () => {
      current = false;
    };
  }, [kind, retry]);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      const result = await actionRequest(() =>
        searchCouponOptions({ kind, search, page }),
      );
      if (!current) return;
      if (result.ok && Array.isArray(result.data?.items)) {
        const found = result.data.items as EligibilityOption[];
        setItems(found);
        setMore(result.data.hasMore === true);
        setLabels((previous) => ({
          ...previous,
          ...Object.fromEntries(found.map((item) => [item.id, item])),
        }));
      } else {
        setItems([]);
        setMore(false);
        setError(result.message || "Selections could not be loaded.");
      }
      setLoading(false);
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [kind, search, page, retry]);
  function reload(nextPage = page) {
    setLoading(true);
    setError("");
    setItems([]);
    setPage(nextPage);
    setRetry((value) => value + 1);
  }
  return (
    <fieldset
      className="eligibility-picker"
      disabled={disabled}
      aria-describedby={id + "-help"}
    >
      <legend>{label}</legend>
      <p id={id + "-help"} className="muted">
        {help[kind]}
      </p>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      {!!selected.length && (
        <ul className="eligibility-selected" aria-label={`Selected ${kind}`}>
          {selected.map((value, index) => (
            <li key={String(value) + ":" + index}>
              <span>
                {labels[value ?? ""]?.label ??
                  `Saved selection (${value?.slice(-8) ?? "unavailable"})`}
                {!labels[value ?? ""] && (
                  <small className="block muted">
                    Unavailable or still loading; restriction retained
                  </small>
                )}
                {labels[value ?? ""]?.detail && (
                  <small className="block muted">
                    {labels[value ?? ""].detail}
                  </small>
                )}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                aria-label={`Remove ${labels[value ?? ""]?.label ?? `saved selection ${value?.slice(-8) ?? "unavailable"}`}`}
                onClick={() =>
                  setSelected((previous) =>
                    previous.filter((item) => item !== value),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {resolveError && (
        <p role="alert">
          {resolveError}{" "}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry saved selections
          </button>
        </p>
      )}
      <label htmlFor={id + "-search"}>Search eligible {kind}</label>
      <input
        id={id + "-search"}
        type="search"
        value={search}
        maxLength={100}
        placeholder={
          kind === "products"
            ? "Product name or SKU"
            : kind === "customers"
              ? "Customer name or phone"
              : "Category name"
        }
        onChange={(event) => {
          setLoading(true);
          setItems([]);
          setError("");
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <div className="eligibility-results" aria-busy={loading}>
        {loading ? (
          <p role="status">Loading {kind}...</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => reload()}
            >
              Retry search
            </button>
          </div>
        ) : !items.length ? (
          <p className="muted">
            No matching {kind}. Saved selections remain selected.
          </p>
        ) : (
          items.map((item) => (
            <label className="eligibility-option" key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...new Set([...previous, item.id])]
                      : previous.filter((value) => value !== item.id),
                  )
                }
              />
              <span>
                {item.label}
                <small className="block muted">{item.detail}</small>
              </span>
            </label>
          ))
        )}
      </div>
      {!loading && !error && (page > 1 || more) && (
        <nav className="button-row" aria-label={`${label} search pages`}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || page === 1}
            onClick={() => reload(page - 1)}
          >
            Previous results
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || !more}
            onClick={() => reload(page + 1)}
          >
            More results
          </button>
        </nav>
      )}
    </fieldset>
  );
}
