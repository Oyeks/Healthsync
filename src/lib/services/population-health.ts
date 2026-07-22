import { parseJson, type Diagnosis } from "../format";

/**
 * Population health surveillance (AI recommendation doc §23). Aggregates
 * diagnosis codes recorded across the current period against the prior
 * period of equal length, surfacing which conditions are trending up —
 * the kind of signal that matters for outbreak-style diseases (malaria,
 * cholera, TB, Lassa fever) as well as chronic-disease load.
 */

export type DiagnosisTrend = {
  code: string;
  description: string;
  currentCount: number;
  priorCount: number;
  direction: "up" | "down" | "flat" | "new";
};

export function computeDiagnosisTrends(
  currentPeriodRecords: { diagnoses: string | null }[],
  priorPeriodRecords: { diagnoses: string | null }[],
  limit = 8,
): DiagnosisTrend[] {
  const current = countDiagnoses(currentPeriodRecords);
  const prior = countDiagnoses(priorPeriodRecords);

  const trends: DiagnosisTrend[] = [];
  for (const [code, entry] of current) {
    const priorCount = prior.get(code)?.count ?? 0;
    let direction: DiagnosisTrend["direction"] = "flat";
    if (priorCount === 0) direction = "new";
    else if (entry.count > priorCount) direction = "up";
    else if (entry.count < priorCount) direction = "down";

    trends.push({
      code,
      description: entry.description,
      currentCount: entry.count,
      priorCount,
      direction,
    });
  }

  trends.sort((a, b) => b.currentCount - a.currentCount);
  return trends.slice(0, limit);
}

function countDiagnoses(records: { diagnoses: string | null }[]) {
  const counts = new Map<string, { description: string; count: number }>();
  for (const record of records) {
    const diagnoses = parseJson<Diagnosis[]>(record.diagnoses, []);
    for (const d of diagnoses) {
      if (!d.code) continue;
      const entry = counts.get(d.code) ?? { description: d.description || d.code, count: 0 };
      entry.count++;
      counts.set(d.code, entry);
    }
  }
  return counts;
}
