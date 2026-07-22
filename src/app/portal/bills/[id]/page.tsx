import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { LogoMark, Wordmark } from "@/components/logo";
import { logout } from "@/app/login/actions";
import { PrintButton } from "@/components/print-button";
import { PrintReportHeader } from "@/components/print-report-header";
import { formatDate, formatDateTime, fullName, parseJson } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/enums";

const STATUS_TONE = {
  unpaid: "amber" as const,
  partial: "blue" as const,
  paid: "green" as const,
  void: "red" as const,
};

type LineItem = { description: string; quantity: number; unitPrice: number };

export default async function PatientReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "patient" || !session.patientId) redirect("/dashboard");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  // A patient may only ever view their own invoice — never distinguish
  // "doesn't exist" from "not yours" in the response.
  if (!invoice || invoice.patientId !== session.patientId) redirect("/portal");

  const items = parseJson<LineItem[]>(invoice.items, []);
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, invoice.total - totalPaid);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
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
        <PrintReportHeader title="Payment Receipt" generatedBy={fullName(invoice.patient)} />

        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <Link
              href="/portal"
              className="text-sm font-medium text-ink-500 hover:text-ink-900"
            >
              ← Back to portal
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-ink-900">Receipt</h1>
            <p className="mt-1 text-sm text-ink-500">
              {invoice.patient.mrn} · {formatDate(invoice.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[invoice.status as keyof typeof STATUS_TONE]}>
              {invoice.status}
            </Badge>
            <PrintButton />
          </div>
        </div>

        <Card>
          <CardHeader title="Line items" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Unit price</th>
                  <th className="px-5 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">{item.description}</td>
                    <td className="px-5 py-3">{item.quantity}</td>
                    <td className="px-5 py-3">₦{item.unitPrice.toLocaleString()}</td>
                    <td className="px-5 py-3 font-medium text-ink-900">
                      ₦{(item.quantity * item.unitPrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1 border-t border-slate-200 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Total</span>
              <span className="font-semibold text-ink-900">
                ₦{invoice.total.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Paid</span>
              <span className="text-sync-700">₦{totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Balance</span>
              <span className="font-semibold text-ink-900">
                ₦{balance.toLocaleString()}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment history" subtitle="Your receipts" />
          {invoice.payments.length === 0 ? (
            <EmptyState message="No payments recorded yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink-900">
                      ₦{p.amount.toLocaleString()} &middot;{" "}
                      {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatDateTime(p.createdAt)}
                      {p.reference && ` · Ref: ${p.reference}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
