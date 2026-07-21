/**
 * Symptom assessment / differential-suggestion tool (AI recommendation doc
 * §1). Given a set of reported symptoms, suggests possible conditions,
 * investigations and an urgency band — clinical decision SUPPORT only. This
 * never writes to the medical record directly; the clinician reviews the
 * suggestions and decides what belongs in their own Assessment and Plan.
 *
 * The rule table below is illustrative and intentionally small. A production
 * deployment must replace it with a validated clinical decision-support
 * engine (e.g. Isabel, NHS Pathways) reviewed by clinical governance.
 */

export type Urgency = "routine" | "urgent" | "emergency";

export type TriageMatch = {
  conditions: string[];
  investigations: string[];
  urgency: Urgency;
  note?: string;
};

type SymptomRule = {
  // All of these symptoms must be present (case-insensitive substring match).
  requires: string[];
  // Optional: only fires for a given sex, or when the patient is pregnant.
  sexFilter?: "male" | "female";
  pregnantOnly?: boolean;
  match: TriageMatch;
};

export const COMMON_SYMPTOMS = [
  "Fever",
  "Cough",
  "Shortness of breath",
  "Chest pain",
  "Palpitations",
  "Sweating",
  "Arm pain",
  "Headache",
  "Neck stiffness",
  "Photophobia",
  "Abdominal pain",
  "Vomiting",
  "Right iliac fossa pain",
  "Vaginal bleeding",
  "Leg swelling",
  "Calf pain",
  "Polyuria",
  "Polydipsia",
  "Weight loss",
  "Confusion",
  "Rash",
] as const;

const RULES: SymptomRule[] = [
  {
    requires: ["fever", "cough", "shortness of breath"],
    match: {
      conditions: [
        "Community-acquired pneumonia",
        "Influenza",
        "COVID-19",
        "Tuberculosis",
      ],
      investigations: ["Chest X-ray", "Full blood count", "CRP", "Pulse oximetry"],
      urgency: "urgent",
    },
  },
  {
    requires: ["chest pain", "sweating", "arm pain"],
    match: {
      conditions: ["Acute coronary syndrome", "Unstable angina"],
      investigations: ["12-lead ECG", "Troponin", "Chest X-ray"],
      urgency: "emergency",
      note: "Chest pain with autonomic features — treat as cardiac until proven otherwise.",
    },
  },
  {
    requires: ["chest pain", "shortness of breath"],
    match: {
      conditions: ["Pulmonary embolism", "Pneumothorax", "Acute coronary syndrome"],
      investigations: ["12-lead ECG", "D-dimer", "Chest X-ray", "Pulse oximetry"],
      urgency: "urgent",
    },
  },
  {
    requires: ["headache", "neck stiffness", "fever"],
    match: {
      conditions: ["Meningitis", "Subarachnoid haemorrhage (if sudden onset)"],
      investigations: ["Urgent senior review", "CT head", "Lumbar puncture (if not contraindicated)"],
      urgency: "emergency",
      note: "Red flag combination — do not delay senior clinical review.",
    },
  },
  {
    requires: ["headache", "photophobia"],
    match: {
      conditions: ["Migraine", "Meningitis"],
      investigations: ["Neurological examination", "Consider CT head if red flags present"],
      urgency: "urgent",
    },
  },
  {
    requires: ["abdominal pain", "vomiting", "right iliac fossa pain"],
    match: {
      conditions: ["Acute appendicitis", "Ectopic pregnancy (if female of childbearing age)", "Ovarian pathology"],
      investigations: ["Full blood count", "CRP", "Urinalysis", "Pregnancy test (if applicable)", "Abdominal/pelvic ultrasound"],
      urgency: "urgent",
    },
  },
  {
    requires: ["abdominal pain", "vaginal bleeding"],
    sexFilter: "female",
    match: {
      conditions: ["Ectopic pregnancy", "Miscarriage", "Ovarian cyst rupture"],
      investigations: ["Urgent pregnancy test", "Pelvic ultrasound", "Group & save"],
      urgency: "emergency",
      note: "Abdominal pain with vaginal bleeding in a woman of childbearing age is an emergency until ectopic pregnancy is excluded.",
    },
  },
  {
    requires: ["leg swelling", "calf pain"],
    match: {
      conditions: ["Deep vein thrombosis"],
      investigations: ["D-dimer", "Doppler ultrasound of the leg"],
      urgency: "urgent",
    },
  },
  {
    requires: ["leg swelling", "calf pain", "shortness of breath"],
    match: {
      conditions: ["Deep vein thrombosis with suspected pulmonary embolism"],
      investigations: ["D-dimer", "CT pulmonary angiogram", "Doppler ultrasound of the leg"],
      urgency: "emergency",
    },
  },
  {
    requires: ["polyuria", "polydipsia", "weight loss"],
    match: {
      conditions: ["New-onset diabetes mellitus"],
      investigations: ["Random/fasting glucose", "HbA1c", "Urinalysis for ketones"],
      urgency: "routine",
    },
  },
  {
    requires: ["fever", "confusion"],
    match: {
      conditions: ["Sepsis", "Meningoencephalitis", "Urinary tract infection in the elderly"],
      investigations: ["Full blood count", "CRP", "Blood cultures", "Urinalysis", "Lactate"],
      urgency: "emergency",
      note: "Fever with new confusion should trigger a sepsis screen.",
    },
  },
  {
    requires: ["fever", "rash"],
    match: {
      conditions: ["Viral exanthem", "Meningococcaemia (if non-blanching)", "Drug reaction"],
      investigations: ["Full blood count", "CRP", "Blood cultures if unwell"],
      urgency: "urgent",
      note: "Check specifically for a non-blanching rash — treat as meningococcal sepsis if present.",
    },
  },
];

function normalise(s: string) {
  return s.trim().toLowerCase();
}

export function assessSymptoms(
  selectedSymptoms: string[],
  patientContext: { sex?: string; pregnant?: boolean } = {},
): TriageMatch[] {
  const symptoms = selectedSymptoms.map(normalise);

  return RULES.filter((rule) => {
    const hasAll = rule.requires.every((r) =>
      symptoms.some((s) => s.includes(normalise(r))),
    );
    if (!hasAll) return false;
    if (rule.sexFilter && patientContext.sex !== rule.sexFilter) return false;
    if (rule.pregnantOnly && !patientContext.pregnant) return false;
    return true;
  }).map((rule) => rule.match);
}

const URGENCY_ORDER: Record<Urgency, number> = { emergency: 0, urgent: 1, routine: 2 };

/** Highest-priority urgency across all matches, or null if there are none. */
export function highestUrgency(matches: TriageMatch[]): Urgency | null {
  if (matches.length === 0) return null;
  return matches.reduce((worst, m) =>
    URGENCY_ORDER[m.urgency] < URGENCY_ORDER[worst] ? m.urgency : worst,
    matches[0].urgency,
  );
}
