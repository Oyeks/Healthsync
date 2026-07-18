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
import { formatDate, formatTime, fullName } from "@/lib/format";
import { AppointmentActions } from "./appointment-actions";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireSession();
  authorize(session, "appointment:read");

  const { date } = await searchParams;
  const selected = date ? new Date(`${date}T00:00:00`) : new Date();
  if (Number.isNaN(selected.getTime())) selected.setTime(Date.now());
  selected.setHours(0, 0, 0, 0);
  const dayEnd = new Date(selected);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const doctorScope = session.role === "doctor" ? { doctorId: session.id } : {};

  const appointments = await prisma.appointment.findMany({
    where: { ...doctorScope, startTime: { gte: selected, lt: dayEnd } },
    orderBy: { startTime: "asc" },
    include: { patient: true, doctor: true },
  });

  const isoDate = selected.toISOString().slice(0, 10);
  const shiftDay = (days: number) => {
    const d = new Date(selected);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const writable = can(session.role, "appointment:write");

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={
          session.role === "doctor"
            ? "Your clinic calendar"
            : "Hospital-wide schedule"
        }
        action={
          writable ? (
            <ButtonLink href="/appointments/new">Book appointment</ButtonLink>
          ) : undefined
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/appointments?date=${shiftDay(-1)}`}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-ink-700 hover:bg-slate-50"
            >
              ←
            </Link>
            <span className="text-sm font-semibold text-ink-900">
              {formatDate(selected)}
            </span>
            <Link
              href={`/appointments?date=${shiftDay(1)}`}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-ink-700 hover:bg-slate-50"
            >
              →
            </Link>
          </div>
          <form className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={isoDate}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-slate-50"
            >
              Go
            </button>
          </form>
        </div>

        {appointments.length === 0 ? (
          <EmptyState message="No appointments scheduled for this day." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                {/* Colour-coded left rail: emergency, booked, done, cancelled. */}
                <span
                  className={`h-10 w-1 shrink-0 rounded-full ${
                    appointment.status === "cancelled"
                      ? "bg-red-400"
                      : appointment.type === "emergency"
                        ? "bg-amber-500"
                        : appointment.status === "completed"
                          ? "bg-sync-500"
                          : "bg-brand-500"
                  }`}
                />
                <div className="w-16 shrink-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {formatTime(appointment.startTime)}
                  </p>
                  <p className="text-xs text-ink-500">
                    {formatTime(appointment.endTime)}
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/patients/${appointment.patientId}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {fullName(appointment.patient)}
                  </Link>
                  <p className="truncate text-xs text-ink-500">
                    {appointment.patient.mrn} · {appointment.doctor.fullName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-700">
                    {appointment.reason ?? "No reason recorded"}
                  </p>
                  {appointment.cancelReason && (
                    <p className="mt-0.5 text-xs text-red-600">
                      Cancelled: {appointment.cancelReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(appointment.status)}>
                    {appointment.status.replace("_", " ")}
                  </Badge>
                  {writable && appointment.status === "booked" && (
                    <AppointmentActions appointmentId={appointment.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
