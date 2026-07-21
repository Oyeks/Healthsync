/**
 * Medication dose-adjustment safety checks (AI recommendation doc §2) —
 * flags drugs that need dose review given renal function, hepatic
 * impairment, pregnancy, or age. Illustrative rule table, same caveat as
 * cds.ts: replace with a licensed drug database before clinical use.
 */

import type { Prescription } from "../format";
import type { ClinicalAlert } from "./cds";

export type PatientClinicalContext = {
  ageYears: number | null;
  egfr: number | null;
  hepaticImpairment: boolean;
  pregnant: boolean;
};

type DoseRule = {
  drugs: string[];
  condition: (ctx: PatientClinicalContext) => boolean;
  severity: "warning" | "critical";
  detail: string;
};

const RULES: DoseRule[] = [
  {
    drugs: ["gentamicin", "vancomycin"],
    condition: (ctx) => ctx.egfr != null && ctx.egfr < 60,
    severity: "critical",
    detail:
      "Renally cleared and nephrotoxic — dose/interval must be adjusted for reduced renal function. Consult a renal dosing chart and consider level monitoring.",
  },
  {
    drugs: ["metformin"],
    condition: (ctx) => ctx.egfr != null && ctx.egfr < 30,
    severity: "critical",
    detail: "Contraindicated at eGFR <30 due to lactic acidosis risk.",
  },
  {
    drugs: ["metformin"],
    condition: (ctx) => ctx.egfr != null && ctx.egfr >= 30 && ctx.egfr < 45,
    severity: "warning",
    detail: "Reduce dose at eGFR 30–45; monitor renal function.",
  },
  {
    drugs: ["ibuprofen", "diclofenac", "naproxen", "aspirin"],
    condition: (ctx) => ctx.pregnant,
    severity: "critical",
    detail:
      "NSAIDs are avoided in pregnancy, particularly the third trimester (risk of premature ductus arteriosus closure).",
  },
  {
    drugs: ["lisinopril", "ramipril", "losartan", "valsartan"],
    condition: (ctx) => ctx.pregnant,
    severity: "critical",
    detail:
      "ACE inhibitors / ARBs are teratogenic and contraindicated in pregnancy.",
  },
  {
    drugs: ["warfarin"],
    condition: (ctx) => ctx.pregnant,
    severity: "critical",
    detail: "Warfarin is teratogenic — avoid in pregnancy, particularly the first trimester.",
  },
  {
    drugs: ["paracetamol", "acetaminophen"],
    condition: (ctx) => ctx.hepaticImpairment,
    severity: "warning",
    detail: "Reduce total daily dose in hepatic impairment; risk of hepatotoxicity at standard doses.",
  },
  {
    drugs: ["simvastatin", "atorvastatin"],
    condition: (ctx) => ctx.hepaticImpairment,
    severity: "warning",
    detail: "Statins require caution/dose review in hepatic impairment — monitor LFTs.",
  },
  {
    drugs: ["morphine", "codeine", "tramadol", "diazepam"],
    condition: (ctx) => ctx.ageYears != null && ctx.ageYears >= 65,
    severity: "warning",
    detail: "Consider a lower starting dose in older adults — increased sensitivity and fall risk.",
  },
  {
    drugs: ["digoxin"],
    condition: (ctx) => ctx.egfr != null && ctx.egfr < 60,
    severity: "warning",
    detail: "Renally cleared with a narrow therapeutic index — reduce dose and monitor levels.",
  },
];

function normalise(drug: string) {
  return drug.trim().toLowerCase();
}

export function screenDoseAdjustments(
  prescriptions: Prescription[],
  context: PatientClinicalContext,
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const drugs = prescriptions.map((p) => normalise(p.drug)).filter(Boolean);

  for (const drug of drugs) {
    for (const rule of RULES) {
      const hit = rule.drugs.some((d) => drug.includes(d));
      if (hit && rule.condition(context)) {
        alerts.push({
          severity: rule.severity,
          title: `Dose adjustment: ${drug}`,
          detail: rule.detail,
        });
      }
    }
  }

  return alerts;
}
