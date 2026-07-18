"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Permission failures throw from authorize(); show them plainly rather than
  // as a generic crash, since they are an expected outcome of RBAC.
  const isPermission = /lacks permission|Not authenticated/i.test(
    error.message,
  );

  return (
    <div className="mx-auto max-w-lg py-12">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-bold text-ink-900">
          {isPermission ? "Access denied" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          {isPermission
            ? "Your role does not have access to this area. If you believe this is an error, contact your system administrator."
            : "An unexpected error occurred while loading this page."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-slate-50"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
