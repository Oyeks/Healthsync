"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

/**
 * Catches genuine unexpected crashes only. Auth/permission failures no
 * longer reach here — rbac.ts::authorize() and auth.ts::requireSession()
 * use Next.js's forbidden()/unauthorized() primitives (see forbidden.tsx
 * and unauthorized.tsx), since production redacts thrown error messages
 * before they reach a client-side boundary like this one.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-bold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-500">
          An unexpected error occurred while loading this page.
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
