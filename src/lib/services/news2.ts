/**
 * NEWS2 (National Early Warning Score 2) — computed from routine vitals to
 * flag physiological deterioration (AI recommendation doc §7). Uses the
 * standard scale-1 (non-COPD) SpO2 bands, since COPD status isn't currently
 * tracked; a production deployment would switch to scale 2 for patients with
 * a documented hypercapnic respiratory failure risk.
 */

export type News2Input = {
  respiratoryRate: number | null;
  spo2: number | null;
  onOxygen: boolean;
  systolic: number | null;
  heartRate: number | null;
  consciousness: string; // alert | voice | pain | unresponsive
  temperature: number | null;
};

export type News2Result = {
  score: number;
  risk: "low" | "medium" | "high";
  recommendation: string;
  scored: boolean; // false if too few readings were present to score
};

function scoreRespiratoryRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}

function scoreSpo2(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

function scoreSystolic(sbp: number): number {
  if (sbp <= 90) return 3;
  if (sbp <= 100) return 2;
  if (sbp <= 110) return 1;
  if (sbp <= 219) return 0;
  return 3;
}

function scoreHeartRate(hr: number): number {
  if (hr <= 40) return 3;
  if (hr <= 50) return 1;
  if (hr <= 90) return 0;
  if (hr <= 110) return 1;
  if (hr <= 130) return 2;
  return 3;
}

function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp <= 36.0) return 1;
  if (temp <= 38.0) return 0;
  if (temp <= 39.0) return 1;
  return 2;
}

export function computeNews2(input: News2Input): News2Result {
  const parts: number[] = [];

  if (input.respiratoryRate != null) parts.push(scoreRespiratoryRate(input.respiratoryRate));
  if (input.spo2 != null) parts.push(scoreSpo2(input.spo2));
  if (input.systolic != null) parts.push(scoreSystolic(input.systolic));
  if (input.heartRate != null) parts.push(scoreHeartRate(input.heartRate));
  if (input.temperature != null) parts.push(scoreTemperature(input.temperature));

  const consciousnessScore = input.consciousness === "alert" ? 0 : 3;
  parts.push(consciousnessScore);

  const oxygenScore = input.onOxygen ? 2 : 0;
  parts.push(oxygenScore);

  // Require at least 3 physiological readings (beyond consciousness/O2) to
  // produce a meaningful score rather than a misleading low number.
  const scored =
    [input.respiratoryRate, input.spo2, input.systolic, input.heartRate, input.temperature].filter(
      (v) => v != null,
    ).length >= 3;

  const score = parts.reduce((sum, p) => sum + p, 0);
  const anySingleParameterIs3 = [
    input.respiratoryRate != null ? scoreRespiratoryRate(input.respiratoryRate) : 0,
    input.spo2 != null ? scoreSpo2(input.spo2) : 0,
    input.systolic != null ? scoreSystolic(input.systolic) : 0,
    input.heartRate != null ? scoreHeartRate(input.heartRate) : 0,
    input.temperature != null ? scoreTemperature(input.temperature) : 0,
    consciousnessScore,
  ].some((s) => s === 3);

  let risk: News2Result["risk"] = "low";
  let recommendation = "Routine monitoring — continue as per ward protocol.";

  if (score >= 7) {
    risk = "high";
    recommendation = "Urgent clinical review required — consider continuous monitoring / critical care input.";
  } else if (score >= 5 || anySingleParameterIs3) {
    risk = "medium";
    recommendation = "Urgent review by ward doctor — increase monitoring frequency.";
  } else if (score >= 1) {
    risk = "low";
    recommendation = "Increase monitoring frequency; reassess per protocol.";
  }

  return { score, risk, recommendation, scored };
}
