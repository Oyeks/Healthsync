/**
 * Disease-specific predictive risk scoring (AI recommendation doc §6).
 * NEWS2 (news2.ts) already covers generic deterioration; this file adds
 * three narrower, clinically-recognised, deterministic scores:
 *
 *  - qSOFA: bedside sepsis screening (Seymour et al. 2016 / Sepsis-3)
 *  - AKI staging: KDIGO creatinine criteria, simplified to "vs. earliest
 *    creatinine on file" since we don't track hourly urine output
 *  - 30-day readmission risk: a LACE-inspired heuristic (length of stay,
 *    acute admission count, comorbidity count)
 *
 * Deliberately NOT included: a standalone "mortality risk" score. Assigning
 * a numeric death probability needs a validated model (e.g. APACHE II,
 * SOFA) with far more inputs than this system captures — presenting one
 * here would be misleading rather than helpful. qSOFA and AKI staging
 * already flag the situations where mortality risk is clinically relevant.
 */

export type QsofaResult = {
  score: number; // 0–3
  criteria: { label: string; met: boolean }[];
  highRisk: boolean; // score >= 2
};

export function computeQsofa(vital: {
  respiratoryRate: number | null;
  systolic: number | null;
  consciousness: string;
}): QsofaResult {
  const criteria = [
    {
      label: "Respiratory rate ≥ 22/min",
      met: vital.respiratoryRate != null && vital.respiratoryRate >= 22,
    },
    {
      label: "Altered mentation",
      met: vital.consciousness !== "alert",
    },
    {
      label: "Systolic BP ≤ 100 mmHg",
      met: vital.systolic != null && vital.systolic <= 100,
    },
  ];
  const score = criteria.filter((c) => c.met).length;
  return { score, criteria, highRisk: score >= 2 };
}

export type AkiStage = "none" | "stage1" | "stage2" | "stage3";

export type AkiResult = {
  stage: AkiStage;
  baseline: number;
  latest: number;
  ratio: number;
  detail: string;
};

const AKI_UNIT = "µmol/L";

export function stageAki(creatinineReadings: { value: number; date: Date }[]): AkiResult | null {
  if (creatinineReadings.length < 2) return null;

  const sorted = [...creatinineReadings].sort((a, b) => a.date.getTime() - b.date.getTime());
  const baseline = sorted[0].value;
  const latest = sorted[sorted.length - 1].value;
  const ratio = baseline > 0 ? latest / baseline : 1;

  let stage: AkiStage = "none";
  if (latest >= 353.6 || ratio >= 3.0) stage = "stage3";
  else if (ratio >= 2.0) stage = "stage2";
  else if (ratio >= 1.5) stage = "stage1";

  const detail =
    stage === "none"
      ? `Latest creatinine ${latest} ${AKI_UNIT} vs. baseline ${baseline} ${AKI_UNIT} — no AKI by KDIGO criteria`
      : `Latest creatinine ${latest} ${AKI_UNIT} is ${ratio.toFixed(1)}× baseline (${baseline} ${AKI_UNIT}) — KDIGO ${stage.replace("stage", "stage ")}`;

  return { stage, baseline, latest, ratio, detail };
}

export type ReadmissionRisk = {
  score: number; // 0–100
  band: "low" | "medium" | "high";
  reasons: string[];
};

export function scoreReadmissionRisk(input: {
  admissionsInLast90Days: number;
  lastLengthOfStayDays: number | null;
  chronicDiagnosisCount: number;
}): ReadmissionRisk {
  const reasons: string[] = [];
  let points = 0;

  if (input.admissionsInLast90Days >= 2) {
    points += 35;
    reasons.push(`${input.admissionsInLast90Days} admissions in the last 90 days`);
  } else if (input.admissionsInLast90Days === 1) {
    points += 15;
    reasons.push("1 admission in the last 90 days");
  }

  if (input.lastLengthOfStayDays != null) {
    if (input.lastLengthOfStayDays >= 7) {
      points += 25;
      reasons.push(`Last stay was ${Math.round(input.lastLengthOfStayDays)} days`);
    } else if (input.lastLengthOfStayDays >= 3) {
      points += 10;
      reasons.push(`Last stay was ${Math.round(input.lastLengthOfStayDays)} days`);
    }
  }

  if (input.chronicDiagnosisCount >= 3) {
    points += 25;
    reasons.push(`${input.chronicDiagnosisCount} recorded chronic conditions`);
  } else if (input.chronicDiagnosisCount >= 1) {
    points += 10;
    reasons.push(`${input.chronicDiagnosisCount} recorded diagnosis on file`);
  }

  const score = Math.min(100, points);
  const band = score >= 50 ? "high" : score >= 25 ? "medium" : "low";
  if (reasons.length === 0) reasons.push("No significant risk factors on file");

  return { score, band, reasons };
}
