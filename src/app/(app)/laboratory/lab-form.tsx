"use client";

import { useActionState, useState } from "react";
import { createLabResult, type LabState } from "./actions";
import { Button, ErrorBanner, Field } from "@/components/ui";
import { LAB_PANELS } from "@/lib/services/labs";

export function LabForm({
  patients,
}: {
  patients: { id: string; firstName: string; lastName: string; mrn: string }[];
}) {
  const [state, action, pending] = useActionState<LabState, FormData>(
    createLabResult,
    {},
  );
  const [panel, setPanel] = useState(LAB_PANELS[0].panel);
  const definition = LAB_PANELS.find((p) => p.panel === panel)!;

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
      <label className="block">
        <span className="text-sm font-medium text-ink-700">
          Panel <span className="text-red-600">*</span>
        </span>
        <select
          name="panel"
          value={panel}
          onChange={(e) => setPanel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500"
        >
          {LAB_PANELS.map((p) => (
            <option key={p.panel} value={p.panel}>
              {p.panel}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Result values
        </p>
        {definition.analytes.map((analyte) => (
          <label key={analyte.name} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-sm text-ink-700">
              {analyte.name}
            </span>
            <input
              name={`value_${analyte.name}`}
              type="number"
              step="any"
              placeholder={`${analyte.refLow}–${analyte.refHigh}`}
              className="w-32 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500"
            />
            <span className="text-xs text-ink-500">{analyte.unit}</span>
          </label>
        ))}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save result"}
      </Button>
    </form>
  );
}
