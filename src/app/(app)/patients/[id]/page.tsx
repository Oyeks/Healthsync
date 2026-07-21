import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  statusTone,
} from "@/components/ui";
import {
  age,
  formatDate,
  formatDateTime,
  fullName,
  parseJson,
  type Allergy,
  type Diagnosis,
  type Insurance,
  type Prescription,
} from "@/lib/format";
import { computeNews2 } from "@/lib/services/news2";
import type { LabAnalyte } from "@/lib/services/labs";
import { VitalsForm } from "./vitals-form";

const NEWS2_TONE = {
  low: "green" as const,
  medium: "amber" as const,
  high: "red" as const,
};

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  authorize(session, "patient:read");
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      records: {
        orderBy: { visitDate: "desc" },
        include: { doctor: true },
      },
      vitals: {
        orderBy: { recordedAt: "desc" },
        take: 5,
        include: { recordedBy: true },
      },
      appointments: {
        orderBy: { startTime: "desc" },
        take: 5,
        include: { doctor: true },
      },
      admissions: {
        where: { status: "active" },
        include: { bed: true },
      },
      labResults: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!patient) notFound();

  const allergies = parseJson<Allergy[]>(patient.allergies, []);
  const insurance = parseJson<Insurance | null>(patient.insurance, null);
  const latestVitals = patient.vitals[0];
  const activeAdmission = patient.admissions[0];
  const news2 = latestVitals
    ? computeNews2({
        respiratoryRate: latestVitals.respiratoryRate,
        spo2: latestVitals.spo2,
        onOxygen: latestVitals.onOxygen,
        systolic: latestVitals.systolic,
        heartRate: latestVitals.heartRate,
        consciousness: latestVitals.consciousness,
        temperature: latestVitals.temperature,
      })
    : null;

  return (
    <>
      <PageHeader
        title={fullName(patient)}
        subtitle={`${patient.mrn} · ${age(patient.dob)} years · ${patient.gender}`}
        action={
          <div className="flex gap-2">
            {can(session.role, "appointment:write") && (
              <ButtonLink
                href={`/appointments/new?patientId=${patient.id}`}
                variant="secondary"
              >
                Book appointment
              </ButtonLink>
            )}
            {can(session.role, "record:write") && (
              <ButtonLink href={`/patients/${patient.id}/encounter`}>
                New encounter
              </ButtonLink>
            )}
          </div>
        }
      />

      {/* Allergy red flags sit above everything — the spec calls these out. */}
      {allergies.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-red-700">
            Allergy alert
          </p>
          <ul className="mt-2 space-y-1">
            {allergies.map((allergy) => (
              <li key={allergy.substance} className="text-sm text-red-800">
                <span className="font-semibold capitalize">
                  {allergy.substance}
                </span>{" "}
                — {allergy.reaction} ({allergy.severity})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — demographics */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Demographics" />
            <dl className="space-y-3 p-5 text-sm">
              {[
                ["MRN", patient.mrn],
                ["Date of birth", formatDate(patient.dob)],
                ["Blood group", patient.bloodGroup ?? "Not recorded"],
                ["Phone", patient.phone],
                ["Email", patient.email ?? "—"],
                ["Address", patient.address ?? "—"],
                [
                  "National ID",
                  patient.nationalIdLast4
                    ? `•••• ${patient.nationalIdLast4}`
                    : "—",
                ],
                [
                  "Emergency contact",
                  patient.emergencyContactName
                    ? `${patient.emergencyContactName} · ${patient.emergencyContactPhone}`
                    : "—",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="mt-0.5 text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Insurance" />
            <div className="p-5 text-sm">
              {insurance ? (
                <>
                  <p className="font-medium text-ink-900">
                    {insurance.provider}
                  </p>
                  <p className="mt-1 text-ink-500">
                    Policy {insurance.policyNumber}
                  </p>
                  {insurance.eligibility && (
                    <p className="mt-2">
                      <Badge
                        tone={
                          insurance.eligibility === "active" ? "green" : "amber"
                        }
                      >
                        {insurance.eligibility.replace("_", " ")}
                      </Badge>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-ink-500">Self-pay — no insurance on file.</p>
              )}
            </div>
          </Card>

          {(patient.egfr != null ||
            patient.hepaticImpairment ||
            patient.pregnant) && (
            <Card>
              <CardHeader
                title="Clinical flags"
                subtitle="Feeds medication dose-adjustment checks"
              />
              <dl className="space-y-3 p-5 text-sm">
                {patient.egfr != null && (
                  <div>
                    <dt className="text-xs text-ink-500">eGFR</dt>
                    <dd className="mt-0.5 flex items-center gap-2 text-ink-900">
                      {patient.egfr} mL/min/1.73m²
                      {patient.egfr < 60 && (
                        <Badge tone="amber">Renal impairment</Badge>
                      )}
                    </dd>
                  </div>
                )}
                {patient.hepaticImpairment && (
                  <div>
                    <Badge tone="amber">Hepatic impairment</Badge>
                  </div>
                )}
                {patient.pregnant && (
                  <div>
                    <Badge tone="blue">Pregnant</Badge>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {activeAdmission && (
            <Card>
              <CardHeader title="Current admission" />
              <div className="p-5 text-sm">
                <p className="font-medium text-ink-900">
                  {activeAdmission.bed.ward} · Bed {activeAdmission.bed.code}
                </p>
                <p className="mt-1 text-ink-500">
                  Admitted {formatDateTime(activeAdmission.admittedAt)}
                </p>
                {activeAdmission.reason && (
                  <p className="mt-2 text-ink-700">{activeAdmission.reason}</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Centre — clinical timeline */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Latest vitals"
              subtitle={
                latestVitals
                  ? `Recorded ${formatDateTime(latestVitals.recordedAt)} by ${latestVitals.recordedBy.fullName}`
                  : undefined
              }
              action={
                news2 && news2.scored ? (
                  <Badge tone={NEWS2_TONE[news2.risk]}>
                    NEWS2 {news2.score} · {news2.risk}
                  </Badge>
                ) : undefined
              }
            />
            {news2 && news2.scored && news2.risk !== "low" && (
              <div
                className={`mx-5 mt-4 rounded-lg border px-3 py-2 text-sm ${
                  news2.risk === "high"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {news2.recommendation}
              </div>
            )}
            {latestVitals ? (
              <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [
                    "BP",
                    latestVitals.systolic && latestVitals.diastolic
                      ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                      : "—",
                    "mmHg",
                  ],
                  ["Pulse", latestVitals.heartRate ?? "—", "bpm"],
                  ["Temp", latestVitals.temperature ?? "—", "°C"],
                  ["SpO₂", latestVitals.spo2 ?? "—", "%"],
                  ["Resp", latestVitals.respiratoryRate ?? "—", "/min"],
                  ["Weight", latestVitals.weightKg ?? "—", "kg"],
                ].map(([label, value, unit]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-ink-500">{label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                      {value}
                      <span className="ml-1 text-xs font-normal text-ink-500">
                        {unit}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState message="No vitals recorded for this patient." />
            )}

            {can(session.role, "vitals:write") && (
              <div className="border-t border-slate-200 p-5">
                <VitalsForm patientId={patient.id} />
              </div>
            )}
          </Card>

          {can(session.role, "lab:read") && (
            <Card>
              <CardHeader
                title="Recent lab results"
                subtitle={`${patient.labResults.length} record${patient.labResults.length === 1 ? "" : "s"}`}
              />
              {patient.labResults.length === 0 ? (
                <EmptyState message="No lab results recorded yet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {patient.labResults.map((result) => {
                    const analytes = parseJson<LabAnalyte[]>(
                      result.results,
                      [],
                    );
                    return (
                      <li key={result.id} className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink-900">
                            {result.panel}
                          </p>
                          <span className="text-xs text-ink-500">
                            {formatDateTime(result.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {analytes.map((a) => (
                            <span
                              key={a.name}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                            >
                              {a.name}: {a.value} {a.unit}
                              {a.flag !== "normal" && (
                                <Badge
                                  tone={a.flag === "critical" ? "red" : "amber"}
                                >
                                  {a.flag}
                                </Badge>
                              )}
                            </span>
                          ))}
                        </div>
                        {result.summary && (
                          <p className="mt-2 text-sm text-ink-700">
                            {result.summary}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardHeader
              title="Visit history"
              subtitle={`${patient.records.length} recorded encounter${patient.records.length === 1 ? "" : "s"}`}
            />
            {patient.records.length === 0 ? (
              <EmptyState message="No clinical encounters recorded yet." />
            ) : (
              <ol className="divide-y divide-slate-100">
                {patient.records.map((record) => {
                  const diagnoses = parseJson<Diagnosis[]>(
                    record.diagnoses,
                    [],
                  );
                  const prescriptions = parseJson<Prescription[]>(
                    record.prescriptions,
                    [],
                  );
                  return (
                    <li key={record.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">
                            {formatDate(record.visitDate)}
                          </p>
                          <p className="text-xs text-ink-500">
                            {record.doctor.fullName}
                          </p>
                        </div>
                        {record.signedAt ? (
                          <Badge tone="green">
                            Signed · {formatDate(record.signedAt)}
                          </Badge>
                        ) : (
                          <Badge tone="amber">Draft — unsigned</Badge>
                        )}
                      </div>

                      <dl className="mt-3 space-y-2 text-sm">
                        {[
                          ["Subjective", record.subjective],
                          ["Objective", record.objective],
                          ["Assessment", record.assessment],
                          ["Plan", record.plan],
                        ]
                          .filter(([, value]) => value)
                          .map(([label, value]) => (
                            <div key={label as string}>
                              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                                {label}
                              </dt>
                              <dd className="mt-0.5 text-ink-700">{value}</dd>
                            </div>
                          ))}
                      </dl>

                      {diagnoses.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {diagnoses.map((d) => (
                            <Badge key={d.code} tone="blue">
                              {d.code} · {d.description}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {prescriptions.length > 0 && (
                        <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
                          {prescriptions.map((p, i) => (
                            <li key={i} className="text-ink-700">
                              <span className="font-medium text-ink-900">
                                {p.drug}
                              </span>{" "}
                              {p.dose} · {p.frequency} · {p.duration}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader title="Appointments" />
            {patient.appointments.length === 0 ? (
              <EmptyState message="No appointments for this patient." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {patient.appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-ink-900">
                        {formatDateTime(appointment.startTime)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {appointment.doctor.fullName} ·{" "}
                        {appointment.reason ?? "No reason recorded"}
                      </p>
                    </div>
                    <Badge tone={statusTone(appointment.status)}>
                      {appointment.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-200 px-5 py-3">
              <Link
                href="/appointments"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View full schedule →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
