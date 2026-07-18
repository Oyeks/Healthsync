"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { admitPatient, type WardState } from "./actions";
import { Button, ErrorBanner } from "@/components/ui";

type Option = { id: string; label: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Admitting…" : "Admit patient"}
    </Button>
  );
}

export function AdmitForm({
  patients,
  beds,
}: {
  patients: Option[];
  beds: Option[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<WardState, FormData>(
    async (prev, formData) => {
      const result = await admitPatient(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    {},
  );

  const control =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500";

  if (beds.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No beds are currently available. Discharge a patient or release a bed
        from maintenance first.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <ErrorBanner message={state.error} />

      <label className="block">
        <span className="text-sm font-medium text-ink-700">Patient</span>
        <select name="patientId" required className={control}>
          <option value="">Select a patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink-700">Bed</span>
        <select name="bedId" required className={control}>
          <option value="">Select an available bed…</option>
          {beds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink-700">
          Reason for admission
        </span>
        <textarea name="reason" rows={2} className={control} />
      </label>

      <Submit />
    </form>
  );
}
