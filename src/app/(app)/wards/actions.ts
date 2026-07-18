"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type WardState = { error?: string };

const admitSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  bedId: z.string().min(1, "Select a bed"),
  reason: z.string(),
});

export async function admitPatient(
  _prev: WardState,
  formData: FormData,
): Promise<WardState> {
  const session = await requireSession();
  authorize(session, "admission:write");

  const parsed = admitSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { patientId, bedId, reason } = parsed.data;

  // Admission, bed status and patient status must move together.
  try {
    await prisma.$transaction(async (tx) => {
      const bed = await tx.bed.findUnique({ where: { id: bedId } });
      if (!bed || bed.status !== "available") {
        throw new Error("That bed is no longer available");
      }

      const existing = await tx.admission.findFirst({
        where: { patientId, status: "active" },
      });
      if (existing) throw new Error("Patient already has an active admission");

      await tx.admission.create({
        data: { patientId, bedId, reason: reason || null, status: "active" },
      });
      await tx.bed.update({
        where: { id: bedId },
        data: { status: "occupied" },
      });
      await tx.patient.update({
        where: { id: patientId },
        data: { status: "admitted" },
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Admission failed",
    };
  }

  await audit(session, "admission.create", "admission", undefined, {
    patientId,
    bedId,
  });

  revalidatePath("/wards");
  revalidatePath(`/patients/${patientId}`);
  return {};
}

export async function dischargePatient(formData: FormData) {
  const session = await requireSession();
  authorize(session, "admission:write");

  const admissionId = String(formData.get("admissionId") ?? "");
  if (!admissionId) return;

  const admission = await prisma.$transaction(async (tx) => {
    const record = await tx.admission.update({
      where: { id: admissionId },
      data: { status: "discharged", dischargedAt: new Date() },
    });
    await tx.bed.update({
      where: { id: record.bedId },
      data: { status: "available" },
    });
    await tx.patient.update({
      where: { id: record.patientId },
      data: { status: "discharged" },
    });
    return record;
  });

  await audit(session, "admission.discharge", "admission", admissionId, {
    patientId: admission.patientId,
  });

  revalidatePath("/wards");
  revalidatePath(`/patients/${admission.patientId}`);
}
