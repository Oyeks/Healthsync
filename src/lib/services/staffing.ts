/**
 * Staffing needs forecasting (part of AI recommendation doc §12, "Hospital
 * Operational AI"). Deterministic ratio-based projection from the same
 * occupancy forecast already computed in occupancy.ts — not a scheduling
 * optimiser, a capacity-planning aid.
 *
 * ED demand and theatre/OR utilisation from the same doc item are NOT
 * covered here: this system has no Emergency Department or theatre-booking
 * module to forecast from. Building those would mean inventing an entire
 * new clinical module, not extending an analytics capability — out of
 * scope for this pass.
 */

const NURSE_TO_PATIENT_RATIO_WARD = 4; // 1 nurse per 4 ward patients
const NURSE_TO_PATIENT_RATIO_ICU = 1.5; // 1 nurse per 1–2 ICU patients
const CONSULTATIONS_PER_DOCTOR_PER_DAY = 16; // 30-min slots, 8-hour clinic

export type StaffingForecast = {
  currentWardPatients: number;
  currentIcuPatients: number;
  nursesNeededNow: number;
  projectedWardPatientsIn3Days: number;
  nursesNeededIn3Days: number;
  todaysAppointments: number;
  doctorsNeededToday: number;
};

export function forecastStaffing(input: {
  currentOccupiedByWard: { ward: string; occupied: number }[];
  projectedOccupiedIn3Days: number;
  todaysAppointments: number;
}): StaffingForecast {
  const icuOccupied =
    input.currentOccupiedByWard.find((w) => w.ward.toUpperCase().includes("ICU"))?.occupied ?? 0;
  const wardOccupied = input.currentOccupiedByWard.reduce((sum, w) => sum + w.occupied, 0) - icuOccupied;

  const nursesNeededNow =
    Math.ceil(wardOccupied / NURSE_TO_PATIENT_RATIO_WARD) +
    Math.ceil(icuOccupied / NURSE_TO_PATIENT_RATIO_ICU);

  // Projection applies the current ward:ICU mix to the projected total —
  // a simplification, since we don't forecast per-ward occupancy separately.
  const totalNow = wardOccupied + icuOccupied || 1;
  const icuShare = icuOccupied / totalNow;
  const projectedIcu = Math.round(input.projectedOccupiedIn3Days * icuShare);
  const projectedWard = input.projectedOccupiedIn3Days - projectedIcu;

  const nursesNeededIn3Days =
    Math.ceil(projectedWard / NURSE_TO_PATIENT_RATIO_WARD) +
    Math.ceil(projectedIcu / NURSE_TO_PATIENT_RATIO_ICU);

  const doctorsNeededToday = Math.ceil(input.todaysAppointments / CONSULTATIONS_PER_DOCTOR_PER_DAY);

  return {
    currentWardPatients: wardOccupied,
    currentIcuPatients: icuOccupied,
    nursesNeededNow,
    projectedWardPatientsIn3Days: input.projectedOccupiedIn3Days,
    nursesNeededIn3Days,
    todaysAppointments: input.todaysAppointments,
    doctorsNeededToday,
  };
}
