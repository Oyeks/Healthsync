import { notFound } from "next/navigation";
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
import { PAYMENT_METHOD_LABELS } from "@/lib/enums";
import { PaymentForm } from "../payment-form";
import { voidInvoice } from "../actions";

const STATUS_TONE = {
  unpaid: "amber" as const,
  partial: "blue" as const,
  paid: "green" as const,
  void: "red" as const,
};

type LineItem = { description: string; quantity: number; unitPrice: number };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  authorize(session, "billing:read");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: true,
      createdBy: true,
      appointment: true,
      payments: { orderBy: { createdAt: "desc" }, include: { recordedBy: true } },
    },
  });
  if (!invoice) notFound();

  const items = parseJson<LineItem[]>(invoice.items, []);
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, invoice.total - totalPaid);

  return (
    <>
      <PageHeader
        title={`Invoice · ${fullName(invoice.patient)}`}
        subtitle={`${invoice.patient.mrn} · Created ${formatDateTime(invoice.createdAt)} by ${invoice.createdBy.fullName}`}
        action={<Badge tone={STATUS_TONE[invoice.status as keyof typeof STATUS_TONE]}>{invoice.status}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Line items"
              subtitle={invoice.appointment ? "Linked to a completed appointment" : undefined}
            />
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
            <CardHeader title="Payment history" />
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
                        {formatDateTime(p.createdAt)} &middot; {p.recordedBy.fullName}
                        {p.reference && ` · Ref: ${p.reference}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {can(session.role, "billing:write") && invoice.status !== "void" && balance > 0 && (
            <Card>
              <CardHeader title="Record payment" />
              <div className="p-5">
                <PaymentForm invoiceId={invoice.id} />
              </div>
            </Card>
          )}

          {can(session.role, "billing:write") && invoice.status !== "void" && (
            <Card>
              <CardHeader title="Void invoice" />
              <form action={voidInvoice} className="space-y-3 p-5">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <p className="text-sm text-ink-500">
                  Voiding removes this invoice from revenue totals. This cannot be undone.
                </p>
                <Button type="submit" variant="danger">
                  Void invoice
                </Button>
              </form>
            </Card>
          )}

          {invoice.dueDate && (
            <Card>
              <CardHeader title="Due date" />
              <p className="p-5 text-sm text-ink-700">{formatDate(invoice.dueDate)}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
