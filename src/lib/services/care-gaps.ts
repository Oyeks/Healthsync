import { parseJson, type Diagnosis } from "../format";

/**
 * Personalised patient engagement (AI recommendation doc §24) — surfaces
 * patients overdue for a chronic-condition review, based on the interval
 * since their last visit carrying that diagnosis. Deterministic and
 * read-only: staff decide whether and how to follow up, nothing is
 * messaged to patients automatically.
 */

export type CareGap = {
  patientId: string;
  patientName: string;
  mrn: string;
  gapType: string;
  daysSinceReview: number;
  targetDays: number;
  urgency: "due" | "overdue";
};

const REVIEW_RULES: { icd10Prefix: string; label: string; targetDays: number }[] = [
  { icd10Prefix: "I50", label: "Heart failure review", targetDays: 30 },
  { icd10Prefix: "I10", label: "Hypertension review", targetDays: 90 },
  { icd10Prefix: "E11", label: "Type 2 diabetes review", targetDays: 90 },
  { icd10Prefix: "E10", label: "Type 1 diabetes review", targetDays: 90 },
  { icd10Prefix: "N18", label: "Chronic kidney disease review", targetDays: 90 },
  { icd10Prefix: "J45", label: "Asthma review", targetDays: 180 },
];

type PatientWithRecords = {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  records: { diagnoses: string | null; visitDate: Date }[];
};

export function findCareGaps(
  patients: PatientWithRecords[],
  now: Date = new Date(),
): CareGap[] {
  const gaps: CareGap[] = [];

  for (const patient of patients) {
    for (const rule of REVIEW_RULES) {
      const matching = patient.records.filter((r) => {
        const diagnoses = parseJson<Diagnosis[]>(r.diagnoses, []);
        return diagnoses.some((d) => d.code?.startsWith(rule.icd10Prefix));
      });
      if (matching.length === 0) continue;

      const mostRecent = matching.reduce((a, b) => (a.visitDate > b.visitDate ? a : b));
      const daysSince = Math.round(
        (now.getTime() - mostRecent.visitDate.getTime()) / 86_400_000,
      );

      if (daysSince > rule.targetDays) {
        gaps.push({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          mrn: patient.mrn,
          gapType: rule.label,
          daysSinceReview: daysSince,
          targetDays: rule.targetDays,
          urgency: daysSince > rule.targetDays * 1.5 ? "overdue" : "due",
        });
      }
    }
  }

  gaps.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "overdue" ? -1 : 1;
    return b.daysSinceReview - a.daysSinceReview;
  });
  return gaps;
}

/**
 * Medication adherence reminders — chronic-condition patients whose last
 * dispensation of a relevant drug is older than a typical refill cycle.
 * A weak signal (we don't track prescribed duration on dispensations), so
 * this flags "may be due" rather than a firm overdue date.
 */
export type MedicationGap = {
  patientId: string;
  patientName: string;
  mrn: string;
  drug: string;
  daysSinceLastDispensed: number;
};

const REFILL_RULES: { icd10Prefix: string; drugKeywords: string[]; refillCycleDays: number }[] = [
  { icd10Prefix: "I10", drugKeywords: ["amlodipine", "lisinopril"], refillCycleDays: 35 },
  { icd10Prefix: "E11", drugKeywords: ["metformin"], refillCycleDays: 35 },
  { icd10Prefix: "E10", drugKeywords: ["insulin"], refillCycleDays: 35 },
  { icd10Prefix: "I50", drugKeywords: ["furosemide", "lisinopril"], refillCycleDays: 35 },
  { icd10Prefix: "J45", drugKeywords: ["salbutamol", "beclometasone"], refillCycleDays: 60 },
];

type PatientWithRecordsAndDispensations = PatientWithRecords & {
  dispensations: { drug: string; createdAt: Date }[];
};

export function findMedicationGaps(
  patients: PatientWithRecordsAndDispensations[],
  now: Date = new Date(),
): MedicationGap[] {
  const gaps: MedicationGap[] = [];

  for (const patient of patients) {
    const hasDiagnosis = (prefix: string) =>
      patient.records.some((r) =>
        parseJson<Diagnosis[]>(r.diagnoses, []).some((d) => d.code?.startsWith(prefix)),
      );

    for (const rule of REFILL_RULES) {
      if (!hasDiagnosis(rule.icd10Prefix)) continue;

      const relevant = patient.dispensations.filter((d) =>
        rule.drugKeywords.some((k) => d.drug.toLowerCase().includes(k)),
      );
      if (relevant.length === 0) continue;

      const lastDispensed = relevant.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const daysSince = Math.round((now.getTime() - lastDispensed.createdAt.getTime()) / 86_400_000);

      if (daysSince > rule.refillCycleDays) {
        gaps.push({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          mrn: patient.mrn,
          drug: lastDispensed.drug,
          daysSinceLastDispensed: daysSince,
        });
      }
    }
  }

  gaps.sort((a, b) => b.daysSinceLastDispensed - a.daysSinceLastDispensed);
  return gaps;
}

/**
 * Screening reminders. Limited to categories where this system actually
 * holds a historical signal to check against:
 *  - Diabetes screening (age ≥45, no HbA1c result in 3 years)
 *  - Paediatric immunisation check (age <18, no immunisation-related
 *    appointment in 12 months — reads the free-text appointment reason,
 *    since there's no dedicated immunisation register)
 * Other screening types from the source document (e.g. cervical screening)
 * are deliberately omitted: without any prior-screening data model, a
 * reminder would just be an unconditional age/sex flag, not a real gap.
 */
export type ScreeningGap = {
  patientId: string;
  patientName: string;
  mrn: string;
  screeningType: string;
  detail: string;
};

export function findScreeningGaps(
  patients: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    dob: Date;
    labResults: { panel: string; createdAt: Date }[];
    appointments: { reason: string | null; startTime: Date }[];
  }[],
  now: Date = new Date(),
): ScreeningGap[] {
  const gaps: ScreeningGap[] = [];

  for (const patient of patients) {
    const ageYears = Math.floor(
      (now.getTime() - patient.dob.getTime()) / (365.25 * 86_400_000),
    );

    if (ageYears >= 45) {
      const lastHba1c = patient.labResults
        .filter((l) => l.panel === "HbA1c")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      const daysSince = lastHba1c
        ? Math.round((now.getTime() - lastHba1c.createdAt.getTime()) / 86_400_000)
        : Infinity;
      if (daysSince > 3 * 365) {
        gaps.push({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          mrn: patient.mrn,
          screeningType: "Diabetes screening (HbA1c)",
          detail: lastHba1c
            ? `Last checked ${Math.round(daysSince / 365)} years ago`
            : "No HbA1c on file",
        });
      }
    }

    if (ageYears < 18) {
      const lastImmunisation = patient.appointments
        .filter((a) => /immunis|vaccin/i.test(a.reason ?? ""))
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
      const daysSince = lastImmunisation
        ? Math.round((now.getTime() - lastImmunisation.startTime.getTime()) / 86_400_000)
        : Infinity;
      if (daysSince > 365) {
        gaps.push({
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          mrn: patient.mrn,
          screeningType: "Immunisation check",
          detail: lastImmunisation
            ? `Last immunisation visit ${Math.round(daysSince / 30)} months ago`
            : "No immunisation visit on file",
        });
      }
    }
  }

  return gaps;
}
