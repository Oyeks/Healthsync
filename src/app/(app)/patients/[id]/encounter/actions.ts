"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize, can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { screenPrescriptions } from "@/lib/services/cds";
import type { Prescription } from "@/lib/format";

const encounterSchema = z.object({
  patientId: z.string().min(1),
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string().min(1, "An assessment is required"),
  plan: z.string(),
  diagnoses: z.string(),
  prescriptions: z.string(),
  sign: z.string().optional(),
  overrideAcknowledged: z.string().optional(),
});

export type EncounterState = { error?: string };

/** Parses "I10 | Essential hypertension" lines into ICD-10 entries. */
function parseDiagnoses(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, ...rest] = line.split("|").map((part) => part.trim());
      return {
        code,
        system: "ICD-10",
        description: rest.join(" | ") || code,
      };
    });
}

/** Parses "Amoxicillin | 500mg | TDS | 7 days" lines into prescriptions. */
function parsePrescriptions(input: string): Prescription[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [drug, dose, frequency, duration] = line
        .split("|")
        .map((part) => part.trim());
      return {
        drug: drug ?? "",
        dose: dose ?? "",
        frequency: frequency ?? "",
        duration: duration ?? "",
      };
    });
}

export async function createEncounter(
  _prev: EncounterState,
  formData: FormData,
): Promise<EncounterState> {
  const session = await requireSession();
  authorize(session, "record:write");

  const parsed = encounterSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
    select: { id: true, allergies: true },
  });
  if (!patient) return { error: "Patient not found" };

  const prescriptions = parsePrescriptions(data.prescriptions);

  // Only doctors may prescribe — the spec's key RBAC distinction.
  if (prescriptions.length > 0 && !can(session.role, "prescribe")) {
    return {
      error: `Role "${session.role}" is not permitted to prescribe medication`,
    };
  }

  // Server-side safety screen. The client shows these alerts live, but the
  // check is re-run here so a crafted POST cannot bypass it.
  const alerts = screenPrescriptions(prescriptions, patient.allergies);
  const critical = alerts.filter((a) => a.severity === "critical");
  if (critical.length > 0 && data.overrideAcknowledged !== "yes") {
    return {
      error: `Blocked by clinical decision support: ${critical[0].title}. ${critical[0].detail} Tick the override box to proceed with a documented clinical justification.`,
    };
  }

  const willSign = data.sign === "yes";

  const record = await prisma.medicalRecord.create({
    data: {
      patientId: data.patientId,
      doctorId: session.id,
      subjective: data.subjective || null,
      objective: data.objective || null,
      assessment: data.assessment,
      plan: data.plan || null,
      diagnoses: JSON.stringify(parseDiagnoses(data.diagnoses)),
      prescriptions: JSON.stringify(prescriptions),
      signedAt: willSign ? new Date() : null,
      signedBy: willSign ? session.fullName : null,
    },
  });

  await audit(session, "record.create", "medical_record", record.id, {
    patientId: data.patientId,
    prescriptionCount: prescriptions.length,
    overrodeAlerts: critical.length > 0,
  });

  if (willSign) {
    await audit(session, "record.sign", "medical_record", record.id);
  }

  revalidatePath(`/patients/${data.patientId}`);
  redirect(`/patients/${data.patientId}`);
}
