"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createEncounter, type EncounterState } from "./actions";
import { Button, Card, CardHeader, ErrorBanner } from "@/components/ui";
import { screenPrescriptions } from "@/lib/services/cds";
import type { Prescription } from "@/lib/format";

function parseLines(input: string): Prescription[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [drug, dose, frequency, duration] = line
        .split("|")
        .map((p) => p.trim());
      return {
        drug: drug ?? "",
        dose: dose ?? "",
        frequency: frequency ?? "",
        duration: duration ?? "",
      };
    });
}

function Textarea({
  label,
  name,
  rows = 3,
  placeholder,
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500"
      />
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function EncounterForm({
  patientId,
  patientName,
  allergiesJson,
  canPrescribe,
}: {
  patientId: string;
  patientName: string;
  allergiesJson: string | null;
  canPrescribe: boolean;
}) {
  const [state, formAction] = useActionState<EncounterState, FormData>(
    createEncounter,
    {},
  );
  const [prescriptionText, setPrescriptionText] = useState("");
  const [sign, setSign] = useState(true);

  // Live safety screening as the clinician types.
  const alerts = useMemo(
    () => screenPrescriptions(parseLines(prescriptionText), allergiesJson),
    [prescriptionText, allergiesJson],
  );
  const hasCritical = alerts.some((a) => a.severity === "critical");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="sign" value={sign ? "yes" : "no"} />

      <ErrorBanner message={state.error} />

      <Card>
        <CardHeader
          title="SOAP note"
          subtitle={`Clinical encounter for ${patientName}`}
        />
        <div className="space-y-4 p-5">
          <Textarea
            label="Subjective"
            name="subjective"
            placeholder="Presenting complaint, history as reported by the patient…"
          />
          <Textarea
            label="Objective"
            name="objective"
            placeholder="Examination findings, observations, investigation results…"
          />
          <Textarea
            label="Assessment"
            name="assessment"
            required
            placeholder="Clinical impression and differential…"
          />
          <Textarea
            label="Plan"
            name="plan"
            placeholder="Management plan, investigations, follow-up…"
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Diagnoses"
          subtitle="One per line — format: ICD-10 code | description"
        />
        <div className="p-5">
          <Textarea
            label="ICD-10 coded diagnoses"
            name="diagnoses"
            placeholder={"I10 | Essential (primary) hypertension\nE11.9 | Type 2 diabetes mellitus"}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Prescriptions"
          subtitle={
            canPrescribe
              ? "One per line — format: drug | dose | frequency | duration"
              : "Your role cannot issue prescriptions"
          }
        />
        <div className="space-y-4 p-5">
          <Textarea
            label="Medications"
            name="prescriptions"
            rows={4}
            value={prescriptionText}
            onChange={canPrescribe ? setPrescriptionText : undefined}
            placeholder={
              canPrescribe
                ? "Amoxicillin | 500 mg | Three times daily | 7 days"
                : "Prescribing is restricted to doctors"
            }
          />

          {/* Clinical decision support surfaces as the prescription is typed. */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    alert.severity === "critical"
                      ? "border-red-300 bg-red-50"
                      : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      alert.severity === "critical"
                        ? "text-red-800"
                        : "text-amber-800"
                    }`}
                  >
                    {alert.severity === "critical" ? "⛔" : "⚠️"} {alert.title}
                  </p>
                  <p
                    className={`mt-1 text-sm ${
                      alert.severity === "critical"
                        ? "text-red-700"
                        : "text-amber-700"
                    }`}
                  >
                    {alert.detail}
                  </p>
                </div>
              ))}

              {hasCritical && (
                <label className="flex items-start gap-2 rounded-lg border border-red-300 bg-white p-3">
                  <input
                    type="checkbox"
                    name="overrideAcknowledged"
                    value="yes"
                    className="mt-0.5"
                  />
                  <span className="text-sm text-ink-700">
                    I have reviewed the alert above and am proceeding with
                    clinical justification. This override is recorded in the
                    audit log.
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Signature" />
        <div className="p-5">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={sign}
              onChange={(e) => setSign(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-ink-700">
              Sign this note on save. Signed notes are locked and attributed to
              you.
            </span>
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Submit label={sign ? "Save & sign note" : "Save draft"} />
        <Link
          href={`/patients/${patientId}`}
          className="text-sm font-medium text-ink-500 hover:text-ink-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
