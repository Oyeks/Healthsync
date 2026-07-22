"use client";

import { Button } from "./ui";

/** Triggers the browser's native print dialog — "Save as PDF" works in every
 * modern browser without any server-side rendering or extra dependency. */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => window.print()}
      className="print:hidden"
    >
      {label}
    </Button>
  );
}
