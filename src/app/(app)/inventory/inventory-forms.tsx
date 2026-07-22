"use client";

import { useActionState } from "react";
import { createStock, receiveShipment, type InventoryState } from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";

export function StockForm() {
  const [state, action, pending] = useActionState<InventoryState, FormData>(
    createStock,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <ErrorBanner message={state.error} />
      <Field label="Drug name" name="drugName" required placeholder="e.g. Amoxicillin" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit" name="unit" required placeholder="e.g. tablet, vial" />
        <Field label="Unit cost (₦)" name="unitCost" type="number" placeholder="0.00" />
        <Field label="Quantity on hand" name="quantityOnHand" type="number" required defaultValue={0} />
        <Field label="Reorder threshold" name="reorderThreshold" type="number" required defaultValue={10} />
      </div>
      <Field label="Expiry date" name="expiryDate" type="date" />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Track this drug"}
      </Button>
    </form>
  );
}

export function ReceiveShipmentForm({ stockId }: { stockId: string }) {
  const [state, action, pending] = useActionState<InventoryState, FormData>(
    receiveShipment,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="stockId" value={stockId} />
      <div className="w-24">
        <label className="block text-xs font-medium text-ink-700">
          Qty received
          <input
            name="quantity"
            type="number"
            min={1}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="w-36">
        <label className="block text-xs font-medium text-ink-700">
          New expiry (optional)
          <input
            name="expiryDate"
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="text-xs">
        {pending ? "Saving…" : "Receive"}
      </Button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
