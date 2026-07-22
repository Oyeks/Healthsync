/**
 * Bed occupancy trend and forecast (AI recommendation doc §12, "predict bed
 * occupancy"). Deterministic — projects near-term occupancy from the
 * observed admission rate and average length of stay, not a black-box model.
 * With sparse history (a fresh deployment) it degrades to a documented
 * default rather than a misleadingly precise number.
 */

export type WardOccupancy = {
  ward: string;
  total: number;
  occupied: number;
  available: number;
  maintenance: number;
  occupancyPercent: number;
};

export type OccupancyForecast = {
  currentOccupied: number;
  usableBeds: number;
  currentPercent: number;
  admissionsPerDay: number;
  avgLengthOfStayDays: number;
  projectedOccupiedIn3Days: number;
  projectedPercentIn3Days: number;
  basis: "historical" | "default";
};

const DEFAULT_LOS_DAYS = 4;
const HISTORY_WINDOW_DAYS = 30;

export function summariseWards(
  beds: { ward: string; status: string }[],
): WardOccupancy[] {
  const byWard = new Map<string, { total: number; occupied: number; available: number; maintenance: number }>();

  for (const bed of beds) {
    const entry = byWard.get(bed.ward) ?? { total: 0, occupied: 0, available: 0, maintenance: 0 };
    entry.total++;
    if (bed.status === "occupied") entry.occupied++;
    else if (bed.status === "available") entry.available++;
    else if (bed.status === "maintenance") entry.maintenance++;
    byWard.set(bed.ward, entry);
  }

  return Array.from(byWard.entries()).map(([ward, e]) => {
    const usable = e.total - e.maintenance;
    return {
      ward,
      total: e.total,
      occupied: e.occupied,
      available: e.available,
      maintenance: e.maintenance,
      occupancyPercent: usable > 0 ? Math.round((e.occupied / usable) * 100) : 0,
    };
  });
}

export function forecastOccupancy(
  beds: { status: string }[],
  admissionsInWindow: { admittedAt: Date }[],
  dischargedInWindow: { admittedAt: Date; dischargedAt: Date }[],
  now: Date = new Date(),
): OccupancyForecast {
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const usableBeds = beds.filter((b) => b.status !== "maintenance").length;
  const currentPercent = usableBeds > 0 ? Math.round((occupied / usableBeds) * 100) : 0;

  const admissionsPerDay = admissionsInWindow.length / HISTORY_WINDOW_DAYS;

  let avgLengthOfStayDays = DEFAULT_LOS_DAYS;
  let basis: OccupancyForecast["basis"] = "default";
  if (dischargedInWindow.length >= 2) {
    const totalDays = dischargedInWindow.reduce((sum, a) => {
      const days = (a.dischargedAt.getTime() - a.admittedAt.getTime()) / 86_400_000;
      return sum + days;
    }, 0);
    avgLengthOfStayDays = totalDays / dischargedInWindow.length;
    basis = "historical";
  }

  // Expected discharges over the next 3 days ≈ (currently occupied / avg LOS) × 3 —
  // a simple turnover-rate approximation, not a per-patient discharge date model.
  const expectedDischarges = avgLengthOfStayDays > 0 ? (occupied / avgLengthOfStayDays) * 3 : 0;
  const expectedAdmissions = admissionsPerDay * 3;

  const projectedOccupiedIn3Days = Math.max(
    0,
    Math.min(usableBeds, Math.round(occupied + expectedAdmissions - expectedDischarges)),
  );
  const projectedPercentIn3Days =
    usableBeds > 0 ? Math.round((projectedOccupiedIn3Days / usableBeds) * 100) : 0;

  return {
    currentOccupied: occupied,
    usableBeds,
    currentPercent,
    admissionsPerDay: Math.round(admissionsPerDay * 10) / 10,
    avgLengthOfStayDays: Math.round(avgLengthOfStayDays * 10) / 10,
    projectedOccupiedIn3Days,
    projectedPercentIn3Days,
    basis,
  };
}
