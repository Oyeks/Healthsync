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
} from "@/components/ui";
import { formatDate, formatDateTime, fullName } from "@/lib/format";
import { summariseRevenue, detectBillingAnomalies } from "@/lib/services/revenue";

const STATUS_TONE = {
  unpaid: "amber" as const,
  partial: "blue" as const,
  paid: "green" as const,
  void: "red" as const,
};

const ANOMALY_LABEL = {
  aged_unpaid: "Aged unpaid",
  overpayment: "Overpayment",
  possible_duplicate: "Possible duplicate",
};

export default async function BillingPage() {
  const session = await requireSession();
  authorize(session, "billing:read");

  const [invoices, unbilledAppointments] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { patient: true, payments: true },
    }),
    prisma.appointment.findMany({
      where: { status: "completed", invoice: null },
      orderBy: { startTime: "desc" },
      take: 10,
      include: { patient: true, doctor: true },
    }),
  ]);

  const allPayments = invoices.flatMap((i) => i.payments);
  const summary = summariseRevenue(invoices, allPayments);
  const anomalies = detectBillingAnomalies(invoices);
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments, and revenue analytics"
        action={
          can(session.role, "billing:write") ? (
            <ButtonLink href="/billing/new">New invoice</ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-ink-500">Total billed</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">
            ₦{summary.totalBilled.toLocaleString()}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-500">Collected</p>
          <p className="mt-2 text-2xl font-bold text-sync-700">
            ₦{summary.totalCollected.toLocaleString()}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-500">Outstanding</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            ₦{summary.outstanding.toLocaleString()}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-500">Collection rate</p>
          <p className="mt-2 text-2xl font-bold text-brand-700">
            {summary.collectionRate}%
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Billing anomalies"
            subtitle="Aged unpaid, overpayment, and possible duplicate invoices"
          />
          {anomalies.length === 0 ? (
            <EmptyState message="No anomalies detected." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {anomalies.map((a, i) => {
                const invoice = invoiceById.get(a.invoiceId);
                return (
                  <li key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/billing/${a.invoiceId}`}
                        className="text-sm font-medium text-ink-900 hover:underline"
                      >
                        {invoice ? fullName(invoice.patient) : a.invoiceId}
                      </Link>
                      <Badge tone="amber">{ANOMALY_LABEL[a.type]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{a.detail}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Unbilled completed appointments"
            subtitle="Completed visits with no invoice on file"
          />
          {unbilledAppointments.length === 0 ? (
            <EmptyState message="Nothing unbilled right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {unbilledAppointments.map((appt) => (
                <li key={appt.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {fullName(appt.patient)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatDate(appt.startTime)} &middot; {appt.doctor.fullName}
                    </p>
                  </div>
                  {can(session.role, "billing:write") && (
                    <Link
                      href={`/billing/new?patientId=${appt.patientId}&appointmentId=${appt.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Invoice →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="All invoices" subtitle={`${invoices.length} total`} />
        {invoices.length === 0 ? (
          <EmptyState message="No invoices yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap">
                      {formatDateTime(invoice.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/billing/${invoice.id}`}
                        className="font-medium text-ink-900 hover:underline"
                      >
                        {fullName(invoice.patient)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">₦{invoice.total.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[invoice.status as keyof typeof STATUS_TONE]}>
                        {invoice.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
