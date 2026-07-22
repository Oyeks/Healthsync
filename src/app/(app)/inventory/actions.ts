"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { authorize } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type InventoryState = { error?: string };

const stockSchema = z.object({
  drugName: z.string().min(1, "Drug name is required"),
  unit: z.string().min(1, "Unit is required"),
  quantityOnHand: z.coerce.number().int().min(0),
  reorderThreshold: z.coerce.number().int().min(0),
  unitCost: z.string(),
  expiryDate: z.string(),
});

export async function createStock(
  _prev: InventoryState,
  formData: FormData,
): Promise<InventoryState> {
  const session = await requireSession();
  authorize(session, "inventory:write");

  const parsed = stockSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await prisma.drugStock.findUnique({
    where: { drugName: data.drugName },
  });
  if (existing) {
    return {
      error: `${data.drugName} is already tracked — use "Receive shipment" to add stock`,
    };
  }

  const stock = await prisma.drugStock.create({
    data: {
      drugName: data.drugName,
      unit: data.unit,
      quantityOnHand: data.quantityOnHand,
      reorderThreshold: data.reorderThreshold,
      unitCost: data.unitCost ? Number(data.unitCost) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
    },
  });

  await audit(session, "inventory.create", "drug_stock", stock.id, {
    drugName: data.drugName,
  });

  revalidatePath("/inventory");
  return {};
}

const receiveSchema = z.object({
  stockId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero"),
  expiryDate: z.string(),
});

export async function receiveShipment(
  _prev: InventoryState,
  formData: FormData,
): Promise<InventoryState> {
  const session = await requireSession();
  authorize(session, "inventory:write");

  const parsed = receiveSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { stockId, quantity, expiryDate } = parsed.data;

  const stock = await prisma.drugStock.findUnique({ where: { id: stockId } });
  if (!stock) return { error: "Stock item not found" };

  await prisma.drugStock.update({
    where: { id: stockId },
    data: {
      quantityOnHand: stock.quantityOnHand + quantity,
      ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
    },
  });

  await audit(session, "inventory.receive", "drug_stock", stockId, { quantity });

  revalidatePath("/inventory");
  return {};
}
