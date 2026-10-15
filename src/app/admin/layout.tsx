import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signOut } from "@/actions/auth";
import { can } from "@/lib/utils";
import { AdminNavigation } from "@/components/admin/navigation";
import "./admin.css";
export const metadata = {
  title: "Staff dashboard",
  robots: { index: false, follow: false },
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
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.profile.role === "customer") redirect("/account");
  const allowed = [
    "",
    ...Object.keys(scopes).filter((path) =>
      can(user.profile.role, scopes[path]),
    ),
  ];
  return (
    <AdminNavigation
      allowed={allowed}
      name={user.profile.full_name}
      role={user.profile.role}
      signOutControl={
        <form action={signOut}>
          <button type="submit" className="btn btn-outline btn-sm">
            Log out
          </button>
        </form>
      }
    >
      {children}
    </AdminNavigation>
  );
}
