"use client";

import { useActionState } from "react";
import { createTherapySession, type TherapyState } from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";

export function TherapyForm({
  patients,
}: {
  patients: { id: string; firstName: string; lastName: string; mrn: string }[];
}) {
  const [state, action, pending] = useActionState<TherapyState, FormData>(
    createTherapySession,
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
          label="Session type"
          name="sessionType"
          required
          options={[
            { value: "initial_assessment", label: "Initial Assessment" },
            { value: "treatment", label: "Treatment" },
            { value: "follow_up", label: "Follow-up" },
            { value: "discharge", label: "Discharge" },
          ]}
        />
        <Field
          label="Status"
          name="status"
          options={[
            { value: "completed", label: "Completed" },
            { value: "scheduled", label: "Scheduled" },
          ]}
        />
      </div>
      <Field
        label="Diagnosis / Referral reason"
        name="diagnosis"
        placeholder="e.g. Post-operative knee rehabilitation"
      />
      <Field
        label="Treatment plan"
        name="treatmentPlan"
        rows={2}
        placeholder="Goals and planned interventions"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Pain level before (0-10)"
          name="painLevelBefore"
          type="number"
          placeholder="0"
        />
        <Field
          label="Pain level after (0-10)"
          name="painLevelAfter"
          type="number"
          placeholder="0"
        />
      </div>
      <Field
        label="Exercises given"
        name="exercisesGiven"
        rows={3}
        placeholder="One per line: Exercise name | sets x reps | notes"
        hint="e.g. Straight leg raise | 3x10 | Hold 5 seconds"
      />
      <Field
        label="Next session date"
        name="nextSessionDate"
        type="date"
      />
      <Field label="Session notes" name="notes" rows={3} placeholder="Clinical observations, progress notes" />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Record session"}
      </Button>
    </form>
  );
}
