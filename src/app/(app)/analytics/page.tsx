import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime, fullName } from "@/lib/format";
import { summariseWards, forecastOccupancy } from "@/lib/services/occupancy";
import { scoreNoShowRisk } from "@/lib/services/noshow";
import { computeDiagnosisTrends } from "@/lib/services/population-health";

const RISK_TONE = { low: "green" as const, medium: "amber" as const, high: "red" as const };
const TREND_TONE = {
  up: "red" as const,
  new: "amber" as const,
  down: "green" as const,
  flat: "neutral" as const,
};
const TREND_LABEL = { up: "↑ rising", new: "new", down: "↓ falling", flat: "stable" };

export default async function AnalyticsPage() {
  const session = await requireSession();
  authorize(session, "analytics:read");

  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);
  const priorWindowStart = new Date(now.getTime() - 60 * 86_400_000);

  const [
    beds,
    admissionsInWindow,
    dischargedInWindow,
    upcomingAppointments,
    currentPeriodRecords,
    priorPeriodRecords,
  ] = await Promise.all([
    prisma.bed.findMany({ select: { ward: true, status: true } }),
    prisma.admission.findMany({
      where: { admittedAt: { gte: windowStart } },
      select: { admittedAt: true },
    }),
    prisma.admission.findMany({
      where: {
        status: "discharged",
        dischargedAt: { gte: windowStart, not: null },
      },
      select: { admittedAt: true, dischargedAt: true },
    }),
    prisma.appointment.findMany({
      where: { status: "booked", startTime: { gte: now } },
      orderBy: { startTime: "asc" },
      take: 20,
      include: { patient: true, doctor: true },
    }),
    prisma.medicalRecord.findMany({
      where: { visitDate: { gte: windowStart } },
      select: { diagnoses: true },
    }),
    prisma.medicalRecord.findMany({
      where: { visitDate: { gte: priorWindowStart, lt: windowStart } },
      select: { diagnoses: true },
    }),
  ]);

  const wardSummary = summariseWards(beds);
  const forecast = forecastOccupancy(
    beds,
    admissionsInWindow,
    dischargedInWindow.filter(
      (a): a is { admittedAt: Date; dischargedAt: Date } => a.dischargedAt != null,
    ),
    now,
  );

  // Score each upcoming appointment against that patient's own history.
  const risks = await Promise.all(
    upcomingAppointments.map(async (appt) => {
      const history = await prisma.appointment.findMany({
        where: {
          patientId: appt.patientId,
          startTime: { lt: now },
          id: { not: appt.id },
        },
        select: { status: true },
      });
      return {
        appointment: appt,
        risk: scoreNoShowRisk(
          { type: appt.type, startTime: appt.startTime, createdAt: appt.createdAt },
          history,
        ),
      };
    }),
  );
  risks.sort((a, b) => b.risk.score - a.risk.score);

  const diagnosisTrends = computeDiagnosisTrends(currentPeriodRecords, priorPeriodRecords);

  return (
    <>
      <PageHeader
        title="Operational analytics"
        subtitle="Bed occupancy forecasting and appointment no-show risk — deterministic projections, not machine-learned predictions"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Bed occupancy forecast"
            subtitle={
              forecast.basis === "historical"
                ? "Based on 30-day admission and discharge history"
                : "Limited discharge history — using a default 4-day length of stay"
            }
          />
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-500">Current occupancy</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">
                {forecast.currentPercent}%
              </p>
              <p className="text-xs text-ink-500">
                {forecast.currentOccupied} of {forecast.usableBeds} beds
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Admissions / day</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">
                {forecast.admissionsPerDay}
              </p>
              <p className="text-xs text-ink-500">30-day average</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Avg. length of stay</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">
                {forecast.avgLengthOfStayDays}d
              </p>
              <p className="text-xs text-ink-500">
                {forecast.basis === "historical" ? "Observed" : "Default estimate"}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Projected in 3 days</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {forecast.projectedPercentIn3Days}%
              </p>
              <p className="text-xs text-ink-500">
                {forecast.projectedOccupiedIn3Days} of {forecast.usableBeds} beds
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
              By ward
            </p>
            <ul className="space-y-2">
              {wardSummary.map((w) => (
                <li key={w.ward} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{w.ward}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-ink-500">
                      {w.occupied}/{w.total - w.maintenance} occupied
                    </span>
                    <Badge tone={w.occupancyPercent > 85 ? "amber" : "neutral"}>
                      {w.occupancyPercent}%
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Appointment no-show risk"
            subtitle="Upcoming bookings, highest risk first"
          />
          {risks.length === 0 ? (
            <EmptyState message="No upcoming appointments to score." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {risks.map(({ appointment, risk }) => (
                <li key={appointment.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {fullName(appointment.patient)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDateTime(appointment.startTime)} &middot;{" "}
                        {appointment.doctor.fullName} &middot;{" "}
                        {appointment.type.replace("_", " ")}
                      </p>
                    </div>
                    <Badge tone={RISK_TONE[risk.band]}>
                      {risk.score}% · {risk.band}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink-700">
                    <span className="font-medium text-ink-900">
                      {risk.recommendedAction}
                    </span>
                    {risk.reasons.length > 0 && (
                      <span className="text-ink-500"> — {risk.reasons.join("; ")}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Population health trends"
            subtitle="Diagnoses recorded in the last 30 days vs. the 30 days before that"
          />
          {diagnosisTrends.length === 0 ? (
            <EmptyState message="No diagnosis data recorded yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {diagnosisTrends.map((t) => (
                <li
                  key={t.code}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink-900">{t.description}</p>
                    <p className="text-xs text-ink-500">
                      {t.code} &middot; {t.currentCount} this period vs. {t.priorCount} prior
                    </p>
                  </div>
                  <Badge tone={TREND_TONE[t.direction]}>{TREND_LABEL[t.direction]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
