import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, EmptyState, statusTone } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { formatTime, fullName, age } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/enums";

function Kpi({
  label,
  value,
  detail,
  tone = "brand",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "brand" | "sync" | "amber";
}) {
  const accent = {
    brand: "text-brand-600",
    sync: "text-sync-600",
    amber: "text-amber-600",
  }[tone];

  return (
    <Card className="p-5">
      <p className="text-sm text-ink-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent}`}>
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-ink-500">{detail}</p>}
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Doctors see only their own clinic; everyone else sees the whole hospital.
  const doctorScope = session.role === "doctor" ? { doctorId: session.id } : {};

  const [
    patientCount,
    todaysAppointments,
    beds,
    activeAdmissions,
    recentPatients,
    upcoming,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count({
      where: {
        ...doctorScope,
        startTime: { gte: dayStart, lt: dayEnd },
        status: { in: ["booked", "completed"] },
      },
    }),
    prisma.bed.findMany({ select: { status: true } }),
    prisma.admission.count({ where: { status: "active" } }),
    prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.appointment.findMany({
      where: {
        ...doctorScope,
        startTime: { gte: dayStart, lt: dayEnd },
        status: "booked",
      },
      orderBy: { startTime: "asc" },
      take: 6,
      include: { patient: true, doctor: true },
    }),
  ]);

  const occupied = beds.filter((b) => b.status === "occupied").length;
  const usableBeds = beds.filter((b) => b.status !== "maintenance").length;
  const occupancy = usableBeds
    ? Math.round((occupied / usableBeds) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title={`Good day, ${session.fullName.replace(/^Dr\.\s*/, "")}`}
        subtitle={`${ROLE_LABELS[session.role]} · ${new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date())}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Registered patients"
          value={String(patientCount)}
          detail="Total in the master index"
        />
        <Kpi
          label={session.role === "doctor" ? "My appointments today" : "Appointments today"}
          value={String(todaysAppointments)}
          detail="Booked and completed"
          tone="sync"
        />
        <Kpi
          label="Bed occupancy"
          value={`${occupancy}%`}
          detail={`${occupied} of ${usableBeds} usable beds`}
          tone={occupancy > 85 ? "amber" : "brand"}
        />
        <Kpi
          label="Currently admitted"
          value={String(activeAdmissions)}
          detail="Active inpatient episodes"
          tone="sync"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={session.role === "doctor" ? "My clinic today" : "Today's schedule"}
            subtitle="Remaining booked appointments"
          />
          {upcoming.length === 0 ? (
            <EmptyState message="No appointments booked for today." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((appointment) => (
                <li key={appointment.id}>
                  <Link
                    href={`/patients/${appointment.patientId}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="w-14 shrink-0 text-sm font-semibold text-brand-700">
                      {formatTime(appointment.startTime)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {fullName(appointment.patient)}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {appointment.reason ?? "No reason recorded"}
                        {session.role !== "doctor" &&
                          ` · ${appointment.doctor.fullName}`}
                      </span>
                    </span>
                    <Badge tone={statusTone(appointment.type)}>
                      {appointment.type.replace("_", " ")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently registered" />
          {recentPatients.length === 0 ? (
            <EmptyState message="No patients registered yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentPatients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/patients/${patient.id}`}
                    className="block px-5 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink-900">
                        {fullName(patient)}
                      </span>
                      <Badge tone={statusTone(patient.status)}>
                        {patient.status}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-500">
                      {patient.mrn} · {age(patient.dob)}y · {patient.gender}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
