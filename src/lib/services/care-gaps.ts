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
