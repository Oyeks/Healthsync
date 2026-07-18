import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div>
        <h2 className="font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink-700 border border-slate-300 hover:bg-slate-50",
  success: "bg-sync-500 text-white hover:bg-sync-600 shadow-sm",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  hint,
  options,
  rows,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  hint?: string;
  options?: readonly { value: string; label: string }[];
  rows?: number;
}) {
  const control =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-slate-400 focus:border-brand-500";

  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {options ? (
        <select
          name={name}
          required={required}
          defaultValue={defaultValue}
          className={control}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : rows ? (
        <textarea
          name={name}
          required={required}
          rows={rows}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={control}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={control}
        />
      )}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

const BADGE_TONES = {
  neutral: "bg-slate-100 text-ink-700",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-sync-50 text-sync-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Maps a domain status string to a badge tone. */
export function statusTone(status: string): keyof typeof BADGE_TONES {
  switch (status) {
    case "booked":
    case "active":
    case "admitted":
      return "blue";
    case "completed":
    case "available":
    case "outpatient":
      return "green";
    case "cancelled":
    case "no_show":
      return "red";
    case "maintenance":
      return "amber";
    default:
      return "neutral";
  }
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-10 text-center text-sm text-ink-500">{message}</div>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
