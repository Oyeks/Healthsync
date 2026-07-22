/**
 * Pharmacy inventory forecasting (AI recommendation doc §13). Consumption
 * rate is derived from actual dispensation history — a deterministic
 * moving-average, not a trained model — and used to project days of stock
 * remaining, flag reorder points, and suggest a procurement date given an
 * assumed supplier lead time.
 */

const HISTORY_WINDOW_DAYS = 30;
const DEFAULT_LEAD_TIME_DAYS = 7;
const LOW_STOCK_DAYS_THRESHOLD = 14;
const EXPIRY_WARNING_DAYS = 60;

export type StockForecast = {
  drugName: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  consumptionPerDay: number;
  daysRemaining: number | null; // null when consumption is 0 (no depletion signal)
  reorderBy: Date | null;
  status: "ok" | "low" | "reorder_now" | "no_usage";
  expiryDate: Date | null;
  expiringSoon: boolean;
};

export function forecastStock(
  stock: {
    drugName: string;
    unit: string;
    quantityOnHand: number;
    reorderThreshold: number;
    expiryDate: Date | null;
  },
  dispensedInWindow: { quantity: number }[],
  now: Date = new Date(),
  leadTimeDays = DEFAULT_LEAD_TIME_DAYS,
): StockForecast {
  const totalDispensed = dispensedInWindow.reduce((sum, d) => sum + d.quantity, 0);
  const consumptionPerDay = totalDispensed / HISTORY_WINDOW_DAYS;

  const daysRemaining =
    consumptionPerDay > 0 ? Math.floor(stock.quantityOnHand / consumptionPerDay) : null;

  const reorderBy =
    daysRemaining != null
      ? new Date(now.getTime() + Math.max(0, daysRemaining - leadTimeDays) * 86_400_000)
      : null;

  let status: StockForecast["status"] = "ok";
  if (stock.quantityOnHand <= stock.reorderThreshold) {
    status = "reorder_now";
  } else if (daysRemaining == null) {
    status = "no_usage";
  } else if (daysRemaining <= LOW_STOCK_DAYS_THRESHOLD) {
    status = "low";
  }

  const expiringSoon =
    stock.expiryDate != null &&
    stock.expiryDate.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * 86_400_000;

  return {
    drugName: stock.drugName,
    unit: stock.unit,
    quantityOnHand: stock.quantityOnHand,
    reorderThreshold: stock.reorderThreshold,
    consumptionPerDay: Math.round(consumptionPerDay * 10) / 10,
    daysRemaining,
    reorderBy,
    status,
    expiryDate: stock.expiryDate,
    expiringSoon,
  };
}
