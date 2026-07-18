"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  label,
  compact = false,
}: {
  href: string;
  label: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  if (compact) {
    return (
      <Link
        href={href}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "bg-brand-50 text-brand-700"
            : "text-ink-500 hover:text-ink-900"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
