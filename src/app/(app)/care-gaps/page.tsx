import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { findCareGaps } from "@/lib/services/care-gaps";

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
      records: { select: { diagnoses: true, visitDate: true } },
    },
  });

  const gaps = findCareGaps(patients);

  return (
    <>
      <PageHeader
        title="Care gaps & follow-up reminders"
        subtitle="Patients overdue for a chronic-condition review, based on time since their last visit for that condition — a worklist, not an automated message"
      />

      <Card>
        <CardHeader title="Overdue reviews" subtitle={`${gaps.length} open gaps`} />
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
    </>
  );
}
