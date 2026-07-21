/**
 * Laboratory result interpretation — deterministic reference-range flagging,
 * not a diagnosis. Every value is compared against adult reference ranges and
 * flagged low/high/critical; a short summary is generated from the pattern of
 * flags. The clinician reviews and acts on it (AI recommendation doc §5).
 *
 * Reference ranges are illustrative adult values for demonstration. A
 * production deployment must source ranges from the reporting laboratory,
 * since they vary by analyser, age, sex and pregnancy status.
 */

export type LabFlag = "low" | "normal" | "high" | "critical";

export type LabAnalyte = {
  name: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  flag: LabFlag;
};

export type LabPanelDefinition = {
  panel: string;
  analytes: {
    name: string;
    unit: string;
    refLow: number;
    refHigh: number;
    criticalLow?: number;
    criticalHigh?: number;
  }[];
};

export const LAB_PANELS: LabPanelDefinition[] = [
  {
    panel: "Full Blood Count",
    analytes: [
      { name: "Haemoglobin", unit: "g/dL", refLow: 12, refHigh: 16, criticalLow: 7 },
      { name: "White Cell Count", unit: "x10⁹/L", refLow: 4, refHigh: 11, criticalHigh: 30 },
      { name: "Platelets", unit: "x10⁹/L", refLow: 150, refHigh: 400, criticalLow: 20 },
    ],
  },
  {
    panel: "Urea & Electrolytes",
    analytes: [
      { name: "Sodium", unit: "mmol/L", refLow: 135, refHigh: 145, criticalLow: 120, criticalHigh: 160 },
      { name: "Potassium", unit: "mmol/L", refLow: 3.5, refHigh: 5.1, criticalLow: 2.5, criticalHigh: 6.5 },
      { name: "Urea", unit: "mmol/L", refLow: 2.5, refHigh: 7.8 },
      { name: "Creatinine", unit: "µmol/L", refLow: 60, refHigh: 110, criticalHigh: 400 },
      { name: "eGFR", unit: "mL/min/1.73m²", refLow: 90, refHigh: 999, criticalLow: 15 },
    ],
  },
  {
    panel: "Liver Function Tests",
    analytes: [
      { name: "ALT", unit: "U/L", refLow: 7, refHigh: 56, criticalHigh: 500 },
      { name: "AST", unit: "U/L", refLow: 10, refHigh: 40, criticalHigh: 500 },
      { name: "Bilirubin", unit: "µmol/L", refLow: 3, refHigh: 21, criticalHigh: 100 },
      { name: "Albumin", unit: "g/L", refLow: 35, refHigh: 50 },
    ],
  },
  {
    panel: "Lipid Profile",
    analytes: [
      { name: "Total Cholesterol", unit: "mmol/L", refLow: 0, refHigh: 5.2 },
      { name: "LDL", unit: "mmol/L", refLow: 0, refHigh: 3.4 },
      { name: "HDL", unit: "mmol/L", refLow: 1.0, refHigh: 999 },
      { name: "Triglycerides", unit: "mmol/L", refLow: 0, refHigh: 1.7 },
    ],
  },
  {
    panel: "HbA1c",
    analytes: [{ name: "HbA1c", unit: "%", refLow: 4, refHigh: 5.6, criticalHigh: 11 }],
  },
  {
    panel: "Thyroid Function",
    analytes: [
      { name: "TSH", unit: "mIU/L", refLow: 0.4, refHigh: 4.0 },
      { name: "Free T4", unit: "pmol/L", refLow: 9, refHigh: 25 },
    ],
  },
];

function flagFor(
  value: number,
  def: { refLow: number; refHigh: number; criticalLow?: number; criticalHigh?: number },
): LabFlag {
  if (def.criticalLow != null && value <= def.criticalLow) return "critical";
  if (def.criticalHigh != null && value >= def.criticalHigh) return "critical";
  if (value < def.refLow) return "low";
  if (value > def.refHigh) return "high";
  return "normal";
}

export function interpretPanel(
  panel: string,
  values: Record<string, number>,
): { analytes: LabAnalyte[]; summary: string } {
  const definition = LAB_PANELS.find((p) => p.panel === panel);
  if (!definition) return { analytes: [], summary: "Unknown panel." };

  const analytes: LabAnalyte[] = definition.analytes
    .filter((a) => values[a.name] != null && !Number.isNaN(values[a.name]))
    .map((a) => ({
      name: a.name,
      value: values[a.name],
      unit: a.unit,
      refLow: a.refLow,
      refHigh: a.refHigh,
      flag: flagFor(values[a.name], a),
    }));

  return { analytes, summary: summarise(panel, analytes) };
}

/** Generates a short, deterministic clinical-pattern summary from flagged analytes. */
function summarise(panel: string, analytes: LabAnalyte[]): string {
  const critical = analytes.filter((a) => a.flag === "critical");
  const abnormal = analytes.filter((a) => a.flag !== "normal");

  if (abnormal.length === 0) {
    return "All values within reference range.";
  }

  const notes: string[] = [];

  if (panel === "HbA1c") {
    const hba1c = analytes.find((a) => a.name === "HbA1c");
    if (hba1c) {
      if (hba1c.value >= 8) notes.push("Poor diabetic control.");
      else if (hba1c.value >= 6.5) notes.push("Consistent with diabetes mellitus; suboptimal control.");
      else if (hba1c.value >= 5.7) notes.push("Prediabetic range.");
    }
  }

  if (panel === "Urea & Electrolytes") {
    const egfr = analytes.find((a) => a.name === "eGFR");
    const potassium = analytes.find((a) => a.name === "Potassium");
    const creatinine = analytes.find((a) => a.name === "Creatinine");
    if (egfr && egfr.value < 30) notes.push("Severe renal impairment (CKD stage 4-5 range).");
    else if (egfr && egfr.value < 60) notes.push("Moderate renal impairment — review nephrotoxic and renally-cleared drug doses.");
    if (potassium && potassium.flag !== "normal") {
      notes.push(potassium.value > 5.1 ? "Hyperkalaemia." : "Hypokalaemia.");
    }
    if (creatinine && creatinine.flag === "critical") notes.push("Markedly elevated creatinine — consider acute kidney injury.");
  }

  if (panel === "Liver Function Tests") {
    const alt = analytes.find((a) => a.name === "ALT");
    const ast = analytes.find((a) => a.name === "AST");
    const bilirubin = analytes.find((a) => a.name === "Bilirubin");
    if ((alt && alt.flag !== "normal") || (ast && ast.flag !== "normal")) {
      notes.push("Pattern consistent with hepatocellular injury.");
    }
    if (bilirubin && bilirubin.flag === "high") notes.push("Hyperbilirubinaemia — consider hepatobiliary cause.");
  }

  if (panel === "Lipid Profile") {
    const ldl = analytes.find((a) => a.name === "LDL");
    if (ldl && ldl.flag === "high") notes.push("Elevated LDL — cardiovascular risk factor.");
  }

  if (panel === "Full Blood Count") {
    const hb = analytes.find((a) => a.name === "Haemoglobin");
    const wbc = analytes.find((a) => a.name === "White Cell Count");
    const plt = analytes.find((a) => a.name === "Platelets");
    if (hb && hb.flag === "low") notes.push("Anaemia.");
    if (wbc && wbc.flag === "high") notes.push("Leukocytosis — consider infection or inflammation.");
    if (plt && plt.flag === "low") notes.push("Thrombocytopenia.");
  }

  if (critical.length > 0) {
    notes.unshift(
      `Critical value${critical.length > 1 ? "s" : ""}: ${critical.map((a) => a.name).join(", ")}.`,
    );
  }

  return notes.length > 0
    ? notes.join(" ")
    : `${abnormal.length} value${abnormal.length > 1 ? "s" : ""} outside reference range.`;
}
