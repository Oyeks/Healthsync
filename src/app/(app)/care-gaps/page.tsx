import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { findCareGaps, findMedicationGaps, findScreeningGaps } from "@/lib/services/care-gaps";

const URGENCY_TONE = { due: "amber" as const, overdue: "red" as const };

export default async function CareGapsPage() {
  const session = await requireSession();
  authorize(session, "engagement:read");

  const patients = await prisma.patient.findMany({
    where: { status: { not: "discharged" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mrn: true,
      dob: true,
      records: { select: { diagnoses: true, visitDate: true } },
      dispensations: { select: { drug: true, createdAt: true } },
      labResults: { select: { panel: true, createdAt: true } },
      appointments: { select: { reason: true, startTime: true } },
    },
  });

  const gaps = findCareGaps(patients);
  const medicationGaps = findMedicationGaps(patients);
  const screeningGaps = findScreeningGaps(patients);

  return (
    <>
      <PageHeader
        title="Care gaps & follow-up reminders"
        subtitle="Chronic-condition reviews, medication refills, and screening due — worklists for staff to act on, nothing is messaged automatically"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Overdue chronic-condition reviews" subtitle={`${gaps.length} open gaps`} />
          {gaps.length === 0 ? (
            <EmptyState message="No overdue chronic-condition reviews right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {gaps.map((gap, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <Link
                      href={`/patients/${gap.patientId}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {gap.patientName}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {gap.mrn} &middot; {gap.gapType}
                    </p>
                    <p className="mt-1 text-sm text-ink-700">
                      Last reviewed {gap.daysSinceReview} days ago — target every{" "}
                      {gap.targetDays} days
                    </p>
                  </div>
                  <Badge tone={URGENCY_TONE[gap.urgency]}>{gap.urgency}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Medication refills due"
            subtitle={`${medicationGaps.length} patient${medicationGaps.length === 1 ? "" : "s"} — based on typical refill cycles, not prescribed duration`}
          />
          {medicationGaps.length === 0 ? (
            <EmptyState message="No medication refills flagged right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {medicationGaps.map((gap, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <Link
                      href={`/patients/${gap.patientId}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {gap.patientName}
                    </Link>
                    <p className="text-xs text-ink-500">{gap.mrn} &middot; {gap.drug}</p>
                    <p className="mt-1 text-sm text-ink-700">
                      Last dispensed {gap.daysSinceLastDispensed} days ago
                    </p>
                  </div>
                  <Badge tone="amber">may be due</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Screening due"
            subtitle={`${screeningGaps.length} patient${screeningGaps.length === 1 ? "" : "s"} — diabetes screening and paediatric immunisation checks`}
          />
          {screeningGaps.length === 0 ? (
            <EmptyState message="No screening gaps flagged right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {screeningGaps.map((gap, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <Link
                      href={`/patients/${gap.patientId}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {gap.patientName}
                    </Link>
                    <p className="text-xs text-ink-500">{gap.mrn} &middot; {gap.screeningType}</p>
                    <p className="mt-1 text-sm text-ink-700">{gap.detail}</p>
                  </div>
                  <Badge tone="amber">due</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
