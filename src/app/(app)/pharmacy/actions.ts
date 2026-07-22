"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type PharmacyState = { error?: string };

const dispenseSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  drug: z.string().min(1, "Drug name is required"),
  dose: z.string().min(1, "Dose is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  prescribedBy: z.string(),
  notes: z.string(),
});

export async function createDispensation(
  _prev: PharmacyState,
  formData: FormData,
): Promise<PharmacyState> {
  const session = await requireSession();
  authorize(session, "pharmacy:dispense");

  const parsed = dispenseSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const dispensation = await prisma.dispensation.create({
    data: {
      patientId: data.patientId,
      pharmacistId: session.id,
      drug: data.drug,
      dose: data.dose,
      quantity: data.quantity,
      prescribedBy: data.prescribedBy || null,
      notes: data.notes || null,
      status: "dispensed",
    },
  });

  await audit(session, "pharmacy.dispense", "dispensation", dispensation.id, {
    patientId: data.patientId,
    drug: data.drug,
  });

  // Best-effort stock decrement — case-insensitive match against tracked
  // inventory (src/lib/services/inventory.ts). A miss doesn't block dispensing;
  // not every dispensed drug is necessarily under formal stock tracking yet.
  const allStock = await prisma.drugStock.findMany();
  const matchingStock = allStock.find(
    (s) => s.drugName.trim().toLowerCase() === data.drug.trim().toLowerCase(),
  );
  if (matchingStock) {
    await prisma.drugStock.update({
      where: { id: matchingStock.id },
      data: { quantityOnHand: Math.max(0, matchingStock.quantityOnHand - data.quantity) },
    });
  }

  revalidatePath("/pharmacy");
  revalidatePath("/inventory");
  return {};
}

export async function rejectDispensation(formData: FormData) {
  const session = await requireSession();
  authorize(session, "pharmacy:dispense");

  const id = String(formData.get("dispensationId") ?? "");
  const reason = String(formData.get("rejectReason") ?? "");
  if (!id) return;

  await prisma.dispensation.update({
    where: { id },
    data: { status: "rejected", rejectReason: reason || "Not specified" },
  });

  await audit(session, "pharmacy.reject", "dispensation", id, { reason });
  revalidatePath("/pharmacy");
}
