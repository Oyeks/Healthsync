import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { PrintReportHeader } from "@/components/print-report-header";
import { formatDateTime, fullName } from "@/lib/format";
import { summariseWards, forecastOccupancy } from "@/lib/services/occupancy";
import { scoreNoShowRisk, type NoShowRisk } from "@/lib/services/noshow";
import { computeDiagnosisTrends, computeMedicineUsageTrends } from "@/lib/services/population-health";
import { forecastStaffing } from "@/lib/services/staffing";

const RISK_TONE = { low: "green" as const, medium: "amber" as const, high: "red" as const };
const RISK_BAR = { low: "bg-sync-500", medium: "bg-amber-500", high: "bg-red-500" };
const TREND_TONE = {
  up: "red" as const,
  new: "amber" as const,
  down: "green" as const,
  flat: "neutral" as const,
};
const TREND_LABEL = { up: "↑ rising", new: "new", down: "↓ falling", flat: "stable" };

function OccupancyBar({ label, percent, danger }: { label: string; percent: number; danger?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-700">{label}</span>
        <span className="text-ink-500">{percent}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 print:border print:border-slate-200">
        <div
          className={`h-full rounded-full ${danger ? "bg-amber-500" : "bg-brand-600"}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

function TrendBars({
  currentCount,
  priorCount,
}: {
  currentCount: number;
  priorCount: number;
}) {
  const max = Math.max(currentCount, priorCount, 1);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[10px] uppercase text-ink-500">Now</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 print:border print:border-slate-200">
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${(currentCount / max) * 100}%` }}
          />
        </div>
        <span className="w-5 shrink-0 text-right text-[10px] text-ink-500">{currentCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[10px] uppercase text-ink-500">Prior</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 print:border print:border-slate-200">
          <div
            className="h-full rounded-full bg-slate-400"
            style={{ width: `${(priorCount / max) * 100}%` }}
          />
        </div>
        <span className="w-5 shrink-0 text-right text-[10px] text-ink-500">{priorCount}</span>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await requireSession();
  authorize(session, "analytics:read");

  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);
  const priorWindowStart = new Date(now.getTime() - 60 * 86_400_000);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [
    beds,
    admissionsInWindow,
    dischargedInWindow,
    upcomingAppointments,
    currentPeriodRecords,
    priorPeriodRecords,
    todaysAppointmentCount,
    currentPeriodDispensations,
    priorPeriodDispensations,
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
    prisma.appointment.count({
      where: { startTime: { gte: dayStart, lt: dayEnd }, status: { in: ["booked", "completed"] } },
    }),
    prisma.dispensation.findMany({
      where: { status: "dispensed", createdAt: { gte: windowStart } },
      select: { drug: true, quantity: true },
    }),
    prisma.dispensation.findMany({
      where: { status: "dispensed", createdAt: { gte: priorWindowStart, lt: windowStart } },
      select: { drug: true, quantity: true },
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

  const riskCounts = risks.reduce(
    (acc, r) => {
      acc[r.risk.band]++;
      return acc;
    },
    { low: 0, medium: 0, high: 0 } as Record<NoShowRisk["band"], number>,
  );
  const totalRisks = risks.length || 1;

  const diagnosisTrends = computeDiagnosisTrends(currentPeriodRecords, priorPeriodRecords);
  const medicineTrends = computeMedicineUsageTrends(
    currentPeriodDispensations,
    priorPeriodDispensations,
  );

  const staffing = forecastStaffing({
    currentOccupiedByWard: wardSummary.map((w) => ({ ward: w.ward, occupied: w.occupied })),
    projectedOccupiedIn3Days: forecast.projectedOccupiedIn3Days,
    todaysAppointments: todaysAppointmentCount,
  });

  return (
    <>
      <PrintReportHeader title="Operational Analytics Report" generatedBy={session.fullName} />

      <PageHeader
        title="Operational analytics"
        subtitle="Bed occupancy forecasting, no-show risk, and population health — deterministic projections, not machine-learned predictions"
        action={<PrintButton />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="print:break-inside-avoid">
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

          <div className="space-y-3 border-t border-slate-200 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
              By ward
            </p>
            {wardSummary.map((w) => (
              <OccupancyBar
                key={w.ward}
                label={`${w.ward} (${w.occupied}/${w.total - w.maintenance})`}
                percent={w.occupancyPercent}
                danger={w.occupancyPercent > 85}
              />
            ))}
          </div>
        </Card>

        <Card className="print:break-inside-avoid">
          <CardHeader
            title="Appointment no-show risk"
            subtitle="Upcoming bookings, highest risk first"
          />
          {risks.length === 0 ? (
            <EmptyState message="No upcoming appointments to score." />
          ) : (
            <>
              <div className="p-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 print:border print:border-slate-200">
                  {(["low", "medium", "high"] as const).map((band) => (
                    <div
                      key={band}
                      className={RISK_BAR[band]}
                      style={{ width: `${(riskCounts[band] / totalRisks) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-4 text-xs text-ink-500">
                  {(["low", "medium", "high"] as const).map((band) => (
                    <span key={band} className="inline-flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${RISK_BAR[band]}`} />
                      {band} ({riskCounts[band]})
                    </span>
                  ))}
                </div>
              </div>
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto border-t border-slate-200 print:max-h-none print:overflow-visible">
                {risks.map(({ appointment, risk }) => (
                  <li key={appointment.id} className="p-5 print:break-inside-avoid">
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
            </>
          )}
        </Card>

        <Card className="lg:col-span-2 print:break-inside-avoid">
          <CardHeader
            title="Population health trends"
            subtitle="Diagnoses recorded in the last 30 days vs. the 30 days before that"
          />
          {diagnosisTrends.length === 0 ? (
            <EmptyState message="No diagnosis data recorded yet." />
          ) : (
            <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
              {diagnosisTrends.map((t) => (
                <div key={t.code} className="print:break-inside-avoid">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-ink-900">{t.description}</p>
                      <p className="text-xs text-ink-500">{t.code}</p>
                    </div>
                    <Badge tone={TREND_TONE[t.direction]}>{TREND_LABEL[t.direction]}</Badge>
                  </div>
                  <TrendBars currentCount={t.currentCount} priorCount={t.priorCount} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="print:break-inside-avoid">
          <CardHeader
            title="Staffing forecast"
            subtitle="Illustrative ratios (1 nurse : 4 ward / 1.5 ICU patients) — not a scheduling system"
          />
          <div className="grid grid-cols-2 gap-4 p-5">
            <div>
              <p className="text-xs text-ink-500">Nurses needed now</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">{staffing.nursesNeededNow}</p>
              <p className="text-xs text-ink-500">
                {staffing.currentWardPatients} ward + {staffing.currentIcuPatients} ICU patients
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Nurses needed in 3 days</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {staffing.nursesNeededIn3Days}
              </p>
              <p className="text-xs text-ink-500">
                Based on projected {staffing.projectedWardPatientsIn3Days} occupied beds
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Doctors needed today</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">
                {staffing.doctorsNeededToday}
              </p>
              <p className="text-xs text-ink-500">
                {staffing.todaysAppointments} appointments · ~16 consults/doctor/day
              </p>
            </div>
          </div>
        </Card>

        <Card className="print:break-inside-avoid">
          <CardHeader
            title="Medicine usage trends"
            subtitle="Quantity dispensed in the last 30 days vs. the 30 days before that"
          />
          {medicineTrends.length === 0 ? (
            <EmptyState message="No dispensation data recorded yet." />
          ) : (
            <div className="space-y-4 p-5">
              {medicineTrends.map((t) => (
                <div key={t.drug} className="print:break-inside-avoid">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-900">{t.drug}</span>
                    <Badge tone={TREND_TONE[t.direction]}>{TREND_LABEL[t.direction]}</Badge>
                  </div>
                  <TrendBars currentCount={t.currentQuantity} priorCount={t.priorQuantity} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
