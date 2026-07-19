import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Button,
} from "@/components/ui";
import { formatDate, formatDateTime, fullName, parseJson } from "@/lib/format";
import { THERAPY_SESSION_TYPE_LABELS } from "@/lib/enums";
import { TherapyForm } from "./therapy-form";
import { completeTherapySession } from "./actions";

function statusTone(s: string) {
  if (s === "completed") return "green" as const;
  if (s === "scheduled") return "blue" as const;
  if (s === "cancelled") return "red" as const;
  return "amber" as const;
}

export default async function PhysiotherapyPage() {
  const session = await requireSession();
  authorize(session, "therapy:read");

  const therapistScope =
    session.role === "physiotherapist" ? { therapistId: session.id } : {};

  const [sessions, patients] = await Promise.all([
    prisma.therapySession.findMany({
      where: therapistScope,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { patient: true, therapist: true },
    }),
    prisma.patient.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, mrn: true },
    }),
  ]);

  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <>
      <PageHeader
        title="Physiotherapy"
        subtitle={
          session.role === "physiotherapist"
            ? "My patients and therapy sessions"
            : "Therapy sessions across all physiotherapists"
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Upcoming sessions"
              subtitle={`${scheduled.length} scheduled`}
            />
            {scheduled.length === 0 ? (
              <EmptyState message="No upcoming therapy sessions." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {scheduled.map((s) => {
                  const exercises = parseJson<{ name: string; details: string }[]>(
                    s.exercisesGiven,
                    [],
                  );
                  return (
                    <li key={s.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">
                            {fullName(s.patient)}{" "}
                            <span className="font-normal text-ink-500">
                              ({s.patient.mrn})
                            </span>
                          </p>
                          <p className="text-xs text-ink-500">
                            {THERAPY_SESSION_TYPE_LABELS[s.sessionType] ??
                              s.sessionType}{" "}
                            &middot; {s.therapist.fullName} &middot;{" "}
                            {formatDateTime(s.createdAt)}
                          </p>
                          {s.diagnosis && (
                            <p className="mt-1 text-sm text-ink-700">
                              {s.diagnosis}
                            </p>
                          )}
                          {s.nextSessionDate && (
                            <p className="mt-1 text-xs text-brand-700">
                              Next session: {formatDate(s.nextSessionDate)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                          {can(session.role, "therapy:write") && (
                            <form action={completeTherapySession}>
                              <input
                                type="hidden"
                                name="sessionId"
                                value={s.id}
                              />
                              <Button
                                type="submit"
                                variant="success"
                                className="text-xs"
                              >
                                Complete
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                      {exercises.length > 0 && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                            Prescribed exercises
                          </p>
                          <ul className="mt-1 space-y-0.5 text-sm text-ink-700">
                            {exercises.map((ex, i) => (
                              <li key={i}>
                                <span className="font-medium text-ink-900">
                                  {ex.name}
                                </span>
                                {ex.details && ` — ${ex.details}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Completed sessions"
              subtitle={`${completed.length} records`}
            />
            {completed.length === 0 ? (
              <EmptyState message="No completed therapy sessions." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-ink-500">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Pain (before/after)</th>
                      <th className="px-5 py-3">Therapist</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {completed.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 whitespace-nowrap">
                          {formatDate(s.createdAt)}
                        </td>
                        <td className="px-5 py-3">{fullName(s.patient)}</td>
                        <td className="px-5 py-3">
                          {THERAPY_SESSION_TYPE_LABELS[s.sessionType] ??
                            s.sessionType}
                        </td>
                        <td className="px-5 py-3">
                          {s.painLevelBefore != null && s.painLevelAfter != null
                            ? `${s.painLevelBefore} → ${s.painLevelAfter}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3">{s.therapist.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          {can(session.role, "therapy:write") && (
            <Card>
              <CardHeader title="Record session" />
              <TherapyForm patients={patients} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
