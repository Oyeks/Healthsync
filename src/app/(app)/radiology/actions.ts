"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { IMAGING_MODALITIES } from "@/lib/enums";

export type RadiologyState = { error?: string };

const orderSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  modality: z.enum(IMAGING_MODALITIES),
  bodyPart: z.string().min(1, "Body part is required"),
  clinicalInfo: z.string(),
  priority: z.enum(["routine", "urgent", "stat"]),
});

export async function createImagingOrder(
  _prev: RadiologyState,
  formData: FormData,
): Promise<RadiologyState> {
  const session = await requireSession();
  authorize(session, "imaging:write");

  const parsed = orderSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const order = await prisma.imagingOrder.create({
    data: {
      patientId: data.patientId,
      requestedById: session.id,
      modality: data.modality,
      bodyPart: data.bodyPart,
      clinicalInfo: data.clinicalInfo || null,
      priority: data.priority,
      status: "requested",
    },
  });

  await audit(session, "imaging.order", "imaging_order", order.id, {
    patientId: data.patientId,
    modality: data.modality,
  });

  revalidatePath("/radiology");
  return {};
}

const reportSchema = z.object({
  orderId: z.string().min(1),
  findings: z.string().min(1, "Findings are required"),
  impression: z.string().min(1, "Impression is required"),
});

export async function reportImagingOrder(
  _prev: RadiologyState,
  formData: FormData,
): Promise<RadiologyState> {
  const session = await requireSession();
  authorize(session, "imaging:report");

  const parsed = reportSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  await prisma.imagingOrder.update({
    where: { id: data.orderId },
    data: {
      radiologistId: session.id,
      findings: data.findings,
      impression: data.impression,
      status: "completed",
      completedAt: new Date(),
    },
  });

  await audit(session, "imaging.report", "imaging_order", data.orderId);

  revalidatePath("/radiology");
  return {};
}
