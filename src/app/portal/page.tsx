import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  statusTone,
} from "@/components/ui";
import { LogoMark, Wordmark } from "@/components/logo";
import { logout } from "@/app/login/actions";
import {
  formatDate,
  formatDateTime,
  parseJson,
  type Diagnosis,
  type Prescription,
} from "@/lib/format";

const INVOICE_STATUS_TONE = {
  unpaid: "amber" as const,
  partial: "blue" as const,
  paid: "green" as const,
  void: "red" as const,
};

export default async function PortalPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "patient" || !session.patientId) redirect("/dashboard");

  // Every query is scoped to the signed-in patient's own record.
  const patient = await prisma.patient.findUnique({
    where: { id: session.patientId },
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        include: { doctor: true },
      },
      records: {
        // Patients see signed notes only — drafts are still being worked on.
        where: { signedAt: { not: null } },
        orderBy: { visitDate: "desc" },
        include: { doctor: true },
      },
      vitals: { orderBy: { recordedAt: "desc" }, take: 1 },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: { payments: true },
      },
    },
  });

  // The session references a patient record that no longer exists (e.g. a
  // stale cookie surviving a database reset). /login independently verifies
  // this same condition before trusting the redirect back here, so this
  // doesn't become an infinite loop — see src/app/login/page.tsx.
  if (!patient) redirect("/login");

  const now = new Date();
  const upcoming = patient.appointments.filter(
    (a) => a.startTime > now && a.status === "booked",
  );
  const past = patient.appointments.filter((a) => a.startTime <= now);
  const latestVitals = patient.vitals[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <div>
              <Wordmark className="text-lg" />
              <p className="text-xs text-ink-500">Patient portal</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">
            Hello, {patient.firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {patient.mrn} · Registered {formatDate(patient.createdAt)}
          </p>
        </div>

        <Card>
          <CardHeader
            title="Upcoming appointments"
            subtitle="Contact the front desk to reschedule"
          />
          {upcoming.length === 0 ? (
            <EmptyState message="You have no upcoming appointments booked." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((appointment) => (
                <li key={appointment.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">
                        {formatDateTime(appointment.startTime)}
                      </p>
                      <p className="text-sm text-ink-500">
                        {appointment.doctor.fullName}
                        {appointment.doctor.specialty &&
                          ` · ${appointment.doctor.specialty}`}
                      </p>
                      <p className="mt-1 text-sm text-ink-700">
                        {appointment.reason ?? "General consultation"}
                      </p>
                    </div>
                    <Badge tone={statusTone(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {latestVitals && (
          <Card>
            <CardHeader
              title="Latest observations"
              subtitle={`Recorded ${formatDateTime(latestVitals.recordedAt)}`}
            />
            <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {[
                [
                  "Blood pressure",
                  latestVitals.systolic && latestVitals.diastolic
                    ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                    : "—",
                ],
                ["Pulse", latestVitals.heartRate ?? "—"],
                ["Temperature", latestVitals.temperature ?? "—"],
                ["Oxygen sat.", latestVitals.spo2 ? `${latestVitals.spo2}%` : "—"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Billing"
            subtitle="Your invoices and payment receipts"
          />
          {patient.invoices.length === 0 ? (
            <EmptyState message="No invoices on file." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {patient.invoices.map((invoice) => {
                const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
                const balance = Math.max(0, invoice.total - paid);
                return (
                  <li key={invoice.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink-900">
                          ₦{invoice.total.toLocaleString()}
                        </p>
                        <p className="text-sm text-ink-500">
                          {formatDate(invoice.createdAt)}
                          {invoice.status !== "paid" &&
                            invoice.status !== "void" &&
                            balance > 0 &&
                            ` · ₦${balance.toLocaleString()} outstanding`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone={INVOICE_STATUS_TONE[invoice.status as keyof typeof INVOICE_STATUS_TONE]}>
                          {invoice.status}
                        </Badge>
                        <Link
                          href={`/portal/bills/${invoice.id}`}
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          View receipt →
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="My medical records"
            subtitle="Finalised consultation notes from your visits"
          />
          {patient.records.length === 0 ? (
            <EmptyState message="No finalised records are available yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {patient.records.map((record) => {
                const diagnoses = parseJson<Diagnosis[]>(record.diagnoses, []);
                const prescriptions = parseJson<Prescription[]>(
                  record.prescriptions,
                  [],
                );
                return (
                  <li key={record.id} className="px-5 py-4">
                    <p className="font-semibold text-ink-900">
                      {formatDate(record.visitDate)}
                    </p>
                    <p className="text-sm text-ink-500">
                      {record.doctor.fullName}
                    </p>

                    {diagnoses.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {diagnoses.map((d) => (
                          <Badge key={d.code} tone="blue">
                            {d.description}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {record.plan && (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                          Your care plan
                        </p>
                        <p className="mt-0.5 text-sm text-ink-700">
                          {record.plan}
                        </p>
                      </div>
                    )}

                    {prescriptions.length > 0 && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                          Prescribed medication
                        </p>
                        <ul className="mt-1 space-y-1">
                          {prescriptions.map((p, i) => (
                            <li key={i} className="text-sm text-ink-700">
                              <span className="font-medium text-ink-900">
                                {p.drug}
                              </span>{" "}
                              — {p.dose}, {p.frequency}, for {p.duration}
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
          <CardHeader title="Visit history" />
          {past.length === 0 ? (
            <EmptyState message="No past appointments." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {past.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div>
                    <p className="text-ink-900">
                      {formatDate(appointment.startTime)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {appointment.doctor.fullName}
                    </p>
                  </div>
                  <Badge tone={statusTone(appointment.status)}>
                    {appointment.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
