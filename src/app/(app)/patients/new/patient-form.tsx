"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { registerPatient, type PatientFormState } from "../actions";
import { Button, Card, CardHeader, ErrorBanner, Field } from "@/components/ui";

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const BLOOD_GROUPS = ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(
  (g) => ({ value: g, label: g || "Unknown" }),
);

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Registering…" : "Register patient"}
    </Button>
  );
}

export function PatientForm() {
  const [state, formAction] = useActionState<PatientFormState, FormData>(
    registerPatient,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      <ErrorBanner message={state.error} />

      <Card>
        <CardHeader
          title="Demographics"
          subtitle="An MRN is generated automatically on save"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="First name" name="firstName" required />
          <Field label="Last name" name="lastName" required />
          <Field label="Date of birth" name="dob" type="date" required />
          <Field
            label="Gender"
            name="gender"
            required
            options={GENDER_OPTIONS}
          />
          <Field
            label="Phone"
            name="phone"
            required
            placeholder="+234 800 000 0000"
          />
          <Field label="Email" name="email" type="email" />
          <Field label="Blood group" name="bloodGroup" options={BLOOD_GROUPS} />
          <Field
            label="National ID / SSN"
            name="nationalId"
            hint="Only the last 4 digits are stored"
          />
          <div className="sm:col-span-2">
            <Field label="Address" name="address" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Emergency contact" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Contact name" name="emergencyContactName" />
          <Field label="Contact phone" name="emergencyContactPhone" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Insurance"
          subtitle="Eligibility is verified against the payer after registration"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Insurance provider"
            name="insuranceProvider"
            placeholder="e.g. Hygeia HMO"
          />
          <Field label="Policy number" name="insurancePolicyNumber" />
          <div className="sm:col-span-2">
            <Field
              label="Known allergies"
              name="allergies"
              rows={3}
              placeholder={"penicillin\nsulfa"}
              hint="One per line. These drive prescribing alerts."
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Clinical flags"
          subtitle="Feed the medication dose-adjustment safety checks — leave blank if unknown"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="eGFR (mL/min/1.73m²)"
            name="egfr"
            type="number"
            placeholder="e.g. 90"
            hint="Estimated renal function, if known"
          />
          <div className="flex flex-col justify-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="hepaticImpairment"
                value="yes"
                className="h-4 w-4"
              />
              Known hepatic impairment
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" name="pregnant" value="yes" className="h-4 w-4" />
              Currently pregnant
            </label>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Submit />
        <Link
          href="/patients"
          className="text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
