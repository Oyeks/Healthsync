import Link from "next/link";
import { Card } from "@/components/ui";

/**
 * Rendered when auth.ts::requireSession() calls unauthorized() — no valid
 * session at all (as opposed to forbidden.tsx, which is a valid session
 * lacking a specific permission). See forbidden.tsx for why this uses
 * Next.js's dedicated primitive instead of a thrown Error.
 */
export default function Unauthorized() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <Card className="p-8 text-center">
        <h1 className="text-lg font-bold text-ink-900">Sign in required</h1>
        <p className="mt-2 text-sm text-ink-500">
          Your session has ended or you're not signed in. Please sign in
          again to continue.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Go to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
