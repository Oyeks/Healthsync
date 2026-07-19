"use client";

import { useActionState } from "react";
import { createDispensation, type PharmacyState } from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";

export function DispenseForm({
  patients,
}: {
  patients: { id: string; firstName: string; lastName: string; mrn: string }[];
}) {
  const [state, action, pending] = useActionState<PharmacyState, FormData>(
    createDispensation,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <ErrorBanner message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Patient"
          name="patientId"
          required
          options={[
            { value: "", label: "— Select patient —" },
            ...patients.map((p) => ({
              value: p.id,
              label: `${p.firstName} ${p.lastName} (${p.mrn})`,
            })),
          ]}
        />
        <Field label="Drug name" name="drug" required placeholder="e.g. Amoxicillin" />
        <Field label="Dose" name="dose" required placeholder="e.g. 500mg" />
        <Field label="Quantity" name="quantity" type="number" required defaultValue={1} />
        <Field label="Prescribed by" name="prescribedBy" placeholder="Doctor name" />
        <Field label="Notes" name="notes" placeholder="Dispensing notes" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Dispensing..." : "Dispense medication"}
      </Button>
    </form>
  );
}
