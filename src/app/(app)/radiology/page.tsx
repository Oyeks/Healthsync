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
import { formatDateTime, fullName } from "@/lib/format";
import { IMAGING_MODALITY_LABELS } from "@/lib/enums";
import { OrderForm, ReportForm } from "./radiology-forms";

function priorityTone(p: string) {
  if (p === "stat") return "red" as const;
  if (p === "urgent") return "amber" as const;
  return "neutral" as const;
}

function statusTone(s: string) {
  if (s === "completed") return "green" as const;
  if (s === "in_progress") return "blue" as const;
  if (s === "cancelled") return "red" as const;
  return "amber" as const;
}

export default async function RadiologyPage() {
  const session = await requireSession();
  authorize(session, "imaging:read");

  const [orders, patients] = await Promise.all([
    prisma.imagingOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        patient: true,
        requestedBy: true,
        radiologist: true,
      },
    }),
    prisma.patient.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    }),
  ]);

  const pending = orders.filter((o) => o.status === "requested");
  const completed = orders.filter((o) => o.status === "completed");

  return (
    <>
      <PageHeader
        title="Radiology"
        subtitle="Imaging orders, reports, and diagnostics"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Pending orders"
              subtitle={`${pending.length} awaiting reporting`}
            />
            {pending.length === 0 ? (
              <EmptyState message="No pending imaging orders." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {pending.map((order) => (
                  <li key={order.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {IMAGING_MODALITY_LABELS[order.modality] ??
                            order.modality}{" "}
                          &mdash; {order.bodyPart}
                        </p>
                        <p className="text-xs text-ink-500">
                          {fullName(order.patient)} ({order.patient.mrn})
                          &middot; Ordered by {order.requestedBy.fullName}
                          &middot; {formatDateTime(order.createdAt)}
                        </p>
                        {order.clinicalInfo && (
                          <p className="mt-1 text-sm text-ink-700">
                            {order.clinicalInfo}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge tone={priorityTone(order.priority)}>
                          {order.priority}
                        </Badge>
                        <Badge tone={statusTone(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>

                    {can(session.role, "imaging:report") && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                          Submit report
                        </p>
                        <ReportForm orderId={order.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Completed studies"
              subtitle={`${completed.length} reported`}
            />
            {completed.length === 0 ? (
              <EmptyState message="No completed imaging studies." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {completed.map((order) => (
                  <li key={order.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {IMAGING_MODALITY_LABELS[order.modality] ??
                            order.modality}{" "}
                          &mdash; {order.bodyPart}
                        </p>
                        <p className="text-xs text-ink-500">
                          {fullName(order.patient)} &middot; Reported by{" "}
                          {order.radiologist?.fullName ?? "—"} &middot;{" "}
                          {order.completedAt
                            ? formatDateTime(order.completedAt)
                            : "—"}
                        </p>
                      </div>
                      <Badge tone="green">completed</Badge>
                    </div>
                    {order.findings && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                          Findings
                        </p>
                        <p className="mt-0.5 text-ink-700">{order.findings}</p>
                        {order.impression && (
                          <>
                            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                              Impression
                            </p>
                            <p className="mt-0.5 font-medium text-ink-900">
                              {order.impression}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {can(session.role, "imaging:write") && (
            <Card>
              <CardHeader title="Request imaging" />
              <OrderForm patients={patients} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
