import { parseJson, type Allergy, type Prescription } from "../format";

/**
 * Clinical Decision Support — allergy and drug-interaction checking.
 *
 * The rule set below is a deliberately small, illustrative table so the alert
 * pathway is real and testable end to end. A production deployment must replace
 * `INTERACTIONS` and `ALLERGY_CLASSES` with a licensed drug database
 * (e.g. First Databank, RxNorm + DrugBank). Do not rely on this list clinically.
 */

type Severity = "warning" | "critical";

export type ClinicalAlert = {
  severity: Severity;
  title: string;
  detail: string;
};

// Known interacting pairs, keyed by lowercase ingredient name.
const INTERACTIONS: Array<{
  a: string;
  b: string;
  severity: Severity;
  detail: string;
}> = [
  {
    a: "warfarin",
    b: "aspirin",
    severity: "critical",
    detail: "Markedly increased bleeding risk. Avoid or monitor INR closely.",
  },
  {
    a: "warfarin",
    b: "ibuprofen",
    severity: "critical",
    detail: "NSAID with anticoagulant raises GI bleeding risk substantially.",
  },
  {
    a: "metformin",
    b: "prednisolone",
    severity: "warning",
    detail: "Corticosteroids raise blood glucose and oppose metformin control.",
  },
  {
    a: "lisinopril",
    b: "spironolactone",
    severity: "warning",
    detail: "Combined use risks hyperkalaemia. Monitor serum potassium.",
  },
  {
    a: "simvastatin",
    b: "clarithromycin",
    severity: "critical",
    detail: "CYP3A4 inhibition raises statin levels; risk of rhabdomyolysis.",
  },
  {
    a: "ciprofloxacin",
    b: "tizanidine",
    severity: "critical",
    detail: "Contraindicated — profound hypotension and sedation.",
  },
];

// Maps an allergy substance to the drugs that cross-react with it.
const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ["amoxicillin", "ampicillin", "penicillin", "flucloxacillin"],
  sulfa: ["co-trimoxazole", "sulfamethoxazole", "sulfasalazine"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "aspirin"],
  aspirin: ["aspirin"],
  codeine: ["codeine", "dihydrocodeine"],
};

function normalise(drug: string) {
  return drug.trim().toLowerCase();
}

/** Screens a proposed prescription list against allergies and each other. */
export function screenPrescriptions(
  prescriptions: Prescription[],
  allergiesJson: string | null,
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const allergies = parseJson<Allergy[]>(allergiesJson, []);
  const drugs = prescriptions.map((p) => normalise(p.drug)).filter(Boolean);

  // Allergy contraindications.
  for (const allergy of allergies) {
    const key = normalise(allergy.substance);
    const crossReacting = ALLERGY_CLASSES[key] ?? [key];
    for (const drug of drugs) {
      const hit = crossReacting.some((c) => drug.includes(c));
      if (hit) {
        alerts.push({
          severity: "critical",
          title: `Allergy conflict: ${drug}`,
          detail: `Patient has a recorded ${allergy.substance} allergy (${allergy.reaction}, ${allergy.severity}). Do not administer without review.`,
        });
      }
    }
  }

  // Pairwise interaction check across the proposed list.
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const match = INTERACTIONS.find(
        ({ a, b }) =>
          (drugs[i].includes(a) && drugs[j].includes(b)) ||
          (drugs[i].includes(b) && drugs[j].includes(a)),
      );
      if (match) {
        alerts.push({
          severity: match.severity,
          title: `Interaction: ${drugs[i]} + ${drugs[j]}`,
          detail: match.detail,
        });
      }
    }
  }

  return alerts;
}
