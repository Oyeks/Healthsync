"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createInvoice, type BillingState } from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";

type LineItem = { description: string; quantity: number; unitPrice: number };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create invoice"}
    </Button>
  );
}

export function InvoiceForm({
  patients,
  defaultPatientId,
  defaultAppointmentId,
}: {
  patients: { id: string; firstName: string; lastName: string; mrn: string }[];
  defaultPatientId?: string;
  defaultAppointmentId?: string;
}) {
  const [state, action] = useActionState<BillingState, FormData>(createInvoice, {});
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    [items],
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={action} className="space-y-4 p-5">
      <ErrorBanner message={state.error} />
      <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
      {defaultAppointmentId && (
        <input type="hidden" name="appointmentId" value={defaultAppointmentId} />
      )}

      <Field
        label="Patient"
        name="patientId"
        required
        defaultValue={defaultPatientId}
        options={[
          { value: "", label: "— Select patient —" },
          ...patients.map((p) => ({
            value: p.id,
            label: `${p.firstName} ${p.lastName} (${p.mrn})`,
          })),
        ]}
      />

      <div>
        <p className="text-sm font-medium text-ink-700">Line items</p>
        <div className="mt-2 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="w-20">
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="w-28">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Unit price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-ink-500 hover:bg-slate-50 disabled:opacity-40"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-sm font-medium text-brand-700 hover:underline"
        >
          + Add line item
        </button>
      </div>

      <Field label="Due date" name="dueDate" type="date" />

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-sm text-ink-500">Total</span>
        <span className="text-xl font-bold text-ink-900">
          ₦{total.toLocaleString()}
        </span>
      </div>

      <Submit />
    </form>
  );
}
