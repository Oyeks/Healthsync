"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { LAB_PANELS, interpretPanel } from "@/lib/services/labs";

export type LabState = { error?: string };

const panelNames = LAB_PANELS.map((p) => p.panel) as [string, ...string[]];

const resultSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  panel: z.enum(panelNames),
});

export async function createLabResult(
  _prev: LabState,
  formData: FormData,
): Promise<LabState> {
  const session = await requireSession();
  authorize(session, "lab:write");

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { patientId, panel } = parsed.data;

  const definition = LAB_PANELS.find((p) => p.panel === panel);
  if (!definition) return { error: "Unknown lab panel" };

  const values: Record<string, number> = {};
  for (const analyte of definition.analytes) {
    const raw = formData.get(`value_${analyte.name}`);
    if (raw != null && raw !== "") {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        return { error: `Invalid value for ${analyte.name}` };
      }
      values[analyte.name] = num;
    }
  }

  if (Object.keys(values).length === 0) {
    return { error: "Enter at least one result value" };
  }

  const { analytes, summary } = interpretPanel(panel, values);

  const result = await prisma.labResult.create({
    data: {
      patientId,
      orderedById: session.id,
      panel,
      results: JSON.stringify(analytes),
      summary,
      status: "reviewed",
    },
  });

  await audit(session, "lab.create", "lab_result", result.id, {
    patientId,
    panel,
  });

  revalidatePath("/laboratory");
  revalidatePath(`/patients/${patientId}`);
  return {};
}
