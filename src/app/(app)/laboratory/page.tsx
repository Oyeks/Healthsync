import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { formatDateTime, fullName, parseJson } from "@/lib/format";
import type { LabAnalyte } from "@/lib/services/labs";
import { LabForm } from "./lab-form";

function flagTone(flag: string) {
  if (flag === "critical") return "red" as const;
  if (flag === "high" || flag === "low") return "amber" as const;
  return "neutral" as const;
}

export default async function LaboratoryPage() {
  const session = await requireSession();
  authorize(session, "lab:read");

  const [results, patients] = await Promise.all([
    prisma.labResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { patient: true, orderedBy: true },
    }),
    prisma.patient.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Laboratory"
        subtitle="Result entry with automatic reference-range interpretation"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Recent results"
              subtitle={`${results.length} records`}
            />
            {results.length === 0 ? (
              <EmptyState message="No lab results recorded yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((r) => {
                  const analytes = parseJson<LabAnalyte[]>(r.results, []);
                  const hasCritical = analytes.some((a) => a.flag === "critical");
                  return (
                    <li key={r.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">
                            {r.panel}
                          </p>
                          <p className="text-xs text-ink-500">
                            {fullName(r.patient)} ({r.patient.mrn}) &middot;
                            Ordered by {r.orderedBy.fullName} &middot;{" "}
                            {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                        {hasCritical && <Badge tone="red">Critical value</Badge>}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {analytes.map((a) => (
                          <span
                            key={a.name}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                          >
                            <span className="font-medium text-ink-900">
                              {a.name}
                            </span>{" "}
                            {a.value} {a.unit}{" "}
                            {a.flag !== "normal" && (
                              <Badge tone={flagTone(a.flag)}>{a.flag}</Badge>
                            )}
                          </span>
                        ))}
                      </div>

                      {r.summary && (
                        <p className="mt-2 text-sm text-ink-700">
                          <span className="font-medium text-ink-900">
                            Interpretation:
                          </span>{" "}
                          {r.summary}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {can(session.role, "lab:write") && (
            <Card>
              <CardHeader title="Enter lab result" />
              <LabForm patients={patients} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
