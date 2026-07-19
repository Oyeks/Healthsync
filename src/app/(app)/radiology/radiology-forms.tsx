"use client";

import { useActionState } from "react";
import {
  createImagingOrder,
  reportImagingOrder,
  type RadiologyState,
} from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";

export function OrderForm({
  patients,
}: {
  patients: { id: string; firstName: string; lastName: string; mrn: string }[];
}) {
  const [state, action, pending] = useActionState<RadiologyState, FormData>(
    createImagingOrder,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <ErrorBanner message={state.error} />
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Modality"
          name="modality"
          required
          options={[
            { value: "xray", label: "X-Ray" },
            { value: "ct", label: "CT Scan" },
            { value: "mri", label: "MRI" },
            { value: "ultrasound", label: "Ultrasound" },
          ]}
        />
        <Field
          label="Priority"
          name="priority"
          options={[
            { value: "routine", label: "Routine" },
            { value: "urgent", label: "Urgent" },
            { value: "stat", label: "STAT" },
          ]}
        />
      </div>
      <Field label="Body part / region" name="bodyPart" required placeholder="e.g. Chest, Lumbar spine" />
      <Field label="Clinical information" name="clinicalInfo" rows={2} placeholder="Reason for study, relevant history" />
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting..." : "Request imaging"}
      </Button>
    </form>
  );
}

export function ReportForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<RadiologyState, FormData>(
    reportImagingOrder,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <ErrorBanner message={state.error} />
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="Findings" name="findings" rows={3} required placeholder="Describe imaging findings" />
      <Field label="Impression" name="impression" rows={2} required placeholder="Summary impression / diagnosis" />
      <Button type="submit" disabled={pending} variant="success">
        {pending ? "Saving..." : "Submit report"}
      </Button>
    </form>
  );
}
