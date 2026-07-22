import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { permissionsFor } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/enums";
import { LogoMark, Wordmark } from "@/components/logo";
import { logout } from "@/app/login/actions";
import { NavLink } from "@/components/nav-link";

const NAV = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard:view" },
  { href: "/patients", label: "Patients", permission: "patient:read" },
  {
    href: "/appointments",
    label: "Appointments",
    permission: "appointment:read",
  },
  { href: "/laboratory", label: "Laboratory", permission: "lab:read" },
  { href: "/pharmacy", label: "Pharmacy", permission: "pharmacy:read" },
  { href: "/inventory", label: "Inventory", permission: "inventory:read" },
  { href: "/radiology", label: "Radiology", permission: "imaging:read" },
  {
    href: "/physiotherapy",
    label: "Physiotherapy",
    permission: "therapy:read",
  },
  { href: "/wards", label: "Wards & Beds", permission: "admission:write" },
  {
    href: "/care-gaps",
    label: "Care Gaps",
    permission: "engagement:read",
  },
  { href: "/analytics", label: "Analytics", permission: "analytics:read" },
  { href: "/billing", label: "Billing", permission: "billing:read" },
  { href: "/staff", label: "Staff", permission: "staff:manage" },
  { href: "/audit", label: "Audit Log", permission: "audit:read" },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Patients have their own portal and no access to the staff workspace.
  if (session.role === "patient") redirect("/portal");

  const granted = permissionsFor(session.role);
  const items = NAV.filter((item) =>
    granted.includes(item.permission as (typeof granted)[number]),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink-900 md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoMark className="h-8 w-8" />
          <Wordmark className="text-lg" />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium text-white">
            {session.fullName}
          </p>
          <p className="text-xs text-slate-400">{ROLE_LABELS[session.role]}</p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile bar — the sidebar is hidden below md. */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <Wordmark className="text-base" />
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-xs font-medium text-ink-500 hover:text-ink-900"
            >
              Sign out
            </button>
          </form>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              compact
            />
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
