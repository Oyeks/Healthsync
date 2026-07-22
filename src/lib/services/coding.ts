/**
 * Coding assistant (AI recommendation doc §20). Small reference tables with
 * substring matching — suggests candidate codes as the clinician types a
 * description. The clinician picks (or ignores) every suggestion; nothing
 * is auto-applied. Covers ICD-10 (diagnoses, already wired into the
 * encounter form), ICD-11 (diagnoses, newer classification), SNOMED CT
 * (clinical concepts), and CPT (billable procedures/services, wired into
 * invoice line items).
 */

export type Icd10Entry = { code: string; description: string };
export type CodeEntry = { code: string; description: string };

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

export const ICD11_REFERENCE: CodeEntry[] = [
  { code: "1F40", description: "Malaria" },
  { code: "1A40", description: "Cholera" },
  { code: "1B10.0", description: "Tuberculosis of the lung" },
  { code: "1C62", description: "HIV disease" },
  { code: "1D60", description: "Lassa fever" },
  { code: "BA00", description: "Essential hypertension" },
  { code: "BD10", description: "Heart failure" },
  { code: "BA41", description: "Acute myocardial infarction" },
  { code: "5A11", description: "Type 2 diabetes mellitus" },
  { code: "5A10", description: "Type 1 diabetes mellitus" },
  { code: "GB61", description: "Chronic kidney disease" },
  { code: "GC08.0", description: "Urinary tract infection" },
  { code: "CA40.Z", description: "Pneumonia, organism unspecified" },
  { code: "CA23", description: "Asthma" },
  { code: "3A00.Z", description: "Anaemia, unspecified" },
  { code: "DA60.Z", description: "Peptic ulcer, site unspecified" },
  { code: "8A80.Z", description: "Headache, unspecified" },
];

export const SNOMED_REFERENCE: CodeEntry[] = [
  { code: "61462000", description: "Malaria" },
  { code: "63650001", description: "Cholera" },
  { code: "56717001", description: "Tuberculosis" },
  { code: "86406008", description: "HIV infection" },
  { code: "38341003", description: "Hypertensive disorder" },
  { code: "84114007", description: "Heart failure" },
  { code: "22298006", description: "Myocardial infarction" },
  { code: "44054006", description: "Type 2 diabetes mellitus" },
  { code: "46635009", description: "Type 1 diabetes mellitus" },
  { code: "709044004", description: "Chronic kidney disease" },
  { code: "68566005", description: "Urinary tract infection" },
  { code: "233604007", description: "Pneumonia" },
  { code: "195967001", description: "Asthma" },
  { code: "271737000", description: "Anaemia" },
  { code: "13200003", description: "Peptic ulcer" },
  { code: "25064002", description: "Headache" },
];

export const CPT_REFERENCE: CodeEntry[] = [
  { code: "99204", description: "New patient office visit, moderate complexity" },
  { code: "99213", description: "Established patient office visit, low complexity" },
  { code: "99214", description: "Established patient office visit, moderate complexity" },
  { code: "99281", description: "Emergency department visit, low severity" },
  { code: "99283", description: "Emergency department visit, moderate severity" },
  { code: "85025", description: "Complete blood count with differential" },
  { code: "80053", description: "Comprehensive metabolic panel" },
  { code: "83036", description: "Haemoglobin A1c test" },
  { code: "80061", description: "Lipid panel" },
  { code: "71046", description: "Chest X-ray, 2 views" },
  { code: "74176", description: "CT abdomen and pelvis without contrast" },
  { code: "76700", description: "Abdominal ultrasound, complete" },
  { code: "93000", description: "Electrocardiogram, complete" },
  { code: "90471", description: "Immunisation administration, single vaccine" },
  { code: "12001", description: "Simple wound repair, 2.5cm or less" },
  { code: "36415", description: "Venipuncture (blood draw)" },
  { code: "99070", description: "Supplies and materials provided" },
];

/** Matches on code or description substring; requires ≥2 characters. */
function search<T extends CodeEntry>(table: T[], query: string, limit: number): T[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return table
    .filter((e) => e.code.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    .slice(0, limit);
}

export function searchIcd10(query: string, limit = 6): Icd10Entry[] {
  return search(ICD10_REFERENCE, query, limit);
}

export function searchIcd11(query: string, limit = 6): CodeEntry[] {
  return search(ICD11_REFERENCE, query, limit);
}

export function searchSnomed(query: string, limit = 6): CodeEntry[] {
  return search(SNOMED_REFERENCE, query, limit);
}

export function searchCpt(query: string, limit = 6): CodeEntry[] {
  return search(CPT_REFERENCE, query, limit);
}
