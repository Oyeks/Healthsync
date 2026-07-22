/**
 * Clinical guideline assistant (AI recommendation doc §19). A small
 * reference table of recommended pathways keyed to common ICD-10 codes —
 * a memory aid pointing the clinician to the standard approach, not a
 * substitute for the full guideline. Sourced from commonly-cited first-line
 * pathways (WHO / NICE-style summaries); always defer to local protocol.
 */

export type GuidelinePathway = {
  icd10Prefix: string;
  condition: string;
  pathway: string;
};

export const GUIDELINE_PATHWAYS: GuidelinePathway[] = [
  {
    icd10Prefix: "I10",
    condition: "Essential hypertension",
    pathway:
      "First-line: ACE inhibitor or calcium channel blocker (CCB if African ancestry or age ≥55). Target <140/90, or <130/80 if diabetic/CKD. Reassess in 4 weeks; add a second agent if not at target.",
  },
  {
    icd10Prefix: "E11",
    condition: "Type 2 diabetes mellitus",
    pathway:
      "First-line: Metformin (unless eGFR <30). Target HbA1c <7% individualised. Screen annually for retinopathy, nephropathy, and neuropathy. Add a second agent if HbA1c remains above target after 3 months.",
  },
  {
    icd10Prefix: "I50",
    condition: "Heart failure",
    pathway:
      "ACE inhibitor/ARB + beta-blocker as first-line for reduced ejection fraction; add mineralocorticoid antagonist if symptoms persist. Daily weights, fluid restriction if advised, and diuretic titration to euvolaemia.",
  },
  {
    icd10Prefix: "N18",
    condition: "Chronic kidney disease",
    pathway:
      "Stage with eGFR + albuminuria. Avoid nephrotoxic drugs (NSAIDs, some antibiotics without dose adjustment). Manage BP and glycaemic control aggressively. Refer to nephrology at eGFR <30 or rapid decline.",
  },
  {
    icd10Prefix: "J45",
    condition: "Asthma",
    pathway:
      "Step up/down per symptom control: SABA as needed → add low-dose ICS → add LABA. Check inhaler technique and adherence before escalating. Provide a written action plan.",
  },
  {
    icd10Prefix: "B54",
    condition: "Malaria",
    pathway:
      "Confirm with RDT or microscopy before treating. Uncomplicated: artemisinin-based combination therapy (ACT) per national guideline. Severe malaria (impaired consciousness, jaundice, high parasitaemia): IV artesunate and admit.",
  },
  {
    icd10Prefix: "A15",
    condition: "Tuberculosis",
    pathway:
      "Confirm with sputum microscopy/GeneXpert. Standard regimen: 2 months HRZE then 4 months HR (2HRZE/4HR), directly observed therapy where possible. Screen household contacts and test for HIV.",
  },
  {
    icd10Prefix: "B20",
    condition: "HIV disease",
    pathway:
      "Start ART regardless of CD4 count at diagnosis. First-line per national guideline (commonly TDF+3TC+DTG). Baseline and follow-up viral load monitoring; screen for TB and other opportunistic infections.",
  },
  {
    icd10Prefix: "J18",
    condition: "Pneumonia",
    pathway:
      "Assess severity (e.g. CURB-65). Outpatient: amoxicillin or macrolide per local resistance pattern. Admit if CURB-65 ≥2, hypoxic, or unable to maintain oral intake. Reassess at 48–72h.",
  },
  {
    icd10Prefix: "N39.0",
    condition: "Urinary tract infection",
    pathway:
      "Uncomplicated: empirical nitrofurantoin or trimethoprim per local resistance data, 3–7 days. Send urine culture if recurrent, pregnant, male, or systemically unwell. Review antibiotic choice against culture result.",
  },
  {
    icd10Prefix: "K27",
    condition: "Peptic ulcer disease",
    pathway:
      "Test for H. pylori (stool antigen/urea breath test) and eradicate if positive (triple therapy). PPI for 4–8 weeks. Stop NSAIDs where possible; investigate for malignancy if red-flag symptoms present.",
  },
  {
    icd10Prefix: "D64.9",
    condition: "Anaemia",
    pathway:
      "Check FBC indices and iron studies before treating. Iron-deficiency: oral iron and identify the source of loss. Investigate further (endoscopy) if unexplained in an adult, especially if microcytic.",
  },
];

/** Returns the guideline pathway matching a diagnosis code, if any. */
export function findGuideline(icd10Code: string): GuidelinePathway | null {
  const code = icd10Code.trim().toUpperCase();
  return (
    GUIDELINE_PATHWAYS.find((g) => code.startsWith(g.icd10Prefix)) ?? null
  );
}
