/**
 * Predictive long-term disease risk (AI recommendation doc §11) — CKD
 * staging, a simplified cardiovascular risk band, and diabetes control
 * trend, each with deterministic lifestyle-recommendation text. These are
 * screening heuristics for clinician review, not a diagnosis and not a
 * substitute for a validated risk calculator (e.g. QRISK3, ASCVD).
 */

export type CkdStage = "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5";

export type CkdAssessment = {
  stage: CkdStage;
  label: string;
  egfr: number;
};

// Ordered smallest max first — .find() below must hit the most severe
// (most specific) matching stage before falling through to milder ones.
const CKD_STAGES: { max: number; stage: CkdStage; label: string }[] = [
  { max: 14, stage: "G5", label: "Kidney failure (G5)" },
  { max: 29, stage: "G4", label: "Severely decreased (G4)" },
  { max: 44, stage: "G3b", label: "Moderately to severely decreased (G3b)" },
  { max: 59, stage: "G3a", label: "Mildly to moderately decreased (G3a)" },
  { max: 89, stage: "G2", label: "Mildly decreased (G2)" },
  { max: Infinity, stage: "G1", label: "Normal or high (G1)" },
];

export function assessCkdStage(egfr: number): CkdAssessment {
  const match = CKD_STAGES.find((s) => egfr <= s.max) ?? CKD_STAGES[CKD_STAGES.length - 1];
  return { stage: match.stage, label: match.label, egfr };
}

export type CvdRisk = {
  band: "low" | "moderate" | "high";
  factors: string[];
  recommendations: string[];
};

export function assessCvdRisk(input: {
  age: number;
  systolic: number | null;
  hasDiabetesDiagnosis: boolean;
  hasHypertensionDiagnosis: boolean;
  ldl: number | null;
}): CvdRisk {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let points = 0;

  if (input.age >= 65) {
    points += 2;
    factors.push(`Age ${input.age}`);
  } else if (input.age >= 45) {
    points += 1;
  }

  if (input.systolic != null && input.systolic >= 140) {
    points += 2;
    factors.push(`Systolic BP ${input.systolic} mmHg`);
    recommendations.push("Home blood pressure monitoring and review of antihypertensive therapy");
  }

  if (input.hasHypertensionDiagnosis) {
    points += 1;
    factors.push("Hypertension diagnosis on record");
  }

  if (input.hasDiabetesDiagnosis) {
    points += 2;
    factors.push("Diabetes diagnosis on record");
    recommendations.push("Diabetic diet review and annual HbA1c monitoring");
  }

  if (input.ldl != null && input.ldl >= 3.4) {
    points += 2;
    factors.push(`LDL ${input.ldl} mmol/L`);
    recommendations.push("Dietary fat modification; consider statin therapy discussion");
  }

  const band = points >= 5 ? "high" : points >= 2 ? "moderate" : "low";

  if (band !== "low") {
    recommendations.push("Smoking cessation advice and regular physical activity if applicable");
  }
  if (recommendations.length === 0) {
    recommendations.push("No specific action indicated — maintain routine health checks");
  }
  if (factors.length === 0) factors.push("No significant risk factors on file");

  return { band, factors, recommendations };
}

export type DiabetesRisk = {
  band: "normal" | "prediabetic" | "diabetic";
  latestHba1c: number;
  trend: "improving" | "worsening" | "stable" | "insufficient_data";
  recommendation: string;
};

export function assessDiabetesRisk(
  hba1cReadings: { value: number; date: Date }[],
): DiabetesRisk | null {
  if (hba1cReadings.length === 0) return null;

  const sorted = [...hba1cReadings].sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = sorted[sorted.length - 1].value;

  const band = latest >= 6.5 ? "diabetic" : latest >= 5.7 ? "prediabetic" : "normal";

  let trend: DiabetesRisk["trend"] = "insufficient_data";
  if (sorted.length >= 2) {
    const prior = sorted[sorted.length - 2].value;
    const delta = latest - prior;
    trend = Math.abs(delta) < 0.2 ? "stable" : delta > 0 ? "worsening" : "improving";
  }

  const recommendation =
    band === "diabetic"
      ? "Confirm with fasting glucose if not already done; commence or review glycaemic control plan"
      : band === "prediabetic"
        ? "Lifestyle intervention (weight, diet, activity) and repeat HbA1c in 6 months"
        : "No action indicated — routine screening interval";

  return { band, latestHba1c: latest, trend, recommendation };
}
