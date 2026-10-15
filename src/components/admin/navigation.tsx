"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  ShoppingBag,
  Users,
  Tag,
  FileText,
  Settings,
  BarChart3,
  Shield,
  MessageSquare,
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
const items = [
  ["", "Dashboard", LayoutDashboard, "Overview"],
  ["reports", "Sales reports", BarChart3, "Overview"],
  ["products", "Products", Package, "Catalog"],
  ["categories", "Categories", Layers, "Catalog"],
  ["inventory", "Inventory", Boxes, "Catalog"],
  ["orders", "Orders", ShoppingBag, "Operations"],
  ["customers", "Customers", Users, "Operations"],
  ["inquiries", "Inquiries", MessageSquare, "Operations"],
  ["feedback", "Product feedback", MessageSquare, "Marketing"],
  ["coupons", "Discounts", Tag, "Marketing"],
  ["promotions", "Promotions", Tag, "Marketing"],
  ["content", "Site content", FileText, "Administration"],
  ["settings", "Store settings", Settings, "Administration"],
  ["staff", "Staff & access", Shield, "Administration"],
] as const;
export function AdminNavigation({
  allowed,
  name,
  role,
  children,
  signOutControl,
}: {
  allowed: string[];
  name: string;
  role: string;
  children: React.ReactNode;
  signOutControl: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const current = items.find(([path]) =>
    path ? pathname.startsWith(`/admin/${path}`) : pathname === "/admin",
  );
  useEffect(() => {
    if (open) drawer.current?.showModal();
    else drawer.current?.close();
  }, [open]);
  function close() {
    setOpen(false);
    toggle.current?.focus();
  }
  const navigation = (
    <>
      <Link className="admin-brand" href="/admin" onClick={close}>
        <span className="admin-monogram">M</span>
        <span>
          MAISON MIRA<small>Commerce workspace</small>
        </span>
      </Link>
      <nav aria-label="Staff navigation">
        {[
          "Overview",
          "Catalog",
          "Operations",
          "Marketing",
          "Administration",
        ].map((group) => {
          const links = items.filter(
            ([path, , , category]) =>
              category === group && allowed.includes(path),
          );
          return links.length ? (
            <details className="admin-nav-group" key={group} open>
              <summary>{group}</summary>
              {links.map(([path, label, Icon]) => {
                const href = `/admin${path ? `/${path}` : ""}`;
                const active = path
                  ? pathname.startsWith(href)
                  : pathname === href;
                return (
                  <Link
                    key={path}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                    {active && <ChevronRight size={14} aria-hidden="true" />}
                  </Link>
                );
              })}
            </details>
          ) : null;
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <Link href="/" className="admin-store-link">
          View storefront <ArrowUpRight size={16} />
        </Link>
        {signOutControl}
      </div>
    </>
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">{navigation}</aside>
      <dialog
        ref={drawer}
        className="admin-drawer"
        onCancel={close}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-label="Store navigation"
      >
        <div>
          <button
            className="admin-icon-button drawer-close"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
          {navigation}
        </div>
      </dialog>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="button-row">
            <button
              ref={toggle}
              className="admin-icon-button admin-menu-toggle"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Menu size={20} />
            </button>
            <nav aria-label="Breadcrumb">
              <Link href="/admin">Workspace</Link>
              <ChevronRight size={14} />
              <span>{current?.[1] ?? "Dashboard"}</span>
              {pathname.split("/").length > 3 && (
                <>
                  <ChevronRight size={14} />
                  <span>
                    {pathname.endsWith("/new") ? "Create" : "Details"}
                  </span>
                </>
              )}
            </nav>
          </div>
          <details className="admin-profile">
            <summary aria-label="Account menu">
              <span className="admin-avatar" aria-hidden="true">
                {(name || "Staff").slice(0, 1).toUpperCase()}
              </span>
              <span>
                {name || "Staff account"}
                <small>{role.replaceAll("_", " ")}</small>
              </span>
            </summary>
            <div>
              <Link href="/account">My account</Link>
              {signOutControl}
            </div>
          </details>
        </header>
        <div className="admin-content">{children}</div>
        <div className="admin-footnote">
          Maison Mira administration <span>PKR · Pakistan Standard Time</span>
        </div>
      </div>
    </div>
  );
}
