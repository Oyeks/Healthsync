import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { forecastStock } from "@/lib/services/inventory";
import { StockForm, ReceiveShipmentForm } from "./inventory-forms";

const STATUS_TONE = {
  ok: "green" as const,
  low: "amber" as const,
  reorder_now: "red" as const,
  no_usage: "neutral" as const,
};
const STATUS_LABEL = {
  ok: "OK",
  low: "Low stock",
  reorder_now: "Reorder now",
  no_usage: "No recent usage",
};

export default async function InventoryPage() {
  const session = await requireSession();
  authorize(session, "inventory:read");

  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 86_400_000);

  const [stock, recentDispensations] = await Promise.all([
    prisma.drugStock.findMany({ orderBy: { drugName: "asc" } }),
    prisma.dispensation.findMany({
      where: { status: "dispensed", createdAt: { gte: windowStart } },
      select: { drug: true, quantity: true },
    }),
  ]);

  const forecasts = stock.map((s) => {
    const dispensed = recentDispensations.filter(
      (d) => d.drug.trim().toLowerCase() === s.drugName.trim().toLowerCase(),
    );
    return { stock: s, forecast: forecastStock(s, dispensed, now) };
  });

  const needsAttention = forecasts.filter(
    (f) => f.forecast.status === "reorder_now" || f.forecast.status === "low" || f.forecast.expiringSoon,
  );

  return (
    <>
      <PageHeader
        title="Pharmacy inventory"
        subtitle="Stock levels with consumption-based reorder forecasting"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {needsAttention.length > 0 && (
            <Card>
              <CardHeader
                title="Needs attention"
                subtitle="Low stock, due for reorder, or expiring within 60 days"
              />
              <ul className="divide-y divide-slate-100">
                {needsAttention.map(({ stock: s, forecast }) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{s.drugName}</p>
                      <p className="text-xs text-ink-500">
                        {forecast.quantityOnHand} {s.unit} on hand
                        {forecast.daysRemaining != null &&
                          ` · ~${forecast.daysRemaining} days remaining`}
                        {forecast.expiringSoon && s.expiryDate &&
                          ` · expires ${formatDate(s.expiryDate)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {forecast.expiringSoon && <Badge tone="amber">Expiring soon</Badge>}
                      <Badge tone={STATUS_TONE[forecast.status]}>
                        {STATUS_LABEL[forecast.status]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="All tracked drugs" subtitle={`${stock.length} items`} />
            {forecasts.length === 0 ? (
              <EmptyState message="No drugs are being tracked yet." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {forecasts.map(({ stock: s, forecast }) => (
                  <li key={s.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{s.drugName}</p>
                        <p className="text-xs text-ink-500">
                          {forecast.quantityOnHand} {s.unit} on hand · reorder at{" "}
                          {s.reorderThreshold} · {forecast.consumptionPerDay}/day consumption
                        </p>
                        {forecast.reorderBy && (
                          <p className="mt-1 text-xs text-brand-700">
                            Reorder by {formatDate(forecast.reorderBy)}
                          </p>
                        )}
                        {s.expiryDate && (
                          <p className="text-xs text-ink-500">
                            Expires {formatDate(s.expiryDate)}
                          </p>
                        )}
                      </div>
                      <Badge tone={STATUS_TONE[forecast.status]}>
                        {STATUS_LABEL[forecast.status]}
                      </Badge>
                    </div>

                    {can(session.role, "inventory:write") && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <ReceiveShipmentForm stockId={s.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {can(session.role, "inventory:write") && (
            <Card>
              <CardHeader title="Track a new drug" />
              <StockForm />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
