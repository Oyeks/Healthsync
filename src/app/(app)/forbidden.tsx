import Link from "next/link";
import { Card } from "@/components/ui";

/**
 * Rendered when rbac.ts::authorize() calls forbidden() — the role is
 * authenticated but lacks the permission for this area. Using Next.js's
 * dedicated forbidden() primitive (rather than throwing a plain Error for
 * error.tsx to pattern-match) because Next.js redacts thrown error messages
 * before they reach a client error boundary in production, which made the
 * old approach silently fall back to a generic "Something went wrong".
 */
export default function Forbidden() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-bold text-ink-900">Access denied</h1>
        <p className="mt-2 text-sm text-ink-500">
          Your role does not have access to this area. If you believe this is
          an error, contact your system administrator.
        </p>
        <div className="mt-6 flex justify-center">
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
