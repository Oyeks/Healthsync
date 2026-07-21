"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { recordVitals, type PatientFormState } from "../actions";
import { Button, ErrorBanner } from "@/components/ui";

const READINGS = [
  { name: "systolic", label: "Systolic", placeholder: "120" },
  { name: "diastolic", label: "Diastolic", placeholder: "80" },
  { name: "heartRate", label: "Pulse", placeholder: "72" },
  { name: "temperature", label: "Temp °C", placeholder: "36.8", step: "0.1" },
  { name: "spo2", label: "SpO₂ %", placeholder: "98" },
  { name: "respiratoryRate", label: "Resp /min", placeholder: "16" },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="success" disabled={pending}>
      {pending ? "Saving…" : "Record vitals"}
    </Button>
  );
}

export function VitalsForm({ patientId }: { patientId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<PatientFormState, FormData>(
    async (prev, formData) => {
      const result = await recordVitals(prev, formData);
      // Clear the inputs only when the reading saved cleanly.
      if (!result.error) formRef.current?.reset();
      return result;
    },
    {},
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <p className="text-sm font-medium text-ink-700">Record new vitals</p>
      <ErrorBanner message={state.error} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {READINGS.map((reading) => (
          <label key={reading.name} className="block">
            <span className="text-xs text-ink-500">{reading.label}</span>
            <input
              name={reading.name}
              type="number"
              step={reading.step ?? "1"}
              placeholder={reading.placeholder}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-xs text-ink-500">Consciousness</span>
          <select
            name="consciousness"
            defaultValue="alert"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500"
          >
            <option value="alert">Alert</option>
            <option value="voice">Responds to voice</option>
            <option value="pain">Responds to pain</option>
            <option value="unresponsive">Unresponsive</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-5">
          <input type="checkbox" name="onOxygen" value="yes" className="h-4 w-4" />
          <span className="text-xs text-ink-700">On supplemental oxygen</span>
        </label>
      </div>
      <p className="text-xs text-ink-500">
        Consciousness and oxygen status feed the NEWS2 early warning score
        shown above once saved.
      </p>
      <Submit />
    </form>
  );
}
