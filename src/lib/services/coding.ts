/**
 * ICD-10 coding assistant (AI recommendation doc §20). A small reference
 * table with substring matching — suggests candidate codes as the clinician
 * types a diagnosis description. The clinician picks (or ignores) every
 * suggestion; nothing is auto-applied.
 */

export type Icd10Entry = { code: string; description: string };

export const ICD10_REFERENCE: Icd10Entry[] = [
  { code: "B54", description: "Malaria, unspecified" },
  { code: "A09", description: "Infectious gastroenteritis and colitis, unspecified" },
  { code: "A00", description: "Cholera" },
  { code: "A15.0", description: "Tuberculosis of lung" },
  { code: "B20", description: "HIV disease" },
  { code: "A96.2", description: "Lassa fever" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "I50.9", description: "Heart failure, unspecified" },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications" },
  { code: "N18.9", description: "Chronic kidney disease, unspecified" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "J18.9", description: "Pneumonia, unspecified organism" },
  { code: "J45.9", description: "Asthma, unspecified" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "D64.9", description: "Anaemia, unspecified" },
  { code: "K27.9", description: "Peptic ulcer, unspecified" },
  { code: "K29.7", description: "Gastritis, unspecified" },
  { code: "R51", description: "Headache" },
  { code: "R10.4", description: "Other and unspecified abdominal pain" },
  { code: "R50.9", description: "Fever, unspecified" },
  { code: "O00.1", description: "Tubal pregnancy (ectopic)" },
  { code: "O14.9", description: "Pre-eclampsia, unspecified" },
  { code: "O72.1", description: "Postpartum haemorrhage" },
  { code: "S06.0", description: "Concussion" },
  { code: "S52.5", description: "Fracture of lower end of radius" },
  { code: "L03.9", description: "Cellulitis, unspecified" },
  { code: "M79.1", description: "Myalgia" },
  { code: "F32.9", description: "Depressive episode, unspecified" },
];

/** Matches on code or description substring; requires ≥2 characters. */
export function searchIcd10(query: string, limit = 6): Icd10Entry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return ICD10_REFERENCE.filter(
    (e) => e.code.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
  ).slice(0, limit);
}
