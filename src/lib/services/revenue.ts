/**
 * Revenue and billing analytics (AI recommendation doc §14). Deterministic
 * aggregation and rule-based anomaly flags over Invoice/Payment records —
 * a worklist for a human biller to review, not automated fraud detection.
 */

export type RevenueSummary = {
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
  collectionRate: number; // 0–100
};

export function summariseRevenue(
  invoices: { total: number; status: string }[],
  payments: { amount: number }[],
): RevenueSummary {
  const billable = invoices.filter((i) => i.status !== "void");
  const totalBilled = billable.reduce((sum, i) => sum + i.total, 0);
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.max(0, totalBilled - totalCollected);
  const collectionRate =
    totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  return { totalBilled, totalCollected, outstanding, collectionRate };
}

export type BillingAnomaly = {
  invoiceId: string;
  type: "aged_unpaid" | "overpayment" | "possible_duplicate";
  detail: string;
};

type InvoiceWithPayments = {
  id: string;
  patientId: string;
  total: number;
  status: string;
  createdAt: Date;
  payments: { amount: number }[];
};

export function detectBillingAnomalies(
  invoices: InvoiceWithPayments[],
  now: Date = new Date(),
): BillingAnomaly[] {
  const anomalies: BillingAnomaly[] = [];

  for (const invoice of invoices) {
    const paid = invoice.payments.reduce((s, p) => s + p.amount, 0);
    const ageDays = Math.round((now.getTime() - invoice.createdAt.getTime()) / 86_400_000);

    if (invoice.status !== "paid" && invoice.status !== "void" && ageDays > 30) {
      anomalies.push({
        invoiceId: invoice.id,
        type: "aged_unpaid",
        detail: `Unpaid for ${ageDays} days — outstanding ₦${(invoice.total - paid).toLocaleString()}`,
      });
    }

    if (paid > invoice.total) {
      anomalies.push({
        invoiceId: invoice.id,
        type: "overpayment",
        detail: `₦${paid.toLocaleString()} paid against a ₦${invoice.total.toLocaleString()} invoice`,
      });
    }
  }

  // Possible duplicate billing: same patient, same amount, invoiced within 24h.
  const byPatient = new Map<string, InvoiceWithPayments[]>();
  for (const inv of invoices) {
    const list = byPatient.get(inv.patientId) ?? [];
    list.push(inv);
    byPatient.set(inv.patientId, list);
  }
  for (const list of byPatient.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (
          a.total === b.total &&
          Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) < 86_400_000
        ) {
          anomalies.push({
            invoiceId: b.id,
            type: "possible_duplicate",
            detail: `Same amount (₦${b.total.toLocaleString()}) billed to this patient within 24 hours of another invoice`,
          });
        }
      }
    }
  }

  return anomalies;
}
