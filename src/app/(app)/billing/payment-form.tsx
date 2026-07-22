"use client";

import { useActionState } from "react";
import { recordPayment, type BillingState } from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/enums";

export function PaymentForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    recordPayment,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <ErrorBanner message={state.error} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" name="amount" type="number" required placeholder="0.00" />
        <Field
          label="Method"
          name="method"
          required
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
      </div>
      <Field label="Reference" name="reference" placeholder="Transaction / receipt reference" />
      <Button type="submit" variant="success" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
